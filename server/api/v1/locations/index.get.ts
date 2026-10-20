// @ts-nocheck
// GET /api/v1/locations — локации (ключ админа, чтение).
import { locations } from '../../../db/schema'
import { requireApiKey, needLevel, requireAdminKey } from '../../../utils/apikeys'
import { parseListQuery, listResponse } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'locations', 1)
  requireAdminKey(ctx)
  const rows = await ctx.db.select({
    id: locations.id,
    name: locations.name,
    description: locations.description,
    address: locations.address,
    city: locations.city,
    country: locations.country,
  }).from(locations)
  return listResponse(rows, parseListQuery(getQuery(event)), ['name', 'city', 'country'])
})
