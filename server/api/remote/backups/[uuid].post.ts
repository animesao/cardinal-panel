// @ts-nocheck
// POST /api/remote/backups/[uuid] — колбэк wings о завершении асинхронного
// снапшота (см. reportBackupStatus в cardinal-wings):
// {successful, checksum, checksum_type, size}.
// Авторизация: обязательный Bearer-токен ноды (nodes.token; wings шлёт
// "tokenID.token" либо "token" — сверяем секретную часть). Колбэк
// принимается только от ноды, которой принадлежит сервер бэкапа.
import { getDb } from '../../../db'
import { backups, nodes, servers } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'

// timingSafeEqual для строк разной длины: сравниваем SHA256.
function secretsEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

export default defineEventHandler(async (event) => {
  const uuid = event.context.params?.uuid
  const body = await readBody(event).catch(() => ({}))
  if (!uuid) throw createError({ statusCode: 400, message: 'Backup UUID required' })

  const auth = getHeader(event, 'authorization') || ''
  const presented = auth.replace(/^Bearer\s+/i, '')
  if (!presented) throw createError({ statusCode: 401, message: 'Missing node token' })
  const secret = presented.includes('.') ? presented.split('.').slice(1).join('.') : presented

  const db = await getDb()
  const nodeRows = await db.select({ id: nodes.id, token: nodes.token }).from(nodes)
  const node = nodeRows.find((n) => n.token && secretsEqual(n.token, secret))
  if (!node) throw createError({ statusCode: 401, message: 'Invalid node token' })

  const rows = await db.select({ backup: backups, server: servers })
    .from(backups)
    .leftJoin(servers, eq(backups.serverId, servers.id))
    .where(eq(backups.uuid, uuid))
    .limit(1)
  if (!rows.length || !rows[0].server) throw createError({ statusCode: 404, message: 'Бэкап не найден' })
  // Чужой ноде свой бэкап не подтвердить/не испортить.
  if (rows[0].server.nodeId !== node.id) throw createError({ statusCode: 403, message: 'Чужой бэкап' })

  const size = Number(body?.size || 0)
  await db.update(backups).set({
    status: body?.successful ? 'completed' : 'failed',
    size: Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0,
  }).where(eq(backups.uuid, uuid))

  return { success: true }
})
