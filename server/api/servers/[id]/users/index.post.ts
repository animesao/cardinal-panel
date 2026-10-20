// @ts-nocheck
// POST /api/servers/[id]/users {email, permissions} — пригласить субпользователя.
// Пользователь должен иметь аккаунт панели (ищем по почте). Владелец/админ —
// без ограничений; субпользователь с user.create выдаёт только права,
// которые есть у него самого (без эскалации привилегий).
import { serverUsers, users, sftpCredentials } from '../../../../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import crypto from 'node:crypto'
import { requireServer, needPerm, sanitizePermissions, sftpUsernameFor, ensureSftpCredential, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv, session } = ctx
  needPerm(ctx, 'user.create')

  const body = await readBody(event).catch(() => ({}))
  const email = String(body?.email || '').trim().toLowerCase()
  if (!email) throw createError({ statusCode: 400, message: 'Укажи почту пользователя' })
  const permissions = sanitizePermissions(body?.permissions)
  if (!permissions.length) throw createError({ statusCode: 400, message: 'Выбери хотя бы одно право' })

  if (!ctx.isAdmin && !ctx.isOwner) {
    const extra = permissions.filter((p) => !ctx.permissions.includes(p))
    if (extra.length) {
      throw createError({ statusCode: 403, message: `Нельзя выдать права, которых нет у тебя: ${extra.join(', ')}` })
    }
  }

  const urows = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1)
  const target = urows[0]
  if (!target) throw createError({ statusCode: 404, message: 'Пользователь с такой почтой не найден — ему нужно сначала войти в панель' })
  if (target.id === srv.ownerId) throw createError({ statusCode: 400, message: 'Это владелец сервера — права у него уже есть' })
  if (target.role === 'admin') throw createError({ statusCode: 400, message: 'Админу доступ не нужен — у него есть всё' })
  if (target.id === session.user.id) throw createError({ statusCode: 400, message: 'Нельзя добавить самого себя' })

  const exists = await db.select().from(serverUsers)
    .where(and(eq(serverUsers.serverId, srv.id), eq(serverUsers.userId, target.id)))
    .limit(1)
  if (exists.length) throw createError({ statusCode: 409, message: 'Пользователь уже добавлен — поменяй ему права' })

  await db.insert(serverUsers).values({ serverId: srv.id, userId: target.id, permissions: JSON.stringify(permissions) })

  // Личный SFTP-кред мембера (`srv-<server8>-<user8>`): строка в БД всегда,
  // пуш в wings — best effort (упадёт — sftp.get сам дозальёт при первом входе).
  const { node } = ctx
  const username = sftpUsernameFor(srv.uuid, target.uuid)
  const password = crypto.randomBytes(18).toString('base64url')
  try {
    await db.insert(sftpCredentials).values({ serverId: srv.id, userId: target.id, username, password })
  } catch {}
  if (node?.url && node?.token) {
    try {
      await ensureSftpCredential(node, srv.uuid, username, password)
    } catch (e: any) {
      console.warn('SFTP credential push for new member failed:', e?.message)
    }
  }
  await logActivity(db, srv.id, session.user.id, 'user.invite', `Добавил ${target.email}`)

  return { success: true, email: target.email, permissions }
})
