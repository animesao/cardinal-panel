// @ts-nocheck
import { getDb } from '../../../../db'
import { allocations } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  try {
    const nodeId = parseInt(event.context.params?.id || '')
    
    if (!nodeId) {
      throw createError({ statusCode: 400, message: 'Node ID required' })
    }
    
    const db = await getDb()
    const nodeAllocations = await db
      .select()
      .from(allocations)
      .where(eq(allocations.nodeId, nodeId))
      .orderBy(allocations.port)
    
    return nodeAllocations
  } catch (error) {
    console.error('Error fetching allocations:', error)
    throw createError({ statusCode: 500, message: 'Ошибка загрузки аллокаций' })
  }
})