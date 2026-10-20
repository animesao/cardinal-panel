// @ts-nocheck
// GET /api/blueprints — каталог чертежей (обогащённые: images[],
// variables[], snake-алиасы — см. server/utils/blueprints.ts).
import { getDb } from '../db'
import { blueprints } from '../db/schema'
import { getServerSession } from '#auth'
import { enrichBlueprint } from '../utils/blueprints'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401 })

  const db = await getDb()
  const rows = await db.select().from(blueprints).orderBy(blueprints.createdAt)
  return rows.map(enrichBlueprint)
})
