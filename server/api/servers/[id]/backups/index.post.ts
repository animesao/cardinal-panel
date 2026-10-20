// @ts-nocheck
// POST /api/servers/[id]/backups {name?} — снапшот через wings
// (POST /v1/containers/srv-<uuid>/backup {uuid} → 202 async).
// Строка со статусом creating создаётся сразу; в completed её переводит
// колбэк wings POST /api/remote/backups/{uuid}.
import { randomUUID } from 'uncrypto'
import { backups } from '../../../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireServer, wingsFetch, containerRef, needPerm, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event).catch(() => ({}))
  const ctx = await requireServer(event, id)
  const { srv, node, db } = ctx
  needPerm(ctx, 'backup.create')

  // backupSlots: 0 = безлимит, N = максимум N бэкапов на сервере.
  const backupLimit = Number(srv.backupSlots) || 0
  if (!ctx.isAdmin && backupLimit > 0) {
    const cnt = await db.select({ n: sql`count(*)`.mapWith(Number) }).from(backups).where(eq(backups.serverId, srv.id))
    if ((cnt[0]?.n || 0) >= backupLimit) {
      throw createError({ statusCode: 403, message: `Лимит бэкапов исчерпан (${backupLimit}). Удали старые или попроси админа.` })
    }
  }

  const uuid = randomUUID()
  await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/backup`, {
    method: 'POST',
    body: { uuid },
  })

  await db.insert(backups).values({
    uuid,
    serverId: srv.id,
    name: body?.name || `backup-${new Date().toISOString().slice(0, 10)}`,
    status: 'creating',
  })
  await logActivity(db, srv.id, ctx.session.user.id, 'backup.create', `Запустил снапшот «${body?.name || uuid}»`)

  return { success: true, uuid }
})
