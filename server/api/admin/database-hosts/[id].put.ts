// @ts-nocheck
// PUT /api/admin/database-hosts/[id] — обновление хоста БД.
import { getDb } from '../../../db'
import { databaseHosts } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'
import { syncHostNodes } from '../../../utils/dbhosts'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  if (!id || !body) throw createError({ statusCode: 400 })

  const { name, host, port, type, username, password } = body
  const nodeId = body.nodeId ?? body.node_id
  const allowedNodeIds = body.allowedNodeIds ?? body.allowed_node_ids
  const db = await getDb()
  await db.update(databaseHosts).set({
    ...(name !== undefined ? { name } : {}),
    ...(host !== undefined ? { host } : {}),
    ...(port !== undefined ? { port } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(username !== undefined ? { username } : {}),
    // Пустой пароль в PUT = «не менять» (форма правки шлёт его
    // только когда админ ввёл новый).
    ...(password !== undefined && password !== '' ? { password } : {}),
    ...(nodeId !== undefined ? { nodeId: nodeId || null } : {}),
  }).where(eq(databaseHosts.id, id))
  if (allowedNodeIds !== undefined) {
    await syncHostNodes(db, id, allowedNodeIds)
  }

  return { success: true }
})
