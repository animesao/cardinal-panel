// @ts-nocheck
// GET /api/servers/[id]/backups/[backupId]/download — скачивание хранимого
// снапшота. Панель минтит короткий JWT (scope backup-download) и
// перенаправляет браузер прямо на wings-ноду:
// GET {node}/download/backup?token=… (без Bearer, проверка по подписи).
import { backups } from '../../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, containerRef, mintWingsJwt, needPerm } from '../../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const backupId = event.context.params?.backupId
  const ctx = await requireServer(event, id)
  const { db, srv, node, session } = ctx
  needPerm(ctx, 'backup.read')

  const rows = await db.select().from(backups)
    .where(and(eq(backups.uuid, backupId), eq(backups.serverId, srv.id))).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Бэкап не найден' })

  const token = mintWingsJwt(node.token, {
    server_uuid: containerRef(srv.uuid),
    backup_uuid: backupId,
    scope: 'backup-download',
    user_uuid: session.user.uuid,
  }, 300)

  const base = String(node.url).replace(/\/+$/, '')
  return sendRedirect(event, `${base}/download/backup?token=${token}`, 302)
})
