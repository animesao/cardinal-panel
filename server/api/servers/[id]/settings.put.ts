// @ts-nocheck
// PUT /api/servers/[id]/settings {name?, description?} — переименование
// и описание сервера. Только владелец и админ (как автозапуск):
// субпользователям имя не отдаём (нет отдельного права).
import { servers } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, needKeyWrite, logActivity } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event).catch(() => ({}))
  const ctx = await requireServer(event, id)
  const { db, srv, isAdmin, isOwner } = ctx
  if (!isAdmin && !isOwner) throw createError({ statusCode: 403, message: 'Нет доступа' })
  needKeyWrite(ctx)

  const patch = {}
  if (body.name !== undefined) {
    const name = String(body.name || '').trim()
    if (name.length < 2) throw createError({ statusCode: 400, message: 'Название: минимум 2 символа' })
    patch.name = name.slice(0, 255)
  }
  if (body.description !== undefined) {
    patch.description = String(body.description || '').slice(0, 1000) || null
  }
  if (!Object.keys(patch).length) return { success: true }

  await db.update(servers).set(patch).where(eq(servers.id, id))
  await logActivity(db, srv.id, ctx.session.user.id, 'server.rename', `Переименовал в «${patch.name || srv.name}»`)
  return { success: true, ...patch }
})
