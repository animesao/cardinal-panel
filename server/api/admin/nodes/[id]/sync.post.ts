// @ts-nocheck
// POST /api/admin/nodes/[id]/sync — синхронизировать данные ноды с хостом:
// опросить wings (/v1/system/info) и записать реальные память/диск в БД.
// Ничего руками вбивать не нужно. Swap остаётся ручным (wings его не отдаёт).
import { getDb } from '../../../../db'
import { nodes } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { fetchNodeResources } from '../../../../utils/wings'
import { requireAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400, message: 'ID ноды не указан' })

  const db = await getDb()
  const rows = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1)
  if (!rows.length || !rows[0].url || !rows[0].token) {
    throw createError({ statusCode: 400, message: 'У ноды нет URL или токена' })
  }

  let res: any
  try {
    res = await fetchNodeResources(rows[0])
  } catch (e: any) {
    throw createError({ statusCode: 502, message: `Нода не отвечает: ${e?.message || e}` })
  }

  const updates: any = {}
  if (res.memory > 0) updates.memory = res.memory
  if (res.disk > 0) updates.disk = res.disk
  if (!Object.keys(updates).length) {
    throw createError({ statusCode: 502, message: 'Нода отдала пустые данные' })
  }
  await db.update(nodes).set(updates).where(eq(nodes.id, id))

  return { success: true, ...updates, hostname: res.hostname, cpu: res.cpu }
})
