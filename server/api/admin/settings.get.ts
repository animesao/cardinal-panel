// @ts-nocheck
// GET /api/admin/settings — все настройки панели (только админы).
// Секреты OAuth наружу не отдаём — только факт, что секрет сохранён.
import { getDb } from '../../db'
import { settings } from '../../db/schema'
import { requireAdmin } from '../../utils/admin'
import { DEFAULT_PANEL_NAME, getOAuthAdmin } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = await getDb()
  const rows = await db.select().from(settings)
  const map = Object.fromEntries(rows.map((r) => [r.name, r.value]))
  return {
    panel_name: map.panel_name || DEFAULT_PANEL_NAME,
    oauth: await getOAuthAdmin(),
  }
})
