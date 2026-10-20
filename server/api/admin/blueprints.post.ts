// @ts-nocheck
// POST /api/admin/blueprints — создание чертежа в БД панели.
import { getDb, insertAndGetId } from '../../db'
import { blueprints } from '../../db/schema'
import { requireAdmin } from '../../utils/admin'

// normalizeJsonList — массив/JSON-строка/текст построчно → JSON-строка или null.
function normalizeJsonList(v: any) {
  if (v === undefined || v === null) return undefined
  if (Array.isArray(v)) return v.length ? JSON.stringify(v) : null
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return null
    try {
      const parsed = JSON.parse(t)
      if (Array.isArray(parsed)) return parsed.length ? JSON.stringify(parsed) : null
      return JSON.stringify(parsed)
    } catch {
      const lines = t.split('\n').map((s) => s.trim()).filter(Boolean)
      return lines.length ? JSON.stringify(lines) : null
    }
  }
  return JSON.stringify(v)
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const { name, description, image } = body || {}
  const startupCommand = body?.startupCommand || body?.startup || body?.startup_command
  const installScript = body?.installScript ?? body?.install_script ?? null
  let environment = body?.environment
  if (!name) throw createError({ statusCode: 400, message: 'Название обязательно' })

  const db = await getDb()
  const values: any = {
    name,
    description: description || null,
    image: image || 'ghcr.io/pterodactyl/yolks:java_17',
    startupCommand: startupCommand || 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
    environment: typeof environment === 'string' ? environment : (environment ? JSON.stringify(environment) : null),
    installScript: installScript || null,
  }
  const images = normalizeJsonList(body?.images ?? body?.images_text)
  const variables = normalizeJsonList(body?.variables ?? body?.variables_text)
  if (images !== undefined) values.images = images
  if (variables !== undefined) values.variables = variables
  const newId = await insertAndGetId(blueprints, values)
  return { success: true, id: newId }
})
