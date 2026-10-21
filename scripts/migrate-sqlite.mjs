#!/usr/bin/env node
// scripts/migrate-sqlite.mjs — применить drizzle-миграции sqlite
// (server/db/migrations/sqlite) к локальному файлу БД.
//
// drizzle-kit не умеет push/migrate в sqlite-proxy, поэтому раскатываем
// сгенерированные *.sql вручную через встроенный node:sqlite.
// Применённые теги храним в __kt_migrations (идемпотентно).
//
//   node scripts/migrate-sqlite.mjs [--db=./data/panel.sqlite] [--dir=./server/db/migrations/sqlite]
//   npm run db:migrate
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { resolveSqlitePath } from './lib/panel-env.mjs'

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const argv = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const i = a.indexOf('=')
    return i === -1 ? [a.slice(2), 'true'] : [a.slice(2, i), a.slice(i + 1)]
  }),
)

// Путь к базе: --db, затем SQLITE_PATH из окружения, затем из
// /etc/cardinal-panel/panel.env. Раньше скрипт писал в ./data/panel.sqlite,
// а панель читает /var/lib/cardinal-panel/panel.sqlite — миграции applied
// оказывались не в той базе.
const dbPath = resolveSqlitePath(argv.db)
const dir = path.resolve(root, argv.dir || './server/db/migrations/sqlite')

const journalPath = path.join(dir, 'meta', '_journal.json')
if (!fs.existsSync(journalPath)) {
  console.error(`no migrations in ${dir} — run "npm run db:generate" first`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
const db = new DatabaseSync(dbPath)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec(`CREATE TABLE IF NOT EXISTS __kt_migrations (
  tag TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch())
)`)

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
const applied = new Set(db.prepare('SELECT tag FROM __kt_migrations').all().map((r) => r.tag))

let n = 0
for (const entry of journal.entries || []) {
  if (applied.has(entry.tag)) {
    console.log(`- skip ${entry.tag}`)
    continue
  }
  const file = path.join(dir, `${entry.tag}.sql`)
  if (!fs.existsSync(file)) {
    console.error(`missing migration file: ${file}`)
    process.exit(1)
  }
  const statements = fs
    .readFileSync(file, 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)
  db.exec('BEGIN')
  try {
    for (const stmt of statements) db.exec(stmt)
    db.prepare('INSERT INTO __kt_migrations (tag) VALUES (?)').run(entry.tag)
    db.exec('COMMIT')
  } catch (e) {
    try { db.exec('ROLLBACK') } catch {}
    console.error(`failed ${entry.tag}: ${e.message}`)
    process.exit(1)
  }
  console.log(`+ applied ${entry.tag}`)
  n++
}

console.log(`done: ${n} applied → ${dbPath}`)
db.close()
