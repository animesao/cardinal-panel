// @ts-nocheck
// GET /api/nodes/[id]/status — живость wings-ноды.
// Формат ответа — как ждёт NodeStatus.vue:
// {status: 'online'|'offline', version?, os?, architecture?, cpu_cores?}.
import { getDb } from '../../../db'
import { nodes, servers, users } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { wingsFetch } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'Node ID required' })

  const db = await getDb()
  const rows = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Нода не найдена' })
  const node = rows[0]

  // Живость ноды — админская информация (версия wings, ОС, архитектура,
  // число ядер). Раньше её видел ЛЮБОЙ авторизованный пользователь, и
  // перебором id'ов можно было обойти всю ноду. Обычному пользователю
  // показываем статус только той ноды, на которой у него есть сервер.
  const uid = Number(session.user.id)
  if (!Number.isInteger(uid) || uid <= 0) {
    throw createError({ statusCode: 401, message: 'Не авторизован' })
  }
  const urows = await db.select({ role: users.role }).from(users).where(eq(users.id, uid)).limit(1)
  const isAdmin = urows[0]?.role === 'admin'
  if (!isAdmin) {
    const own = await db.select({ id: servers.id }).from(servers)
      .where(and(eq(servers.nodeId, id), eq(servers.ownerId, uid))).limit(1)
    if (!own.length) {
      throw createError({ statusCode: 403, message: 'Нет доступа' })
    }
  }

  try {
    const [version, info] = await Promise.all([
      wingsFetch(node, '/v1/version'),
      wingsFetch(node, '/v1/system/info'),
    ])
    const n = info?.nodes?.[0] || {}
    return {
      status: 'online',
      version: version?.version || null,
      os: 'Linux',
      architecture: n.architecture || null,
      cpu_cores: n.ncpu || 0,
    }
  } catch (e: any) {
    return { status: 'offline' }
  }
})
