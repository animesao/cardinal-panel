// @ts-nocheck
// PUT /api/admin/blueprints/[id] — обновление чертежа.
import { getDb } from '../../../db'
import { blueprints } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'

function normalizeJson(v: any) {
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

  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  if (!id || !body) throw createError({ statusCode: 400 })

  const { name, description, image, environment } = body
  const startupCommand = body.startupCommand ?? body.startup ?? body.startup_command
  const installScript = body.installScript ?? body.install_script
  const images = normalizeJson(body.images ?? body.images_text)
  const variables = normalizeJson(body.variables ?? body.variables_text)
  const db = await getDb()
  await db.update(blueprints).set({
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(image !== undefined ? { image } : {}),
    ...(startupCommand !== undefined ? { startupCommand } : {}),
    ...(environment !== undefined ? { environment: typeof environment === 'string' ? environment : JSON.stringify(environment) } : {}),
    ...(installScript !== undefined ? { installScript } : {}),
    ...(images !== undefined ? { images } : {}),
    ...(variables !== undefined ? { variables } : {}),
  }).where(eq(blueprints.id, id))

  return { success: true }
})
