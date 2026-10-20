// @ts-nocheck
import { getDb } from '../../db'
import { servers, nodes, allocations, serverUsers } from '../../db/schema'
import { eq, inArray } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { displayAddress } from '../../utils/wings'

const serverShape = {
  id: servers.id,
  uuid: servers.uuid,
  name: servers.name,
  description: servers.description,
  ownerId: servers.ownerId,
  nodeId: servers.nodeId,
  memory: servers.memory,
  cpu: servers.cpu,
  disk: servers.disk,
  status: servers.status,
  createdAt: servers.createdAt,
  node: {
    id: nodes.id,
    name: nodes.name,
    url: nodes.url,
  },
  allocation: {
    id: allocations.id,
    ip: allocations.ip,
    port: allocations.port,
  },
}

// withAddress — считает address (IP аллокации / LAN-IP ноды) и вычищает
// внутренний URL ноды из ответа: мемберам он ни к чему.
const withAddress = (rows: any[]) => rows.map((s: any) => {
  const { node, allocation, ...rest } = s
  return {
    ...rest,
    node: node ? { id: node.id, name: node.name } : node,
    allocation,
    address: displayAddress(allocation, node),
  }
})

export default defineEventHandler(async (event) => {
  try {
    const session = await getServerSession(event)
    
    if (!session?.user) {
      throw createError({ statusCode: 401, message: 'Не авторизован' })
    }
    
    const db = await getDb()
    
    const userServers = withAddress(await db
      .select(serverShape)
      .from(servers)
      .leftJoin(nodes, eq(servers.nodeId, nodes.id))
      .leftJoin(allocations, eq(servers.allocationId, allocations.id))
      .where(eq(servers.ownerId, session.user.id))
      .orderBy(servers.createdAt))

    // Серверы, расшаренные мне как субпользователю.
    const memberRows = await db.select({ serverId: serverUsers.serverId })
      .from(serverUsers)
      .where(eq(serverUsers.userId, session.user.id))
    const ownedIds = new Set(userServers.map((s) => s.id))
    const sharedIds = [...new Set(memberRows.map((r) => r.serverId))].filter((sid) => !ownedIds.has(sid))
    let shared: any[] = []
    if (sharedIds.length) {
      shared = withAddress(await db
        .select(serverShape)
        .from(servers)
        .leftJoin(nodes, eq(servers.nodeId, nodes.id))
        .leftJoin(allocations, eq(servers.allocationId, allocations.id))
        .where(inArray(servers.id, sharedIds))
        .orderBy(servers.createdAt)).map((s) => ({ ...s, shared: true }))
    }

    return [...userServers.map((s) => ({ ...s, shared: false })), ...shared]
  } catch (error: any) {
    console.error('Error fetching user servers:', error)
    throw createError({ statusCode: 500, message: error.message })
  }
})