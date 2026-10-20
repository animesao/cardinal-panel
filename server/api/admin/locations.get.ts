// @ts-nocheck
import { getDb } from '../../db'
import { locations } from '../../db/schema'
import { requireAdmin } from '../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)
  try {
    const db = await getDb()
    const allLocations = await db.select().from(locations).orderBy(locations.createdAt)
    return allLocations
  } catch (error) {
    console.error('Error fetching locations:', error)
    throw createError({
      statusCode: 500,
      message: 'Ошибка загрузки локаций'
    })
  }
})