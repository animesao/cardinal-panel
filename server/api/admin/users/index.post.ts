// @ts-nocheck
// POST /api/admin/users {email, password, name?, role?} — создать аккаунт
// с входом по почте+паролю (провайдер credentials). Работает и по API-ключу
// с users.write — так биллинг заводит аккаунты.
import { getDb } from '../../../db'
import { users } from '../../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'uncrypto'
import { requireAdmin } from '../../../utils/admin'
import { hashPassword, assertPasswordRules } from '../../../utils/password'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = await getDb()
  const body = await readBody(event).catch(() => ({}))

  const email = String(body?.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, message: 'Некорректная почта' })
  }
  const password = assertPasswordRules(body?.password)
  const name = String(body?.name || '').trim().slice(0, 255) || null
  const role = body?.role === 'admin' ? 'admin' : 'user'

  const exists = await db.select({ id: users.id }).from(users)
    .where(sql`lower(${users.email}) = ${email}`).limit(1)
  if (exists.length) throw createError({ statusCode: 409, message: 'Такая почта уже занята' })

  const uuid = randomUUID()
  const inserted = await db.insert(users).values({
    uuid,
    email,
    name,
    avatar: null,
    provider: 'credentials',
    providerId: email,
    role,
    passwordHash: hashPassword(password),
    locale: 'en',
    lastLogin: new Date(0),
  }).returning?.({ id: users.id }) ?? null

  let id = inserted?.[0]?.id
  if (!id) {
    // sqlite-драйвер без returning — добираем по uuid.
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.uuid, uuid)).limit(1)
    id = rows[0]?.id
  }
  return { success: true, id, email, role }
})
