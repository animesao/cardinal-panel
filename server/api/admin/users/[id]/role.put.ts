// @ts-nocheck
import { getDb } from '../../../../db'
import { users } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  try {
    const id = parseInt(event.context.params?.id || '')
    const body = await readBody(event)
    const { role } = body
    
    if (!id) {
      throw createError({
        statusCode: 400,
        message: 'ID пользователя не указан'
      })
    }
    
    if (!role || !['user', 'admin'].includes(role)) {
      throw createError({
        statusCode: 400,
        message: 'Некорректная роль'
      })
    }
    
    const db = await getDb()
    
    // Проверяем, что не пытаемся изменить роль последнего админа
    if (role === 'user') {
      const adminCount = await db.$count(users, eq(users.role, 'admin'))
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, id)
      })
      
      if (targetUser?.role === 'admin' && adminCount <= 1) {
        throw createError({
          statusCode: 400,
          message: 'Нельзя изменить роль последнего администратора'
        })
      }
    }
    
    await db.update(users)
      .set({ role })
      .where(eq(users.id, id))
    
    return {
      success: true,
      message: 'Роль успешно обновлена'
    }
  } catch (error) {
    console.error('Error updating role:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Ошибка обновления роли'
    })
  }
})