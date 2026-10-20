// @ts-nocheck
// DELETE /api/servers/[id]/backups/[backupId] — удаление снапшота:
// сначала на wings-ноде, затем строка в БД панели.
import { backups } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, wingsFetch, containerRef, needPerm, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const backupId = event.context.params?.backupId
  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  needPerm(ctx, 'backup.delete')

  const rows = await db.select().from(backups)
    .where(and(eq(backups.uuid, backupId), eq(backups.serverId, srv.id))).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Бэкап не найден' })

  try {
    await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/backup?uuid=${encodeURIComponent(backupId)}`, {
      method: 'DELETE',
    })
  } catch (e: any) {
    // 404 ноды = "already gone" — строку всё равно удаляем.
    if (e?.statusCode !== 404) throw e
  }
  await db.delete(backups).where(eq(backups.uuid, backupId))
  await logActivity(db, srv.id, ctx.session.user.id, 'backup.delete', `Удалил бэкап «${rows[0].name}»`)

  return { success: true }
})
