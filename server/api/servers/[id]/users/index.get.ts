// @ts-nocheck
// GET /api/servers/[id]/users — субпользователи сервера + каталог прав.
// Владелец/админ видят всегда; субпользователь — только с user.read.
import { serverUsers, users } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, needPerm, SUBUSER_PERMISSIONS } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  needPerm(ctx, 'user.read')

  const rows = await db.select({ member: serverUsers, user: users })
    .from(serverUsers)
    .leftJoin(users, eq(serverUsers.userId, users.id))
    .where(eq(serverUsers.serverId, srv.id))

  const members = rows.map((r) => {
    let permissions: string[] = []
    try {
      const parsed = JSON.parse(r.member.permissions || '[]')
      if (Array.isArray(parsed)) permissions = parsed.filter((p) => typeof p === 'string')
    } catch {}
    return {
      userId: r.member.userId,
      email: r.user?.email || '—',
      name: r.user?.name || null,
      permissions,
    }
  })

  return { members, catalog: SUBUSER_PERMISSIONS }
})
