#!/usr/bin/env node
// scripts/check-db-connection.mjs — диагностика доступа к MySQL-хосту.
//
// Зачем не хватает кнопки «Проверить» в панели: она отвечает только
// «доступен / недоступен». Когда провижининг базы для игрового сервера
// не сработал, нужно понимать ГДЕ именно сломалось — сеть, авторизация,
// отсутствие базы или нехватка прав. Скрипт разбирает путь по шагам и
// печатает, на каком именно шаге стоп.
//
// Пароль НЕ стоит передавать аргументом: он останется в истории командной
// строки и в списке процессов. Предпочтительный способ — переменная
// окружения:
//
//   DB_HOST=192.168.0.104 DB_PORT=3306 DB_USER=u_xxx \
//   DB_PASSWORD=... DB_NAME=s15_60e931 node scripts/check-db-connection.mjs
//
// Либо одной строкой через with-env.mjs (тот же приём, что у db:push):
//
//   node scripts/with-env.mjs DB_HOST=... DB_PASSWORD=... -- \
//     node scripts/check-db-connection.mjs
//
// Поддерживается и JDBC-строка из карточки базы:
//   node scripts/check-db-connection.mjs --url 'jdbc:mysql://host:3306/db'
//
// Коды возврата: 0 — всё ок, 1 — ошибка подключения/запроса, 2 — ошибка вызова.

import net from 'node:net'
import mysql from 'mysql2/promise'

const argv = process.argv.slice(2)

const USAGE = `Проверка подключения к MySQL

  node scripts/check-db-connection.mjs [опции]

Опции:
  -h, --host <host>        хост            (env DB_HOST,  по умолчанию 127.0.0.1)
  -p, --port <port>        порт            (env DB_PORT,  по умолчанию 3306)
  -u, --user <user>        пользователь    (env DB_USER)
  -w, --password <pass>    пароль          (env DB_PASSWORD) — небезопасно, см. шапку
  -d, --database <name>    база            (env DB_NAME)
      --url <jdbc|url>     разобрать jdbc:mysql://host:port/db
      --json               машинный вывод в stdout
      --help               эта справка
`

const fail = (msg, code = 2) => {
  console.error(msg)
  process.exit(code)
}

if (argv.includes('--help')) {
  console.log(USAGE)
  process.exit(0)
}

// Разбор аргументов: -h/-p/-u/-w/-d могут идти как `--host 1.2.3.4` и как
// `--host=1.2.3.4`, короткие — только раздельно.
const ALIAS = { h: 'host', p: 'port', u: 'user', w: 'password', d: 'database' }
const opts = {}

const parseJdbc = (raw) => {
  // jdbc:mysql://host:3306/db?a=b  |  mysql://host/db
  const m = String(raw).match(/^(?:jdbc:)?mysql:\/\/(?:[^@/]*@)?([^/:?]+)(?::(\d+))?(?:\/([^?]*))?/i)
  if (!m) return null
  return { host: m[1], port: m[2], database: m[3] }
}

for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (!a.startsWith('-')) fail(`Неожиданный аргумент: ${a}\n\n${USAGE}`)

  let key = a.replace(/^--?/, '')
  let val
  const eq = key.indexOf('=')
  if (eq !== -1) {
    val = key.slice(eq + 1)
    key = key.slice(0, eq)
  }
  key = ALIAS[key] || key

  if (key === 'json') { opts.json = true; continue }
  if (key === 'url') {
    if (val === undefined) val = argv[++i]
    const p = parseJdbc(val)
    if (!p) fail(`Не разобрал строку подключения: ${val}`)
    if (p.host) opts.host = opts.host || p.host
    if (p.port) opts.port = opts.port || p.port
    if (p.database) opts.database = opts.database || p.database
    continue
  }
  if (!['host', 'port', 'user', 'password', 'database'].includes(key)) {
    fail(`Неизвестная опция: ${a}\n\n${USAGE}`)
  }
  if (val === undefined) val = argv[++i]
  if (val === undefined) fail(`Опции ${a} нужно значение`)
  opts[key] = val
}

const passwordFromArgv = opts.password !== undefined
const host = opts.host || process.env.DB_HOST || '127.0.0.1'
const port = Number(opts.port || process.env.DB_PORT || 3306)
const user = opts.user || process.env.DB_USER || ''
const password = opts.password ?? process.env.DB_PASSWORD ?? ''
const database = opts.database || process.env.DB_NAME || ''

