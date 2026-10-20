// @ts-nocheck
// server/utils/apikey-auth.ts — общее ядро API-ключей БЕЗ зависимостей
// от wings.ts (иначе цикл: apikeys ↔ wings). Здесь: модель ресурсов,
// токены, разбор Bearer, политика админских роутов.
import crypto from 'node:crypto'
import { getDb } from '../db'
import { apiKeys, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { checkBucket, rateLimitHeaders, API_RATE_LIMIT, API_RATE_WINDOW_MS } from './ratelimit'

export const API_KEY_PREFIX = 'cp_'

// API_RESOURCES — ресурсы ключа: 0 нет, 1 чтение, 2 чтение и запись.
// Write есть только там, где реализована безопасная операция:
// servers.write = питание, files/backups/databases/ports/startup/
// server_users.write = соответствующие мутации, админские write =
// CRUD в /api/admin/*. server_databases и activity — только чтение
// (пароли и чужие креды через ключи не отдаются и не меняются).
export const API_RESOURCES = [
  { key: 'servers', name: 'Серверы', desc: 'Свои и расшаренные серверы', maxLevel: 2 },
  { key: 'files', name: 'Файлы', desc: 'Чтение, загрузка, правки, удаление', maxLevel: 2 },
  { key: 'backups', name: 'Бэкапы', desc: 'Список, создание, откат, удаление', maxLevel: 2 },
  { key: 'databases', name: 'Базы данных', desc: 'Список, создание, удаление', maxLevel: 2 },
  { key: 'ports', name: 'Порты сервера', desc: 'Список, выдача, удаление', maxLevel: 2 },
  { key: 'startup', name: 'Запуск', desc: 'Просмотр и смена запуска', maxLevel: 2 },
  { key: 'server_users', name: 'Субпользователи', desc: 'Список и управление доступом', maxLevel: 2 },
  { key: 'activity', name: 'Активность', desc: 'Журнал действий сервера', maxLevel: 1 },
  { key: 'nodes', name: 'Ноды', desc: 'Список, данные, аллокации, CRUD', maxLevel: 2 },
  { key: 'users', name: 'Пользователи', desc: 'Список, данные, роли', maxLevel: 2 },
  { key: 'allocations', name: 'Пул портов', desc: 'Аллокации нод', maxLevel: 2 },
  { key: 'locations', name: 'Локации', desc: 'Список и CRUD', maxLevel: 2 },
  { key: 'blueprints', name: 'Чертежи', desc: 'Каталог и CRUD', maxLevel: 2 },
  { key: 'database_hosts', name: 'Хосты БД', desc: 'Список и CRUD (без паролей)', maxLevel: 2 },
  { key: 'server_databases', name: 'Базы серверов', desc: 'Список (без паролей)', maxLevel: 1 },
]

// normalizeLevels — уровни ключа {resource: 0|1|2}.
// Понимает легаси-массив: servers.read → servers 1, servers.power → servers 2.
export function normalizeLevels(raw: any): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of API_RESOURCES) out[r.key] = 0
  if (Array.isArray(raw)) {
    if (raw.includes('servers.power')) out.servers = 2
    else if (raw.includes('servers.read')) out.servers = 1
    return out
  }
  let obj: any = raw
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj) } catch { return out }
  }
  if (obj && typeof obj === 'object') {
    for (const r of API_RESOURCES) {
      const v = Number(obj[r.key])
      if (Number.isInteger(v) && v >= 1 && v <= r.maxLevel) out[r.key] = v
    }
  }
  return out
}

// sanitizeResourceLevels — строгая валидация с формы выпуска.
// Запись там, где её нет, — 400, а не молчаливое урезание.
export function sanitizeResourceLevels(input: any): Record<string, number> {
  const out: Record<string, number> = {}
  const obj = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {}
  for (const r of API_RESOURCES) {
    const raw = Number(obj[r.key] ?? 0)
    if (!Number.isInteger(raw) || raw < 0) continue
    if (raw > r.maxLevel) {
      throw createError({ statusCode: 400, message: `Ресурс ${r.key}: максимум уровень ${r.maxLevel}` })
    }
    if (raw > 0) out[r.key] = raw
  }
  return out
}

