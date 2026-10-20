// @ts-nocheck
// GET /api/remote/autostart — список контейнеров для автозапуска при старте
// ноды. Wings зовёт этот эндпоинт на загрузке (см. autostart.go) и поднимает
// перечисленные контейнеры. Авторизация — Bearer-токен ноды (тот же разбор,
// что в POST /api/remote/sftp/auth): отдаём только серверы этой ноды.
import { getDb } from '../../db'
import { nodes, servers } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { containerRef } from '../../utils/wings'
import crypto from 'node:crypto'

// timingSafeEqual для строк разной длины: сравниваем SHA256
// (как в remote/sftp/auth и remote/backups — единый способ сверки токенов нод).
function secretsEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

export default defineEventHandler(async (event) => {
  const auth = getHeader(event, 'authorization') || ''
  const presented = auth.replace(/^Bearer\s+/i, '')
  const secret = presented.includes('.') ? presented.split('.').slice(1).join('.') : presented
  if (!secret) throw createError({ statusCode: 401, message: 'Missing node token' })

  const db = await getDb()
  const nodeRows = await db.select({ id: nodes.id, token: nodes.token }).from(nodes)
  const node = nodeRows.find((n) => n.token && secretsEqual(n.token, secret))
  if (!node) throw createError({ statusCode: 401, message: 'Invalid node token' })
  const nodeId = node.id

  const rows = await db.select({ uuid: servers.uuid })
    .from(servers)
    .where(and(eq(servers.nodeId, nodeId), eq(servers.autoStart, 1), eq(servers.suspended, 0)))

  return { servers: rows.map((r) => containerRef(r.uuid)) }
})
