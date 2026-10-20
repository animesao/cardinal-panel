// @ts-nocheck
// POST /api/servers/[id]/reinstall — переустановка через wings
// (POST /v1/containers/srv-<uuid>/reinstall с полным CreateRequest).
// Именованный том данных сохраняется, файлы выживают.
import { servers, allocations } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, wingsFetch, buildCreatePayload, serverExtraPorts, needPerm, logActivity } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  if (srv.suspended) throw createError({ statusCode: 403, message: 'Сервер заморожен администратором' })
  needPerm(ctx, 'startup.update')

  let allocation = null
  if (srv.allocationId) {
    const rows = await db.select().from(allocations).where(eq(allocations.id, srv.allocationId)).limit(1)
    allocation = rows[0] || null
  }
  // Доп. порты — в тот же CreateRequest, иначе reinstall их снесёт
  // (контейнер пересоздаётся с нуля, маппинги не наследуются).
  const extras = await serverExtraPorts(db, srv.id, srv.allocationId)

  const ref = `srv-${srv.uuid}`
  const res = await wingsFetch(node, `/v1/containers/${ref}/reinstall`, {
    method: 'POST',
    body: buildCreatePayload(srv, allocation, extras),
  })

  await db.update(servers).set({ status: 'running' }).where(eq(servers.id, id))
  await logActivity(db, srv.id, ctx.session.user.id, 'server.reinstall', 'Переустановил сервер')
  return { success: true, ...res }
})
