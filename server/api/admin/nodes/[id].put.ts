// @ts-nocheck
// PUT /api/admin/nodes/[id] — обновление ноды в БД панели + пуш конфига
// в wings (POST /v1/config: panel_url + токен для SFTP-проверок и колбэков).
import { getDb } from '../../../db'
import { nodes } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { wingsFetch, assertNodeUrl } from '../../../utils/wings'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  const { name, token, locationId, memory, disk, swap } = body || {}
  const databaseHostId = body?.databaseHostId ?? body?.database_host_id ?? undefined

  if (!id) throw createError({ statusCode: 400, message: 'ID ноды не указан' })

  const db = await getDb()
  const updates: any = {}
  if (name !== undefined) updates.name = name
  if (body?.url !== undefined) updates.url = assertNodeUrl(body.url)
  if (token !== undefined && token !== '') updates.token = token
  if (locationId !== undefined) updates.locationId = locationId || null
  if (memory !== undefined) updates.memory = memory
  if (disk !== undefined) updates.disk = disk
  if (swap !== undefined) updates.swap = swap
  if (databaseHostId !== undefined) updates.databaseHostId = databaseHostId || null

  await db.update(nodes).set(updates).where(eq(nodes.id, id))

  const rows = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1)
  const node = rows[0]
  let wingsSynced = false
  if (node?.url && node?.token && process.env.NUXT_PANEL_URL) {
    try {
      await wingsFetch(node, '/v1/config', {
        method: 'POST',
        body: { panel_url: process.env.NUXT_PANEL_URL, token: node.token },
      })
      wingsSynced = true
    } catch (e: any) {
      console.warn('Wings config push failed:', e?.message)
    }
  }

  return { success: true, message: 'Нода успешно обновлена', wingsSynced }
})
