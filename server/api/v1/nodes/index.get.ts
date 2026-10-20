// @ts-nocheck
// GET /api/v1/nodes — ноды панели (ключ админа, чтение).
// Токены нод наружу НЕ отдаются — только shape для статуса/биллинга.
import { nodes, locations } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireApiKey, needLevel, requireAdminKey } from '../../../utils/apikeys'
import { parseListQuery, listResponse } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'nodes', 1)
  requireAdminKey(ctx)
  const { db } = ctx
  const rows = await db.select({
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
  return listResponse(rows, parseListQuery(getQuery(event)), ['name'])
})
