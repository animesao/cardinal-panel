// @ts-nocheck
// server/middleware/auth-ratelimit.ts — лимит по IP на чувствительные
// маршруты аутентификации.
//
// Почему здесь, а не в обработчике credentials: там next-auth отдаёт только
// заголовки запроса, а X-Forwarded-For подделывается клиентом. Здесь
// доступен реальный адрес сокета (event.node.req.socket.remoteAddress),
// поэтому лимит не обходится сменой заголовка.
//
// Лимит по идентичности (e-mail) живёт в server/api/auth/[...].ts —
// его подделать нельзя в принципе. Здесь — защита от распределённого
// перебора и от перебора 2FA-кодов.
import { clientIp } from '../utils/clientip'
import { checkAttemptBucket } from '../utils/ratelimit'

// Маршруты, которые нельзя дёргать без ограничений.
const PROTECTED = [
  '/api/auth/callback/credentials',
  '/api/auth/signin',
  '/api/auth/csrf',
  '/api/account/password',
  '/api/account/2fa/',
  '/api/users/sftp-password',
]

const IP_LIMIT = 30
const IP_WINDOW_MS = 60 * 1000

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!PROTECTED.some((p) => path.startsWith(p))) return

  const ip = clientIp(event)
  if (checkAttemptBucket(`route:${ip}:${path}`, IP_LIMIT, IP_WINDOW_MS)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
})
