// @ts-nocheck
// DELETE /api/admin/database-hosts/[id] — удаление хоста.
// container-режим: сначала сносим MySQL-контейнер на ноде (best effort,
// том ktdb-<id> с данными остаётся на ноде), затем отвязка нод и запись.
// external: только отвязка нод + запись (базы серверов — каскадом по FK).
import { getDb } from '../../../db'
import { databaseHosts, nodes } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'
import { wingsFetch } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400 })

  const db = await getDb()
  const rows = await db.select().from(databaseHosts).where(eq(databaseHosts.id, id)).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Хост не найден' })
  const host = rows[0]

  if (host.provisioning === 'container' && host.containerRef) {
    try {
      let wingsNode = null
      if (host.nodeId) {
        const nrows = await db.select().from(nodes).where(eq(nodes.id, host.nodeId)).limit(1)
        wingsNode = nrows[0] || null
      }
      if (wingsNode?.url && wingsNode?.token) {
        await wingsFetch(wingsNode, `/v1/containers/${host.containerRef}?force=1`, { method: 'DELETE' })
      }
    } catch (e) {
      console.warn('DB container remove failed (continuing):', e?.message)
    }
  }

  await db.update(nodes).set({ databaseHostId: null }).where(eq(nodes.databaseHostId, id))
  await db.delete(databaseHosts).where(eq(databaseHosts.id, id))

  return { success: true }
})
