// @ts-nocheck
// GET /api/v1/servers/[uuid]/resources — живые CPU/RAM/диск + статус.
// Скоп servers.read.
import { requireApiKey, needLevel, resolveKeyServer } from '../../../../utils/apikeys'
import { wingsFetch, containerRef, normalizeStats } from '../../../../utils/wings'

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
  const uuid = event.context.params?.uuid
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'servers', 1)
  const { srv, node } = await resolveKeyServer(ctx.db, ctx, uuid)
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
