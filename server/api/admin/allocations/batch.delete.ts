// @ts-nocheck
import { getDb } from '../../../db'
import { allocations } from '../../../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  try {
    const body = await readBody(event)
    const { ids } = body
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw createError({ statusCode: 400, message: 'IDs массива обязателен' })
    }
    
    const db = await getDb()
    
    // Проверяем, что ни одна из аллокаций не назначена серверу
    const allocatedIds = await db
      .select({ id: allocations.id })
      .from(allocations)
      .where(and(
        inArray(allocations.id, ids),
        eq(allocations.assigned, 'yes')
      ))
    
    if (allocatedIds.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Нельзя удалить ${allocatedIds.length} аллокаций, так как они назначены серверам`
      })
    }
    
    // Удаляем аллокации
    await db.delete(allocations).where(inArray(allocations.id, ids))
    
    return { 
      success: true, 
      message: `Удалено ${ids.length} аллокаций` 
    }
  } catch (error: any) {
    console.error('Error batch deleting allocations:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Ошибка удаления аллокаций'
    })
  }
})