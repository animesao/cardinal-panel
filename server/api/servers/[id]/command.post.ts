// @ts-nocheck
// POST /api/servers/[id]/command {command: string}
// Отправка команды в консоль сервера REST'ом (без WS):
// прокси в wings terminal/input (stdin главного процесса, как Pterodactyl).
import { requireServer, wingsFetch, containerRef, needPerm, logActivity } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event).catch(() => ({}))
  const command = String(body?.command ?? body?.cmd ?? '')

  if (!command.trim()) throw createError({ statusCode: 400, message: 'Пустая команда' })
  if (command.length > 2000) throw createError({ statusCode: 400, message: 'Команда: максимум 2000 символов' })

  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  if (srv.suspended) throw createError({ statusCode: 403, message: 'Сервер заморожен администратором' })
  needPerm(ctx, 'control.console')

  const ref = containerRef(srv.uuid)
  const data = command.endsWith('\n') ? command : `${command}\n`
  try {
    await wingsFetch(node, `/v1/containers/${ref}/terminal/input`, {
      method: 'POST',
      body: { data },
    })
  } catch (e: any) {
    if (e?.statusCode === 404) {
      await wingsFetch(node, `/v1/containers/${ref}/terminal`, { method: 'POST' })
      await wingsFetch(node, `/v1/containers/${ref}/terminal/input`, {
        method: 'POST',
        body: { data },
      })
    } else {
      throw e
    }
  }

  await logActivity(db, srv.id, ctx.session.user.id, 'console.command', `Команда: ${command.slice(0, 200)}`)
  return { success: true }
})
