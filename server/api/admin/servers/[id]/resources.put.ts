// @ts-nocheck
// PUT /api/admin/servers/[id]/resources {memory, cpu, disk, swap, io, portSlots?, backupSlots?, databaseSlots?} —
// смена лимитов сервера: сначала БД панели (источник правды),
// затем живьём в cardinal через wings
// (POST /v1/containers/srv-<uuid>/limits: память/CPU — сразу в cgroup,
// диск — со следующего рестарта). swap/io cardinal не умеет — только БД.
// portSlots/backupSlots/databaseSlots — лимиты доп. портов, бэкапов и баз
// (0 = безлимит), только БД.
import { getDb } from '../../../../db'
import { servers, nodes } from '../../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/admin'
import { wingsFetch, containerRef } from '../../../../utils/wings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  if (!id || !body) throw createError({ statusCode: 400, message: 'Некорректные параметры' })

  const { memory, cpu, disk, swap, io, portSlots, backupSlots, databaseSlots, autoStart } = body
  if (memory == null || cpu == null || disk == null) {
    throw createError({ statusCode: 400, message: 'Память, CPU и диск обязательны' })
  }

  const db = await getDb()
  const rows = await db.select({ server: servers, node: nodes })
    .from(servers)
    .leftJoin(nodes, eq(servers.nodeId, nodes.id))
    .where(eq(servers.id, id))
    .limit(1)
  if (!rows.length) throw createError({ statusCode: 404, message: 'Сервер не найден' })
  const { server: srv, node } = rows[0]

  await db.update(servers).set({
    memory, cpu, disk,
    swap: swap ?? 0,
    io: io ?? 500,
    ...(portSlots != null ? { portSlots: Math.max(0, Number(portSlots) || 0) } : {}),
    ...(backupSlots != null ? { backupSlots: Math.max(0, Number(backupSlots) || 0) } : {}),
    ...(databaseSlots != null ? { databaseSlots: Math.max(0, Number(databaseSlots) || 0) } : {}),
    ...(autoStart != null ? { autoStart: autoStart ? 1 : 0 } : {}),
  }).where(eq(servers.id, id))

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

  return { success: true }
})
