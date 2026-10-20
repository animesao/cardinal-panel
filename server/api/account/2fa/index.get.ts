// @ts-nocheck
// GET /api/account/2fa — статус 2FA текущего пользователя.
import { getDb } from '../../../db'
import { userTotp } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const db = await getDb()
  const rows = await db.select().from(userTotp).where(eq(userTotp.userId, session.user.id)).limit(1)
  return { enabled: !!(rows.length && rows[0].enabled) }
})
