// @ts-nocheck
// server/utils/wings.ts — единый клиент cardinal-wings для панели.
//
// Панель никогда не ходит в cardinal напрямую: все операции с контейнерами
// идут через wings-ноду (nodes.url + nodes.token), к которой привязан сервер.
// Контейнер адресуется стабильным именем `srv-<server-uuid>` — cardinal ID
// wings резолвит сам (см. resolve.go в cardinal-wings), поэтому панель не
// хранит случайные ID и переживает reinstall без миграций.
import { getDb } from '../db'
import { servers, nodes, allocations, serverUsers, users, serverActivity } from '../db/schema'
import { eq, and, ne, sql, desc } from 'drizzle-orm'
import { getServerSession } from '#auth'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { resolveApiKey } from './apikey-auth'

// SUBUSER_PERMISSIONS — каталог прав субпользователей (как в Pterodactyl):
// группы для UI приглашения + белый список для валидации на бэке.
export const SUBUSER_PERMISSIONS = [
  { group: 'Консоль', permissions: [
    { key: 'websocket.connect', name: 'Подключение', desc: 'Открывать консоль и видеть вывод сервера' },
    { key: 'control.console', name: 'Команды', desc: 'Отправлять команды в консоль сервера' },
  ]},
  { group: 'Питание', permissions: [
    { key: 'control.start', name: 'Старт', desc: 'Запускать сервер' },
    { key: 'control.stop', name: 'Стоп', desc: 'Останавливать сервер' },
    { key: 'control.restart', name: 'Рестарт', desc: 'Перезапускать сервер' },
  ]},
  { group: 'Файлы', permissions: [
    { key: 'file.read', name: 'Чтение', desc: 'Смотреть и скачивать файлы' },
    { key: 'file.create', name: 'Создание', desc: 'Создавать файлы и папки, загружать' },
    { key: 'file.update', name: 'Изменение', desc: 'Править, переименовывать, менять права' },
    { key: 'file.delete', name: 'Удаление', desc: 'Удалять файлы и папки' },
    { key: 'file.archive', name: 'Архив', desc: 'Скачивать папки и выборку одним .zip' },
  ]},
  { group: 'Бэкапы', permissions: [
    { key: 'backup.read', name: 'Просмотр', desc: 'Видеть список и скачивать' },
    { key: 'backup.create', name: 'Создание', desc: 'Создавать снапшоты' },
    { key: 'backup.restore', name: 'Восстановление', desc: 'Откатывать сервер из бэкапа' },
    { key: 'backup.delete', name: 'Удаление', desc: 'Удалять бэкапы' },
  ]},
  { group: 'Базы данных', permissions: [
    { key: 'database.read', name: 'Просмотр', desc: 'Видеть базы и креды' },
    { key: 'database.create', name: 'Создание', desc: 'Создавать базы' },
    { key: 'database.delete', name: 'Удаление', desc: 'Удалять базы' },
  ]},
  { group: 'Порты', permissions: [
    { key: 'allocation.read', name: 'Просмотр', desc: 'Видеть порты сервера' },
    { key: 'allocation.create', name: 'Выдача', desc: 'Занимать доп. порты' },
    { key: 'allocation.update', name: 'Основной', desc: 'Менять основной порт' },
    { key: 'allocation.delete', name: 'Освобождение', desc: 'Освобождать доп. порты' },
  ]},
  { group: 'Запуск', permissions: [
    { key: 'startup.read', name: 'Просмотр', desc: 'Видеть команду запуска и переменные' },
    { key: 'startup.update', name: 'Настройки запуска', desc: 'Менять образ, команду, переменные, переустановку' },
  ]},
  { group: 'Пользователи', permissions: [
    { key: 'user.read', name: 'Просмотр', desc: 'Видеть субпользователей' },
    { key: 'user.create', name: 'Приглашение', desc: 'Добавлять по почте' },
    { key: 'user.update', name: 'Права', desc: 'Менять набор прав' },
    { key: 'user.delete', name: 'Удаление', desc: 'Убирать с сервера' },
  ]},
  { group: 'Активность', permissions: [
    { key: 'activity.read', name: 'Просмотр', desc: 'Видеть журнал действий на сервере' },
  ]},
]

export const ALL_SUBUSER_PERMS: string[] = SUBUSER_PERMISSIONS.flatMap((g) => g.permissions.map((p) => p.key))

