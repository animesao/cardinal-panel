// @ts-nocheck
// GET /api/v1/servers — серверы владельца ключа (свои + расшаренные,
// админу — все). Скоп servers.read.
import { requireApiKey, needLevel, getUserServers } from '../../../utils/apikeys'
import { parseListQuery, listResponse } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'servers', 1)
  const all = await getUserServers(ctx.db, ctx.user)
  return listResponse(all, parseListQuery(getQuery(event)), ['name', 'status'])
})
