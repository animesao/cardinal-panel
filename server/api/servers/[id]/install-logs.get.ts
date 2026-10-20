// @ts-nocheck
// GET /api/servers/[id]/install-logs — хвост логов контейнера из wings
// (GET /v1/containers/srv-<uuid>/logs?tail=200).
import { requireServer, wingsFetch, containerRef, needPerm } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  // Логи установки могут содержать URL сборки и вывод — это тот же уровень
  // доступа, что и чтение файлов. Раньше маршрут был доступен любому
  // мемберу сервера вообще без прав.
  needPerm(ctx, 'file.read')
  const { srv, node } = ctx

  try {
    const logs = await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/logs?tail=200`)
    if (typeof logs === 'string') return logs.split('\n').filter(Boolean)
    return logs
  } catch (e) {
    return ['Логи установки пока недоступны...']
  }
})
