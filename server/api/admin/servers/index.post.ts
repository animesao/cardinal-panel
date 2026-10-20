// @ts-nocheck
// POST /api/admin/servers — создание сервера:
// 1. Проверки панели (чертёж, ресурсы, аллокация).
// 2. Строка в БД (status installing) + занятие аллокации.
// 3. Создание контейнера в cardinal через wings
//    (POST {node}/v1/containers, имя srv-<uuid>).
import { getDb, insertAndGetId } from '../../../db'
import { servers, allocations, nodes, blueprints } from '../../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'uncrypto'
import { wingsFetch, buildCreatePayload } from '../../../utils/wings'
import { enrichBlueprint, parseEnvObject, variableDefaults, applyVariables } from '../../../utils/blueprints'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  const body = await readBody(event)
  const {
    name, description, ownerId, nodeId, allocationId,
    memory, cpu, disk, swap, io, startup, image,
    blueprintId, portSlots, backupSlots, databaseSlots, autoStart
  } = body

  console.log('[Servers API] Creating server:', { name, ownerId, nodeId, allocationId, blueprintId })

  const db = await getDb()

  let finalStartup = startup
  let finalImage = image
  let finalEnvironment = null

  if (blueprintId) {
    const rows = await db.select()
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1)

    if (!rows.length) throw createError({ statusCode: 400, message: 'Чертёж не найден' })
    const bp = enrichBlueprint(rows[0])
    console.log('[Servers API] Using blueprint:', bp.name)

    // Образ: выбранный из списка чертежа или основной.
    if (image && bp.images.length && !bp.images.includes(image)) {
      throw createError({ statusCode: 400, message: 'Образ не входит в список чертежа' })
    }
    if (!finalImage) finalImage = bp.image

    // Окружение: дефолты переменных + legacy environment, поверх — ввод.
    const base = { ...variableDefaults(bp.variables), ...parseEnvObject(bp.environment) }
    const { env: merged, errors } = applyVariables(bp.variables, base, body?.variables || {})
    if (errors.length) throw createError({ statusCode: 400, message: `Переменные чертежа: ${errors.join('; ')}` })
    finalEnvironment = Object.keys(merged).length ? JSON.stringify(merged) : bp.environment
    if (!finalStartup) finalStartup = bp.startupCommand
  } else if (body?.variables && typeof body.variables === 'object') {
    finalEnvironment = JSON.stringify(body.variables)
  }

  if (!name || !ownerId || !nodeId || !allocationId || !memory || !cpu || !disk || !finalStartup || !finalImage) {
    throw createError({ statusCode: 400, message: 'Заполните все обязательные поля' })
  }

  // Ноды мультитульные: ограничений по типам серверов нет — любой сервер
  // можно создать на любой ноде (лимиты — только память/диск ниже).

  const nodeInfo = await db.select({
    totalMemory: nodes.memory,
    totalDisk: nodes.disk,
    totalSwap: nodes.swap,
  })
    .from(nodes)
    .where(eq(nodes.id, nodeId))
    .limit(1)

  // Ёмкость ноды: память + своп (добавил swap — общий котёл растёт),
  // 0 = без учёта. Диск отдельно.
  if (nodeInfo.length) {
    const memCap = (nodeInfo[0].totalMemory || 0) + (nodeInfo[0].totalSwap || 0)
    const diskCap = nodeInfo[0].totalDisk || 0
    if (memCap > 0 || diskCap > 0) {
      const usage = await db.select({
        memoryUsed: sql`COALESCE(SUM(${servers.memory}), 0)`.mapWith(Number),
        swapUsed: sql`COALESCE(SUM(${servers.swap}), 0)`.mapWith(Number),
        diskUsed: sql`COALESCE(SUM(${servers.disk}), 0)`.mapWith(Number)
      })
        .from(servers)
        .where(eq(servers.nodeId, nodeId))

      const memUsed = (usage[0]?.memoryUsed || 0) + (usage[0]?.swapUsed || 0)
      const diskUsed = usage[0]?.diskUsed || 0
      const wantMem = (memory || 0) + (swap || 0)

      if (memCap > 0 && (memUsed + wantMem) > memCap) {
        const available = memCap - memUsed
        throw createError({
          statusCode: 400,
          message: `Недостаточно памяти на ноде (RAM+swap). Доступно: ${available} MB, требуется: ${wantMem} MB`
        })
      }

      if (diskCap > 0 && (diskUsed + disk) > diskCap) {
        const available = diskCap - diskUsed
        throw createError({
          statusCode: 400,
          message: `Недостаточно диска на ноде. Доступно: ${available} MB, требуется: ${disk} MB`
        })
      }
    }
  }

  const allocation = await db
    .select()
    .from(allocations)
    .where(eq(allocations.id, allocationId))
    .limit(1)

  if (!allocation.length) {
    throw createError({ statusCode: 400, message: 'Аллокация не найдена' })
  }

  if (allocation[0].assigned === 'yes') {
    throw createError({ statusCode: 400, message: 'Аллокация уже занята' })
  }

  const nodeRows = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1)
  if (!nodeRows.length) throw createError({ statusCode: 400, message: 'Нода не найдена' })
  const wingsNode = nodeRows[0]

  const uuid = randomUUID()

  const serverId = await insertAndGetId(servers, {
    uuid,
    name,
    description: description || null,
    ownerId,
    nodeId,
    allocationId,
    portSlots: Math.max(0, Number(portSlots) || 0),
    backupSlots: Math.max(0, Number(backupSlots) || 0),
    databaseSlots: Math.max(0, Number(databaseSlots) || 0),
    autoStart: autoStart ? 1 : 0,
    memory,
    cpu,
    disk,
    swap: swap || 0,
    io: io || 500,
    startup: finalStartup,
    image: finalImage,
    environment: finalEnvironment,
    blueprintId: blueprintId || null,
    status: 'installing',
  })
  console.log('[Servers API] Server created in DB:', { id: serverId, uuid })

  await db.update(allocations)
    .set({ assigned: 'yes', serverId })
    .where(eq(allocations.id, allocationId))

  // Создание контейнера в cardinal через wings.
  try {
    const payload = buildCreatePayload(
      { id: serverId, uuid, image: finalImage, startup: finalStartup, environment: finalEnvironment, memory, cpu, disk },
      allocation[0],
    )
    const created = await wingsFetch(wingsNode, '/v1/containers', { method: 'POST', body: payload })
    console.log('[Servers API] Wings container created:', created)
    await db.update(servers).set({ status: 'running' }).where(eq(servers.id, serverId))
  } catch (e: any) {
    console.error('[Servers API] Wings create failed:', e?.message)
    await db.update(servers).set({ status: 'error' }).where(eq(servers.id, serverId))
    throw createError({
      statusCode: 502,
      message: `Сервер сохранён, но нода отклонила создание контейнера: ${e?.message || e}`,
    })
  }

  return {
    success: true,
    message: 'Сервер создан',
    id: serverId,
    uuid,
  }
})
