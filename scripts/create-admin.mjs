#!/usr/bin/env node
// scripts/create-admin.mjs — создать (или повысить) администратора панели.
//
// Зачем: раньше админ появлялся сам — при пустой таблице users первый
// вошедший через OAuth получал role=admin. Пустая таблица — это дефолт
// после `npm run db:migrate`, поэтому любой, кто первым дошёл до панели,
// становился админом без аутентификации.
//
//   node scripts/create-admin.mjs --email=admin@example.com --password=...
//   npm run create-admin -- --email=admin@example.com --password=...
//
// Если аккаунт с таким e-mail уже есть — он повышается до админа и получает
// заданный пароль. Если пароль не передан, он генерируется и печатается
// один раз.
//
// Работает с обеими диалектами: SQLite (node:sqlite) и MySQL (mysql2).
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

// --- параметры -------------------------------------------------------------
const email = String(argv.email || '').trim().toLowerCase()
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('usage: node scripts/create-admin.mjs --email=<email> [--password=<pw>] [--name=<name>]')
  process.exit(2)
}
let password = String(argv.password || '')
const generated = !password
if (generated) {
  password = crypto.randomBytes(12).toString('base64url')
}
if (password.length < 8 || password.length > 128) {
  console.error('пароль: минимум 8, максимум 128 символов')
  process.exit(2)
}
const name = String(argv.name || '').trim() || email.split('@')[0]

// --- хэш пароля (тот же формат, что в server/utils/password.ts) ------------
const N = 16384, R = 8, P = 1, KEYLEN = 64
const salt = crypto.randomBytes(16).toString('base64url')
const hash = crypto.scryptSync(password, salt, KEYLEN, { N, R, p: P }).toString('base64url')
const passwordHash = `scrypt$${N}$${R}$${P}$${salt}$${hash}`

const uuid = crypto.randomUUID()
const now = Math.floor(Date.now() / 1000)

const dialect = String(process.env.DB_DIALECT || 'sqlite').toLowerCase()

async function runSqlite() {
  const { DatabaseSync } = await import('node:sqlite')
  const dbPath = path.resolve(root, String(process.env.SQLITE_PATH || './data/panel.sqlite'))
  if (!fs.existsSync(dbPath)) {
    console.error(`база не найдена: ${dbPath} — сначала выполните "npm run db:migrate"`)
    process.exit(1)
  }
  const db = new DatabaseSync(dbPath)
  const found = db.prepare('SELECT id, role FROM users WHERE lower(email) = ?').all(email)
  if (found.length) {
    db.prepare('UPDATE users SET role = ?, password_hash = ?, updated_at = ? WHERE id = ?')
      .run('admin', passwordHash, now, found[0].id)
    console.log(`пользователь ${email} повышен до admin (id=${found[0].id}, было ${found[0].role})`)
  } else {
    db.prepare(`INSERT INTO users
      (uuid, email, name, avatar, provider, provider_id, role, password_hash, locale, created_at, last_login, updated_at)
      VALUES (?, ?, ?, NULL, 'credentials', ?, 'admin', ?, 'en', ?, ?, ?)`)
      .run(uuid, email, name, uuid, passwordHash, now, now, now)
    console.log(`создан администратор ${email}`)
  }
  db.close()
}

async function runMysql() {
  const mysql = (await import('mysql2/promise')).default
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
  })
  const [found] = await conn.execute('SELECT id, role FROM users WHERE LOWER(email) = ?', [email])
  if (found.length) {
    await conn.execute('UPDATE users SET role = ?, password_hash = ?, updated_at = ? WHERE id = ?',
      ['admin', passwordHash, new Date(), found[0].id])
    console.log(`пользователь ${email} повышен до admin (id=${found[0].id}, было ${found[0].role})`)
  } else {
    await conn.execute(
      `INSERT INTO users
        (uuid, email, name, avatar, provider, provider_id, role, password_hash, locale, created_at, last_login, updated_at)
        VALUES (?, ?, ?, NULL, 'credentials', ?, 'admin', ?, 'en', NOW(), NOW(), NOW())`,
      [uuid, email, name, uuid, passwordHash])
    console.log(`создан администратор ${email}`)
  }
  await conn.end()
}

if (dialect === 'mysql') await runMysql()
else await runSqlite()

console.log('')
console.log('  email:   ' + email)
console.log('  пароль:  ' + password + (generated ? '  (сгенерирован, сохраните)' : ''))
console.log('')
