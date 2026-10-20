// @ts-nocheck
// GET /api/servers/[id]/schedules — список расписаний сервера.
// Только владелец/админ (отдельных прав мемберов нет, как у автозапуска).
import { schedules } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  if (!ctx.isAdmin && !ctx.isOwner) throw createError({ statusCode: 403, message: 'Нет доступа' })
  const rows = await ctx.db.select().from(schedules).where(eq(schedules.serverId, id))
  return rows.map((r) => ({ ...r, payload: r.action === 'command' ? r.payload : null }))
})
