// @ts-nocheck
// GET /api/admin/api-keys — все API-ключи: владелец, скопы,
// последнее использование. Секретов наружу нет — только prefix для опознания.
import { getDb } from '../../../db'
import { apiKeys, users } from '../../../db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'
import { parseScopes } from '../../../utils/apikeys'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = await getDb()
  const rows = await db.select({ key: apiKeys, user: users })
    .from(apiKeys)
    .leftJoin(users, eq(apiKeys.userId, users.id))
    .orderBy(desc(apiKeys.createdAt))
  return rows.map((r) => ({
    id: r.key.id,
    name: r.key.name,
    prefix: r.key.prefix,
    scopes: parseScopes(r.key.scopes),
    lastUsedAt: r.key.lastUsedAt,
    createdAt: r.key.createdAt,
    owner: r.user ? { id: r.user.id, email: r.user.email, name: r.user.name } : null,
  }))
})
