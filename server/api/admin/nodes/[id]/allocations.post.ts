// @ts-nocheck
import { getDb, insertAndGetId } from '../../../../db'
import { allocations, nodes } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { nodeLanIp } from '../../../../utils/wings'
import { requireAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  try {
    const nodeId = parseInt(event.context.params?.id || '')
    const body = await readBody(event)
    let { ip, ports } = body

    if (!nodeId || !ports) {
      throw createError({ statusCode: 400, message: 'Порты обязательны' })
    }

    const db = await getDb()

    // Пустой IP или заглушка 0.0.0.0 → LAN-IP ноды, чтобы в панели
    // и у игроков был подключаемый адрес, а не 0.0.0.0.
    if (!ip || ip === '0.0.0.0') {
      const nrows = await db.select({ url: nodes.url }).from(nodes).where(eq(nodes.id, nodeId)).limit(1)
      ip = (nrows.length && nodeLanIp(nrows[0])) || '0.0.0.0'
    }

    // Парсим диапазон портов
    let portRange: number[] = []
    if (ports.includes('-')) {
      const [start, end] = ports.split('-').map(Number)
      for (let i = start; i <= end; i++) {
        portRange.push(i)
      }
    } else {
      portRange = [parseInt(ports)]
    }
    
    // Проверяем, что порты не заняты на этой ноде
    for (const port of portRange) {
      const existing = await db
        .select()
        .from(allocations)
        .where(and(eq(allocations.nodeId, nodeId), eq(allocations.port, port)))
        .limit(1)
      
      if (existing.length > 0) {
        throw createError({
          statusCode: 400,
          message: `Порт ${port} уже используется на этой ноде`
        })
      }
    }
    
    // Создаём аллокации
    const created = []
    for (const port of portRange) {
      const newId = await insertAndGetId(allocations, {
        nodeId,
        ip,
        port,
        assigned: 'no',
      })
      created.push({ port, id: newId })
    }
    
    return {
      success: true,
      message: `Создано ${created.length} аллокаций`,
      created
    }
  } catch (error: any) {
    console.error('Error creating allocations:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Ошибка создания аллокаций'
    })
  }
})