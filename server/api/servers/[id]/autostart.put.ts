// @ts-nocheck
// PUT /api/servers/[id]/autostart {enabled} — автозапуск сервера при старте
// ноды. Владелец и админ. Панель хранит флаг, wings при загрузке спрашивает
// GET /api/remote/autostart и поднимает помеченные контейнеры.
import { servers } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, needPerm, needKeyWrite, logActivity } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  if (!ctx.isAdmin && !ctx.isOwner) throw createError({ statusCode: 403, message: 'Только владелец и админ' })
  needKeyWrite(ctx)
  const body = await readBody(event).catch(() => ({}))
  const enabled = !!(body?.enabled ?? body?.autoStart)

  await db.update(servers).set({ autoStart: enabled ? 1 : 0 }).where(eq(servers.id, srv.id))
  await logActivity(db, srv.id, ctx.session.user.id, 'server.autostart', enabled ? 'Включил автозапуск' : 'Выключил автозапуск')

  return { success: true, autoStart: enabled }
})
