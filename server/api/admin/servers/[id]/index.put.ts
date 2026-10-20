// @ts-nocheck
// PUT /api/admin/servers/[id] — полное редактирование сервера:
// имя, описание, владелец + лимиты (память/CPU/диск живьём в cardinal
// через wings, остальное — только БД). Нода, аллокация, образ и запуск
// здесь не меняются (это переустановка/смена через вкладки сервера).
// Работает и по API-ключу с servers.write.
import { getDb } from '../../../../db'
import { servers, nodes, users } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/admin'
import { wingsFetch, containerRef } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  if (!id || !body) throw createError({ statusCode: 400, message: 'Некорректные параметры' })

  const db = await getDb()
  const rows = await db.select({ server: servers, node: nodes })
    .from(servers)
    .leftJoin(nodes, eq(servers.nodeId, nodes.id))
    .where(eq(servers.id, id))
    .limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Сервер не найден' })
  const { server: srv, node } = rows[0]

  const patch: any = {}
  if (body.name !== undefined) {
    const name = String(body.name || '').trim()
    if (name.length < 2) throw createError({ statusCode: 400, message: 'Название: минимум 2 символа' })
    patch.name = name.slice(0, 255)
  }
  if (body.description !== undefined) {
    patch.description = String(body.description || '').slice(0, 1000) || null
  }
  if (body.ownerId !== undefined && Number(body.ownerId) !== srv.ownerId) {
    const urows = await db.select({ id: users.id }).from(users).where(eq(users.id, Number(body.ownerId))).limit(1)
    if (!urows.length) throw createError({ statusCode: 400, message: 'Владелец не найден' })
    patch.ownerId = Number(body.ownerId)
  }
  for (const f of ['memory', 'cpu', 'disk']) {
    if (body[f] !== undefined) {
      const v = Number(body[f])
      if (!Number.isFinite(v) || v <= 0) throw createError({ statusCode: 400, message: `Поле ${f}: положительное число` })
      patch[f] = Math.round(v)
    }
  }
  for (const f of ['swap', 'io', 'portSlots', 'backupSlots', 'databaseSlots']) {
    if (body[f] !== undefined) patch[f] = Math.max(0, Math.round(Number(body[f]) || 0))
  }
  if (body.autoStart !== undefined) patch.autoStart = body.autoStart ? 1 : 0
  if (!Object.keys(patch).length) return { success: true }

  await db.update(servers).set(patch).where(eq(servers.id, id))

  // Лимиты — живьём в cardinal, если менялись.
  if (patch.memory !== undefined || patch.cpu !== undefined || patch.disk !== undefined) {
    const memory = patch.memory ?? srv.memory
    const cpu = patch.cpu ?? srv.cpu
    const disk = patch.disk ?? srv.disk
    try {
      await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/limits`, {
        method: 'POST',
        body: {
          memory_bytes: (memory || 0) * 1024 * 1024,
          cpus: (cpu || 0) / 100,
          disk_bytes: (disk || 0) * 1024 * 1024,
        },
      })
    } catch (e: any) {
      throw createError({
        statusCode: 502,
        message: `Сохранено в БД, но нода не применила лимиты: ${e?.message || e}`,
      })
    }
  }

  return { success: true }
})
