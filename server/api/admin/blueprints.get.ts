// @ts-nocheck
// GET /api/admin/blueprints — чертежи из БД панели (обогащённые).
import { getDb } from '../../db'
import { blueprints } from '../../db/schema'
import { requireAdmin } from '../../utils/admin'
import { enrichBlueprint } from '../../utils/blueprints'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = await getDb()
  const rows = await db.select().from(blueprints).orderBy(blueprints.createdAt)
  return rows.map(enrichBlueprint)
})
