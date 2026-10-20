// @ts-nocheck
// PUT /api/admin/nodes/[id]/types — сохранение разрешённых типов (БД панели).
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
  const body = await readBody(event)
  if (!id) throw createError({ statusCode: 400, message: 'Node ID required' })

  const types = Array.isArray(body) ? body : (body?.types || [])
  const db = await getDb()
  await db.update(nodes).set({ serverTypes: JSON.stringify(types) }).where(eq(nodes.id, id))

  return { success: true }
})