export function permName(key: string): string {
  for (const g of SUBUSER_PERMISSIONS) {
    const hit = g.permissions.find((p) => p.key === key)
    if (hit) return hit.name
  }
  return key
}

// PERM_UPGRADES — тихая миграция старых наборов прав: новые ключи
// доезжают из старых эквивалентов, чтобы существующие мемберы ничего
// не потеряли (websocket.connect из control.console, startup.read из
// startup.update, file.archive из file.read). Дальше ключи живут
// независимо: владелец может снять часть без потери остального.
const PERM_UPGRADES: Record<string, string[]> = {
  'websocket.connect': ['control.console'],
  'startup.read': ['startup.update'],
  'file.archive': ['file.read'],
}

export function upgradePerms(perms: string[]): { perms: string[]; changed: boolean } {
  const out = [...perms]
  let changed = false
  for (const [nu, sources] of Object.entries(PERM_UPGRADES)) {
    if (!out.includes(nu) && sources.some((s) => out.includes(s))) {
      out.push(nu)
      changed = true
    }
  }
  return { perms: out, changed }
}

// parseSubuserPerms — набор control-*/file-* прав мембера из server_users
// (JSON-массив). Нужно ключам API: мощность сигнала сверяется с control-
// правами мембера, а не с уровнями ключа.
export function parseSubuserPerms(raw: any): string[] {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(v)) return v.filter((p) => typeof p === 'string')
  } catch {}
  return []
}

// sanitizePermissions — белый список: режет неизвестные ключи и дубли.
export function sanitizePermissions(input: any): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const p of input) {
    if (typeof p === 'string' && ALL_SUBUSER_PERMS.includes(p) && !out.includes(p)) out.push(p)
  }
  return out
}

// containerRef — стабильное имя контейнера в cardinal/wings.
export function containerRef(uuid: string): string {
  return `srv-${uuid}`
}

export function volumeName(uuid: string): string {
  return `srv-${uuid}`
}

function baseUrl(node: any): string {
  return String(node.url || '').replace(/\/+$/, '')
}

// nodeLanIp — LAN-адрес хоста wings-ноды (для доступа к проброшенным
// портам её контейнеров: и панели, и игровым серверам с других нод).
export function nodeLanIp(node: any): string {
  try { return new URL(baseUrl(node)).hostname } catch { return '' }
}

// fetchNodeResources — живые ресурсы хоста wings-ноды (память/диск/CPU
// из /v1/system/info). Общая для detect (форма) и sync (запись в БД).
export async function fetchNodeResources(node: any) {
  const info: any = await wingsFetch(node, '/v1/system/info')
  const list = Array.isArray(info?.nodes) ? info.nodes : []
  const entry = list.find((n: any) => n?.name === 'local' && n?.status === 'up')
    || list.find((n: any) => n?.status === 'up')
    || list[0]
  if (!entry) throw createError({ statusCode: 502, message: 'Нода не отдала данные' })
  const mb = (b: any) => Math.max(0, Math.floor((Number(b) || 0) / 1048576))
  return {
    memory: mb(entry.mem_total_bytes),
    disk: mb(entry.disk_total_bytes),
    cpu: Number(entry.ncpu) || 0,
    architecture: entry.architecture || null,
    hostname: entry.hostname || null,
    node: entry.name || null,
  }
}
// assertNodeUrl — валидация URL ноды при создании/правке (SSRF-барьер):
// только http/https, без userinfo в URL, и без приватных/служебных
// диапазонов. Cloud-metadata (169.254.169.254) админ всё ещё может вбить
// руками — это его осознанный риск, но опечатки, file/gopher-схемы и
// обращения во внутреннюю сеть не пройдут.
export function assertNodeUrl(raw: any): string {
  const s = String(raw || '').trim()
  let u: URL
  try { u = new URL(s) } catch { throw createError({ statusCode: 400, message: 'Некорректный URL ноды' }) }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw createError({ statusCode: 400, message: 'URL ноды: только http(s)' })
  }
  if (u.username || u.password) {
    throw createError({ statusCode: 400, message: 'URL ноды: без логина в адресе' })
  }
  if (!u.hostname) throw createError({ statusCode: 400, message: 'Некорректный URL ноды' })
  // Внутренние адреса: панель не должна ходить в них по произвольному
  // URL из тела запроса (SSRF во внутреннюю сеть / metadata).
  if (isPrivateHost(u.hostname)) {
    throw createError({ statusCode: 400, message: 'URL ноды: внутренний адрес запрещён' })
  }
  return s
}

