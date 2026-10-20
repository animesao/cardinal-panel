// @ts-nocheck
// POST /api/servers/[id]/files/folder {path} — создание папки через wings fm/mkdir.
import { requireServer, wingsFetch, containerRef, needPerm, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  const { path } = body
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx
  needPerm(ctx, 'file.create')

  if (!id || !path) throw createError({ statusCode: 400, message: 'Неверные параметры' })

  await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/fm/mkdir`, {
    method: 'POST',
    body: { path },
  })
  await logActivity(ctx.db, srv.id, ctx.session.user.id, 'file.mkdir', `Создал папку ${path}`)

  return { success: true }
})
