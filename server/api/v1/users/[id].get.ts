// @ts-nocheck
// GET /api/v1/users/[id] — один пользователь (ключ админа, чтение, без секретов).
import { users, userTotp } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireApiKey, needLevel, requireAdminKey } from '../../../utils/apikeys'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireApiKey(event)
  needLevel(ctx, 'users', 1)
  requireAdminKey(ctx)
  if (!id) throw createError({ statusCode: 400, message: 'Некорректный id' })
  const rows = await ctx.db.select({
    id: users.id,
    uuid: users.uuid,
    email: users.email,
    name: users.name,
    role: users.role,
    createdAt: users.createdAt,
    totpEnabled: userTotp.enabled,
  }).from(users).leftJoin(userTotp, eq(userTotp.userId, users.id)).where(eq(users.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Пользователь не найден' })
  return { ...rows[0], totpEnabled: !!rows[0].totpEnabled }
})
