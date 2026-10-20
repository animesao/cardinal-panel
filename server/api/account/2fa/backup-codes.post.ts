// @ts-nocheck
// POST /api/account/2fa/backup-codes {password} — перевыпустить резервные коды.
// Старые сгорают. Ответ показывается ОДИН РАЗ.
import { getDb } from '../../../db'
import { users, userTotp } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { verifyPassword } from '../../../utils/password'
import { generateBackupCodes, hashBackupCode } from '../../../utils/totp'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const db = await getDb()
  const body = await readBody(event).catch(() => ({}))
  const urows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!urows.length) throw createError({ statusCode: 401, message: 'Не авторизован' })
  const user = urows[0]

  const rows = await db.select().from(userTotp).where(eq(userTotp.userId, user.id)).limit(1)
  if (!rows.length || !rows[0].enabled) throw createError({ statusCode: 400, message: '2FA не включена' })
  if (user.passwordHash && !verifyPassword(String(body?.password || ''), user.passwordHash)) {
    throw createError({ statusCode: 403, message: 'Неверный пароль' })
  }
  const codes = generateBackupCodes()
  await db.update(userTotp).set({ backupCodes: JSON.stringify(codes.map(hashBackupCode)) })
    .where(eq(userTotp.userId, user.id))
  return { success: true, backupCodes: codes }
})
