// @ts-nocheck
// GET /api/servers/[id]/files/download?path= — скачивание через wings
// fm/download (base64), панель отдаёт байты с Content-Disposition.
import { requireServer, wingsFetch, containerRef, needPerm } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const query = getQuery(event)
  const path = query.path as string
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx
  needPerm(ctx, 'file.read')

  if (!id || !path) throw createError({ statusCode: 400, message: 'Неверные параметры' })

  const res: any = await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/fm/download?path=${encodeURIComponent(path)}`)
  const buf = Buffer.from(res?.content || '', 'base64')
  // Имя из пути wings: режем всё, что ломает Content-Disposition
  // (кавычки, CRLF, слэши) — иначе возможен header-splitting/XSS именем.
  const fileName = (path.split('/').pop() || 'file').replace(/["\\\r\n/]/g, '').slice(0, 128) || 'file'

  event.node.res.setHeader('Content-Type', 'application/octet-stream')
  event.node.res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  event.node.res.setHeader('Content-Length', buf.length)
  return buf
})
