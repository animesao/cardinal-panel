// @ts-nocheck
// POST /api/admin/nodes/detect {url, token} | {id} — опросить wings-ноду
// и вернуть реальные ресурсы хоста: память/диск/CPU из /v1/system/info.
// Для автозаполнения формы ноды. {id} — существующая нода (токен берётся
// из БД, вводить заново не нужно); {url, token} — ещё не созданная.
import { getDb } from '../../../db'
import { nodes } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { assertNodeUrl, fetchNodeResources } from '../../../utils/wings'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))

  let node: any
  if (body?.id) {
    const db = await getDb()
    const rows = await db.select().from(nodes).where(eq(nodes.id, Number(body.id))).limit(1)
    if (!rows.length || !rows[0].url || !rows[0].token) {
      throw createError({ statusCode: 400, message: 'У ноды нет URL или токена' })
    }
    node = rows[0]
  } else {
    const url = assertNodeUrl(body?.url)
    const token = String(body?.token || '')
    if (!token) throw createError({ statusCode: 400, message: 'Токен обязателен' })
    node = { url, token }
  }

  try {
    return await fetchNodeResources(node)
  } catch (e: any) {
    throw createError({ statusCode: 502, message: `Нода не отвечает: ${e?.message || e}` })
  }
})
