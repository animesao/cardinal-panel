// @ts-nocheck
// POST /api/admin/api-keys {name, levels, scopes?, email?} — выпустить ключ.
// levels: {servers: 0|1|2, nodes: 0|1, ...} (см. API_RESOURCES).
// Легаси-массив scopes ещё принимается и переводится в уровни.
// Владелец: пользователь с такой почтой (пусто = себе). Секрет возвращается
// ОДИН РАЗ — панель его не хранит, только SHA256-хэш.
import { getDb } from '../../../db'
import { users } from '../../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'
import { mintApiKey } from '../../../utils/apikeys'
import { sanitizeResourceLevels, normalizeLevels } from '../../../utils/apikey-auth'

export default defineEventHandler(async (event) => {
  const { session } = await requireAdmin(event)
  const db = await getDb()
  const body = await readBody(event).catch(() => ({}))

  const name = String(body?.name || '').trim()
  if (name.length < 2) throw createError({ statusCode: 400, message: 'Название: минимум 2 символа' })
  if (name.length > 100) throw createError({ statusCode: 400, message: 'Название: максимум 100 символов' })
  const levels = body?.levels && typeof body.levels === 'object' && !Array.isArray(body.levels)
    ? sanitizeResourceLevels(body.levels)
    : normalizeLevels(Array.isArray(body?.scopes) ? body.scopes : [])
  if (!Object.keys(levels).length) throw createError({ statusCode: 400, message: 'Выбери хотя бы один доступ' })

  let ownerId = session.user.id
  const email = String(body?.email || '').trim().toLowerCase()
  if (email) {
    const urows = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1)
    if (!urows.length) throw createError({ statusCode: 404, message: 'Пользователь с такой почтой не найден' })
    ownerId = urows[0].id
  }

  const { token, prefix } = await mintApiKey(db, ownerId, name, levels)
  return { success: true, token, prefix, name, levels }
})
