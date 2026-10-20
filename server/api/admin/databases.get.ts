// @ts-nocheck
// GET /api/admin/databases — все базы серверов одним списком:
// имя базы + сервер + хост + дата. БЕЗ кредов (пароли/логины
// пользователей баз наружу не отдаём даже админке списком).
import { getDb } from '../../db'
import { serverDatabases, servers, databaseHosts } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAdmin } from '../../utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = await getDb()
  const rows = await db.select({
    id: serverDatabases.id,
    name: serverDatabases.name,
    serverId: serverDatabases.serverId,
    createdAt: serverDatabases.createdAt,
    server: {
      id: servers.id,
      name: servers.name,
    },
    host: {
      id: databaseHosts.id,
      name: databaseHosts.name,
      type: databaseHosts.type,
    },
  })
    .from(serverDatabases)
    .leftJoin(servers, eq(serverDatabases.serverId, servers.id))
    .leftJoin(databaseHosts, eq(serverDatabases.hostId, databaseHosts.id))
    .orderBy(desc(serverDatabases.createdAt))
  return rows
})
