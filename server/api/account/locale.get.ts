// @ts-nocheck
// GET /api/account/locale — язык пользователя (только свой).
import { getDb } from '../../db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })
  const db = await getDb()
  const rows = await db.select({ locale: users.locale }).from(users).where(eq(users.id, session.user.id)).limit(1)
  return { locale: rows[0]?.locale || session.user.locale || 'en' }
})
