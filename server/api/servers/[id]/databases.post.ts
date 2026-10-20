// @ts-nocheck
// POST /api/servers/[id]/databases — создание базы с полностью
// автоматическими реквизитами (имя/пользователь/пароль — рандом).
// Хост: явный hostId|host_id (если ноде назначен хост — только он),
// иначе хост ноды, иначе первый доступный.
import { serverDatabases, databaseHosts, nodes } from '../../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireServer, needPerm, logActivity } from '../../../utils/wings'
import { insertAndGetId } from '../../../db'
import { provisionDatabase, waitForMysql, verifyDatabaseUser, dropProvisionedDatabase } from '../../../utils/databases'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event).catch(() => ({}))
  const ctx = await requireServer(event, id)
  const { db, srv } = ctx
  needPerm(ctx, 'database.create')
  const wantedHostId = body?.hostId ?? body?.host_id ?? null

  // databaseSlots: 0 = безлимит, N = максимум N баз на сервере.
  const dbLimit = Number(srv.databaseSlots) || 0
  if (!ctx.isAdmin && dbLimit > 0) {
    const cnt = await db.select({ n: sql`count(*)`.mapWith(Number) }).from(serverDatabases).where(eq(serverDatabases.serverId, srv.id))
    if ((cnt[0]?.n || 0) >= dbLimit) {
      throw createError({ statusCode: 403, message: `Лимит баз данных исчерпан (${dbLimit}). Удали старые или попроси админа.` })
    }
  }

  // Хост, назначенный ноде сервера (может отсутствовать).
  let mappedHostId = null
  if (srv.nodeId) {
    const nrows = await db.select({ databaseHostId: nodes.databaseHostId }).from(nodes).where(eq(nodes.id, srv.nodeId)).limit(1)
    mappedHostId = nrows[0]?.databaseHostId ?? null
  }

  if (wantedHostId && mappedHostId && Number(wantedHostId) !== mappedHostId) {
    throw createError({ statusCode: 403, message: 'Для ноды сервера назначен другой хост БД' })
  }

  let host = null
  const pickId = wantedHostId || mappedHostId
  if (pickId) {
    const rows = await db.select().from(databaseHosts).where(eq(databaseHosts.id, Number(pickId))).limit(1)
    host = rows[0] || null
  } else {
    const rows = await db.select().from(databaseHosts).limit(1)
    host = rows[0] || null
  }
  if (!host) throw createError({ statusCode: 400, message: 'Нет доступных хостов баз данных (назначьте хост ноде в Admin → Nodes)' })

  let creds
  try {
    // Контейнер мог ещё не догрузиться после создания хоста — ждём.
    await waitForMysql(host, 90000, 3000)
    creds = await provisionDatabase(host, srv.id)
    // Контрольное подключение новыми реквизитами: доказывает, что база,
    // пользователь и гранты реально создались и работают.
    await verifyDatabaseUser(host, creds)
  } catch (e) {
    // Не оставляем битую базу: сносим созданное и отдаём понятную ошибку.
    if (creds) {
      try { await dropProvisionedDatabase(host, creds.dbName, creds.username) } catch {}
    }
    throw createError({ statusCode: 502, message: `БД не прошла проверку подключения: ${e?.message || e}` })
  }

  const newId = await insertAndGetId(serverDatabases, {
    serverId: srv.id,
    hostId: host.id,
    name: creds.dbName,
    username: creds.username,
    password: creds.password,
  })
  await logActivity(db, srv.id, ctx.session.user.id, 'database.create', `Создал базу «${creds.dbName}»`)

  return { success: true, id: newId, ...creds, host: host.host, port: host.port }
})
