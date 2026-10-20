// @ts-nocheck
import { getDb } from '../../../db'
import { users, userTotp } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { parseListQuery, listResponse } from '../../../utils/pagination'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  try {
    const db = await getDb()

    if (!db) {
      throw createError({
        statusCode: 500,
        message: 'Database connection failed'
      })
    }

    // Проекция без sftp_password: plaintext-пароли пользователей
    // не должны утекать даже в админский листинг.
    // totpEnabled — есть ли включённая 2FA (для бейджа в списке).
    const allUsers = await db.select({
      id: users.id,
      uuid: users.uuid,
      email: users.email,
      name: users.name,
      avatar: users.avatar,
      provider: users.provider,
      providerId: users.providerId,
      role: users.role,
      createdAt: users.createdAt,
      lastLogin: users.lastLogin,
      updatedAt: users.updatedAt,
      totpEnabled: userTotp.enabled,
    }).from(users).leftJoin(userTotp, eq(userTotp.userId, users.id)).orderBy(users.createdAt)
    const shaped = allUsers.map((u) => ({ ...u, totpEnabled: !!u.totpEnabled }))
    return listResponse(shaped, parseListQuery(getQuery(event)), ['email', 'name', 'role'])
  } catch (error) {
    console.error('Error fetching users:', error)
    throw createError({
      statusCode: 500,
      message: 'Ошибка загрузки пользователей'
    })
  }
})