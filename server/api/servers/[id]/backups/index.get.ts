// @ts-nocheck
// GET /api/servers/[id]/backups — список бэкапов из БД панели.
// Сами архивы хранит wings-нода (драйвер "agent"); завершение асинхронного
// снапшота wings сообщает сюда: POST /api/remote/backups/{uuid}.
import { backups } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, needPerm } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  needPerm(ctx, 'backup.read')

  return await db.select().from(backups).where(eq(backups.serverId, srv.id)).orderBy(backups.createdAt)
})
