// @ts-nocheck
// PUT /api/admin/users/[id] {name?, email?, role?, password?} — обновить аккаунт.
// Защита последнего админа: снять роль admin нельзя, если он единственный.
import { getDb } from '../../../../db'
import { users } from '../../../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/admin'
import { hashPassword, assertPasswordRules } from '../../../../utils/password'

export default defineEventHandler(async (event) => {
  const { session } = await requireAdmin(event)
  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'Некорректный id' })

  const db = await getDb()
  const body = await readBody(event).catch(() => ({}))
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Пользователь не найден' })
  const target = rows[0]

  const patch = {}
  if (body?.name !== undefined) {
    const name = String(body.name || '').trim().slice(0, 255)
    patch.name = name || null
  }
  if (body?.email !== undefined) {
    const email = String(body.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createError({ statusCode: 400, message: 'Некорректная почта' })
    }
    const dup = await db.select({ id: users.id }).from(users)
      .where(sql`lower(${users.email}) = ${email}`).limit(1)
    if (dup.length && dup[0].id !== id) {
      throw createError({ statusCode: 409, message: 'Такая почта уже занята' })
    }
    patch.email = email
    if (target.provider === 'credentials') patch.providerId = email
  }
  if (body?.role !== undefined) {
    const role = String(body.role || '')
    if (!['user', 'admin'].includes(role)) throw createError({ statusCode: 400, message: 'Некорректная роль' })
    if (target.role === 'admin' && role === 'user') {
      const adminCount = await db.$count(users, eq(users.role, 'admin'))
      if (adminCount <= 1) throw createError({ statusCode: 400, message: 'Нельзя снять роль последнего администратора' })
      if (target.id === session.user.id) throw createError({ statusCode: 400, message: 'Нельзя снять роль с себя' })
    }
    patch.role = role
  }
  if (body?.password !== undefined && String(body.password || '').length > 0) {
    patch.passwordHash = hashPassword(assertPasswordRules(body.password))
  }
  if (!Object.keys(patch).length) throw createError({ statusCode: 400, message: 'Нечего обновлять' })

  await db.update(users).set(patch).where(eq(users.id, id))
  return { success: true, id }
})
