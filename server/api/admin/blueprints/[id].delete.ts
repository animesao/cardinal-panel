// @ts-nocheck
// DELETE /api/admin/blueprints/[id] — удаление чертежа.
import { getDb } from '../../../db'
import { blueprints } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = parseInt(event.context.params?.id || '0')
  if (!id) throw createError({ statusCode: 400 })

  const db = await getDb()
  await db.delete(blueprints).where(eq(blueprints.id, id))

  return { success: true }
})
