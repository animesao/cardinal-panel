// @ts-nocheck
// POST /api/users/sftp-password — генерация панельного SFTP-пароля
// пользователя (users.sftp_password). Используется для SFTP-входа по
// паре user.uuid + пароль: wings проверяет их через
// POST /api/remote/sftp/auth.
import crypto from 'node:crypto'
import { getDb } from '../../db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const password = crypto.randomBytes(18).toString('base64url')
  const db = await getDb()
  await db.update(users).set({ sftpPassword: password }).where(eq(users.id, session.user.id))

  return { success: true, password }
})
