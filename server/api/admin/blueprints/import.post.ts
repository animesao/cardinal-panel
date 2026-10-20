// @ts-nocheck
// POST /api/admin/blueprints/import — импорт яйца Pterodactyl (PTDL_v1 JSON)
// в чертёж панели: images[] для выбора версии, variables[] для настроек,
// startup как шаблон, installScript из scripts.installation.
import { getDb, insertAndGetId } from '../../../db'
import { blueprints } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'
import { eggToBlueprint, enrichBlueprint } from '../../../utils/blueprints'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const egg = body?.egg || body
  const mapped = eggToBlueprint(egg)

  const db = await getDb()
  const dup = await db.select({ id: blueprints.id }).from(blueprints).where(eq(blueprints.name, mapped.name)).limit(1)
  if (dup.length) {
    throw createError({ statusCode: 409, message: `Чертёж «${mapped.name}» уже существует — переименуй или удали старый` })
  }

  const newId = await insertAndGetId(blueprints, mapped)
  const rows = await db.select().from(blueprints).where(eq(blueprints.id, newId)).limit(1)
  const enriched = enrichBlueprint(rows[0])
  return {
    success: true,
    id: newId,
    blueprint: enriched,
    images: enriched.images.length,
    variables: enriched.variables.length,
  }
})
