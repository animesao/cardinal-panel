// @ts-nocheck
// GET /api/account/api-keys — свои ключи (без секретов, только prefix).
import { getDb } from '../../../db'
import { apiKeys } from '../../../db/schema'
import { eq, desc } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { parseScopes } from '../../../utils/apikeys'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const db = await getDb()
  const rows = await db.select().from(apiKeys)
    .where(eq(apiKeys.userId, session.user.id))
    .orderBy(desc(apiKeys.createdAt))
  return rows.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    scopes: parseScopes(k.scopes),
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  }))
})
