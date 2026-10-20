// @ts-nocheck
// GET /api/servers/[id]/sftp — чтение личного SFTP-креда вызывающего.
// Чистое чтение без побочных эффектов: ничего не создаёт (создание —
// POST .../sftp/ensure, ротация — POST .../sftp). Нет строки в БД — 404.
import { servers, sftpCredentials } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, wingsFetch, needPerm, sftpUsernameFor } from '../../../utils/wings'

function nodeHost(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv, node, session, isOwner } = ctx
  needPerm(ctx, 'file.read')

  const callerId = session?.user?.id
  const username = isOwner
    ? sftpUsernameFor(srv.uuid, null)
    : sftpUsernameFor(srv.uuid, session?.user?.uuid || null)

  const credRows = await db.select().from(sftpCredentials)
    .where(and(eq(sftpCredentials.serverId, srv.id), eq(sftpCredentials.userId, callerId)))
    .limit(1)
  let password: string | null = credRows.length ? credRows[0].password : null
  if (!password && isOwner && srv.sftpPassword) password = srv.sftpPassword
  if (!password) throw createError({ statusCode: 404, message: 'Креды не созданы' })

  let info: any = {}
  try {
    info = await wingsFetch(node, '/v1/sftp/info')
  } catch { info = {} }

  return {
    host: nodeHost(node.url),
    port: info?.port || 2022,
    username: credRows.length ? credRows[0].username : username,
    password,
  }
})
