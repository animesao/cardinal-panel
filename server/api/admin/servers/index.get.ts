// @ts-nocheck
import { getDb } from '../../../db'
import { servers, users, nodes, allocations } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { displayAddress } from '../../../utils/wings'
import { parseListQuery, listResponse } from '../../../utils/pagination'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  try {
    const db = await getDb()

    const allServers = await db
      .select({
        id: servers.id,
        uuid: servers.uuid,
        name: servers.name,
        description: servers.description,
        status: servers.status,
        nodeId: servers.nodeId,
        memory: servers.memory,
        cpu: servers.cpu,
        disk: servers.disk,
        swap: servers.swap,
        io: servers.io,
        portSlots: servers.portSlots,
        backupSlots: servers.backupSlots,
        databaseSlots: servers.databaseSlots,
        autoStart: servers.autoStart,
        owner: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
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
        createdAt: servers.createdAt,
      })
      .from(servers)
      .leftJoin(users, eq(servers.ownerId, users.id))
      .leftJoin(nodes, eq(servers.nodeId, nodes.id))
      .leftJoin(allocations, eq(servers.allocationId, allocations.id))
      .orderBy(servers.createdAt)

    // Адрес для игроков (IP аллокации / LAN-IP ноды), URL ноды наружу не отдаём.
    const shaped = allServers.map((s: any) => {
      const { node, ...rest } = s
      return {
        ...rest,
        node: node ? { id: node.id, name: node.name } : node,
        address: displayAddress(s.allocation, node),
      }
    })
    return listResponse(shaped, parseListQuery(getQuery(event)), ['name', 'status'])
  } catch (error) {
    console.error('Error fetching servers:', error)
    throw createError({ statusCode: 500, message: 'Ошибка загрузки серверов' })
  }
})