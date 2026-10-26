// @ts-nocheck
// POST /api/servers/[id]/files/rename {from, to} — через wings fm/move.
import { requireServer, wingsFetch, containerRef, needPerm, logActivity } from '../../../../utils/wings'
import { validateServerFilePath } from '../../../../utils/file-path'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  const { from: rawFrom, to: rawTo } = body
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx
  needPerm(ctx, 'file.update')

  if (!id || !rawFrom || !rawTo) throw createError({ statusCode: 400, message: 'Неверные параметры' })
  const from = validateServerFilePath(rawFrom)
  const to = validateServerFilePath(rawTo)

  await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/fm/move`, {
    method: 'POST',
    body: { src: from, dst: to },
  })
  await logActivity(ctx.db, srv.id, ctx.session.user.id, 'file.rename', `Переименовал ${from} → ${to}`)

  return { success: true }
})
