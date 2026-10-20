// @ts-nocheck
// GET /api/servers/[id]/environment — окружение сервера объектом
// (парсинг servers.environment). Просмотр — с правом startup.read,
// правки — только startup.update (см. environment.put).
import { parseEnvObject } from '../../../utils/blueprints'
import { requireServer, needPerm } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  needPerm(ctx, 'startup.read')
  const { srv } = ctx
  return parseEnvObject(srv.environment)
})
