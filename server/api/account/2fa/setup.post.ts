// @ts-nocheck
// POST /api/account/2fa/setup {password} — начать включение 2FA.
// Проверяет пароль, кладёт зашифрованный секрет как pending (enabled=0).
// Ответ {secret, otpauthUrl} показывается ОДИН РАЗ — дальше только код из app.
import { getDb } from '../../../db'
import { users, userTotp } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { verifyPassword } from '../../../utils/password'
import { generateTotpSecret, otpauthUrl } from '../../../utils/totp'
import { sealSecret } from '../../../utils/oauth-seal'
import QRCode from 'qrcode'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const db = await getDb()
  const body = await readBody(event).catch(() => ({}))
  const urows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!urows.length) throw createError({ statusCode: 401, message: 'Не авторизован' })
  const user = urows[0]

  if (!user.passwordHash) throw createError({ statusCode: 400, message: 'Сначала задай пароль (вход по почте+паролю)' })
  if (!verifyPassword(String(body?.password || ''), user.passwordHash)) {
    throw createError({ statusCode: 403, message: 'Неверный пароль' })
  }
  const trows = await db.select().from(userTotp).where(eq(userTotp.userId, user.id)).limit(1)
  if (trows.length && trows[0].enabled) throw createError({ statusCode: 409, message: '2FA уже включена — сначала отключи' })

  const secret = generateTotpSecret()
  const sealed = sealSecret(secret)
  if (trows.length) {
    await db.update(userTotp).set({ secret: sealed, enabled: 0, backupCodes: null }).where(eq(userTotp.userId, user.id))
  } else {
    await db.insert(userTotp).values({ userId: user.id, secret: sealed, enabled: 0, backupCodes: null })
  }
  const url = otpauthUrl(secret, user.email)
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 })
  return { secret, otpauthUrl: url, qr }
})
