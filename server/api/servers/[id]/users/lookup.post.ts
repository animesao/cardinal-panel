// @ts-nocheck
// POST /api/servers/[id]/users/lookup {email} — шаг 1 мастера приглашения:
// существует ли аккаунт, как зовут (ник), не владелец/админ ли, не добавлен ли уже.
import { serverUsers, users } from '../../../../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireServer, needPerm } from '../../../../utils/wings'
import { checkAttemptBucket } from '../../../../utils/ratelimit'

// Сколько e-mail'ов можно проверить одним пользователем за 10 минут.
// Проверка «есть ли такой аккаунт» — по своей природе оракул перечисления,
// поэтому скорость ограничена.
const LOOKUP_LIMIT = 30
const LOOKUP_WINDOW_MS = 10 * 60 * 1000

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  needPerm(ctx, 'user.create')

  const body = await readBody(event).catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  if (!email) throw createError({ statusCode: 400, message: 'Укажи почту' })

  const callerId = Number(ctx.session?.user?.id)
  if (checkAttemptBucket(`lookup:${callerId}`, LOOKUP_LIMIT, LOOKUP_WINDOW_MS)) {
    throw createError({ statusCode: 429, message: 'Слишком много проверок — подождите' })
  }

  const urows = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1)
  const target = urows[0]
  if (!target) return { exists: false, email }

  // Про роль в панели (admin) НЕ сообщаем: это глобальная роль чужого
  // аккаунта, и она не нужна мастеру приглашения. Нужны только данные
  // по ЭТОМУ серверу: владелец и уже добавленный участник.
  const base = { exists: true, email: target.email, name: target.name || null, avatar: target.avatar || null }
  if (target.id === srv.ownerId) return { ...base, owner: true }
  const mrows = await db.select().from(serverUsers)
    .where(and(eq(serverUsers.serverId, srv.id), eq(serverUsers.userId, target.id)))
    .limit(1)
  return { ...base, alreadyAdded: mrows.length > 0 }
})
