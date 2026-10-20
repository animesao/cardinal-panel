// @ts-nocheck
// POST /api/admin/servers/[id]/unsuspend — разморозить сервер.
import { getDb } from '../../../../db'
import { servers } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/admin'
import { logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const { db, session } = await requireAdmin(event)
  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'Server ID required' })
  const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Сервер не найден' })
  await db.update(servers).set({ suspended: 0 }).where(eq(servers.id, id))
  await logActivity(db, id, session.user.id, 'server.unsuspend', 'Разморозил сервер')
  return { success: true, suspended: 0 }
})
