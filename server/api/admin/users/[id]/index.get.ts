// @ts-nocheck
// GET /api/admin/users/[id] — один пользователь (проекция без секретов).
import { getDb } from '../../../../db'
import { users } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'Некорректный id' })

  const db = await getDb()
  const rows = await db.select({
    id: users.id,
    uuid: users.uuid,
    email: users.email,
    name: users.name,
    avatar: users.avatar,
    provider: users.provider,
    providerId: users.providerId,
    role: users.role,
    locale: users.locale,
    createdAt: users.createdAt,
    lastLogin: users.lastLogin,
    updatedAt: users.updatedAt,
  }).from(users).where(eq(users.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Пользователь не найден' })
  return rows[0]
})
