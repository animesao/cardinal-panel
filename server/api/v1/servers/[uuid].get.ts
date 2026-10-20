// @ts-nocheck
// GET /api/v1/servers/[uuid] — один сервер. Скоп servers.read.
import { requireApiKey, needLevel, resolveKeyServer } from '../../../utils/apikeys'
import { displayAddress } from '../../../utils/wings'
import { nodes, allocations, servers } from '../../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const uuid = event.context.params?.uuid
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'servers', 1)
  const { db, srv } = await resolveKeyServer(ctx.db, ctx, uuid)
  const { user } = ctx

  const nrows = await db.select().from(nodes).where(eq(nodes.id, srv.nodeId)).limit(1)
  const arows = srv.allocationId
    ? await db.select().from(allocations).where(eq(allocations.id, srv.allocationId)).limit(1)
    : []
  const node = nrows[0] || null
  const allocation = arows[0] || null
  const shared = !(ctx.isAdmin || srv.ownerId === user.id)

  return {
    id: srv.id,
    uuid: srv.uuid,
    name: srv.name,
    description: srv.description,
    memory: srv.memory,
    cpu: srv.cpu,
    disk: srv.disk,
    status: srv.status,
    shared,
    node: node ? { id: node.id, name: node.name } : null,
    allocation,
    address: displayAddress(allocation, node),
    createdAt: srv.createdAt,
  }
})