// isPrivateHost — хост в приватном/служебном диапазоне.
export function isPrivateHost(hostname: string): boolean {
  const h = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!h) return true
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  // IPv4
  const m4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m4) {
    const [a, b] = [Number(m4[1]), Number(m4[2])]
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true   // link-local, включая 169.254.169.254
    if (a === 100 && b >= 64 && b <= 127) return true  // CGNAT
    if (a >= 224) return true                // multicast + зарезервированные
    return false
  }
  // IPv6
  if (h === '::1' || h === '::') return true
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true
  // IPv4-в-IPv6
  const m46 = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (m46) return isPrivateHost(m46[1])
  return false
}

// usedHostPorts — занятые хост-порты ноды (из листинга контейнеров,
// формат wings "host:container/proto"). Best effort: что не распарсилось —
// пропускаем, финальная защита — ретрай создания на конфликте.
export async function usedHostPorts(node: any): Promise<Set<number>> {
  const used = new Set<number>()
  try {
    const page: any = await wingsFetch(node, '/v1/containers?all=1&limit=1000')
    for (const c of page?.containers || []) {
      for (const p of c?.ports || []) {
        const m = String(p).match(/^(\d+):/)
        if (m) used.add(Number(m[1]))
      }
    }
  } catch {}
  return used
}

// isPortConflict — эвристика: ошибка создания из-за занятого порта.
export function isPortConflict(e: any): boolean {
  const msg = String(e?.data?.error?.message || e?.data?.message || e?.message || '').toLowerCase()
  return /port|bind|address|already|conflict|in use|занят/.test(msg)
}

// wingsFetch — запрос к wings-ноде с Bearer-токеном из nodes.token.
export async function wingsFetch(node: any, path: string, opts: any = {}) {
  if (!node?.url || !node?.token) {
    throw createError({ statusCode: 500, message: 'Нода не настроена (нет URL или токена)' })
  }
  try {
    return await $fetch(`${baseUrl(node)}${path}`, {
      ...opts,
      // Редирект с ноды не выполняется: иначе нода может увести панель
      // (вместе с node-токеном в Authorization) на произвольный внутренний
      // адрес — SSRF с утечкой токена.
      redirect: 'manual',
      headers: {
        Authorization: `Bearer ${node.token}`,
        ...(opts.headers || {}),
      },
    })
  } catch (e: any) {
    throw createError({
      statusCode: e?.statusCode || e?.response?.status || 502,
      message: e?.data?.error?.message || e?.data?.message || e?.message || 'Нода недоступна',
    })
  }
}

export function wingsWsUrl(node: any, ref: string): string {
  return `${baseUrl(node).replace(/^http/, 'ws')}/api/servers/${ref}/ws`
}

// mintWingsJwt — короткоживущий JWT для браузерных потоков wings
// (/api/servers/{uuid}/ws, /download/file, /upload/file, /download/backup).
// Подпись — HMAC-SHA256 токеном ноды: wings сверяет её со своими API-ключами.
export function mintWingsJwt(nodeToken: string, claims: Record<string, any>, ttlSec = 600): string {
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    { iat: now, nbf: now, exp: now + ttlSec, ...claims },
    nodeToken,
    { algorithm: 'HS256', header: { typ: 'JWT' } },
  )
}

