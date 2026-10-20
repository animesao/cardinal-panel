// @ts-nocheck
// POST /api/servers/[id]/power {action: start|stop|restart|kill}
// Прокси в cardinal-wings: POST /v1/containers/srv-<uuid>/<action>.
import { servers } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, wingsFetch, containerRef, needPerm, logActivity } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  const { action } = body

  if (!['start', 'stop', 'restart', 'kill'].includes(action)) {
    throw createError({ statusCode: 400, message: 'Invalid action' })
  }

  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  if (srv.suspended) throw createError({ statusCode: 403, message: 'Сервер заморожен администратором' })
  needPerm(ctx, action === 'start' ? 'control.start' : action === 'restart' ? 'control.restart' : 'control.stop')

  await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/${action}`, { method: 'POST' })

  const newStatus =
    action === 'start' ? 'running'
    : (action === 'stop' || action === 'kill') ? 'stopped'
    : srv.status
  await db.update(servers).set({ status: newStatus }).where(eq(servers.id, id))

  const powerLabels = { start: 'Запустил сервер', stop: 'Остановил сервер', restart: 'Перезапустил сервер', kill: 'Убил процесс сервера' }
  await logActivity(db, srv.id, ctx.session.user.id, `power.${action}`, powerLabels[action] || action)

  return { success: true, status: newStatus }
})
