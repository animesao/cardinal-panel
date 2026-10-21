#!/usr/bin/env node
// scripts/admin-api-key.mjs — выпуск и отзыв API-ключа администратора.
//
// Зачем: установщику нужно завести узел (wings) через НАСТОЯЩИЙ API панели
// (POST /api/admin/nodes), а не правкой базы. Роут требует админскую
// сессию; логин через OAuth/NextAuth из bash ненадёжен. Поэтому ключ
// выпускается напрямую в БД (тем же приёмом, что и create-admin.mjs),
// используется один раз и сразу отзывается.
//
//   node scripts/admin-api-key.mjs --email=admin@example.com --name=installer --scopes=nodes:2
//   node scripts/admin-api-key.mjs --revoke=cp_xxxxxxxx
//
// Ключ показывается ОДИН раз: в БД лежит только SHA-256 хэш.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

const argv = {}
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue
  const i = a.indexOf('=')
  if (i === -1) argv[a.slice(2)] = 'true'
  else argv[a.slice(2, i)] = a.slice(i + 1)
}

const dialect = String(process.env.DB_DIALECT || 'sqlite').toLowerCase()
const sqlitePath = path.resolve(root, String(process.env.SQLITE_PATH || './data/panel.sqlite'))

function hashApiToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Уровни доступа: "nodes:2,users:1" → {nodes:2, users:1} */
function parseScopes(raw) {
  const levels = {}
  for (const part of String(raw || '').split(',')) {
    const [resource, level] = part.split(':').map((s) => s.trim())
    if (!resource) continue
    levels[resource] = Number(level) || 1
  }
  return levels
}

async function runSqlite() {
  const { DatabaseSync } = await import('node:sqlite')
  if (!fs.existsSync(sqlitePath)) {
    console.error(`база не найдена: ${sqlitePath}`)
    process.exit(1)
  }
  const db = new DatabaseSync(sqlitePath)
  try {
    if (argv.revoke) {
      const info = db.prepare('DELETE FROM api_keys WHERE prefix = ?').run(String(argv.revoke))
      console.log(info.changes ? `ключ ${argv.revoke} отозван` : `ключ ${argv.revoke} не найден`)
      return
    }
    const email = String(argv.email || '').trim().toLowerCase()
    const user = db
      .prepare('SELECT id, role FROM users WHERE lower(email) = ?')
      .get(email)
    if (!user) {
      console.error(`пользователь ${email} не найден`)
      process.exit(1)
    }
    if (user.role !== 'admin') {
      console.error(`пользователь ${email} не администратор (роль: ${user.role})`)
      process.exit(1)
    }
    const secret = 'cp_' + crypto.randomBytes(24).toString('base64url')
    const prefix = secret.slice(0, 12)
    const levels = parseScopes(argv.scopes || 'nodes:2')
    const now = Math.floor(Date.now() / 1000)
    db.prepare(
      `INSERT INTO api_keys (user_id, name, prefix, token_hash, scopes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(user.id, String(argv.name || 'installer'), prefix, hashApiToken(secret), JSON.stringify(levels), now)
    console.log(`TOKEN=${secret}`)
    console.log(`PREFIX=${prefix}`)
  } finally {
    db.close()
  }
}

async function runMysql() {
  const mysql = (await import('mysql2/promise')).default
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
  })
  try {
    if (argv.revoke) {
      const [res] = await conn.execute('DELETE FROM api_keys WHERE prefix = ?', [String(argv.revoke)])
      console.log(res.affectedRows ? `ключ ${argv.revoke} отозван` : `ключ ${argv.revoke} не найден`)
      return
    }
    const email = String(argv.email || '').trim().toLowerCase()
    const [users] = await conn.execute('SELECT id, role FROM users WHERE LOWER(email) = ?', [email])
    if (!users.length) {
      console.error(`пользователь ${email} не найден`)
      process.exit(1)
    }
    if (users[0].role !== 'admin') {
      console.error(`пользователь ${email} не администратор (роль: ${users[0].role})`)
      process.exit(1)
    }
    const secret = 'cp_' + crypto.randomBytes(24).toString('base64url')
    const prefix = secret.slice(0, 12)
    const levels = parseScopes(argv.scopes || 'nodes:2')
    await conn.execute(
      'INSERT INTO api_keys (user_id, name, prefix, token_hash, scopes, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [users[0].id, String(argv.name || 'installer'), prefix, hashApiToken(secret), JSON.stringify(levels)],
    )
    console.log(`TOKEN=${secret}`)
    console.log(`PREFIX=${prefix}`)
  } finally {
    await conn.end()
  }
}

if (dialect === 'mysql') await runMysql()
else await runSqlite()
