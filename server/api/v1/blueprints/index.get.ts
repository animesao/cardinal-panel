// @ts-nocheck
// GET /api/v1/blueprints — каталог чертежей (ключ админа, чтение).
import { blueprints } from '../../../db/schema'
import { requireApiKey, needLevel, requireAdminKey } from '../../../utils/apikeys'
import { parseListQuery, listResponse } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'blueprints', 1)
  requireAdminKey(ctx)
  const rows = await ctx.db.select({
    id: blueprints.id,
    name: blueprints.name,
    description: blueprints.description,
    image: blueprints.image,
    startupCommand: blueprints.startupCommand,
    environment: blueprints.environment,
    installScript: blueprints.installScript,
    images: blueprints.images,
    variables: blueprints.variables,
    createdAt: blueprints.createdAt,
  }).from(blueprints)
  return listResponse(rows, parseListQuery(getQuery(event)), ['name'])
})