export function hashApiToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// resolveApiKey — Bearer → {user, levels, keyId}. Кидает 401.
// Троттлит ключ: 60 запросов в минуту, 429 + Retry-After.
// lastUsedAt обновляется здесь же (один апдейт на запрос).
export async function resolveApiKey(presented: string, event: any = null) {
  const db = await getDb()
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.tokenHash, hashApiToken(presented))).limit(1)
  if (!rows.length) throw createError({ statusCode: 401, message: 'Неверный API-ключ' })
  const key = rows[0]
  const rl = checkBucket('key:' + key.id, API_RATE_LIMIT, API_RATE_WINDOW_MS)
  if (event && event.node && event.node.res) {
    const headers = rateLimitHeaders(rl)
    for (const hk of Object.keys(headers)) event.node.res.setHeader(hk, headers[hk])
  }
  if (!rl.allowed) {
    if (event && event.node && event.node.res) event.node.res.setHeader('Retry-After', String(rl.retryAfter))
    throw createError({ statusCode: 429, message: 'Слишком много запросов — подожди минуту' })
  }
  const urows = await db.select().from(users).where(eq(users.id, key.userId)).limit(1)
  if (!urows.length) throw createError({ statusCode: 401, message: 'Владелец ключа не найден' })
  const user = urows[0]

  const levels = normalizeLevels(key.scopes)
  const legacy = (() => {
    try { return Array.isArray(typeof key.scopes === 'string' ? JSON.parse(key.scopes) : key.scopes) } catch { return false }
  })()
  try {
    const patch: any = { lastUsedAt: new Date() }
    if (legacy) patch.scopes = JSON.stringify(levels)
    await db.update(apiKeys).set(patch).where(eq(apiKeys.id, key.id))
  } catch {}

  return { db, key, user, levels, isAdmin: user.role === 'admin' }
}

// KEY_POLICY — какой ресурс/уровень нужен ключу на админских роутах.
// Совпадение по методу и префиксу пути; нет совпадения = запрет
// (управление ключами и настройки через API недоступны by design).
type PolicyRule = { methods: string[]; prefix: string[]; resource: string; level: number }
const KEY_POLICY: PolicyRule[] = [
  // Read-only POST-исключения — только опрашивают, ничего не меняют.
  { methods: ['POST'], prefix: ['/api/admin/nodes/detect'], resource: 'nodes', level: 1 },
  { methods: ['POST'], prefix: ['/api/admin/database-hosts/test'], resource: 'database_hosts', level: 1 },
  { methods: ['GET'], prefix: ['/api/admin/servers'], resource: 'servers', level: 1 },
  { methods: ['POST', 'PUT', 'DELETE'], prefix: ['/api/admin/servers'], resource: 'servers', level: 2 },
  { methods: ['GET'], prefix: ['/api/admin/nodes'], resource: 'nodes', level: 1 },
  { methods: ['POST', 'PUT', 'DELETE'], prefix: ['/api/admin/nodes'], resource: 'nodes', level: 2 },
  { methods: ['GET'], prefix: ['/api/admin/users'], resource: 'users', level: 1 },
  { methods: ['POST', 'PUT', 'DELETE'], prefix: ['/api/admin/users'], resource: 'users', level: 2 },
  { methods: ['GET'], prefix: ['/api/admin/allocations'], resource: 'allocations', level: 1 },
  { methods: ['POST', 'PUT', 'DELETE'], prefix: ['/api/admin/allocations'], resource: 'allocations', level: 2 },
  { methods: ['GET'], prefix: ['/api/admin/locations'], resource: 'locations', level: 1 },
  { methods: ['POST', 'PUT', 'DELETE'], prefix: ['/api/admin/locations'], resource: 'locations', level: 2 },
  { methods: ['GET'], prefix: ['/api/admin/blueprints'], resource: 'blueprints', level: 1 },
  { methods: ['POST', 'PUT', 'DELETE'], prefix: ['/api/admin/blueprints'], resource: 'blueprints', level: 2 },
  { methods: ['GET'], prefix: ['/api/admin/database-hosts'], resource: 'database_hosts', level: 1 },
  { methods: ['POST', 'PUT', 'DELETE'], prefix: ['/api/admin/database-hosts'], resource: 'database_hosts', level: 2 },
  { methods: ['GET'], prefix: ['/api/admin/databases'], resource: 'server_databases', level: 1 },
]

// matchApiKeyPolicy — чистая функция (тестируема без БД): [resource, level]
// или null (= запрет).
export function matchApiKeyPolicy(path: string, method: string): [string, number] | null {
  const m = String(method || '').toUpperCase()
  for (const r of KEY_POLICY) {
    if (!r.methods.includes(m)) continue
    if (r.prefix.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'))) return [r.resource, r.level]
  }
  return null
}
