// @ts-nocheck
// POST /api/admin/nodes — создание ноды + пуш конфига в wings
// (POST /v1/config: panel_url + токен для SFTP-проверок и колбэков бэкапов).
import { getDb, insertAndGetId } from '../../../db'
import { nodes } from '../../../db/schema'
import { wingsFetch, assertNodeUrl } from '../../../utils/wings'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  const body = await readBody(event)
  const { name, token, locationId, memory, disk, swap } = body
  const databaseHostId = body?.databaseHostId ?? body?.database_host_id ?? null
  const url = assertNodeUrl(body?.url)

  if (!name || !url || !token) {
    throw createError({
      statusCode: 400,
      message: 'Название, URL и токен обязательны'
    })
  }

  // URL и токен — это binding из установщика wings (URL + Token).
  const db = await getDb()

  const nodeId = await insertAndGetId(nodes, {
    name,
    url,
    token,
    locationId: locationId || null,
    memory: memory || 0,
    disk: disk || 0,
    swap: swap || 0,
    databaseHostId: databaseHostId || null,
  })

  let wingsSynced = false
  let wingsError = null
  if (process.env.NUXT_PANEL_URL) {
    try {
      const version = await wingsFetch({ url, token }, '/v1/version')
      await wingsFetch({ url, token }, '/v1/config', {
        method: 'POST',
        body: { panel_url: process.env.NUXT_PANEL_URL, token },
      })
      wingsSynced = true
      console.log(`[Nodes API] Wings ${url} linked (version:`, version?.version || version, ')')
    } catch (e: any) {
      wingsError = e?.message || String(e)
      console.warn('[Nodes API] Wings link failed:', wingsError)
    }
  }

  return {
    success: true,
    message: wingsSynced ? 'Нода успешно создана и связана с wings' : 'Нода создана (wings не подтвержден — проверьте URL/токен)',
    id: nodeId,
    wingsSynced,
    wingsError,
  }
})
