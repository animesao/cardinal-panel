// @ts-nocheck
// POST /api/servers/[id]/backups/[backupId]/restore — восстановление
// хранимого снапшота через wings (POST /v1/.../backup {backup_uuid}).
import { backups } from '../../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, wingsFetch, containerRef, needPerm, logActivity } from '../../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const backupId = event.context.params?.backupId
  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  needPerm(ctx, 'backup.restore')

  const rows = await db.select().from(backups)
    .where(and(eq(backups.uuid, backupId), eq(backups.serverId, srv.id))).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Бэкап не найден' })

  const res = await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/backup`, {
    method: 'POST',
    body: { backup_uuid: backupId },
  })
  await logActivity(db, srv.id, ctx.session.user.id, 'backup.restore', `Восстановил из «${rows[0].name}»`)
  return res
})
