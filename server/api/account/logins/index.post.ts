// @ts-nocheck
// POST /api/account/logins — записать текущий вход (IP, устройство, способ).
// Вызывается со страницы логина сразу после успешного signIn.
// Храним последние 20 на пользователя.
import { getDb } from '../../../db'
import { loginHistory } from '../../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { getServerSession } from '#auth'

function clientIp(event: any): string {
  const fwd = getHeader(event, 'x-forwarded-for')
  if (fwd) return String(fwd).split(',')[0].trim().slice(0, 45)
  const real = getHeader(event, 'x-real-ip')
  if (real) return String(real).trim().slice(0, 45)
  try {
    return String(event.node.req.socket?.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 45)
  } catch { return '' }
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const body = await readBody(event).catch(() => ({}))
  const db = await getDb()
  const ua = String(getHeader(event, 'user-agent') || '').slice(0, 255)
  const ip = clientIp(event)
  const provider = String(body?.provider || session?.user?.provider || '').slice(0, 50) || null

  // Дедуп: тот же IP+способ за последние 10 минут не пишем
  // (перезаход в панель, двойной монт лейаутов).
  try {
    const last = await db.select().from(loginHistory)
      .where(eq(loginHistory.userId, session.user.id))
      .orderBy(sql`${loginHistory.id} DESC`)
      .limit(1)
    if (last.length && last[0].ip === ip && (last[0].provider || null) === provider) {
      const age = Date.now() - new Date(last[0].createdAt).getTime()
      if (age < 10 * 60 * 1000) return { success: true, skipped: true }
    }
  } catch {}

  await db.insert(loginHistory).values({
    userId: session.user.id,
    ip,
    userAgent: ua || null,
    provider,
  })

  // Чистим хвост: оставляем 20 свежих.
  try {
    await db.delete(loginHistory).where(sql`${loginHistory.id} NOT IN (
      SELECT id FROM login_history
      WHERE user_id = ${session.user.id}
      ORDER BY id DESC LIMIT 20
    ) AND ${loginHistory.userId} = ${session.user.id}`)
  } catch {}

  return { success: true }
})
