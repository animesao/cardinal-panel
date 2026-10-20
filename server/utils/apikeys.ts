// @ts-nocheck
// server/utils/apikeys.ts — API-ключи панели (как Account API в Pterodactyl).
//
// Ключ привязан к пользователю и действует от его имени: свои серверы +
// расшаренные. Что именно разрешено — решают scopes ключа:
//   account.read  — кто владеет ключом
//   servers.read  — список, данные и ресурсы серверов
//   servers.power — старт, стоп и рестарт серверов
//
// Формат токена: `cp_<32 символа>` (144 бита). В БД лежит только SHA256-хэш,
// сам секрет показывается один раз при создании.
import crypto from 'node:crypto'
import { getDb } from '../db'
import { apiKeys, users, servers, nodes, allocations, serverUsers } from '../db/schema'
import { eq, inArray } from 'drizzle-orm'
import { displayAddress, parseSubuserPerms } from './wings'
import { API_KEY_PREFIX, normalizeLevels, hashApiToken, resolveApiKey } from './apikey-auth'

export function parseScopes(raw: any): string[] {
  return Object.entries(normalizeLevels(raw))
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}.${v === 2 ? 'write' : 'read'}`)
}

// mintApiKey — создать ключ для пользователя. levels: {resource: 1|2}.
// Возвращает секрет ОДИН РАЗ: в БД едет только хэш, показать токен
// потом уже нельзя.
export async function mintApiKey(db: any, userId: number, name: string, levels: Record<string, number>) {
  const secret = API_KEY_PREFIX + crypto.randomBytes(24).toString('base64url')
  const row = {
    userId,
    name,
    prefix: secret.slice(0, 12),
    tokenHash: hashApiToken(secret),
    scopes: JSON.stringify(levels),
  }
  await db.insert(apiKeys).values(row)
  return { token: secret, prefix: row.prefix }
}

// requireApiKey — Bearer-проверка для /api/v1/*. 401 без/с чужим токеном.
export async function requireApiKey(event: any) {
  const auth = getHeader(event, 'authorization') || ''
  const presented = auth.replace(/^Bearer\s+/i, '').trim()
  if (!presented.startsWith(API_KEY_PREFIX)) {
    throw createError({ statusCode: 401, message: 'Нужен API-ключ (Authorization: Bearer cp_...)' })
  }
  return await resolveApiKey(presented, event)
}

// needLevel — уровень доступа к ресурсу (1 чтение, 2 запись).
export function needLevel(ctx: { levels?: Record<string, number> }, resource: string, min = 1) {
  if ((ctx?.levels?.[resource] || 0) >= min) return
  throw createError({ statusCode: 403, message: `Ключу нет доступа: ${resource} (нужен уровень ${min})` })
}

// requireAdminKey — админские ресурсы (ноды, пользователи, хосты БД):
// мало иметь уровень в ключе, владелец ключа должен быть админом панели.
export function requireAdminKey(ctx: { isAdmin?: boolean }) {
  if (ctx?.isAdmin) return
  throw createError({ statusCode: 403, message: 'Ресурс доступен только ключам администраторов' })
}

const serverShape = {
  id: servers.id,
  uuid: servers.uuid,
  name: servers.name,
  description: servers.description,
  ownerId: servers.ownerId,
  nodeId: servers.nodeId,
  memory: servers.memory,
  cpu: servers.cpu,
  disk: servers.disk,
  status: servers.status,
  createdAt: servers.createdAt,
  node: {
    id: nodes.id,
    name: nodes.name,
  },
  allocation: {
    id: allocations.id,
    ip: allocations.ip,
    port: allocations.port,
  },
}

// withAddress — как в my.get: считает address и прячет внутренний URL ноды.
function withAddress(rows: any[], nodeUrls: Map<number, string>) {
  return rows.map((s: any) => {
    const { node, allocation, ...rest } = s
    const url = node ? nodeUrls.get(node.id) || '' : ''
    return {
      ...rest,
      node: node ? { id: node.id, name: node.name } : node,
      allocation,
      address: displayAddress(allocation, url ? { url } : null),
    }
  })
}

// getUserServers — серверы, доступные пользователю ключа: свои + расшаренные.
// Админу — все серверы панели.
export async function getUserServers(db: any, user: any) {
  // URL нод нужны только для подсчёта address — тянем отдельно, наружу не отдаём.
  const nodeRows = await db.select({ id: nodes.id, url: nodes.url }).from(nodes)
  const nodeUrls = new Map(nodeRows.map((n: any) => [n.id, n.url]))

  if (user.role === 'admin') {
    const all = await db
      .select(serverShape)
      .from(servers)
      .leftJoin(nodes, eq(servers.nodeId, nodes.id))
      .leftJoin(allocations, eq(servers.allocationId, allocations.id))
      .orderBy(servers.createdAt)
    return withAddress(all, nodeUrls).map((s: any) => ({ ...s, shared: false }))
  }

  const owned = withAddress(await db
    .select(serverShape)
    .from(servers)
    .leftJoin(nodes, eq(servers.nodeId, nodes.id))
    .leftJoin(allocations, eq(servers.allocationId, allocations.id))
    .where(eq(servers.ownerId, user.id))
    .orderBy(servers.createdAt), nodeUrls)

  const memberRows = await db.select({ serverId: serverUsers.serverId })
    .from(serverUsers)
    .where(eq(serverUsers.userId, user.id))
  const ownedIds = new Set(owned.map((s: any) => s.id))
  const sharedIds = [...new Set(memberRows.map((r: any) => r.serverId))].filter((sid) => !ownedIds.has(sid))
  let shared: any[] = []
  if (sharedIds.length) {
    shared = withAddress(await db
      .select(serverShape)
      .from(servers)
      .leftJoin(nodes, eq(servers.nodeId, nodes.id))
      .leftJoin(allocations, eq(servers.allocationId, allocations.id))
      .where(inArray(servers.id, sharedIds))
      .orderBy(servers.createdAt), nodeUrls).map((s: any) => ({ ...s, shared: true }))
  }
  return [...owned.map((s: any) => ({ ...s, shared: false })), ...shared]
}

// resolveKeyServer — сервер по uuid с проверкой доступа ключа.
// Возвращает {srv, node, role}: owner/admin/member(+permissions).
export async function resolveKeyServer(db: any, ctx: { user: any; isAdmin?: boolean }, uuid: string) {
  const { user } = ctx
  const srows = await db.select().from(servers).where(eq(servers.uuid, uuid)).limit(1)
  if (!srows.length) throw createError({ statusCode: 404, message: 'Сервер не найден' })
  const srv = srows[0]

  const nrows = await db.select().from(nodes).where(eq(nodes.id, srv.nodeId)).limit(1)
  if (!nrows.length) throw createError({ statusCode: 500, message: 'Нода сервера не найдена' })
  const node = nrows[0]

  if (ctx.isAdmin || user.role === 'admin' || srv.ownerId === user.id) {
    return { srv, node, isOwner: srv.ownerId === user.id, isAdmin: true, permissions: [] as string[] }
  }
  const mrows = await db.select().from(serverUsers)
    .where(eq(serverUsers.serverId, srv.id))
  const mine = mrows.find((r: any) => r.userId === user.id)
  if (!mine) throw createError({ statusCode: 403, message: 'Нет доступа к серверу' })
  return { srv, node, isOwner: false, isAdmin: false, permissions: parseSubuserPerms(mine.permissions) }
}
