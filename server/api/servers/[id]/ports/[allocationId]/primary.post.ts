// @ts-nocheck
// POST /api/servers/[id]/ports/[allocationId]/primary — сделать порт основным
// (primary allocation как в Pterodactyl): servers.allocationId переключается,
// старый primary остаётся доп. портом. SERVER_IP/SERVER_PORT в окружении
// обновляются, команда запуска перерендеривается и пушится в wings — адрес
// сервера и шаблоны следуют за новым основным портом.
import { servers, allocations } from '../../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, wingsFetch, containerRef, renderStartup, serverVars, splitAllocationIp, needPerm, logActivity } from '../../../../../utils/wings'
import { parseEnvObject } from '../../../../../utils/blueprints'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const allocId = parseInt(event.context.params?.allocationId || '0')
  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  needPerm(ctx, 'allocation.update')
  if (!id || !allocId) throw createError({ statusCode: 400, message: 'Некорректные параметры' })

  const rows = await db.select().from(allocations).where(eq(allocations.id, allocId)).limit(1)
  if (!rows.length || rows[0].serverId !== srv.id) {
    throw createError({ statusCode: 404, message: 'Порт не найден' })
  }
  if (srv.allocationId && rows[0].id === srv.allocationId) {
    return { success: true, message: 'Уже основной' }
  }

  const { ip: newIp } = splitAllocationIp(rows[0].ip)
  const extraEnv = parseEnvObject(srv.environment)
  extraEnv.SERVER_IP = newIp
  extraEnv.SERVER_PORT = rows[0].port
  const rendered = renderStartup(
    srv.startup,
    serverVars({ ...srv }, { ip: newIp, port: rows[0].port }, extraEnv),
  )

  try {
    await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/update`, {
      method: 'POST',
      body: { startup_script: rendered },
    })
  } catch (e: any) {
    throw createError({ statusCode: 502, message: `Нода не применила смену порта: ${e?.message || e}` })
  }

  await db.update(servers).set({
    allocationId: rows[0].id,
    environment: JSON.stringify(extraEnv),
  }).where(eq(servers.id, srv.id))
  await logActivity(db, srv.id, ctx.session.user.id, 'ports.primary', `Основной порт → ${newIp}:${rows[0].port}`)

  return { success: true, id: rows[0].id, ip: newIp, port: rows[0].port }
})
