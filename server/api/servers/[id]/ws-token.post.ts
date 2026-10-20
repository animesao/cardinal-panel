// @ts-nocheck
// POST /api/servers/[id]/ws-token — данные для консоли браузера:
// {url, token}. token — JWT (HS256, ключ = токен ноды) со scope=websocket,
// url — legacy-протокол wings GET /api/servers/<ref>/ws.
// POST, а не GET: минт токена + запись в activity — неидемпотентная операция.
// Замороженный сервер консоль не открывает (как power/command/reinstall).
import { requireServer, containerRef, mintWingsJwt, wingsWsUrl, needPerm, logActivity } from '../../../utils/wings'

const PERMS_OWNER = ['websocket.connect', 'control.console', 'control.start', 'control.stop', 'control.restart']
const PERMS_ADMIN = [...PERMS_OWNER, 'admin.websocket.install']

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { srv, node, session } = ctx
  if (srv.suspended) throw createError({ statusCode: 403, message: 'Сервер заморожен администратором' })
  needPerm(ctx, 'websocket.connect')

  const ref = containerRef(srv.uuid)

  const token = mintWingsJwt(node.token, {
    server_uuid: ref,
    scope: 'websocket',
    permissions: ctx.isAdmin
      ? PERMS_ADMIN
      : ctx.isOwner
        ? PERMS_OWNER
        : ['websocket.connect', ...ctx.permissions.filter((p) => p.startsWith('control.'))],
    user_uuid: session.user.uuid,
  }, 600)
  await logActivity(ctx.db, srv.id, session.user.id, 'console.open', 'Открыл консоль')

  return { url: wingsWsUrl(node, ref), token }
})
