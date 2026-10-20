// @ts-nocheck
// server/db — подключение к БД панели в двух диалектах (см. dialect.ts).
//
//   sqlite (по умолчанию): локальный файл SQLITE_PATH через встроенный
//     node:sqlite + drizzle sqlite-proxy. Никаких внешних сервисов.
//   mysql: серверная MySQL через mysql2 (DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/
//     DB_NAME) — как было раньше.
//
// insertAndGetId — единый способ получить id вставленной строки:
// mysql2 отдаёт OkPacket-массив ([{insertId}]), sqlite-proxy —
// {rows:[{insertId}]} (собирается из last_insert_rowid в колбэке ниже).
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2'
import { drizzle as drizzleProxy } from 'drizzle-orm/sqlite-proxy'
import mysql from 'mysql2/promise'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import * as schema from './schema'
import { IS_SQLITE, SQLITE_PATH } from './dialect'

let dbInstance = null

// sqliteClient — колбэк drizzle sqlite-proxy поверх node:sqlite.
// Контракт (см. drizzle-orm/sqlite-proxy/session.js +
// better-sqlite3/session.js): drizzle читает строки ПОЗИЦИОННО
// (row[columnIndex] в mapResultRow), поэтому отдаём массивы значений
// в порядке колонок SELECT. Объекты не годятся: при join таблиц с
// одинаковыми именами колонок (id, name, ...) дубли схлопываются и
// порядок теряется. node:sqlite умеет массивы через setReturnArrays().
//   all/values → {rows: [[...], ...]}, get → {rows: [...]|undefined},
//   run → любой объект (возвращается вызывающему; кладём insertId из
//   last_insert_rowid для insertAndGetId).
function sqliteClient(handle) {
  const readAll = (stmt, args) => {
    if (typeof stmt.setReturnArrays === 'function') stmt.setReturnArrays(true)
    return stmt.all(...args)
  }
  const readOne = (stmt, args) => {
    if (typeof stmt.setReturnArrays === 'function') stmt.setReturnArrays(true)
    return stmt.get(...args)
  }
  const toArray = (row) => (Array.isArray(row) ? row : Object.values(row))
  return async (sqlText, params, method) => {
    const args = params || []
    if (method === 'all' || method === 'values') {
      return { rows: readAll(handle.prepare(sqlText), args).map(toArray) }
    }
    if (method === 'get') {
      const row = readOne(handle.prepare(sqlText), args)
      return { rows: row === undefined ? undefined : toArray(row) }
    }
    const info = handle.prepare(sqlText).run(...args)
    return { rows: [{ insertId: Number(info.lastInsertRowid) }] }
  }
}

function openSqlite(dbPath) {
  const resolved = path.resolve(dbPath)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  const handle = new DatabaseSync(resolved)
  handle.exec('PRAGMA journal_mode = WAL')
  handle.exec('PRAGMA foreign_keys = ON')
  return handle
}

export async function getDb() {
  if (dbInstance) return dbInstance

  if (IS_SQLITE) {
    dbInstance = drizzleProxy(sqliteClient(openSqlite(SQLITE_PATH)), { schema })
    return dbInstance
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ktpanel',
  })

  dbInstance = drizzle(connection, { schema, mode: 'default' })
  return dbInstance
}

export async function insertAndGetId(table, values) {
  const db = await getDb()
  const res = await db.insert(table).values(values)
  if (Array.isArray(res)) return Number(res[0].insertId)
  const id = res?.rows?.[0]?.insertId
  if (id === undefined || id === null) throw new Error('insert did not return an id')
  return Number(id)
}

// Экспортируем функцию, а не сам db
export default getDb
