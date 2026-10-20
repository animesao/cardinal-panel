// @ts-nocheck
// DELETE /api/admin/users/[id] — удалить аккаунт.
// Запреты: себя, последнего админа, владельца серверов (cascade снёс бы
// серверы — сначала перенеси/удали их вручную).
import { getDb } from '../../../../db'
import { users, servers } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  const { session } = await requireAdmin(event)
  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'Некорректный id' })
  if (id === session.user.id) throw createError({ statusCode: 400, message: 'Нельзя удалить себя' })

  const db = await getDb()
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Пользователь не найден' })
  const target = rows[0]

  if (target.role === 'admin') {
    const adminCount = await db.$count(users, eq(users.role, 'admin'))
    if (adminCount <= 1) throw createError({ statusCode: 400, message: 'Нельзя удалить последнего администратора' })
  }
  const owned = await db.select({ id: servers.id }).from(servers).where(eq(servers.ownerId, id)).limit(1)
  if (owned.length) throw createError({ statusCode: 409, message: 'У пользователя есть серверы — перенеси владельца или удали их' })

  await db.delete(users).where(eq(users.id, id))
  return { success: true }
})
