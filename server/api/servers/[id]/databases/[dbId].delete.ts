// @ts-nocheck
// DELETE /api/servers/[id]/databases/[dbId] — удаление базы:
// DROP на хосте (best effort) + удаление строки.
import { serverDatabases, databaseHosts } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, needPerm, logActivity } from '../../../../utils/wings'
import { dropProvisionedDatabase } from '../../../../utils/databases'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const dbId = parseInt(event.context.params?.dbId || '0')
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  needPerm(ctx, 'database.delete')

  const rows = await db.select().from(serverDatabases)
    .where(and(eq(serverDatabases.id, dbId), eq(serverDatabases.serverId, srv.id))).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'База не найдена' })

  const hosts = await db.select().from(databaseHosts).where(eq(databaseHosts.id, rows[0].hostId)).limit(1)
  if (hosts.length) {
    try {
      await dropProvisionedDatabase(hosts[0], rows[0].name, rows[0].username)
    } catch (e: any) {
      console.warn('DB host drop failed:', e?.message)
    }
  }

  await db.delete(serverDatabases).where(eq(serverDatabases.id, dbId))
  await logActivity(db, srv.id, ctx.session.user.id, 'database.delete', `Удалил базу «${rows[0].name}»`)
  return { success: true }
})