// requireServer — сессия + сервер + нода + проверка доступа.
// Возвращает роль вызывающего: isAdmin / isOwner / isMember (+permissions).
// adminOnly: true — только админы (админские роуты, субпользователи мимо).
// Bearer cp_* вместо сессии — вызов по API-ключу от имени его владельца;
// уровни ключа едут в ctx.keyLevels и режутся в needPerm.
export async function requireServer(event: any, id: number, opts: { adminOnly?: boolean } = {}) {
  const auth = getHeader(event, 'authorization') || ''
  const presented = auth.replace(/^Bearer\s+/i, '').trim()
  let session: any = null
  let keyLevels: Record<string, number> | null = null
  if (presented.startsWith('cp_')) {
    const resolved = await resolveApiKey(presented, event)
    session = { user: resolved.user }
    keyLevels = resolved.levels
  } else {
    session = await getServerSession(event)
  }
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })
  if (!id) throw createError({ statusCode: 400, message: 'Server ID required' })

  const db = await getDb()
  const rows = await db
    .select({ server: servers, node: nodes })
    .from(servers)
    .leftJoin(nodes, eq(servers.nodeId, nodes.id))
    .where(eq(servers.id, id))
    .limit(1)

  if (!rows.length) throw createError({ statusCode: 404, message: 'Сервер не найден' })
  const { server: srv, node } = rows[0]
  if (!node) throw createError({ statusCode: 500, message: 'Нода сервера не найдена' })

  // Роль — свежая из БД, а не из кэша сессии: разжалование админа
  // и смена владельца применяются мгновенно.
  let isAdmin = session.user.role === 'admin'
  try {
    // id пользователя — ЦЕЛОЕ из нашей БД. Раньше сюда попадал id провайдера
    // OAuth (строка), если поиск по e-mail не нашёл аккаунт: строка
    // приводилась к числу и могла указать на чужого пользователя, включая
    // админа. Поэтому проверяем тип и диапазон.
    const uid = Number(session.user.id)
    if (!Number.isInteger(uid) || uid <= 0) {
      throw createError({ statusCode: 401, message: 'Не авторизован' })
    }
    const urows = await db.select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1)
    if (!urows.length) throw createError({ statusCode: 401, message: 'Не авторизован' })
    isAdmin = urows[0].role === 'admin'
  } catch (e: any) {
    if (e?.statusCode) throw e
    throw createError({ statusCode: 401, message: 'Не авторизован' })
  }
  const isOwner = srv.ownerId === Number(session.user.id)
  let permissions: string[] = []
  const isMember = !isAdmin && !isOwner && await (async () => {
    if (opts.adminOnly) return false
    const mrows = await db.select().from(serverUsers)
      .where(and(eq(serverUsers.serverId, id), eq(serverUsers.userId, Number(session.user.id))))
      .limit(1)
    if (!mrows.length) return false
    try {
      const parsed = JSON.parse(mrows[0].permissions || '[]')
      if (Array.isArray(parsed)) permissions = parsed.filter((p) => typeof p === 'string')
    } catch { permissions = [] }
    // Тихая миграция старых наборов (новые ключи из старых эквивалентов),
    // чтобы давно выданные права не протухли. Пишем назад только при изменении.
    try {
      const up = upgradePerms(permissions)
      if (up.changed) {
        permissions = up.perms
        await db.update(serverUsers).set({ permissions: JSON.stringify(permissions) }).where(eq(serverUsers.id, mrows[0].id))
      }
    } catch {}
    return true
  })()
  if (opts.adminOnly ? !isAdmin : (!isOwner && !isAdmin && !isMember)) {
    throw createError({ statusCode: 403, message: 'Нет доступа' })
  }
  return { db, session, srv, node, isAdmin, isOwner, isMember, permissions, keyLevels }
}

// KEY_LEVEL_FOR_PERM — какой ресурс/уровень ключа требует каждое
// субпользовательское право. Через это needPerm режет ключам лишнее:
// уровни ключа действуют даже на владельца/админа (read-ключ админа
// писать не может). Праву без записи здесь ключом не воспользоваться.
const KEY_LEVEL_FOR_PERM: Record<string, [string, number]> = {
  'websocket.connect': ['servers', 1],
  'control.console': ['servers', 2],
  'control.start': ['servers', 2],
  'control.stop': ['servers', 2],
  'control.restart': ['servers', 2],
  'file.read': ['files', 1],
  'file.archive': ['files', 1],
  'file.create': ['files', 2],
  'file.update': ['files', 2],
  'file.delete': ['files', 2],
  'backup.read': ['backups', 1],
  'backup.create': ['backups', 2],
  'backup.restore': ['backups', 2],
  'backup.delete': ['backups', 2],
  'database.read': ['databases', 1],
  'database.create': ['databases', 2],
  'database.delete': ['databases', 2],
  'allocation.read': ['ports', 1],
  'allocation.create': ['ports', 2],
  'allocation.update': ['ports', 2],
  'allocation.delete': ['ports', 2],
  'startup.read': ['startup', 1],
  'startup.update': ['startup', 2],
  'user.read': ['server_users', 1],
  'user.create': ['server_users', 2],
  'user.update': ['server_users', 2],
  'user.delete': ['server_users', 2],
  'activity.read': ['activity', 1],
}

