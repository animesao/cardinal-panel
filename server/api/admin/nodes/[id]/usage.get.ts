// @ts-nocheck
// GET /api/admin/nodes/[id]/usage — занятые ресурсы ноды:
// суммы по БД панели + живые счётчики wings (/v1/system/info).
import { getDb } from '../../../../db'
import { nodes, servers } from '../../../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { wingsFetch } from '../../../../utils/wings'
import { requireAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'Node ID required' })

  const db = await getDb()
  const rows = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Нода не найдена' })
  const node = rows[0]

  const usage = await db.select({
    memory_used: sql`COALESCE(SUM(${servers.memory}), 0)`.mapWith(Number),
    disk_used: sql`COALESCE(SUM(${servers.disk}), 0)`.mapWith(Number),
    swap_used: sql`COALESCE(SUM(${servers.swap}), 0)`.mapWith(Number),
    servers: sql`COUNT(*)`.mapWith(Number),
  }).from(servers).where(eq(servers.nodeId, id))

  let live: any = null
  try {
    live = await wingsFetch(node, '/v1/system/info')
  } catch {}

  return {
    memory_used: usage[0]?.memory_used || 0,
    disk_used: usage[0]?.disk_used || 0,
    swap_used: usage[0]?.swap_used || 0,
    servers: usage[0]?.servers || 0,
    memory_total: node.memory || 0,
    disk_total: node.disk || 0,
    swap_total: node.swap || 0,
    live,
  }
})
