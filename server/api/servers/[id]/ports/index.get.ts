// @ts-nocheck
// GET /api/servers/[id]/ports — первичный адрес + доп. порты + слоты.
import { allocations } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, serverExtraPorts, splitAllocationIp, needPerm } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  needPerm(ctx, 'allocation.read')

  let primary = null
  if (srv.allocationId) {
    const rows = await db.select().from(allocations).where(eq(allocations.id, srv.allocationId)).limit(1)
    if (rows.length) {
      const { ip, protocol } = splitAllocationIp(rows[0].ip)
      primary = { id: rows[0].id, ip, port: rows[0].port, protocol }
    }
  }
  const extras = await serverExtraPorts(db, srv.id, srv.allocationId)
  const slots = Number(srv.portSlots) || 0
  return { primary, extras, slots: { total: slots, used: extras.length } }
})
