// @ts-nocheck
// server/utils/dbhosts.ts — связь «хост БД → ноды».
//
// Одна и та же связь видна с двух сторон:
//   - нода: nodes.databaseHostId (выбор в NodeModal),
//   - хост: allowed_node_ids (мультивыбор в форме хоста).
// syncHostNodes выставляет ТОЧНОЕ множество: перечисленные ноды получают
// databaseHostId = hostId, ранее привязанные, но не перечисленные —
// сбрасываются в NULL.
import { nodes } from '../db/schema'
import { eq } from 'drizzle-orm'

export async function syncHostNodes(db: any, hostId: number, nodeIds: any) {
  const wanted = new Set(
    (Array.isArray(nodeIds) ? nodeIds : []).map(Number).filter((n) => Number.isFinite(n)),
  )
  const current = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(eq(nodes.databaseHostId, hostId))
  for (const row of current) {
    if (!wanted.has(row.id)) {
      await db.update(nodes).set({ databaseHostId: null }).where(eq(nodes.id, row.id))
    }
  }
  for (const nodeId of wanted) {
    await db.update(nodes).set({ databaseHostId: hostId }).where(eq(nodes.id, nodeId))
  }
}

// hostAllowedNodes — {hostId: [nodeIds]} для всех хостов одним запросом
// (подстановка в список хостов, чтобы не делать N+1).
export async function hostAllowedNodes(db: any) {
  const rows = await db.select({ id: nodes.id, databaseHostId: nodes.databaseHostId }).from(nodes)
  const map: Record<number, number[]> = {}
  for (const r of rows) {
    if (r.databaseHostId) {
      if (!map[r.databaseHostId]) map[r.databaseHostId] = []
      map[r.databaseHostId].push(r.id)
    }
  }
  return map
}