if (!user) fail(`Не указан пользователь (-u/--user или env DB_USER)\n\n${USAGE}`)
if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`Некорректный порт: ${opts.port || process.env.DB_PORT}`)
if (passwordFromArgv) {
  console.warn('! Пароль передан аргументом — он виден в списке процессов и в истории командной строки.')
  console.warn('  Для продакшена используйте переменную окружения DB_PASSWORD.\n')
}

const t0 = Date.now()
const steps = []
let failed = false

const step = (name, ok, detail) => {
  steps.push({ name, ok, detail })
  if (!ok) failed = true
  if (!opts.json) {
    const mark = ok ? 'OK  ' : 'FAIL'
    console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const target = `${user}@${host}:${port}${database ? `/${database}` : ''}`
if (!opts.json) {
  console.log(`\nMySQL ${target}\n`)
}

// --- шаг 1: TCP -----------------------------------------------------------------
// Отдельный шаг, потому что «хост недоступен» и «доступен, но пароль неверен» —
// это разные диагнозы, а mysql2 отдаёт их одинаковой ошибкой подключения.
if (!opts.json) console.log('Сеть')
let tcpOk = false
await new Promise((resolve) => {
  const sock = new net.Socket()
  const done = (ok, detail) => { tcpOk = ok; step(`TCP ${host}:${port}`, ok, detail); sock.destroy(); resolve() }
  sock.setTimeout(5000)
  sock.once('connect', () => done(true, 'порт открыт'))
  sock.once('timeout', () => done(false, 'таймаут 5 c — порт не отвечает'))
  sock.once('error', (e) => done(false, `${e.code || e.message} (проверьте сеть/файрвол/туннель до БД)`))
  sock.connect(port, host)
})

if (!tcpOk) {
  if (opts.json) console.log(JSON.stringify({ ok: false, target, steps }, null, 2))
  else console.log('\nИтог: до MySQL не достучались — дальше проверять нечего.\n')
  process.exit(1)
}

// --- шаг 2: аутентификация + handshake ------------------------------------------
if (!opts.json) console.log('\nMySQL')
let conn
try {
  conn = await mysql.createConnection({
    host, port, user, password,
    database: database || undefined,
    connectTimeout: 8000,
  })
  step('аутентификация', true, 'пароль принят')
} catch (e) {
  const code = e?.code || ''
  const hint = {
    ER_ACCESS_DENIED_ERROR: 'доступ запрещён — неверный пароль или пользователь',
    ECONNREFUSED: 'соединение отклонено сервером',
    ETIMEDOUT: 'таймаут на handshake',
    ER_BAD_DB_ERROR: 'база не существует (проверьте имя и --database)',
    PROTOCOL_SEQUENCE_ERROR: 'на этом порту не MySQL',
  }[code] || e.message
  step('аутентификация', false, `${code}: ${hint}`)
  if (opts.json) console.log(JSON.stringify({ ok: false, target, steps }, null, 2))
  else console.log('\nИтог: подключиться не удалось.\n')
  process.exit(1)
}

try {
  await conn.ping()
  step('ping', true)

  const [info] = await conn.query(
    'SELECT VERSION() AS version, CURRENT_USER() AS authUser, CONNECTION_ID() AS connId',
  )
  step('SELECT 1 / идентификация', true,
    `MySQL ${info.version}, authenticated as ${info.authUser}, conn #${info.connId}`)

  if (database) {
    const [rows] = await conn.query('SHOW TABLES')
    const names = rows.map((r) => Object.values(r)[0])
    step(`база «${database}» доступна`, true,
      names.length ? `${names.length} таблиц: ${names.slice(0, 8).join(', ')}${names.length > 8 ? ', …' : ''}`
                   : 'пустая (0 таблиц)')
    const [priv] = await conn.query('SHOW GRANTS FOR CURRENT_USER')
    step('права', true, `${priv.length} grant(s)`)
  } else {
    step('база', true, 'не указана — соединение без выбора базы')
  }
} catch (e) {
  step('запросы', false, `${e?.code || ''}: ${e.message}`.replace(/^:\s*/, ''))
} finally {
  await conn.end().catch(() => {})
}

const ms = Date.now() - t0
if (opts.json) {
  console.log(JSON.stringify({ ok: !failed, target, ms, steps }, null, 2))
} else {
  console.log(`\nИтог: ${failed ? 'проблемы выше' : 'соединение работает'} (${ms} ms)\n`)
}
process.exit(failed ? 1 : 0)