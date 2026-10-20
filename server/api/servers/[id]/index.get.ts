// @ts-nocheck
import { getDb } from '../../../db'
import { servers, nodes, allocations, blueprints, serverUsers, users } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { enrichBlueprint } from '../../../utils/blueprints'
import { displayAddress } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  try {
    const id = parseInt(event.context.params?.id || '0')
    const session = await getServerSession(event)
    
    if (!session?.user) {
      throw createError({ statusCode: 401, message: 'Не авторизован' })
    }
    
    if (!id) {
      throw createError({ statusCode: 400, message: 'Server ID required' })
    }
    
    const db = await getDb()
    
    const server = await db
      .select({
        id: servers.id,
        uuid: servers.uuid,
        name: servers.name,
        description: servers.description,
        ownerId: servers.ownerId,
        nodeId: servers.nodeId,
        memory: servers.memory,
        cpu: servers.cpu,
        disk: servers.disk,
        swap: servers.swap,
        io: servers.io,
        startup: servers.startup,
        image: servers.image,
        environment: servers.environment,
        blueprintId: servers.blueprintId,
        status: servers.status,
        portSlots: servers.portSlots,
        backupSlots: servers.backupSlots,
        databaseSlots: servers.databaseSlots,
        autoStart: servers.autoStart,
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
      })
      .from(servers)
      .leftJoin(nodes, eq(servers.nodeId, nodes.id))
      .leftJoin(allocations, eq(servers.allocationId, allocations.id))
      .where(eq(servers.id, id))
      .limit(1)
    
    if (!server.length) {
      throw createError({ statusCode: 404, message: 'Сервер не найден' })
    }
    
    // Проверяем доступ (владелец, админ или субпользователь).
    // Роль админа — свежая из БД, а не из кэша сессии.
    const urow = await db.select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1)
    if (!urow.length) throw createError({ statusCode: 401, message: 'Не авторизован' })
    const isAdmin = urow[0].role === 'admin'
    const isOwner = server[0].ownerId === session.user.id
    let permissions: string[] = []
    if (!isAdmin && !isOwner) {
      const mrows = await db.select().from(serverUsers)
        .where(and(eq(serverUsers.serverId, id), eq(serverUsers.userId, session.user.id)))
        .limit(1)
      if (!mrows.length) throw createError({ statusCode: 403, message: 'Нет доступа' })
      try {
        const parsed = JSON.parse(mrows[0].permissions || '[]')
        if (Array.isArray(parsed)) permissions = parsed.filter((p) => typeof p === 'string')
      } catch { permissions = [] }
    }

    // Чертёж сервера (обогащённый: images[], variables[]) для вкладок
    // запуска/установки — выбор версии и настроек берётся отсюда.
    let blueprint = null
    if (server[0].blueprintId) {
      const brows = await db.select().from(blueprints).where(eq(blueprints.id, server[0].blueprintId)).limit(1)
      if (brows.length) blueprint = enrichBlueprint(brows[0])
    }

    // Адрес для подключения игроков: IP аллокации, а если там заглушка
    // 0.0.0.0 — LAN-IP ноды (иначе игрок видит неподключаемый адрес).
    const address = displayAddress(server[0].allocation, server[0].node)

    const { node: nodeFull, ...rest } = server[0]
    // Секреты запуска (startup/environment) — только владельцу, админу
    // и держателям startup.update. Остальным мемберам вкладки
    // Запуск/Установка в UI скрыты, отдавать им env нельзя.
    const canStartup = isAdmin || isOwner || permissions.includes('startup.update')
    return {
      ...rest,
      startup: canStartup ? rest.startup : null,
      environment: canStartup ? rest.environment : null,
      node: nodeFull ? { id: nodeFull.id, name: nodeFull.name } : nodeFull,
      address,
      blueprint,
      viewer: { owner: isOwner, admin: isAdmin, permissions },
    }
  } catch (error: any) {
    console.error('Error fetching server:', error)
    throw createError({ statusCode: error.statusCode || 500, message: error.message })
  }
})