// @ts-nocheck
import { getDb } from '../../../db'
import { locations } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  try {
    const id = parseInt(event.context.params?.id || '')
    
    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID локации не указан'
      })
    }
    
    const db = await getDb()
    
    await db.delete(locations).where(eq(locations.id, id))
    
    return {
      success: true,
      message: 'Локация успешно удалена'
    }
  } catch (error) {
    console.error('Error deleting location:', error)
    throw createError({
      statusCode: 500,
      message: 'Ошибка удаления локации'
    })
  }
})