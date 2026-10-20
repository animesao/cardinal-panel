// @ts-nocheck
// POST /api/servers/[id]/ports {protocol?} — занять доп. порт.
// Порт всегда выдаётся автоматически (первый свободный в пуле ноды),
// выбрать конкретный нельзя — ни игроку, ни админу через этот эндпоинт.
// Обычный игрок: только из пула ноды (свободные строки allocations) и строго
// в пределах слотов (servers.port_slots).
// Свобода проверяется дважды: по пулу панели и живьём по ноде (usedHostPorts).
// Затем маппинг host:container=port:port пушится в контейнер (ports/add).
import { allocations } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, wingsFetch, containerRef, serverExtraPorts, splitAllocationIp, usedHostPorts, needPerm, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  needPerm(ctx, 'allocation.create')
  const isAdmin = ctx.isAdmin
  const body = await readBody(event).catch(() => ({}))
  const protocol = String(body?.protocol || 'tcp').toLowerCase() === 'udp' ? 'udp' : 'tcp'

  const primRows = srv.allocationId
    ? await db.select().from(allocations).where(eq(allocations.id, srv.allocationId)).limit(1)
    : []
  const primary = primRows[0] || null
  const primaryIp = primary ? splitAllocationIp(primary.ip).ip : null
  const extras = await serverExtraPorts(db, srv.id, srv.allocationId)

  if (!isAdmin) {
    // portSlots: 0 = безлимит, N = максимум N доп. портов.
    const slots = Number(srv.portSlots) || 0
    if (slots > 0 && extras.length >= slots) {
      throw createError({ statusCode: 403, message: `Лимит доп. портов исчерпан (${extras.length}/${slots}). Попроси админа выдать слоты.` })
    }
  }

  const taken = new Set(extras.map((e) => `${e.ip}:${e.port}/${e.protocol}`))
  if (primary) {
    const pp = splitAllocationIp(primary.ip)
    taken.add(`${pp.ip}:${primary.port}/${pp.protocol}`)
  }

  let live = new Set()
  try { live = await usedHostPorts(node) } catch { live = new Set() }
  const busy = (ip, port, proto) => taken.has(`${ip}:${port}/${proto}`) || live.has(port)

  let targetIp = null
  let targetPort = null
  let poolRowId = null

  // Автовыдача: первый свободный в пуле ноды (сначала IP primary-аллокации,
  // затем по возрастанию порта). Конкретный порт запросить нельзя.
  const pool = await db.select().from(allocations)
    .where(and(eq(allocations.nodeId, srv.nodeId), eq(allocations.assigned, 'no')))
  const norm = pool.map((r) => ({ row: r, ...splitAllocationIp(r.ip) }))
    .filter((c) => c.protocol === protocol)
    .sort((a, b) => ((a.ip === primaryIp ? 0 : 1) - (b.ip === primaryIp ? 0 : 1)) || (a.row.port - b.row.port))
  const found = norm.find((c) => !busy(c.ip, c.row.port, protocol))
  if (!found) {
    throw createError({ statusCode: 409, message: 'В пуле ноды нет свободных портов. Попроси админа добавить аллокации.' })
  }
  targetIp = found.ip
  targetPort = found.row.port
  poolRowId = found.row.id

  await db.update(allocations).set({ assigned: 'yes', serverId: srv.id }).where(eq(allocations.id, poolRowId))

  try {
    await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/ports/add`, {
      method: 'POST',
      body: { mapping: `${targetPort}:${targetPort}/${protocol}` },
    })
  } catch (e: any) {
    try { await db.update(allocations).set({ assigned: 'no', serverId: null }).where(eq(allocations.id, poolRowId)) } catch {}
    throw createError({ statusCode: 502, message: `Нода не приняла маппинг порта: ${e?.message || e}` })
  }
  await logActivity(db, srv.id, ctx.session.user.id, 'ports.add', `Занял порт ${targetPort}/${protocol}`)

  return { success: true, id: poolRowId, ip: targetIp, port: targetPort, protocol }
})
