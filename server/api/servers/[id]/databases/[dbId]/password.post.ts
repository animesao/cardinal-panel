// @ts-nocheck
// POST /api/servers/[id]/databases/[dbId]/password — ротация пароля:
// новый пароль сначала на хост (ALTER USER + verify), затем в БД.
// При падении хоста строка не меняется — рассинхрона нет.
import { serverDatabases, databaseHosts } from '../../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireServer, needPerm, logActivity } from '../../../../../utils/wings'
import { rotateDatabasePassword, verifyDatabaseUser } from '../../../../../utils/databases'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const dbId = parseInt(event.context.params?.dbId || '0')
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  needPerm(ctx, 'database.create')

  const rows = await db.select().from(serverDatabases)
    .where(and(eq(serverDatabases.id, dbId), eq(serverDatabases.serverId, srv.id))).limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'База не найдена' })
  const rec = rows[0]

  const hosts = await db.select().from(databaseHosts).where(eq(databaseHosts.id, rec.hostId)).limit(1)
  if (!hosts.length) throw createError({ statusCode: 400, message: 'Хост базы данных не найден' })

  let password
  try {
    password = await rotateDatabasePassword(hosts[0], rec.username)
    await verifyDatabaseUser(hosts[0], { dbName: rec.name, username: rec.username, password })
  } catch (e) {
    throw createError({ statusCode: 502, message: `Хост не принял новый пароль: ${e?.message || e}` })
  }

  await db.update(serverDatabases).set({ password }).where(eq(serverDatabases.id, dbId))
  await logActivity(db, srv.id, ctx.session.user.id, 'database.password', `Сменил пароль базы «${rec.name}»`)
  return { success: true, password }
})
