// @ts-nocheck
// PUT /api/servers/[id]/users/[userId] {permissions} — поменять набор прав.
// Без эскалации: не-владелец выдаёт только права из своего набора.
// Убрали file.read — личный SFTP-кред мембера отзывается точечно
// (остальные участники не страдают, общий пароль не трогаем).
import { serverUsers, sftpCredentials, users } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, needPerm, sanitizePermissions, removeSftpCredential, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const userId = parseInt(event.context.params?.userId || '0')
  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  needPerm(ctx, 'user.update')
  if (!id || !userId) throw createError({ statusCode: 400, message: 'Некорректные параметры' })

  const body = await readBody(event).catch(() => ({}))
  const permissions = sanitizePermissions(body?.permissions)
  if (!permissions.length) throw createError({ statusCode: 400, message: 'Выбери хотя бы одно право' })

  if (!ctx.isAdmin && !ctx.isOwner) {
    const extra = permissions.filter((p) => !ctx.permissions.includes(p))
    if (extra.length) {
      throw createError({ statusCode: 403, message: `Нельзя выдать права, которых нет у тебя: ${extra.join(', ')}` })
    }
  }

  const rows = await db.select().from(serverUsers)
    .where(and(eq(serverUsers.serverId, srv.id), eq(serverUsers.userId, userId)))
    .limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Пользователь не найден' })

  await db.update(serverUsers).set({ permissions: JSON.stringify(permissions) }).where(eq(serverUsers.id, rows[0].id))
  const turows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  await logActivity(db, srv.id, ctx.session.user.id, 'user.update', `Обновил права ${turows[0]?.email || `#${userId}`}`)

  // Без file.read вход по личному креду больше не положен — отзываем его.
  if (!permissions.includes('file.read')) {
    const credRows = await db.select().from(sftpCredentials)
      .where(and(eq(sftpCredentials.serverId, srv.id), eq(sftpCredentials.userId, userId)))
      .limit(1)
    if (credRows.length) {
      await db.delete(sftpCredentials).where(eq(sftpCredentials.id, credRows[0].id))
      if (node?.url && node?.token) {
        try {
          await removeSftpCredential(node, srv.uuid, credRows[0].username)
        } catch (e: any) {
          console.warn('SFTP credential revoke after file.read revoke failed:', e?.message)
        }
      }
    }
  }

  return { success: true, permissions }
})
