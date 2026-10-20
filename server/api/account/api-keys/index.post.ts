// @ts-nocheck
// POST /api/account/api-keys {name, levels} — выпустить СЕБЕ ключ.
// Только серверные ресурсы (свой/расшаренные серверы): nodes/users/
// allocations/locations/blueprints/database_hosts/server_databases —
// 403 даже админу. Полные ключи выпускаются только в Admin → API-ключи.
import { getDb } from '../../../db'
import { users } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { mintApiKey } from '../../../utils/apikeys'
import { sanitizeResourceLevels, normalizeLevels } from '../../../utils/apikey-auth'

const ACCOUNT_RESOURCES = new Set(['servers', 'files', 'backups', 'databases', 'ports', 'startup', 'server_users', 'activity'])

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const db = await getDb()
  const body = await readBody(event).catch(() => ({}))
  const name = String(body?.name || '').trim()
  if (name.length < 2) throw createError({ statusCode: 400, message: 'Название: минимум 2 символа' })
  if (name.length > 100) throw createError({ statusCode: 400, message: 'Название: максимум 100 символов' })

  const levels = body?.levels && typeof body.levels === 'object' && !Array.isArray(body.levels)
    ? sanitizeResourceLevels(body.levels)
    : normalizeLevels(Array.isArray(body?.scopes) ? body.scopes : [])
  if (!Object.keys(levels).length) throw createError({ statusCode: 400, message: 'Выбери хотя бы один доступ' })

  const urows = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!urows.length) throw createError({ statusCode: 401, message: 'Не авторизован' })
  for (const k of Object.keys(levels)) {
    if (!ACCOUNT_RESOURCES.has(k)) throw createError({ statusCode: 403, message: `Ресурс ${k}: только через Admin → API-ключи` })
  }

  const { token, prefix } = await mintApiKey(db, session.user.id, name, levels)
  return { success: true, token, prefix, name, levels }
})
