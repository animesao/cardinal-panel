// @ts-nocheck
// POST /api/v1/servers/[uuid]/command {command: string}.
// Скоп servers.write. Мемберам — только с control.console.
import { requireApiKey, needLevel, resolveKeyServer } from '../../../../utils/apikeys'
import { wingsFetch, containerRef, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const uuid = event.context.params?.uuid
  const body = await readBody(event).catch(() => ({}))
  const command = String(body?.command ?? body?.cmd ?? '')

  if (!command.trim()) throw createError({ statusCode: 400, message: 'Пустая команда' })
  if (command.length > 2000) throw createError({ statusCode: 400, message: 'Команда: максимум 2000 символов' })

  const ctx = await requireApiKey(event)
  needLevel(ctx, 'servers', 2)
  const { db, srv, node, isAdmin, isOwner, permissions } = await resolveKeyServer(ctx.db, ctx, uuid)

  if (!isAdmin && !isOwner && !permissions.includes('control.console')) {
    throw createError({ statusCode: 403, message: 'Нет права control.console' })
  }
  if (srv.suspended) throw createError({ statusCode: 403, message: 'Сервер заморожен администратором' })

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

  await logActivity(db, srv.id, ctx.user.id, 'console.command', `Команда (API): ${command.slice(0, 200)}`)
  return { success: true }
})
