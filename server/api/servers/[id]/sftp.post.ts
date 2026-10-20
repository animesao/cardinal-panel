// @ts-nocheck
// POST /api/servers/[id]/sftp — сгенерировать новый личный SFTP-пароль
// вызывающего (владелец: srv-<server8>, мембер: srv-<server8>-<user8>).
// Новый пароль заливается в wings и сохраняется в sftp_credentials
// (у владельца — также в servers.sftp_password). Старый умирает сразу.
// Возвращает полный {host, port, username, password}.
import crypto from 'node:crypto'
import { servers, sftpCredentials } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import {
  requireServer, wingsFetch, needPerm, logActivity,
  sftpUsernameFor, ensureSftpCredential,
} from '../../../utils/wings'

function nodeHost(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv, node, session, isOwner } = ctx
  // Ротация пароля — это МУТАЦИЯ credential'а, поэтому нужен уровень
  // записи. Раньше достаточно было file.read (уровень 1), то есть
  // read-only API-ключ мог перебить пароль владельца.
  needPerm(ctx, 'file.update')
  const callerId = session?.user?.id
  const username = isOwner ? sftpUsernameFor(srv.uuid, null) : sftpUsernameFor(srv.uuid, session?.user?.uuid || null)

  const password = crypto.randomBytes(18).toString('base64url')
  // Сначала wings: упал — БД не трогаем, старый пароль продолжает работать.
  await ensureSftpCredential(node, srv.uuid, username, password)

  const rows = await db.select().from(sftpCredentials)
    .where(and(eq(sftpCredentials.serverId, srv.id), eq(sftpCredentials.userId, callerId)))
    .limit(1)
  if (rows.length) {
    await db.update(sftpCredentials).set({ username, password }).where(eq(sftpCredentials.id, rows[0].id))
  } else {
    await db.insert(sftpCredentials).values({ serverId: srv.id, userId: callerId, username, password })
  }
  if (isOwner) {
    await db.update(servers).set({ sftpPassword: password }).where(eq(servers.id, srv.id))
  }
  await logActivity(db, srv.id, callerId, 'sftp.password', 'Обновил SFTP-пароль')

  let info: any = {}
  try {
    info = await wingsFetch(node, '/v1/sftp/info')
  } catch { info = {} }

  return {
    host: nodeHost(node.url),
    port: info?.port || 2022,
    username,
    password,
  }
})
