// @ts-nocheck
// GET /api/servers/[id]/databases — базы сервера с адресом хоста
// (db.host/db.port для карточки подключения).
import { serverDatabases, databaseHosts } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, needPerm } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  needPerm(ctx, 'database.read')

  const rows = await db.select({
    id: serverDatabases.id,
    name: serverDatabases.name,
    username: serverDatabases.username,
    password: serverDatabases.password,
    hostId: serverDatabases.hostId,
    host: databaseHosts.host,
    port: databaseHosts.port,
    hostName: databaseHosts.name,
    createdAt: serverDatabases.createdAt,
  }).from(serverDatabases)
    .leftJoin(databaseHosts, eq(serverDatabases.hostId, databaseHosts.id))
    .where(eq(serverDatabases.serverId, srv.id))

  return rows
})
