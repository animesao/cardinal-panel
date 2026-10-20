// @ts-nocheck
// GET /api/v1/blueprints/[id] — один чертёж (ключ админа, чтение).
import { blueprints } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireApiKey, needLevel, requireAdminKey } from '../../../utils/apikeys'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'blueprints', 1)
  requireAdminKey(ctx)
  if (!id) throw createError({ statusCode: 400, message: 'Некорректный id' })
  const rows = await ctx.db.select().from(blueprints).where(eq(blueprints.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Чертёж не найден' })
  return rows[0]
})
