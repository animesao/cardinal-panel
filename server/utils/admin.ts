// @ts-nocheck
// server/utils/admin.ts — проверка роли администратора со СВЕЖЕЙ ролью из БД.
// JWT-сессия кэширует role, поэтому доверять session.user.role нельзя:
// разжалование должно применяться мгновенно везде.
//
// Bearer cp_* вместо сессии — вызов по API-ключу: владелец обязан быть
// админом, а роут обязан входить в KEY_POLICY (см. apikey-auth).
// Управления ключами и настроек через API нет by design.
import { getServerSession } from '#auth'
import { getDb } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { resolveApiKey, matchApiKeyPolicy } from './apikey-auth'

export async function requireAdmin(event: any) {
  const auth = getHeader(event, 'authorization') || ''
  const presented = auth.replace(/^Bearer\s+/i, '').trim()
  if (presented.startsWith('cp_')) {
    const resolved = await resolveApiKey(presented, event)
    if (!resolved.isAdmin) {
      throw createError({ statusCode: 403, message: 'Только для администраторов' })
    }
    const method = event.method || event.node?.req?.method || 'GET'
    const policy = matchApiKeyPolicy(event.path || '', method)
    if (!policy) {
      throw createError({ statusCode: 403, message: 'Роут недоступен по API-ключу' })
    }
    const [resource, level] = policy
    if ((resolved.levels[resource] || 0) < level) {
      throw createError({ statusCode: 403, message: `Ключу нет доступа: ${resource} (нужен уровень ${level})` })
    }
    return { db: resolved.db, session: { user: resolved.user }, keyLevels: resolved.levels }
  }

  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 403, message: 'Только для администраторов' })
  try {
    const db = await getDb()
    const rows = await db.select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1)
    if (!rows.length || rows[0].role !== 'admin') {
      throw createError({ statusCode: 403, message: 'Только для администраторов' })
    }
    return { db, session }
  } catch (e: any) {
    if (e?.statusCode === 403) throw e
    throw createError({ statusCode: 403, message: 'Только для администраторов' })
  }
}
