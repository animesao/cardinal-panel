// @ts-nocheck
// POST /api/account/2fa/disable {password, token} — выключить 2FA.
// Нужны оба фактора: пароль (если задан) + код из app или резервный код.
import { getDb } from '../../../db'
import { users, userTotp } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { verifyPassword } from '../../../utils/password'
import { verifyTotp, hashBackupCode } from '../../../utils/totp'
import { unsealSecret } from '../../../utils/oauth-seal'

function parseCodes(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(v)) return v.filter((c) => typeof c === 'string')
  } catch {}
  return []
}

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
  let secret = ''
  try {
    secret = unsealSecret(rows[0].secret)
  } catch {
    throw createError({ statusCode: 500, message: 'Секрет повреждён' })
  }
  const token = String(body?.token || '')
  const totpOk = verifyTotp(secret, token)
  const codes = parseCodes(rows[0].backupCodes)
  const backupOk = !totpOk && codes.includes(hashBackupCode(token))
  if (!totpOk && !backupOk) throw createError({ statusCode: 403, message: 'Неверный код' })

  await db.delete(userTotp).where(eq(userTotp.userId, user.id))
  return { success: true }
})
