// @ts-nocheck
// GET /api/servers/[id]/resources — живые CPU/RAM/диск из wings
// (GET /v1/containers/srv-<uuid>/stats), нормализованные к {cpu, memory, disk}.
import { requireServer, wingsFetch, containerRef, normalizeStats } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const { srv, node } = await requireServer(event, id)

  try {
    const stats = await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/stats`)
    return normalizeStats(stats)
  } catch (e) {
    return { cpu: 0, memory: 0, disk: 0 }
  }
})
