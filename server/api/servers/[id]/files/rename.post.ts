// @ts-nocheck
// POST /api/servers/[id]/files/rename {from, to} — через wings fm/move.
import { requireServer, wingsFetch, containerRef, needPerm, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  const { from, to } = body
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx
  needPerm(ctx, 'file.update')

  if (!id || !from || !to) throw createError({ statusCode: 400, message: 'Неверные параметры' })

  await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/fm/move`, {
    method: 'POST',
    body: { src: from, dst: to },
  })
  await logActivity(ctx.db, srv.id, ctx.session.user.id, 'file.rename', `Переименовал ${from} → ${to}`)

  return { success: true }
})
