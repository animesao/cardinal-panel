// server/plugins/scheduler.ts — тик планировщика расписаний (раз в 60с):
// забирает due (active + nextRunAt <= now, пачками по 25) и выполняет
// через shared runSchedule. Падение одного не останавливает остальных.
import { getDb } from '../db'
import { schedules } from '../db/schema'
import { eq, and, lte } from 'drizzle-orm'
import { runSchedule } from '../utils/schedules'

export default defineNitroPlugin(() => {
  const tick = async () => {
    try {
      const db = await getDb()
      const due = await db.select({ id: schedules.id }).from(schedules)
        .where(and(eq(schedules.active, 1), lte(schedules.nextRunAt, new Date())))
        .limit(25)
      for (const s of due) {
        try {
          await runSchedule(db, s.id, null)
        } catch (e: any) {
          console.warn(`[scheduler] #${s.id}:`, e?.message || e)
        }
      }
    } catch (e: any) {
      console.warn('[scheduler] tick:', e?.message || e)
    }
  }
  setInterval(tick, 60000)
})
