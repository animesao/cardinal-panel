// @ts-nocheck
// POST /api/account/2fa/enable {token} — подтвердить setup кодом из app.
// Включает 2FA и ОДИН РАЗ отдаёт резервные коды (дальше их не показать).
import { getDb } from '../../../db'
import { userTotp } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { verifyTotp, generateBackupCodes, hashBackupCode } from '../../../utils/totp'
import { unsealSecret } from '../../../utils/oauth-seal'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const db = await getDb()
  const body = await readBody(event).catch(() => ({}))
  const rows = await db.select().from(userTotp).where(eq(userTotp.userId, session.user.id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 400, message: 'Сначала начни setup' })
  if (rows[0].enabled) throw createError({ statusCode: 409, message: '2FA уже включена' })

  let secret = ''
  try {
    secret = unsealSecret(rows[0].secret)
  } catch {
    throw createError({ statusCode: 500, message: 'Секрет повреждён — начни setup заново' })
  }
  if (!verifyTotp(secret, String(body?.token || ''))) {
    throw createError({ statusCode: 403, message: 'Неверный код — проверь время на телефоне' })
  }
  const codes = generateBackupCodes()
  await db.update(userTotp).set({
    enabled: 1,
    backupCodes: JSON.stringify(codes.map(hashBackupCode)),
  }).where(eq(userTotp.userId, session.user.id))
  return { success: true, backupCodes: codes }
})
