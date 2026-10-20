// @ts-nocheck
// POST /api/admin/database-hosts — создание хоста БД в двух режимах:
//
// container (по умолчанию): панель просит wings-ноду поднять MySQL
//   в контейнере cardinal (образ mysql:8, том ktdb-<id>, restart always,
//   свободный хост-порт с 3306 вверх). Затем ждёт готовности и пишет
//   в запись реальный host/port/containerRef.
// external: классика — адрес уже поднятого MySQL, панель только проверяет
//   соединение root-данными и сохраняет запись.
//
// В обоих режимах после записи синхронизируются слоты нод
// (allowed_node_ids → nodes.databaseHostId).
import { getDb, insertAndGetId } from '../../db'
import { databaseHosts, nodes } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../utils/admin'
import { syncHostNodes } from '../../utils/dbhosts'
import { wingsFetch, nodeLanIp, usedHostPorts, isPortConflict } from '../../utils/wings'
import { waitForMysql, testMysqlConnection } from '../../utils/databases'

const DB_IMAGE = 'mysql:8'
const DB_CONTAINER_PORT = 3306
const DB_PORT_CANDIDATES = Array.from({ length: 15 }, (_, i) => 3306 + i)

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const { name, type } = body || {}
  const mode = body?.mode || body?.provisioning || 'container'
  const nodeId = body?.nodeId ?? body?.node_id ?? null
  const allowedNodeIds = body?.allowedNodeIds ?? body?.allowed_node_ids ?? null
  if (!name) throw createError({ statusCode: 400, message: 'Название обязательно' })

  const db = await getDb()

  if (mode === 'container') {
    return await createContainerHost(db, body, { name, type: type || 'mysql', nodeId, allowedNodeIds })
  }
  return await createExternalHost(db, body, { name, allowedNodeIds })
})

async function loadNode(db, nodeId) {
  const rows = await db.select().from(nodes).where(eq(nodes.id, Number(nodeId))).limit(1)
  if (!rows.length) throw createError({ statusCode: 400, message: 'Нода не найдена' })
  if (!rows[0].url || !rows[0].token) throw createError({ statusCode: 400, message: 'У ноды нет URL/токена wings' })
  return rows[0]
}

async function createContainerHost(db, body, { name, type, nodeId, allowedNodeIds }) {
  if (type && type !== 'mysql') {
    throw createError({ statusCode: 400, message: 'В контейнере пока поднимается только MySQL' })
  }
  if (!nodeId) throw createError({ statusCode: 400, message: 'Выбери ноду, где развернуть MySQL' })
  const rootPassword = body?.password || body?.rootPassword
  const rootUser = body?.username || body?.rootUser || 'root'
  if (!rootPassword) throw createError({ statusCode: 400, message: 'Задай root-пароль MySQL' })

  const wingsNode = await loadNode(db, nodeId)
  const lanIp = nodeLanIp(wingsNode)
  if (!lanIp) throw createError({ statusCode: 400, message: 'У ноды некорректный URL' })

  const newId = await insertAndGetId(databaseHosts, {
    name, host: lanIp, port: 0, type: 'mysql',
    username: rootUser, password: rootPassword, nodeId,
    provisioning: 'container',
  })
  const containerName = `kt-dbh-${newId}`
  await db.update(databaseHosts).set({ containerRef: containerName }).where(eq(databaseHosts.id, newId))

  const used = await usedHostPorts(wingsNode)
  const candidates = DB_PORT_CANDIDATES.filter((p) => !used.has(p))
  let chosen = 0
  let lastErr = null
  for (const port of candidates.length ? candidates : DB_PORT_CANDIDATES) {
    try {
      await wingsFetch(wingsNode, '/v1/containers', {
        method: 'POST',
        body: {
          name: containerName,
          image: DB_IMAGE,
          env: [`MYSQL_ROOT_PASSWORD=${rootPassword}`],
          ports: [{ host: port, container: DB_CONTAINER_PORT, protocol: 'tcp' }],
          volumes: [{ source: `ktdb-${newId}`, target: '/var/lib/mysql' }],
          restart: 'always',
          labels: { 'kt.panel/db-host-id': String(newId) },
        },
      })
      chosen = port
      break
    } catch (e) {
      lastErr = e
      if (!isPortConflict(e)) break
    }
  }
  if (!chosen) {
    await db.delete(databaseHosts).where(eq(databaseHosts.id, newId))
    throw createError({ statusCode: 502, message: `Wings не создал контейнер MySQL: ${lastErr?.message || lastErr}` })
  }

  await db.update(databaseHosts).set({ port: chosen }).where(eq(databaseHosts.id, newId))

  let warning = null
  try {
    await waitForMysql({ host: lanIp, port: chosen, username: rootUser, password: rootPassword }, 150000, 3000)
  } catch (e) {
    warning = `MySQL-контейнер создан (порт ${chosen}), но за 150с не ответил — возможно, ещё тянется образ. Базы заработают, когда поднимется.`
  }

  if (Array.isArray(allowedNodeIds)) {
    await syncHostNodes(db, newId, allowedNodeIds)
  }
  return { success: true, id: newId, port: chosen, container: containerName, warning }
}

async function createExternalHost(db, body, { name, allowedNodeIds }) {
  const { host, port, type, username, password } = body || {}
  const nodeId = body?.nodeId ?? body?.node_id ?? null
  if (!host || !username || !password) {
    throw createError({ statusCode: 400, message: 'Адрес, пользователь и пароль обязательны' })
  }

  try {
    await testMysqlConnection({ host, port: port || 3306, username, password })
  } catch (e) {
    throw createError({ statusCode: 502, message: `Хост БД недоступен: ${e?.message || e}` })
  }

  const newId = await insertAndGetId(databaseHosts, {
    name, host, port: port || 3306, type: type || 'mysql',
    username, password, nodeId: nodeId || null,
    provisioning: 'external',
  })
  if (Array.isArray(allowedNodeIds)) {
    await syncHostNodes(db, newId, allowedNodeIds)
  }
  return { success: true, id: newId }
}
