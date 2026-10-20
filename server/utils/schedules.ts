// @ts-nocheck
// server/utils/schedules.ts — выполнение расписаний сервера.
// Общая для роутов и планировщика (server/plugins/scheduler.ts):
// без #auth внутри, только db + wings HTTP.
import { schedules, servers, nodes } from '../db/schema'
import { eq } from 'drizzle-orm'

export const SCHEDULE_ACTIONS = ['start', 'stop', 'restart', 'command']

export function nextRun(date = new Date(), intervalMinutes: number) {
  return new Date(date.getTime() + Math.max(5, intervalMinutes) * 60000)
}

// runSchedule — выполнить одно расписание: power через wings lifecycle,
// command через wings exec (fire-and-forget). Замороженный сервер
// пропускаем, но nextRunAt всё равно двигаем (иначе тик будет дёргать
// его каждую минуту). Возвращает {skipped} для замороженных.
export async function runSchedule(db: any, schedId: number, actorId: number | null) {
  const srows = await db.select().from(schedules).where(eq(schedules.id, schedId)).limit(1)
  if (!srows.length) throw createError({ statusCode: 404, message: 'Расписание не найдено' })
  const sched = srows[0]

  const grows = await db.select({ server: servers, node: nodes }).from(servers)
    .leftJoin(nodes, eq(servers.nodeId, nodes.id))
    .where(eq(servers.id, sched.serverId)).limit(1)
  if (!grows.length) throw createError({ statusCode: 404, message: 'Сервер не найден' })
  const { server: srv, node } = grows[0]
  if (!node?.url || !node?.token) throw createError({ statusCode: 500, message: 'Нода не настроена' })

  const now = new Date()
  const advance = () => db.update(schedules)
    .set({ lastRunAt: now, nextRunAt: nextRun(now, sched.intervalMinutes) })
    .where(eq(schedules.id, sched.id))

  if (srv.suspended) {
    await advance()
    return { skipped: true }
  }

  const ref = `srv-${srv.uuid}`
  const headers = { Authorization: `Bearer ${node.token}` }
  const base = String(node.url).replace(/\/+$/, '')
  try {
    if (sched.action === 'command') {
      if (!sched.payload) throw createError({ statusCode: 400, message: 'Пустая команда' })
      // Команда уходит в stdin главного процесса контейнера — ровно так же,
      // как ручная команда в /api/servers/[id]/command.
      //
      // Раньше здесь был POST /v1/containers/{ref}/exec с произвольной
      // shell-строкой: владелец сервера получал шелл в контейнере (а с
      // неконфинированным exec-путем — и выход с ноды). Теперь это команда
      // игрового сервера ("say привет", "stop"), без шелла.
      const data = sched.payload.endsWith('\n') ? sched.payload : `${sched.payload}\n`
      try {
        await $fetch(`${base}/v1/containers/${ref}/terminal/input`, {
          method: 'POST', headers, body: { data },
        })
      } catch (e: any) {
        if (e?.statusCode !== 404) throw e
        // Терминал ещё не создан — создаём и повторяем.
        await $fetch(`${base}/v1/containers/${ref}/terminal`, { method: 'POST', headers })
        await $fetch(`${base}/v1/containers/${ref}/terminal/input`, {
          method: 'POST', headers, body: { data },
        })
      }
    } else {
      await $fetch(`${base}/v1/containers/${ref}/${sched.action}`, { method: 'POST', headers })
    }
  } catch (e: any) {
    throw createError({ statusCode: 502, message: e?.data?.error?.message || e?.message || 'Нода недоступна' })
  }

  await advance()
  try {
    const { logActivity } = await import('./wings')
    await logActivity(db, srv.id, actorId, 'schedule.run', `Расписание «${sched.name}»: ${sched.action}`)
  } catch {}
  return { skipped: false }
}
