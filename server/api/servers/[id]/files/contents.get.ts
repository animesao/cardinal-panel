// @ts-nocheck
// GET /api/servers/[id]/files/contents?path= — текст файла через wings fm/read.
import { requireServer, wingsFetch, containerRef, needPerm } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const query = getQuery(event)
  const path = query.path as string
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx
  needPerm(ctx, 'file.read')

  if (!id || !path) throw createError({ statusCode: 400, message: 'Неверные параметры' })

  const res: any = await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/fm/read?path=${encodeURIComponent(path)}`)
  return typeof res?.content === 'string' ? res.content : res
})
