// @ts-nocheck
// DELETE /api/admin/servers/[id] — удаление сервера:
// сначала контейнер в cardinal через wings (DELETE force + чистка SFTP-кредов
// контейнера), затем освобождение аллокации и удаление строк
// (sftp_credentials и бэкапы — каскадом).
import { getDb } from '../../../../db'
import { servers, allocations, nodes } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { wingsFetch, containerRef, removeSftpCredential } from '../../../../utils/wings'
import { requireAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'Server ID required' })

  const db = await getDb()
  const rows = await db.select({ server: servers, node: nodes })
    .from(servers)
    .leftJoin(nodes, eq(servers.nodeId, nodes.id))
    .where(eq(servers.id, id))
    .limit(1)

  if (!rows.length) throw createError({ statusCode: 404, message: 'Сервер не найден' })
  const { server: srv, node } = rows[0]

  if (node?.url && node?.token) {
    try {
      await removeSftpCredential(node, srv.uuid)
    } catch (e: any) {
      console.warn('Wings SFTP cleanup failed (continuing with delete):', e?.message)
    }
    try {
      await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}?force=1`, { method: 'DELETE' })
    } catch (e: any) {
      console.warn('Wings remove failed (continuing with DB delete):', e?.message)
    }
  }

  if (srv.allocationId) {
    await db.update(allocations)
      .set({ assigned: 'no', serverId: null })
      .where(eq(allocations.id, srv.allocationId))
  }
  // Доп. порты сервера (все строки allocations с serverId) — тоже в пул.
  await db.update(allocations)
    .set({ assigned: 'no', serverId: null })
    .where(eq(allocations.serverId, id))

  await db.delete(servers).where(eq(servers.id, id))

  return { success: true, message: 'Сервер удалён' }
})
