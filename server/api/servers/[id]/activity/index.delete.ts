// @ts-nocheck
// DELETE /api/servers/[id]/activity — очистить журнал сервера.
// Только владелец и админ (отдельного права нет — это сброс истории).
import { serverActivity } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, needKeyWrite } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  if (!ctx.isAdmin && !ctx.isOwner) throw createError({ statusCode: 403, message: 'Только владелец и админ' })
  needKeyWrite(ctx)

  await db.delete(serverActivity).where(eq(serverActivity.serverId, srv.id))
  return { success: true }
})
