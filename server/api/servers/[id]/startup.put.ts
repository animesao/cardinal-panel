// @ts-nocheck
// PUT /api/servers/[id]/startup {startup} — команда запуска.
// Хранится в БД панели и синхронизируется в cardinal
// (POST /v1/containers/srv-<uuid>/update {startup_script}), применяется
// cardinal при следующем старте контейнера.
import { getDb } from '../../../db'
import { servers, allocations } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, wingsFetch, containerRef, renderStartup, serverVars, needPerm, logActivity } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  const { startup } = body

  if (!id || !startup) {
    throw createError({ statusCode: 400, message: 'ID сервера и команда запуска обязательны' })
  }

  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  needPerm(ctx, 'startup.update')

  await db.update(servers).set({ startup }).where(eq(servers.id, id))

  try {
    let allocation = null
    if (srv.allocationId) {
      const rows = await db.select().from(allocations).where(eq(allocations.id, srv.allocationId)).limit(1)
      allocation = rows[0] || null
    }
    let extraEnv = {}
    try { extraEnv = srv.environment ? JSON.parse(srv.environment) : {} } catch {}
    const vars = serverVars({ ...srv, startup }, allocation, extraEnv)
    await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/update`, {
      method: 'POST',
      body: { startup_script: renderStartup(startup, vars) },
    })
  } catch (e) {
    console.warn('Wings startup sync failed:', e?.message)
  }
  await logActivity(db, srv.id, ctx.session.user.id, 'startup.update', 'Обновил команду запуска')

  return { success: true, message: 'Команда запуска обновлена' }
})
