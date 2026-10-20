// @ts-nocheck
// GET /api/servers/[id]/live — живой статус + CPU/RAM/диск одним запросом
// (inspect + stats в wings параллельно). Для дашборда: N серверов = N
// запросов вместо 2N. Никогда не падает: нода молчит = offline + нули.
import { requireServer, wingsFetch, containerRef, normalizeStats } from '../../../utils/wings'

const mapState = (raw: any) => {
  const s = String(raw || '').toLowerCase()
  if (s === 'running' || s === 'up') return 'running'
  if (s === 'restarting') return 'starting'
  if (s === 'paused') return 'running'
  return 'offline'
}

const pickState = (info: any) => {
  if (!info || typeof info !== 'object') return null
  if (typeof info.status === 'string') return info.status
  if (info.State && typeof info.State.Status === 'string') return info.State.Status
  if (info.state && typeof info.state.status === 'string') return info.state.status
  return null
}

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const { srv, node } = await requireServer(event, id)
  const ref = containerRef(srv.uuid)
  const [info, stats] = await Promise.all([
    wingsFetch(node, `/v1/containers/${ref}`).catch(() => null),
    wingsFetch(node, `/v1/containers/${ref}/stats`).catch(() => null),
  ])
  const res = normalizeStats(stats)
  return {
    status: mapState(pickState(info)),
    cpu: res.cpu,
    memory: res.memory,
    disk: res.disk,
    limits: { memory: srv.memory, cpu: srv.cpu, disk: srv.disk },
  }
})
