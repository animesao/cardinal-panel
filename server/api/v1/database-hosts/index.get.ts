// @ts-nocheck
// GET /api/v1/database-hosts — хосты БД (ключ админа, чтение).
// Пароли наружу НЕ отдаются.
import { databaseHosts, nodes } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireApiKey, needLevel, requireAdminKey } from '../../../utils/apikeys'
import { parseListQuery, listResponse } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'database_hosts', 1)
  requireAdminKey(ctx)
  const rows = await ctx.db.select({ host: databaseHosts, node: nodes })
    .from(databaseHosts)
    .leftJoin(nodes, eq(databaseHosts.nodeId, nodes.id))
  return listResponse(rows.map((r: any) => ({
    id: r.host.id,
    name: r.host.name,
    host: r.host.host,
    port: r.host.port,
    type: r.host.type,
    username: r.host.username,
    provisioning: r.host.provisioning,
    node: r.node ? { id: r.node.id, name: r.node.name } : null,
    createdAt: r.host.createdAt,
  })), parseListQuery(getQuery(event)), ['name', 'host', 'type'])
})
