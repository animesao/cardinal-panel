// @ts-nocheck
// POST /api/admin/database-hosts/test — проверка связи БЕЗ сохранения.
// Тело: {mode, host?, port?, username?, password?, type?, nodeId?, hostId?}.
//   external → connect+ping к MySQL root-данными из формы. Если пароль пуст,
//     а hostId задан, берём сохранённый пароль хоста: в форме правки он
//     намеренно пуст («не менять»), и без этой подстановки кнопка «Проверить»
//     не могла сработать никогда.
//   container → живость wings-ноды (GET /v1/version), на которой развернётся MySQL.
// Используется кнопкой «Проверить» в форме хоста.
import { getDb } from '../../../db'
import { nodes, databaseHosts } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/admin'
import { wingsFetch } from '../../../utils/wings'
import { testMysqlConnection, assertDbHost } from '../../../utils/databases'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event).catch(() => ({}))
  const mode = body?.mode || 'external'

  if (mode === 'container') {
    const nodeId = body?.nodeId ?? body?.node_id
    if (!nodeId) throw createError({ statusCode: 400, message: 'Выбери ноду для проверки' })
    const db = await getDb()
    const rows = await db.select().from(nodes).where(eq(nodes.id, Number(nodeId))).limit(1)
    if (!rows.length || !rows[0].url || !rows[0].token) {
      throw createError({ statusCode: 400, message: 'У ноды нет URL/токена wings' })
    }
    try {
      const version = await wingsFetch(rows[0], '/v1/version')
      return { success: true, message: `Нода на связи (wings ${version?.version || 'ok'})` }
    } catch (e) {
      throw createError({ statusCode: 502, message: `Нода недоступна: ${e?.message || e}` })
    }
  }

  const type = body?.type || 'mysql'
  if (type !== 'mysql') {
    throw createError({
      statusCode: 501,
      message: `Проверка хоста ${type} пока не поддерживается: панель ходит только по MySQL-протоколу`,
    })
  }

  let { host, port, username, password } = body || {}
  const hostId = body?.hostId ?? body?.host_id ?? body?.id

  if (!host || !username) {
    throw createError({ statusCode: 400, message: 'Заполни адрес и пользователя' })
  }

  // Пустой пароль при правке = «не менять», ровно как в PUT /database-hosts/[id].
  // Тогда для проверки подставляем сохранённый: иначе кнопка «Проверить» в
  // форме правки всегда падала бы с 400, потому что панель принципиально не
  // отдаёт сохранённые пароли в форму.
  if (!password && hostId) {
    const db = await getDb()
    const rows = await db
      .select({ password: databaseHosts.password })
      .from(databaseHosts)
      .where(eq(databaseHosts.id, Number(hostId)))
      .limit(1)
    if (!rows.length) throw createError({ statusCode: 404, message: 'Хост не найден' })
    password = rows[0].password
  }

  if (!password) {
    throw createError({
      statusCode: 400,
      message: hostId
        ? 'У хоста нет сохранённого пароля — введи пароль, чтобы проверить связь'
        : 'Заполни адрес, пользователя и пароль',
    })
  }

  // SSRF-барьер: проверка открывает TCP на произвольный host:port из тела
  // запроса. Без этого админ (или скомпрометированный админ-ключ) может
  // сканировать внутреннюю сеть панели. Внутренние адреса запрещены.
  assertDbHost({ host }, { allowPrivate: body?.allowPrivate === true })

  try {
    await testMysqlConnection({ host, port: port || 3306, username, password })
    return { success: true, message: 'Подключение успешно' }
  } catch (e) {
    throw createError({ statusCode: 502, message: `Хост БД недоступен: ${e?.message || e}` })
  }
})
