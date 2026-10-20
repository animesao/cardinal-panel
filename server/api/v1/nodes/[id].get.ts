// @ts-nocheck
// GET /api/v1/nodes/[id] — одна нода (ключ админа, чтение, без токена).
import { nodes, locations } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireApiKey, needLevel, requireAdminKey } from '../../../utils/apikeys'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'nodes', 1)
  requireAdminKey(ctx)
  if (!id) throw createError({ statusCode: 400, message: 'Некорректный id' })
  const rows = await db_select(ctx.db, id)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Нода не найдена' })
  return rows[0]
})

async function db_select(db: any, id: number) {
  return await db.select({
    id: nodes.id,
    name: nodes.name,
    url: nodes.url,
    locationId: nodes.locationId,
    memory: nodes.memory,
    disk: nodes.disk,
    swap: nodes.swap,
    location: { id: locations.id, name: locations.name },
  })
    .from(nodes)
    .leftJoin(locations, eq(nodes.locationId, locations.id))
    .where(eq(nodes.id, id))
    .limit(1)
}
