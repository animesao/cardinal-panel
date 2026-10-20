// @ts-nocheck
// POST /api/remote/sftp/auth — проверка SFTP-логина со стороны wings
// (см. panelSFTPAuth в cardinal-wings): {username, password, type}.
// Принимаем три вида логинов:
//   1. per-user креды wings: username = srv-<server8> (владелец) или
//      srv-<server8>-<user8> (мембер), password из sftp_credentials
//      → {server: "srv-<server-uuid>"} (имя контейнера в cardinal).
//   2. легаси owner-кред: username = srv-<8hex>, password =
//      servers.sftp_password (креды до per-user миграции).
//   3. панельный логин: username = user.uuid, password = users.sftp_password
//      → {server} первого сервера пользователя.
// Авторизация: Bearer-токен ноды (nodes.token; wings шлёт "tokenID.token"
// либо "token" — сверяем секретную часть).
import { getDb } from '../../../db'
import { users, nodes, servers, serverUsers, sftpCredentials } from '../../../db/schema'
import { eq, like } from 'drizzle-orm'
import crypto from 'node:crypto'

// timingSafeEqual для строк разной длины: сравниваем SHA256.
function secretsEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const { username, password } = body || {}
  if (!username || !password) throw createError({ statusCode: 400, message: 'username/password required' })

  const auth = getHeader(event, 'authorization') || ''
  const presented = auth.replace(/^Bearer\s+/i, '')
  if (!presented) throw createError({ statusCode: 401, message: 'Missing node token' })
  const secret = presented.includes('.') ? presented.split('.').slice(1).join('.') : presented

  const db = await getDb()
  const nodeRows = await db.select({ id: nodes.id, token: nodes.token }).from(nodes)
  const node = nodeRows.find((n) => n.token && secretsEqual(n.token, secret))
  if (!node) throw createError({ statusCode: 401, message: 'Invalid node token' })

  // 1. per-user креды wings (точное совпадение пары username+password).
  if (String(username).startsWith('srv-')) {
    const credRows = await db.select().from(sftpCredentials).where(eq(sftpCredentials.username, String(username))).limit(1)
    const cred = credRows[0]
    if (cred && cred.password && secretsEqual(cred.password, String(password))) {
      const srows = await db.select().from(servers).where(eq(servers.id, cred.serverId)).limit(1)
      if (srows.length) return { server: `srv-${srows[0].uuid}` }
    }
    // 2. Легаси: общий пароль сервера (owner-креды до per-user миграции).
    //
    // ВАЖНО: ветка живёт ТОЛЬКО для серверов, у которых ещё нет per-user
    // кредов. Как только появились персональные, общий пароль владельца
    // перестаёт давать доступ: иначе мембер, которому отозвали file.read,
    // продолжал ходить по SFTP с общим паролем — и в аудите wings выглядел
    // как владелец.
    const short = String(username).slice(4, 12)
    const all = await db.select().from(servers).where(like(servers.uuid, `${short}%`))
    const hit = all.find((s) => s.uuid.replace(/-/g, '').slice(0, 8) === short && s.sftpPassword && secretsEqual(s.sftpPassword, String(password)))
    if (!hit) throw createError({ statusCode: 401, message: 'Invalid SFTP credentials' })
    const perUser = await db.select({ id: sftpCredentials.id })
      .from(sftpCredentials).where(eq(sftpCredentials.serverId, hit.id)).limit(1)
    if (perUser.length) {
      throw createError({ statusCode: 401, message: 'Invalid SFTP credentials' })
    }
    return { server: `srv-${hit.uuid}` }
  }

  // 3. панельный логин пользователя: свои серверы, затем расшаренные
  // с доступом к файлам. Без file.read личный вход не пускает — иначе
  // отозванный/урезанный мембер заходил бы своим паролем мимо прав.
  const urows = await db.select().from(users).where(eq(users.uuid, username)).limit(1)
  if (!urows.length || !urows[0].sftpPassword || !secretsEqual(urows[0].sftpPassword, String(password))) {
    throw createError({ statusCode: 401, message: 'Invalid SFTP credentials' })
  }
  const srows = await db.select().from(servers).where(eq(servers.ownerId, urows[0].id)).limit(1)
  if (srows.length) return { server: `srv-${srows[0].uuid}` }
  const memberRows = await db.select({ member: serverUsers, server: servers })
    .from(serverUsers)
    .leftJoin(servers, eq(serverUsers.serverId, servers.id))
    .where(eq(serverUsers.userId, urows[0].id))
    .orderBy(serverUsers.serverId)
  for (const m of memberRows) {
    if (!m.server) continue
    let perms: string[] = []
    try {
      const parsed = JSON.parse(m.member.permissions || '[]')
      if (Array.isArray(parsed)) perms = parsed.filter((p) => typeof p === 'string')
    } catch {}
    if (perms.includes('file.read')) return { server: `srv-${m.server.uuid}` }
  }
  throw createError({ statusCode: 401, message: 'Invalid SFTP credentials' })
})
