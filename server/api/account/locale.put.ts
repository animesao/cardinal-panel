// @ts-nocheck
// PUT /api/account/locale {locale} — смена языка интерфейса.
// Белый список из 10 языков, зеркалит LANGS в app/plugins/i18n.ts.
import { getDb } from '../../db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#auth'

const ALLOWED = ['ru', 'en', 'de', 'es', 'fr', 'pt', 'zh', 'ar', 'hi', 'ja']

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })
  const body = await readBody(event).catch(() => ({}))
  const locale = String(body?.locale || '').trim()
  if (!ALLOWED.includes(locale)) throw createError({ statusCode: 400, message: 'Неизвестный язык' })
  const db = await getDb()
  await db.update(users).set({ locale }).where(eq(users.id, session.user.id))
  return { success: true, locale }
})
