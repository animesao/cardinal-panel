// @ts-nocheck
// PUT /api/account/password {currentPassword?, newPassword} — смена пароля.
// У кого пароля ещё нет (вход через OAuth) — текущий не спрашиваем.
import { getDb } from '../../db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { hashPassword, verifyPassword, assertPasswordRules } from '../../utils/password'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const body = await readBody(event).catch(() => ({}))
  const db = await getDb()
  const rows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 401, message: 'Не авторизован' })

  if (rows[0].passwordHash) {
    if (!verifyPassword(String(body?.currentPassword || ''), rows[0].passwordHash)) {
      throw createError({ statusCode: 400, message: 'Неверный текущий пароль' })
    }
  }
  const next = assertPasswordRules(body?.newPassword)
  await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, session.user.id))
  return { success: true }
})
