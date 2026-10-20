// @ts-nocheck
// POST /api/v1/servers/[uuid]/power {signal: start|stop|restart|kill}.
// Скоп servers.power. Мемберам — только сигналы из их control-прав.
import { servers } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireApiKey, needLevel, resolveKeyServer } from '../../../../utils/apikeys'
import { wingsFetch, containerRef, logActivity } from '../../../../utils/wings'

const SIGNAL_PERM = {
  start: 'control.start',
  restart: 'control.restart',
  stop: 'control.stop',
  kill: 'control.stop',
}

export default defineEventHandler(async (event) => {
  const uuid = event.context.params?.uuid
  const body = await readBody(event).catch(() => ({}))
  const signal = String(body?.signal || body?.action || '')
  if (!['start', 'stop', 'restart', 'kill'].includes(signal)) {
    throw createError({ statusCode: 400, message: 'signal: start|stop|restart|kill' })
  }
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'servers', 2)
  const { db, srv, node, isAdmin, isOwner, permissions } = await resolveKeyServer(ctx.db, ctx, uuid)

  if (!isAdmin && !isOwner && !permissions.includes(SIGNAL_PERM[signal])) {
    throw createError({ statusCode: 403, message: `Нет права ${SIGNAL_PERM[signal]}` })
  }
  if (srv.suspended) throw createError({ statusCode: 403, message: 'Сервер заморожен администратором' })

  await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/${signal}`, { method: 'POST' })

  const newStatus =
    signal === 'start' ? 'running'
    : (signal === 'stop' || signal === 'kill') ? 'stopped'
    : srv.status
  await db.update(servers).set({ status: newStatus }).where(eq(servers.id, srv.id))

  const labels = { start: 'Запустил сервер (API)', stop: 'Остановил сервер (API)', restart: 'Перезапустил сервер (API)', kill: 'Убил процесс сервера (API)' }
  await logActivity(db, srv.id, ctx.user.id, `power.${signal}`, labels[signal])

  return { success: true, status: newStatus }
})
