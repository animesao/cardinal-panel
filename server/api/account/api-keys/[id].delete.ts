// @ts-nocheck
// DELETE /api/account/api-keys/[id] — отозвать СВОЙ ключ (чужой — 404).
import { getDb } from '../../../db'
import { apiKeys } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'Некорректный id' })

  const db = await getDb()
  const rows = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, session.user.id)))
    .limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Ключ не найден' })
  await db.delete(apiKeys).where(eq(apiKeys.id, id))
  return { success: true }
})
