// @ts-nocheck
import { getDb, insertAndGetId } from '../../db'
import { locations } from '../../db/schema'
import { requireAdmin } from '../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  try {
    const body = await readBody(event)
    const { name, description, address, city, country } = body
    
    if (!name) {
      throw createError({
        statusCode: 400,
        message: 'Название локации обязательно'
      })
    }
    
    const db = await getDb()
    
    const newId = await insertAndGetId(locations, {
      name,
      description: description || null,
      address: address || null,
      city: city || null,
      country: country || null,
    })
    
    return {
      success: true,
      message: 'Локация успешно создана',
      id: newId
    }
  } catch (error) {
    console.error('Error creating location:', error)
    throw createError({
      statusCode: 500,
      message: 'Ошибка создания локации'
    })
  }
})