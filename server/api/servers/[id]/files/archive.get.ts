// @ts-nocheck
// GET /api/servers/[id]/files/archive?path= — скачать папку архивом (.zip)
// через wings fm/download-zip (base64), панель отдаёт байты с Content-Disposition.
import { requireServer, wingsFetch, containerRef, needPerm } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const query = getQuery(event)
  const path = query.path as string
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx
  needPerm(ctx, 'file.archive')

  if (!id || !path) throw createError({ statusCode: 400, message: 'Неверные параметры' })

  const res: any = await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/fm/download-zip?path=${encodeURIComponent(path)}`)
  const buf = Buffer.from(res?.content || '', 'base64')
  if (!buf.length) throw createError({ statusCode: 404, message: 'Папка пуста или не найдена' })
  const base = (path.split('/').pop() || 'archive').replace(/["\\\r\n/]/g, '').slice(0, 100) || 'archive'
  const fileName = `${base}.zip`

  event.node.res.setHeader('Content-Type', 'application/zip')
  event.node.res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  event.node.res.setHeader('Content-Length', buf.length)
  return buf
})
