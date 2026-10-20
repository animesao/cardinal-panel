// @ts-nocheck
// GET /api/servers/[id]/activity — журнал действий на сервере.
// Владелец/админ видят всегда; субпользователь — только с activity.read.
import { serverActivity, users } from '../../../../db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { requireServer, needPerm } from '../../../../utils/wings'
import { pageAliases } from '../../../../utils/pagination'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const query = { ...getQuery(event), ...pageAliases(getQuery(event)) }
  const limit = Math.min(Math.max(parseInt(query.limit) || 50, 1), 200)
  const offset = Math.max(parseInt(query.offset) || 0, 0)
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  needPerm(ctx, 'activity.read')

  // Общее число — в заголовке (для нумерованных страниц в UI).
  const totalRows = await db.select({ n: sql<number>`count(*)` })
    .from(serverActivity)
    .where(eq(serverActivity.serverId, srv.id))
  event.node.res.setHeader('X-Total-Count', Number(totalRows[0]?.n) || 0)

  const rows = await db.select({
    id: serverActivity.id,
    action: serverActivity.action,
    detail: serverActivity.detail,
    createdAt: serverActivity.createdAt,
    actor: {
      id: users.id,
      email: users.email,
      name: users.name,
    },
  })
    .from(serverActivity)
    .leftJoin(users, eq(serverActivity.userId, users.id))
    .where(eq(serverActivity.serverId, srv.id))
    .orderBy(desc(serverActivity.id))
    .limit(limit)
    .offset(offset)

  return rows
})
