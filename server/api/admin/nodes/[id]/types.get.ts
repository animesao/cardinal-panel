// @ts-nocheck
// GET /api/admin/nodes/[id]/types — разрешённые типы серверов ноды (БД панели).
import { getDb } from '../../../../db'
import { nodes } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'Node ID required' })

  const db = await getDb()
  const rows = await db.select({ serverTypes: nodes.serverTypes }).from(nodes).where(eq(nodes.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Нода не найдена' })

  try {
    const parsed = rows[0].serverTypes ? JSON.parse(rows[0].serverTypes) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
})
