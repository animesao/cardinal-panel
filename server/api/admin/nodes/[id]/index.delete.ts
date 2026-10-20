// @ts-nocheck
// DELETE /api/admin/nodes/[id] — удаление ноды (серверы каскадом по FK).
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
  if (!id) throw createError({ statusCode: 400, message: 'ID ноды не указан' })

  const db = await getDb()
  await db.delete(nodes).where(eq(nodes.id, id))

  return { success: true, message: 'Нода удалена' }
})
