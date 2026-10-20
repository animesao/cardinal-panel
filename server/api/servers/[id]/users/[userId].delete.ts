// @ts-nocheck
// DELETE /api/servers/[id]/users/[userId] — убрать субпользователя с сервера.
// Отзываем только его личный SFTP-кред (`srv-<server8>-<user8>` в wings +
// строка sftp_credentials). Общий пароль сервера больше не ротируется —
// остальные участники и владелец продолжают работать как раньше.
import { serverUsers, sftpCredentials, users } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, needPerm, sftpUsernameFor, removeSftpCredential, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const userId = parseInt(event.context.params?.userId || '0')
  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  needPerm(ctx, 'user.delete')
  if (!id || !userId) throw createError({ statusCode: 400, message: 'Некорректные параметры' })

  const rows = await db.select().from(serverUsers)
    .where(and(eq(serverUsers.serverId, srv.id), eq(serverUsers.userId, userId)))
    .limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Пользователь не найден' })

  // Username — из строки креда, либо вычисленный (чистка сирот без строки).
  let username: string | null = null
  const credRows = await db.select().from(sftpCredentials)
    .where(and(eq(sftpCredentials.serverId, srv.id), eq(sftpCredentials.userId, userId)))
    .limit(1)
  if (credRows.length) {
    username = credRows[0].username
  } else {
    const urows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (urows[0]?.uuid) username = sftpUsernameFor(srv.uuid, urows[0].uuid)
  }

  await db.delete(serverUsers).where(eq(serverUsers.id, rows[0].id))
  if (credRows.length) {
    await db.delete(sftpCredentials).where(eq(sftpCredentials.id, credRows[0].id))
  }

  if (username && node?.url && node?.token) {
    try {
      await removeSftpCredential(node, srv.uuid, username)
    } catch (e: any) {
      console.warn('SFTP credential revoke after member remove failed:', e?.message)
    }
  }
  const durows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  await logActivity(db, srv.id, ctx.session.user.id, 'user.remove', `Убрал ${durows[0]?.email || `#${userId}`}`)

  return { success: true }
})
