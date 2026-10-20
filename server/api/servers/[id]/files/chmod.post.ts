// @ts-nocheck
// POST /api/servers/[id]/files/chmod {file, mode} — через wings fm/chmod.
import { requireServer, wingsFetch, containerRef, needPerm, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx
  needPerm(ctx, 'file.update')

  if (!id) throw createError({ statusCode: 400, message: 'Неверные параметры' })

  // Режим — только octal 3-4 цифры: клиентскую проверку легко обойти,
  // а мусор уходит в chmod контейнера.
  const mode = String(body.mode || '')
  if (!/^[0-7]{3,4}$/.test(mode)) throw createError({ statusCode: 400, message: 'Режим: 3-4 восьмеричные цифры (например 644)' })

  await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/fm/chmod`, {
    method: 'POST',
    body: { path: body.path || body.file, mode },
  })
  await logActivity(ctx.db, srv.id, ctx.session.user.id, 'file.chmod', `Права ${body.path || body.file} → ${mode}`)

  return { success: true }
})
