// @ts-nocheck
// PUT /api/servers/[id]/schedules/[schedId] — правка расписания
// (имя, действие, команда, интервал, вкл/выкл). Выключение/включение
// пересчитывает nextRunAt от текущего момента.
import { schedules } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, needKeyWrite, needPerm, logActivity } from '../../../../utils/wings'
import { SCHEDULE_ACTIONS, nextRun } from '../../../../utils/schedules'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const schedId = parseInt(event.context.params?.schedId || '0')
  const body = await readBody(event).catch(() => ({}))
  const ctx = await requireServer(event, id)
  if (!ctx.isAdmin && !ctx.isOwner) throw createError({ statusCode: 403, message: 'Нет доступа' })
  needKeyWrite(ctx)

  const rows = await ctx.db.select().from(schedules)
    .where(and(eq(schedules.id, schedId), eq(schedules.serverId, id))).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Расписание не найдено' })

  const patch: any = {}
  if (body.name !== undefined) patch.name = String(body.name || '').trim().slice(0, 255) || rows[0].name
  if (body.action !== undefined) {
    if (!SCHEDULE_ACTIONS.includes(String(body.action))) throw createError({ statusCode: 400, message: 'action: start|stop|restart|command' })
    patch.action = String(body.action)
    patch.payload = patch.action === 'command' ? String(body.payload ?? rows[0].payload ?? '').trim().slice(0, 2000) : null
    if (patch.action === 'command' && !patch.payload) throw createError({ statusCode: 400, message: 'Пустая команда' })
  } else if (body.payload !== undefined && rows[0].action === 'command') {
    patch.payload = String(body.payload || '').trim().slice(0, 2000) || null
  }
  if (body.intervalMinutes !== undefined) {
    patch.intervalMinutes = Math.min(10080, Math.max(5, Math.round(Number(body.intervalMinutes) || 60)))
  }
  if (body.active !== undefined) {
    patch.active = body.active ? 1 : 0
    patch.nextRunAt = nextRun(new Date(), patch.intervalMinutes ?? rows[0].intervalMinutes)
  }
  if (!Object.keys(patch).length) return { success: true }

  // Команда уходит в консоль сервера — значит, нужно право на консоль.
  if (patch.action === 'command' || rows[0].action === 'command') {
    needPerm(ctx, 'control.console')
  }

  await ctx.db.update(schedules).set(patch).where(eq(schedules.id, schedId))
  await logActivity(ctx.db, id, ctx.session.user.id, 'schedule.update', `Расписание «${patch.name || rows[0].name}»`)
  return { success: true }
})
