// @ts-nocheck
// GET /api/admin/database-hosts — хосты БД из БД панели
// (со snake-алиасом node_id и именем ноды хранения для фронта).
import { getDb } from '../../db'
import { databaseHosts, nodes } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../utils/admin'
import { hostAllowedNodes } from '../../utils/dbhosts'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = await getDb()
  const rows = await db.select({
    id: databaseHosts.id,
    name: databaseHosts.name,
    host: databaseHosts.host,
    port: databaseHosts.port,
    type: databaseHosts.type,
    username: databaseHosts.username,
    password: databaseHosts.password,
    nodeId: databaseHosts.nodeId,
    node_id: databaseHosts.nodeId,
    nodeName: nodes.name,
    createdAt: databaseHosts.createdAt,
  }).from(databaseHosts)
    .leftJoin(nodes, eq(databaseHosts.nodeId, nodes.id))
    .orderBy(databaseHosts.createdAt)
  const allowed = await hostAllowedNodes(db)
  // Root-пароль наружу не отдаём (только факт): форма правки шлёт
  // его заново лишь когда админ ввёл новый, иначе PUT его не трогает.
  return rows.map(({ password, ...h }: any) => ({ ...h, allowed_node_ids: allowed[h.id] || [], hasPassword: !!password }))
})
