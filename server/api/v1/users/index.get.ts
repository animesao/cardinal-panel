// @ts-nocheck
// GET /api/v1/users — пользователи (ключ админа, чтение).
// SFTP-пароли наружу НЕ отдаются.
import { users, userTotp } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireApiKey, needLevel, requireAdminKey } from '../../../utils/apikeys'
import { parseListQuery, listResponse } from '../../../utils/pagination'

export default defineEventHandler(async (event) => {
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'users', 1)
  requireAdminKey(ctx)
  const rows = await ctx.db.select({
    id: users.id,
    uuid: users.uuid,
    email: users.email,
    name: users.name,
    role: users.role,
    createdAt: users.createdAt,
    totpEnabled: userTotp.enabled,
  }).from(users).leftJoin(userTotp, eq(userTotp.userId, users.id))
  return listResponse(rows.map((u) => ({ ...u, totpEnabled: !!u.totpEnabled })), parseListQuery(getQuery(event)), ['email', 'name', 'role'])
})
