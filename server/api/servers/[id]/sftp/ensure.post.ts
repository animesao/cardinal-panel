// @ts-nocheck
// POST /api/servers/[id]/sftp/ensure — идемпотентное создание личного
// SFTP-креда вызывающего (тем же паролем из БД или новым).
// Выделено из GET: создание кредов в wings + запись в БД —
// не GET-операция (CSRF через top-level навигацию с Lax-кукой).
import crypto from 'node:crypto'
import { servers, sftpCredentials } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import {
  requireServer, wingsFetch, needPerm,
  sftpUsernameFor, ensureSftpCredential, wingsSftpUsernames,
} from '../../../../utils/wings'

function nodeHost(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv, node, session, isOwner } = ctx
  // Создание/ротация кредов — мутация, нужен уровень записи.
  needPerm(ctx, 'file.update')

  let info: any = {}
  try {
    info = await wingsFetch(node, '/v1/sftp/info')
  } catch { info = {} }
  if (info && info.enabled === false) {
    throw createError({ statusCode: 409, message: 'SFTP выключен на этой ноде' })
  }

  const callerUuid = session?.user?.uuid || null
  const callerId = session?.user?.id
  const username = isOwner ? sftpUsernameFor(srv.uuid, null) : sftpUsernameFor(srv.uuid, callerUuid)

  let password: string | null = null
  const credRows = await db.select().from(sftpCredentials)
    .where(and(eq(sftpCredentials.serverId, srv.id), eq(sftpCredentials.userId, callerId)))
    .limit(1)
  if (credRows.length) {
    password = credRows[0].password
  } else if (isOwner && srv.sftpPassword) {
    password = srv.sftpPassword
  }

  const present = (await wingsSftpUsernames(node, srv.uuid)).includes(username)
  if (!present) {
    if (!password) password = crypto.randomBytes(18).toString('base64url')
    await ensureSftpCredential(node, srv.uuid, username, password)
  }
  if (!password) {
    password = crypto.randomBytes(18).toString('base64url')
    await ensureSftpCredential(node, srv.uuid, username, password)
  }

  if (credRows.length) {
    if (credRows[0].password !== password || credRows[0].username !== username) {
      await db.update(sftpCredentials)
        .set({ username, password })
        .where(eq(sftpCredentials.id, credRows[0].id))
    }
  } else {
    await db.insert(sftpCredentials).values({ serverId: srv.id, userId: callerId, username, password })
  }
  if (isOwner && srv.sftpPassword !== password) {
    await db.update(servers).set({ sftpPassword: password }).where(eq(servers.id, srv.id))
  }

  return {
    host: nodeHost(node.url),
    port: info?.port || 2022,
    username,
    password,
  }
})
