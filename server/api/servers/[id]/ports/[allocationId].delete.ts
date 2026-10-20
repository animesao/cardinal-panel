// @ts-nocheck
// DELETE /api/servers/[id]/ports/[allocationId] — освободить доп. порт:
// снять маппинг в wings (best effort) и вернуть строку в пул ноды.
// Основной порт освободить нельзя.
import { allocations } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, wingsFetch, containerRef, splitAllocationIp, needPerm, logActivity } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const allocId = parseInt(event.context.params?.allocationId || '0')
  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  needPerm(ctx, 'allocation.delete')
  if (!id || !allocId) throw createError({ statusCode: 400, message: 'Некорректные параметры' })

  const rows = await db.select().from(allocations).where(eq(allocations.id, allocId)).limit(1)
  if (!rows.length || rows[0].serverId !== srv.id) {
    throw createError({ statusCode: 404, message: 'Порт не найден' })
  }
  if (srv.allocationId && rows[0].id === srv.allocationId) {
    throw createError({ statusCode: 400, message: 'Основной порт освободить нельзя' })
  }

  const { protocol } = splitAllocationIp(rows[0].ip)
  try {
    // ports/remove принимает форму host[/proto] (не host:container/proto
    // как ports/add): `cardinal port rm` парсит только хост-порт.
    await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/ports/remove`, {
      method: 'POST',
      body: { mapping: `${rows[0].port}/${protocol}` },
    })
  } catch (e: any) {
    console.warn('Wings ports/remove failed (freeing anyway):', e?.message)
  }
  await db.update(allocations).set({ assigned: 'no', serverId: null }).where(eq(allocations.id, allocId))
  await logActivity(db, srv.id, ctx.session.user.id, 'ports.remove', `Освободил порт ${rows[0].port}/${protocol}`)

  return { success: true }
})