// needPerm — точечная проверка права. Владелец и админ проходят всегда,
// субпользователь — только с нужным ключом в наборе.
// Вызов по API-ключу (ctx.keyLevels) дополнительно режется уровнем ключа
// — даже владельцу/админу: read-ключ писать не может.
export function needPerm(ctx: { isAdmin?: boolean; isOwner?: boolean; permissions?: string[]; keyLevels?: Record<string, number> }, perm: string) {
  const gate = KEY_LEVEL_FOR_PERM[perm]
  if (ctx?.keyLevels) {
    // Вызов по API-ключу: права без записи в карте — запрет по умолчанию,
    // чтобы новое право не открылось ключам само.
    if (!gate || (ctx.keyLevels[gate[0]] || 0) < gate[1]) {
      throw createError({ statusCode: 403, message: `Ключу нет доступа${gate ? `: ${gate[0]} (нужен уровень ${gate[1]})` : ''}` })
    }
  }
  if (ctx?.isAdmin || ctx?.isOwner) return
  if (Array.isArray(ctx?.permissions) && ctx.permissions.includes(perm)) return
  throw createError({ statusCode: 403, message: `Недостаточно прав (нужно: ${permName(perm)})` })
}

// needKeyWrite — мутации через API-ключ требуют servers.write.
// Сессии (UI) не задеты: у них keyLevels нет. Без этого владелец
// с read-only ключом писал бы в обход least-privilege (ключ знает
// только needPerm, а часть роутов проверяет лишь isAdmin/isOwner).
export function needKeyWrite(ctx: { keyLevels?: Record<string, number> | null }) {
  if (ctx?.keyLevels && (ctx.keyLevels.servers || 0) < 2) {
    throw createError({ statusCode: 403, message: 'Ключу нет доступа: servers (нужен уровень 2)' })
  }
}
// rotateServerSftpPassword — ротация общего пароля SFTP сервера (owner-кред):
// сначала wings, затем БД. Порядок важен: упал wings — БД не трогаем, старые
// креды продолжают работать, рассинхрона нет. Личные креды мемберов при этом
// не страдают — у каждого свой пароль (см. sftpUsernameFor).
export async function rotateServerSftpPassword(db: any, node: any, srv: any): Promise<string> {
  const username = `srv-${String(srv.uuid).replace(/-/g, '').slice(0, 8)}`
  const password = crypto.randomBytes(18).toString('base64url')
  await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/sftp`, {
    method: 'PUT',
    body: { username, password },
  })
  await db.update(servers).set({ sftpPassword: password }).where(eq(servers.id, srv.id))
  return password
}

// shortHex — первые 8 hex uuid без дефисов (суффиксы SFTP-имён).
export function shortHex(uuid: string): string {
  return String(uuid || '').replace(/-/g, '').slice(0, 8)
}

// sftpUsernameFor — личное SFTP-имя пользователя на сервере:
// владелец — `srv-<server8>`, мембер — `srv-<server8>-<user8>`.
// Совпадает со схемой wings (см. sftp.go): несколько пользователей
// держат креды одного контейнера одновременно.
export function sftpUsernameFor(serverUuid: string, userUuid: string | null): string {
  const s = shortHex(serverUuid)
  if (!userUuid) return `srv-${s}`
  return `srv-${s}-${shortHex(userUuid)}`
}

// ensureSftpCredential — залить {username, password} в wings (PUT).
export async function ensureSftpCredential(node: any, serverUuid: string, username: string, password: string) {
  await wingsFetch(node, `/v1/containers/${containerRef(serverUuid)}/sftp`, {
    method: 'PUT',
    body: { username, password },
  })
}

// removeSftpCredential — убрать кред из wings: один username (?username=)
// либо все креды контейнера (удаление сервера). 404 глотаем — стора
// на ноде может уже не быть, это не ошибка синхронизации.
export async function removeSftpCredential(node: any, serverUuid: string, username?: string) {
  const q = username ? `?username=${encodeURIComponent(username)}` : ''
  try {
    await wingsFetch(node, `/v1/containers/${containerRef(serverUuid)}/sftp${q}`, { method: 'DELETE' })
  } catch (e: any) {
    if (e?.statusCode !== 404) throw e
  }
}

// wingsSftpUsernames — кто уже держит креды контейнера в wings
// (GET .../sftp → {enabled, usernames[]}).
export async function wingsSftpUsernames(node: any, serverUuid: string): Promise<string[]> {
  try {
    const st: any = await wingsFetch(node, `/v1/containers/${containerRef(serverUuid)}/sftp`)
    if (Array.isArray(st?.usernames)) return st.usernames.filter((u: any) => typeof u === 'string')
    if (st?.enabled && typeof st?.username === 'string' && st.username) return [st.username]
  } catch {}
  return []
}

// parseEnv — environment из БД (JSON-строка {"K":"V"}) в пары KEY=VAL.
export function parseEnv(environment: any): string[] {
  if (!environment) return []
  try {
    const obj = typeof environment === 'string' ? JSON.parse(environment) : environment
    return Object.entries(obj).map(([k, v]) => `${k}=${v}`)
  } catch {
    return []
  }
}

// serverVars — переменные для шаблонов startup и окружения контейнера.
export function serverVars(srv: any, allocation: any, extraEnv: Record<string, any> = {}) {
  const vars: Record<string, any> = {
    memory: srv.memory,
    cpu: srv.cpu,
    disk: srv.disk,
    SERVER_MEMORY: srv.memory,
    SERVER_PORT: allocation?.port || '',
    SERVER_IP: allocation?.ip || '',
    ...extraEnv,
  }
  return vars
}

// renderStartup — подстановка {{VAR}} в команду запуска.
export function renderStartup(startup: string, vars: Record<string, any>): string {
  if (!startup) return ''
  return String(startup).replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m, key) => {
    if (vars[key] !== undefined && vars[key] !== null) return String(vars[key])
    if (vars[String(key).toUpperCase()] !== undefined) return String(vars[String(key).toUpperCase()])
    if (vars[String(key).toLowerCase()] !== undefined) return String(vars[String(key).toLowerCase()])
    return m
  })
}

// serverExtraPorts — доп. аллокации сервера (все строки allocations c
// serverId, кроме первичной). Протокол хранится в суффиксе IP
// ("1.2.3.4/udp"), чтобы не мигрировать таблицу: чистый IP — tcp.
export async function serverExtraPorts(db: any, serverId: number, primaryAllocationId: any) {
  const conds: any[] = [eq(allocations.serverId, serverId)]
  if (primaryAllocationId) conds.push(ne(allocations.id, primaryAllocationId))
  const rows = await db.select().from(allocations).where(and(...conds))
  return rows.map((r: any) => {
    const raw = String(r.ip || '')
    const udp = raw.endsWith('/udp')
    const ip = udp ? raw.slice(0, -4) : raw.replace(/\/tcp$/, '')
    return { id: r.id, ip, port: r.port, protocol: udp ? 'udp' : 'tcp', containerPort: r.port }
  })
}

export function splitAllocationIp(raw: any): { ip: string; protocol: 'tcp' | 'udp' } {
  const s = String(raw || '')
  if (s.endsWith('/udp')) return { ip: s.slice(0, -4), protocol: 'udp' }
  return { ip: s.replace(/\/tcp$/, ''), protocol: 'tcp' }
}

export function joinAllocationIp(ip: string, protocol: string): string {
  return String(protocol || 'tcp').toLowerCase() === 'udp' ? `${ip}/udp` : ip
}

// displayAddress — адрес для подключения игроков: IP аллокации, а если там
// заглушка 0.0.0.0 — LAN-IP ноды (иначе игрок видит неподключаемый адрес).
// Суффикс протокола (1.2.3.4/udp) срезается — в адресе ему не место.
export function displayAddress(allocation: any, node: any): string | null {
  const raw = allocation?.ip || ''
  const { ip: cleanIp } = splitAllocationIp(raw)
  let ip = cleanIp
  const port = allocation?.port
  if ((!ip || ip === '0.0.0.0') && node?.url) {
    ip = nodeLanIp(node) || ip
  }
  return ip && port ? `${ip}:${port}` : null
}
// buildCreatePayload — тело POST /v1/containers из серверной записи панели.
// extraPorts — доп. аллокации сервера [{port, containerPort?, protocol?}]:
// первичный порт идёт из allocation, остальные дописываются сюда же, чтобы
// reinstall не сносил выданные порты.
export function buildCreatePayload(srv: any, allocation: any, extraPorts: any[] = []) {
  let extraEnv: Record<string, any> = {}
  try {
    extraEnv = srv.environment ? JSON.parse(srv.environment) : {}
  } catch { extraEnv = {} }
  const vars = serverVars(srv, allocation, extraEnv)
  const env = [...parseEnv(srv.environment)]
  for (const [k, v] of Object.entries({ SERVER_MEMORY: vars.SERVER_MEMORY, SERVER_PORT: vars.SERVER_PORT, SERVER_IP: vars.SERVER_IP })) {
    if (v !== '' && !env.some((e) => e.startsWith(`${k}=`))) env.push(`${k}=${v}`)
  }
  const ports = allocation ? [{ host: allocation.port, container: allocation.port, protocol: 'tcp' }] : []
  for (const p of extraPorts || []) {
    const host = Number(p?.port)
    if (!host) continue
    ports.push({
      host,
      container: Number(p?.containerPort) || host,
      protocol: String(p?.protocol || 'tcp').toLowerCase() === 'udp' ? 'udp' : 'tcp',
    })
  }
  return {
    name: containerRef(srv.uuid),
    image: srv.image,
    startup_script: renderStartup(srv.startup, vars),
    env,
    ports,
    volumes: [{ source: volumeName(srv.uuid), target: '/home/container' }],
    // unless-stopped: падения и перезагрузка хоста поднимают контейнер,
    // а ручной стоп через панель остаётся стопом. С 'always' супервизор
    // cardinal перезапускал бы и вручную остановленные серверы.
    restart: 'unless-stopped',
    memory_bytes: (srv.memory || 0) * 1024 * 1024,
    cpus: (srv.cpu || 0) / 100,
    disk_bytes: (srv.disk || 0) * 1024 * 1024,
    labels: { 'kt.panel/server-id': String(srv.id), 'kt.panel/uuid': srv.uuid },
  }
}

// normalizeStats — stats wings (Docker-схема cardinal) к {cpu, memory, disk}.
// Ключи cardinal: cpu_percent, memory_usage_bytes, disk_usage_bytes
// (см. internal/container/stats.go) + алиасы других источников.
export function normalizeStats(s: any) {
  if (!s) return { cpu: 0, memory: 0, disk: 0 }
  const num = (...keys: string[]) => {
    for (const k of keys) {
      const v = s[k]
      if (typeof v === 'number' && Number.isFinite(v)) return v
    }
    return 0
  }
  return {
    cpu: num('cpu_percent', 'cpu_absolute'),
    memory: num('memory_usage_bytes', 'memory_bytes', 'memory_usage'),
    disk: num('disk_usage_bytes', 'disk_bytes'),
  }
}

// logActivity — одна строка в журнал сервера. Никогда не роняет запрос:
// ошибка записи глотается. Храним последние 500 записей на сервер.
export async function logActivity(db: any, serverId: number, userId: number | null, action: string, detail?: string) {
  try {
    await db.insert(serverActivity).values({ serverId, userId: userId || null, action, detail: detail || null })
    await db.delete(serverActivity).where(and(
      eq(serverActivity.serverId, serverId),
      sql`${serverActivity.id} NOT IN (SELECT id FROM (SELECT id FROM server_activity WHERE server_id = ${serverId} ORDER BY id DESC LIMIT 500) t)`,
    ))
  } catch {}
}

// normalizeFiles — fm/list wings к формату ServerFiles.vue.
export function normalizeFiles(fm: any) {
  const entries = Array.isArray(fm) ? fm : (fm?.entries || [])
  return entries.map((e: any) => ({
    name: e.name,
    directory: e.type === 'dir' || e.directory === true,
    size: e.size || 0,
    modified: e.mod_time ? new Date(e.mod_time * 1000).toISOString() : (e.modified || null),
  }))
}

// wingsFileExists — есть ли уже файл по полному пути в контейнере.
// Нужно для разделения прав: существующий файл правит file.update,
// новый создаёт file.create (иначе create-only мембер перезаписывает
// server.jar в обход update). Ошибка листинга = считаем новым:
// избирательный отказ fm/list атакующий вызвать не может, а UX
// записи в ещё несуществующую папку ломать нельзя.
export async function wingsFileExists(node: any, ref: string, fullPath: string): Promise<boolean> {
  const p = String(fullPath || '')
  const base = p.split('/').pop() || ''
  if (!base) return false
  const dir = p.slice(0, p.length - base.length).replace(/\/+$/, '') || '/'
  try {
    const fm: any = await wingsFetch(node, `/v1/containers/${ref}/fm/list?path=${encodeURIComponent(dir)}`)
    return normalizeFiles(fm).some((e: any) => e.name === base && !e.directory)
  } catch {
    return false
  }
}
