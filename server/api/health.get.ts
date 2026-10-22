// @ts-nocheck
// server/api/health.get.ts — проверка живости панели.
//
// Без авторизации: этот эндпоинт должен отвечать и когда БД упала,
// иначе балансировщик и Docker HEALTHCHECK не смогут отличить
// «панель сломалась» от «панель занята».
//
// Ответ 200 — всё работает, 503 — панель жива, но зависимость (БД)
// недоступна. Тело всегда JSON с подробностями.
//
// Диск: панель на заполненном разделе продолжает отдавать страницы, но
// любая запись падает с «database or disk is full». Поэтому в ответе
// всегда есть раздел disk со свободным местом, а при нехватке status
// становится degraded. HTTP остаётся 200: перезапуск из-за заполненного
// диска не помогает, и мониторинг не должен считать панель упавшей
// из-за места на диске.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import getDb from '../db'
import { IS_SQLITE, SQLITE_PATH } from '../db/dialect'
import { DISK_WARN_MB, diskStatus, freeDiskMb } from '../utils/disk'

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
    disk: { freeMb: null, path: '', warnMb: DISK_WARN_MB },
  }

  // Для sqlite смотрим раздел с базой, для mysql — раздел с приложением:
  // база может быть на другой машине, её раздел отсюда не виден.
  const diskPath = IS_SQLITE ? path.dirname(path.resolve(SQLITE_PATH)) : process.cwd()
  body.disk.path = diskPath
  const freeMb = await freeDiskMb(diskPath)
  body.disk.freeMb = freeMb
  const disk = diskStatus(freeMb)
  if (disk.status === 'degraded') {
    body.status = 'degraded'
    body.disk.warning = disk.warning
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
