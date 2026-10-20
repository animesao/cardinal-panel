// @ts-nocheck
// GET /api/v1/server-databases — базы серверов (ключ админа, чтение).
// Пароли наружу НЕ отдаются — только учёт для биллинга.
import { serverDatabases, servers, databaseHosts } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireApiKey, needLevel, requireAdminKey } from '../../../utils/apikeys'
import { parseListQuery, listResponse } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'server_databases', 1)
  requireAdminKey(ctx)
  const rows = await ctx.db.select({
    db: serverDatabases,
    server: { id: servers.id, name: servers.name },
    host: { id: databaseHosts.id, name: databaseHosts.name },
  })
    .from(serverDatabases)
    .leftJoin(servers, eq(serverDatabases.serverId, servers.id))
    .leftJoin(databaseHosts, eq(serverDatabases.hostId, databaseHosts.id))
  return listResponse(rows.map((r: any) => ({
    id: r.db.id,
    name: r.db.name,
    username: r.db.username,
    server: r.server,
    host: r.host,
    createdAt: r.db.createdAt,
  })), parseListQuery(getQuery(event)), ['name', 'username'])
})
