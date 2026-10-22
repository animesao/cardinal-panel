// server/utils/node-url.ts — валидация адреса wings-ноды.
//
// Отдельный модуль без тяжёлых импортов (БД, auth), чтобы правило можно
// было покрыть юнит-тестами.
//
// Правило такое:
// - схема только http(s), без логина в адресе;
// - публичный адрес ноды проходит всегда;
// - внутренний адрес — только из явно доверенной подсети
//   (NODE_TRUSTED_CIDRS): в типовой схеме панель и нода стоят в одной
//   локальной сети, и оператор один раз прописывает подсеть в env;
// - имя хоста проверяется по резолву: http://wings.example.com, который
//   смотрит в 127.0.0.1, считается внутренним адресом;
// - адреса метаданных облаков запрещены всегда, вне allowlist.

import { isTrustedHost, mappedIPv4, parseIp } from './cidr'

// METADATA_HOSTS — адреса метаданных облаков. Блокируются всегда, вне
// зависимости от NODE_TRUSTED_CIDRS: там лежат временные токены, и панель
// не должна их доставать.
const METADATA_HOSTS = new Set([
  '169.254.169.254',   // AWS / GCP / Azure / OpenStack
  '169.254.170.2',    // AWS ECS
  '100.100.100.200',  // Alibaba Cloud
  'fd00:ec2::254',    // AWS IMDSv6
])

// isMetadataHost — хост ведёт на сервис метаданных.
export function isMetadataHost(hostname: string): boolean {
  const h = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!h) return false
  if (METADATA_HOSTS.has(h)) return true
  const mapped = mappedIPv4(h)
  return !!mapped && METADATA_HOSTS.has(mapped)
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
  if (m46) return isPrivateHost(m46[1]!)
  return false
}

// _dnsCache — резолв хостов с коротким TTL, чтобы не долбить DNS на каждый
// запрос формы ноды.
const _dnsCache = new Map<string, { ips: string[]; at: number }>()
const DNS_TTL = 60_000

export async function resolveHost(host: string): Promise<string[]> {
  const now = Date.now()
  const hit = _dnsCache.get(host)
  if (hit && now - hit.at < DNS_TTL) return hit.ips
  let ips: string[] = []
  try {
    const dns = await import('node:dns/promises')
    const found = await dns.lookup(host, { all: true, verbatim: true })
    ips = found.map((r) => r.address)
  } catch {
    ips = []
  }
  _dnsCache.set(host, { ips, at: now })
  return ips
}

// assertNodeUrl — валидация URL ноды при создании/правке (SSRF-барьер).
export async function assertNodeUrl(raw: any): Promise<string> {
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

  const host = u.hostname.toLowerCase()
  if (isMetadataHost(host)) {
    throw createError({ statusCode: 400, message: 'URL ноды: адрес метаданных запрещён' })
  }

  const literal = parseIp(host)
  const addresses = literal ? [host] : await resolveHost(host)
  if (!literal && !addresses.length) {
    throw createError({ statusCode: 400, message: `URL ноды: не удалось разрешить имя ${u.hostname}` })
  }

  const internal = addresses.filter((a) => isPrivateHost(a))
  if (!internal.length) return s // публичный адрес - пропускаем

  const trusted = isTrustedHost(host) || internal.every((a) => isTrustedHost(a))
  if (!trusted) {
    throw createError({
      statusCode: 400,
      message:
        `URL ноды: внутренний адрес ${u.hostname} запрещён. Добавьте подсеть ноды в ` +
        `NODE_TRUSTED_CIDRS (env панели), например NODE_TRUSTED_CIDRS=192.168.0.0/16`,
    })
  }
  return s
}
