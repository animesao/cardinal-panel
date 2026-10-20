// @ts-nocheck
// GET /api/servers/[id]/status — живой статус контейнера (inspect в wings).
// В отличие от колонки servers.status (обновляется по событиям), этот эндпоинт
// всегда говорит правду: страница опрашивает его раз в 3с, и бейдж/консоль
// следуют за реальными переходами offline→starting→running, включая рестарт.
// Никогда не падает: нет контейнера / нода молчит = offline.
import { requireServer, wingsFetch, containerRef } from '../../../utils/wings'

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
  try {
    const info: any = await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}`)
    const raw = pickState(info)
    return { status: mapState(raw), raw }
  } catch {
    return { status: 'offline', raw: null }
  }
})
