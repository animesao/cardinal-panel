// @ts-nocheck
// DELETE /api/servers/[id]/files {path} — удаление через wings fm/rm.
import { requireServer, wingsFetch, containerRef, needPerm, logActivity } from '../../../utils/wings'
import { validateServerFilePath } from '../../../utils/file-path'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  const { path: rawPath } = body
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx
  needPerm(ctx, 'file.delete')

  if (!id || !rawPath) throw createError({ statusCode: 400, message: 'Неверные параметры' })
  const path = validateServerFilePath(rawPath)

  await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/fm/rm`, {
    method: 'POST',
    body: { path },
  })
  await logActivity(ctx.db, srv.id, ctx.session.user.id, 'file.delete', `Удалил ${path}`)

  return { success: true }
})
