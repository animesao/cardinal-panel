// @ts-nocheck
// POST /api/setup/bootstrap — создание ПЕРВОГО администратора панели.
//
// Зачем: раньше админ появлялся сам — при пустой таблице users первый
// вошедший через OAuth получал role=admin (C3). Пустая таблица — это
// дефолт после `npm run db:migrate`, поэтому любой, кто первым дошёл до
// панели, становился админом без аутентификации.
//
// Теперь первый админ создаётся оператором, у которого есть доступ к панели
// (PANEL_SETUP_TOKEN в .env) либо к БД (`npm run create-admin`).
//
// Маршрут работает ОДИН РАЗ: после создания админа он закрывается, а
// токен из БД вычищается.
import { getDb } from '../../db'
import { users } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'uncrypto'
import { hashPassword } from '../../utils/password'
import { hasAdmin, setupTokenMatches } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  // Панель уже инициализирована — маршрут больше не нужен.
  if (await hasAdmin()) {
    throw createError({ statusCode: 403, message: 'Панель уже инициализирована' })
  }

  const body = await readBody(event).catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')
  const token = String(body?.setupToken || '')

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw createError({ statusCode: 400, message: 'Некорректный e-mail' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: 'Пароль: минимум 8 символов' })
  }
  if (!setupTokenMatches(token)) {
    throw createError({ statusCode: 403, message: 'Неверный токен настройки' })
  }

  const db = await getDb()
  const existing = await db.select({ id: users.id }).from(users)
    .where(sql`lower(${users.email}) = ${email}`).limit(1)

  const passwordHash = hashPassword(password)
  if (existing.length) {
    // Аккаунт с таким e-mail уже есть (например, создан OAuth-входом) —
    // повышаем его до админа и задаём пароль.
    await db.update(users)
      .set({ role: 'admin', passwordHash })
      .where(eq(users.id, existing[0].id))
  } else {
    await db.insert(users).values({
      uuid: randomUUID(),
      email,
      name: String(body?.name || '').trim() || email.split('@')[0],
      avatar: null,
      provider: 'credentials',
      providerId: randomUUID(),
      role: 'admin',
      passwordHash,
      locale: 'en',
    })
  }

  return { success: true, email }
})
