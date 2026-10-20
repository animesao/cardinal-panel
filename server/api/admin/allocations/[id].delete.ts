// @ts-nocheck
import { getDb } from '../../../db'
import { allocations } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  try {
    // Правильно получаем id из параметров роута
    const id = parseInt(event.context.params?.id || '0')
    
    if (!id || id === 0) {
      throw createError({ statusCode: 400, message: 'Allocation ID required' })
    }
    
    const db = await getDb()
    
    // Проверяем, не назначена ли аллокация серверу
    const allocation = await db
      .select()
      .from(allocations)
      .where(eq(allocations.id, id))
      .limit(1)
    
    if (allocation.length === 0) {
      throw createError({ statusCode: 404, message: 'Аллокация не найдена' })
    }
    
    if (allocation[0].assigned === 'yes') {
      throw createError({
        statusCode: 400,
        message: 'Нельзя удалить аллокацию, назначенную серверу'
      })
    }
    
    await db.delete(allocations).where(eq(allocations.id, id))
    
    return { success: true, message: 'Аллокация удалена' }
  } catch (error: any) {
    console.error('Error deleting allocation:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Ошибка удаления аллокации'
    })
  }
})