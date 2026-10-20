// @ts-nocheck
// POST /api/servers/[id]/schedules {name, action, payload?, intervalMinutes?, active?}.
// Только владелец/админ. nextRunAt сразу = now + interval.
import { schedules } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, needKeyWrite, needPerm, logActivity } from '../../../../utils/wings'
import { SCHEDULE_ACTIONS, nextRun } from '../../../../utils/schedules'
import { insertAndGetId } from '../../../../db'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event).catch(() => ({}))
  const ctx = await requireServer(event, id)
  if (!ctx.isAdmin && !ctx.isOwner) throw createError({ statusCode: 403, message: 'Нет доступа' })
  needKeyWrite(ctx)

  const name = String(body?.name || '').trim().slice(0, 255) || 'schedule'
  const action = String(body?.action || '')
  if (!SCHEDULE_ACTIONS.includes(action)) throw createError({ statusCode: 400, message: 'action: start|stop|restart|command' })
  const payload = action === 'command' ? String(body?.payload || '').trim().slice(0, 2000) : null
  if (action === 'command' && !payload) throw createError({ statusCode: 400, message: 'Пустая команда' })
  // Команда уходит в консоль сервера — значит, нужно право на консоль.
  if (action === 'command') needPerm(ctx, 'control.console')
  const intervalMinutes = Math.min(10080, Math.max(5, Math.round(Number(body?.intervalMinutes) || 60)))
  const active = body?.active === undefined ? 1 : (body.active ? 1 : 0)

  const newId = await insertAndGetId(schedules, {
    serverId: id,
    name,
    action,
    payload,
    intervalMinutes,
    active,
    nextRunAt: nextRun(new Date(), intervalMinutes),
  })
  await logActivity(ctx.db, id, ctx.session.user.id, 'schedule.create', `Расписание «${name}»: ${action} каждые ${intervalMinutes} мин`)
  return { success: true, id: newId }
})
