// @ts-nocheck
// GET /api/v1/nodes/[id]/allocations — аллокации ноды (ключ админа, чтение).
import { allocations } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireApiKey, needLevel, requireAdminKey } from '../../../../utils/apikeys'
import { parseListQuery, listResponse } from '../../../../utils/pagination'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'allocations', 1)
  requireAdminKey(ctx)
  if (!id) throw createError({ statusCode: 400, message: 'Некорректный id' })
  const rows = await ctx.db.select({
    id: allocations.id,
    ip: allocations.ip,
    port: allocations.port,
    assigned: allocations.assigned,
    serverId: allocations.serverId,
  })
    .from(allocations)
    .where(eq(allocations.nodeId, id))
  return listResponse(rows, parseListQuery(getQuery(event)), ['ip', 'assigned'])
})
