// @ts-nocheck
// POST /api/servers/[id]/schedules/[schedId]/run — выполнить сейчас
// (вне расписания). Замороженный сервер — 403 без выполнения.
import { schedules } from '../../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, needKeyWrite } from '../../../../../utils/wings'
import { runSchedule } from '../../../../../utils/schedules'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const schedId = parseInt(event.context.params?.schedId || '0')
  const ctx = await requireServer(event, id)
  if (!ctx.isAdmin && !ctx.isOwner) throw createError({ statusCode: 403, message: 'Нет доступа' })
  needKeyWrite(ctx)

  const rows = await ctx.db.select().from(schedules)
    .where(and(eq(schedules.id, schedId), eq(schedules.serverId, id))).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Расписание не найдено' })

  const res = await runSchedule(ctx.db, schedId, ctx.session.user.id)
  if (res.skipped) throw createError({ statusCode: 403, message: 'Сервер заморожен администратором' })
  return { success: true }
})
