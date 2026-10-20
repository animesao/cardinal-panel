// @ts-nocheck
// server/utils/databases.ts — провижининг баз игровых серверов.
//
// Поддерживается MySQL/MariaDB (протокол один). PostgreSQL: контейнер
// создать можно, но провижининг отдельных БД требует pg-драйвер,
// которого нет в зависимостях, — такой хост честно отвечает 501.
//
// Имена/пользователи/пароли всегда случайные:
//   БД s<serverId>_<rand6>, пользователь u_<rand12>, пароль 24 символа.
import mysql from 'mysql2/promise'
import crypto from 'node:crypto'
import { isPrivateHost } from './wings'

const ident = (s: string) => String(s).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48)

export async function hostConnection(host: any) {
  return await mysql.createConnection({
    host: host.host,
    port: host.port || 3306,
    user: host.username,
    password: host.password,
    connectTimeout: 8000,
  })
}

// assertDbHost — SSRF-барьер для проверки хоста БД.
//
// Тест соединения открывает TCP на произвольный host:port из тела запроса.
// Без проверки это сканер внутренней сети (и путь к 169.254.169.254).
// Хосты БД по умолчанию живут рядом с панелью, но администратор может
// указать и внешний — поэтому блокируем только заведомо внутренние адреса
// и оставляем явный флаг для осознанного исключения.
export function assertDbHost(host: any, opts: { allowPrivate?: boolean } = {}) {
  const h = String(host?.host || '').trim()
  if (!h) throw createError({ statusCode: 400, message: 'Хост БД: пусто' })
  if (opts.allowPrivate) return
  if (isPrivateHost(h)) {
    throw createError({ statusCode: 400, message: 'Хост БД: внутренний адрес запрещён' })
  }
}

// testMysqlConnection — быстрая проверка связи (connect + ping) без
// создания чего-либо. Используется кнопкой «Проверить» в форме хоста
// и при сохранении external-хоста.
export async function testMysqlConnection(host: any) {
  const conn = await hostConnection(host)
  try {
    await conn.ping()
  } finally {
    await conn.end().catch(() => {})
  }
  return true
}

export async function provisionDatabase(host: any, serverId: number) {
  if (host.type && host.type !== 'mysql') {
    throw createError({ statusCode: 501, message: 'Провижининг PostgreSQL пока не поддерживается (нет pg-драйвера)' })
  }
  const dbName = ident(`s${serverId}_${crypto.randomBytes(3).toString('hex')}`)
  const username = ident(`u_${crypto.randomBytes(6).toString('hex')}`)
  const password = crypto.randomBytes(18).toString('base64url')

  const conn = await hostConnection(host)
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await conn.query(`CREATE USER IF NOT EXISTS '${username}'@'%' IDENTIFIED BY ?`, [password])
    await conn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${username}'@'%'`)
    await conn.query('FLUSH PRIVILEGES')
  } finally {
    await conn.end().catch(() => {})
  }
  return { dbName, username, password }
}

// waitForMysql — ждём готовности MySQL (нужно после поднятия контейнера:
// первый старт тянет образ и инициализирует data dir). Бросает последнюю
// ошибку по истечении timeoutMs.
export async function waitForMysql(host: any, timeoutMs = 120000, stepMs = 3000) {
  const deadline = Date.now() + timeoutMs
  let lastErr = null
  while (Date.now() < deadline) {
    try {
      const conn = await hostConnection(host)
      try {
        await conn.ping()
      } finally {
        await conn.end().catch(() => {})
      }
      return true
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, stepMs))
    }
  }
  throw new Error(`MySQL ${host.host}:${host.port || 3306} не поднялся: ${lastErr?.message || lastErr}`)
}

// verifyDatabaseUser — контрольное подключение НОВЫМИ реквизитами:
// доказывает, что выданные серверу данные реально работают
// (пользователь создан, пароль верный, права на базу есть).
export async function verifyDatabaseUser(host: any, creds: { dbName: string; username: string; password: string }) {
  const conn = await mysql.createConnection({
    host: host.host,
    port: host.port || 3306,
    user: creds.username,
    password: creds.password,
    database: creds.dbName,
    connectTimeout: 8000,
  })
  try {
    await conn.query('SELECT 1')
  } finally {
    await conn.end().catch(() => {})
  }
}

// rotateDatabasePassword — смена пароля существующего пользователя:
// сначала хост, затем verify новым паролем. БД при ошибке не трогаем.
export async function rotateDatabasePassword(host: any, username: string) {
  if (host.type && host.type !== 'mysql') {
    throw createError({ statusCode: 501, message: 'Провижининг PostgreSQL пока не поддерживается (нет pg-драйвера)' })
  }
  const password = crypto.randomBytes(18).toString('base64url')
  const conn = await hostConnection(host)
  try {
    await conn.query(`ALTER USER IF EXISTS '${ident(username)}'@'%' IDENTIFIED BY ?`, [password])
    await conn.query('FLUSH PRIVILEGES')
  } finally {
    await conn.end().catch(() => {})
  }
  return password
}

export async function dropProvisionedDatabase(host: any, dbName: string, username: string) {  const conn = await hostConnection(host)
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${ident(dbName)}\``)
    await conn.query(`DROP USER IF EXISTS '${ident(username)}'@'%'`)
    await conn.query('FLUSH PRIVILEGES')
  } finally {
    await conn.end().catch(() => {})
  }
}
