// @ts-nocheck
// server/api/health.get.ts — проверка живости панели.
//
// Без авторизации: этот эндпоинт должен отвечать и когда БД упала,
// иначе балансировщик и Docker HEALTHCHECK не смогут отличить
// «панель сломалась» от «панель занята».
//
// Ответ 200 — всё работает, 503 — панель жива, но зависимость (БД)
// недоступна. Тело всегда JSON с подробностями.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import getDb from '../db'

const startedAt = Date.now()

function readVersion() {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    return readFileSync(path.join(root, 'VERSION'), 'utf8').trim()
  } catch {
    return 'unknown'
  }
}

export default defineEventHandler(async (event) => {
  const body = {
    status: 'ok',
    version: readVersion(),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    database: 'unknown',
  }

  try {
    const db = await getDb()
    // Диалекты различаются API: у sqlite-proxy (node:sqlite) есть all(),
    // у mysql2-драйвера — execute(). Пробуем оба.
    if (typeof db.all === 'function') {
      await db.all(sql`SELECT 1`)
    } else {
      await db.execute(sql`SELECT 1`)
    }
    body.database = 'ok'
  } catch (error) {
    body.status = 'degraded'
    body.database = 'unavailable'
    body.error = error?.message ? String(error.message).slice(0, 200) : 'unknown error'
    setResponseStatus(event, 503)
  }

  return body
})
