// @ts-nocheck
// GET /api/servers/[id]/db-hosts — хосты БД, доступные серверу.
// Если ноде сервера назначен хост (nodes.database_host_id) — только он,
// иначе все хосты (legacy). Без секретов: только {id, name, type}.
import { databaseHosts, nodes } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, needPerm } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  // Список хостов БД — тоже данные, доступные не всем мемберам.
  needPerm(ctx, 'database.read')
  const { db, srv } = ctx

  const all = await db.select({
    id: databaseHosts.id,
    name: databaseHosts.name,
    type: databaseHosts.type,
  }).from(databaseHosts).orderBy(databaseHosts.name)

  if (srv.nodeId) {
    const nrows = await db.select({ databaseHostId: nodes.databaseHostId }).from(nodes).where(eq(nodes.id, srv.nodeId)).limit(1)
    const mapped = nrows[0]?.databaseHostId
    if (mapped) return all.filter((h) => h.id === mapped)
  }
  return all
})
