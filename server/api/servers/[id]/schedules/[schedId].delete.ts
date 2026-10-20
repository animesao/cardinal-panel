// @ts-nocheck
// DELETE /api/servers/[id]/schedules/[schedId] — удаление расписания.
import { schedules } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, needKeyWrite, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const schedId = parseInt(event.context.params?.schedId || '0')
  const ctx = await requireServer(event, id)
  if (!ctx.isAdmin && !ctx.isOwner) throw createError({ statusCode: 403, message: 'Нет доступа' })
  needKeyWrite(ctx)

  const rows = await ctx.db.select().from(schedules)
    .where(and(eq(schedules.id, schedId), eq(schedules.serverId, id))).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Расписание не найдено' })

  await ctx.db.delete(schedules).where(eq(schedules.id, schedId))
  await logActivity(ctx.db, id, ctx.session.user.id, 'schedule.delete', `Удалил расписание «${rows[0].name}»`)
  return { success: true }
})
