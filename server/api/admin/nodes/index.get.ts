// @ts-nocheck
import { getDb } from '../../../db'
import { nodes, locations, databaseHosts } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { parseListQuery, listResponse } from '../../../utils/pagination'
import { requireAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  // Проверка роли делается в самом обработчике, а не только в
  // server/middleware/admin.ts: middleware — единственный барьер, и
  // одна рефакторинг-ошибка в нём открыла бы все админские роуты.
  await requireAdmin(event)

  try {
    const db = await getDb()

    // Получаем ноды с информацией о локациях и хосте БД.
    // Токен наружу не отдаём (только факт наличия): иначе угон
    // admin-сессии/XSS сразу даёт Bearer-доступ ко всем нодам.
    const allNodes = await db
      .select({
        id: nodes.id,
        name: nodes.name,
        url: nodes.url,
        token: nodes.token,
        locationId: nodes.locationId,
        memory: nodes.memory,
        disk: nodes.disk,
        swap: nodes.swap,
        databaseHostId: nodes.databaseHostId,
        createdAt: nodes.createdAt,
        updatedAt: nodes.updatedAt,
        location: {
          id: locations.id,
          name: locations.name,
          city: locations.city,
          country: locations.country,
        },
        databaseHost: {
          id: databaseHosts.id,
          name: databaseHosts.name,
        },
      })
      .from(nodes)
      .leftJoin(locations, eq(nodes.locationId, locations.id))
      .leftJoin(databaseHosts, eq(nodes.databaseHostId, databaseHosts.id))
      .orderBy(nodes.createdAt)

    const shaped = allNodes.map(({ token, ...n }: any) => ({ ...n, tokenSet: !!token }))
    return listResponse(shaped, parseListQuery(getQuery(event)), ['name'])
  } catch (error) {
    console.error('Error fetching nodes:', error)
    throw createError({
      statusCode: 500,
      message: 'Ошибка загрузки нод'
    })
  }
})
