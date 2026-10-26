// @ts-nocheck
// GET /api/servers/[id]/files?path=/ — листинг через wings fm/list,
// нормализованный к формату ServerFiles.vue:
// [{name, directory, size, modified}].
import { requireServer, wingsFetch, containerRef, normalizeFiles, needPerm } from '../../../utils/wings'
import { validateServerFilePath } from '../../../utils/file-path'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const query = getQuery(event)
  const rawPath = (query.path as string) || '/'
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx
  needPerm(ctx, 'file.read')
  const path = validateServerFilePath(rawPath)

  const fm = await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/fm/list?path=${encodeURIComponent(path)}`)
  return normalizeFiles(fm)
})
