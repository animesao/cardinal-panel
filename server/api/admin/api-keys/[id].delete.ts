// @ts-nocheck
// DELETE /api/admin/api-keys/[id] — отозвать ключ. Мгновенно умирает:
// хэш удаляется, старые запросы с ним — 401.
import { getDb } from '../../../db'
import { apiKeys } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = await getDb()
  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'Некорректный id' })
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Ключ не найден' })
  await db.delete(apiKeys).where(eq(apiKeys.id, id))
  return { success: true }
})
