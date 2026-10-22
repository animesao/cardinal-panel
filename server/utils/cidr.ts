// server/utils/cidr.ts — разбор IP-адресов и CIDR-подсетей.
//
// Нужна панели для одного: оператор явно перечисляет подсети, в которых
// лежат wings-ноды (NODE_TRUSTED_CIDRS), а панель проверяет, что адрес
// ноды попадает в этот список. Без allowlist внутренние адреса запрещены,
// поэтому в типовой схеме «панель и нода в одной локальной сети» оператор
// обязан один раз прописать подсеть в env.
//
// Поддерживаются IPv4 и IPv6, а также IPv4-mapped IPv6 (::ffff:10.0.0.1) —
// иначе адрес вида ::ffff:192.168.0.1 проскочил бы мимо проверки IPv4.

export interface CidrRange {
  /** база сети (адрес с обнулёнными битами хоста) */
  net: bigint
  /** длина префикса */
  bits: number
  /** 4 или 6 */
  version: 4 | 6
}

const IPV4_MAX = 0xffffffffn
const IPV6_MAX = (1n << 128n) - 1n

/** IPv4 -> число. null, если это не IPv4. */
export function parseIPv4(ip: string): bigint | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || '').trim())
  if (!m) return null
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  if (parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null
  return (
    (BigInt(parts[0]!) << 24n) |
    (BigInt(parts[1]!) << 16n) |
    (BigInt(parts[2]!) << 8n) |
    BigInt(parts[3]!)
  )
}

/** IPv6 -> число. null, если это не IPv6. */
export function parseIPv6(ip: string): bigint | null {
  let s = String(ip || '').trim().toLowerCase()
  if (!s.includes(':')) return null
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1)
  s = s.split('%')[0] ?? s // zone id (fe80::1%eth0) — не влияет на адрес
  // встроенный IPv4-хвост: ::ffff:192.168.0.1 -> ::ffff:c0a8:1
  const m4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s)
  if (m4) {
    const v4 = parseIPv4(m4[1]!)
    if (v4 === null) return null
    const hi = (v4 >> 16n) & 0xffffn
    const lo = v4 & 0xffffn
    s = `${s.slice(0, m4.index!)}${hi.toString(16)}:${lo.toString(16)}`
  }
  const dbl = s.indexOf('::')
  let groups: string[]
  if (dbl >= 0) {
    const head = s.slice(0, dbl).split(':').filter(Boolean)
    const tail = s.slice(dbl + 2).split(':').filter(Boolean)
    const fill = 8 - head.length - tail.length
    if (fill < 0) return null
    groups = [...head, ...Array<string>(fill).fill('0'), ...tail]
  } else {
    groups = s.split(':').filter(Boolean)
  }
  if (groups.length !== 8) return null
  let out = 0n
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    out = (out << 16n) | BigInt(parseInt(g, 16))
  }
  return out
}

/** Любой IP-адрес -> число. null, если разобрать не удалось. */
export function parseIp(ip: string): { value: bigint; version: 4 | 6 } | null {
  const v4 = parseIPv4(ip)
  if (v4 !== null) return { value: v4, version: 4 }
  const v6 = parseIPv6(ip)
  if (v6 !== null) return { value: v6, version: 6 }
  return null
}

/** IPv4-mapped IPv6 (::ffff:10.0.0.1) -> IPv4-строка. */
export function mappedIPv4(ip: string): string | null {
  const v6 = parseIPv6(ip)
  if (v6 === null) return null
  const top = v6 >> 32n
  if (top !== 0xffffn) return null
  const v = v6 & IPV4_MAX
  return `${Number((v >> 24n) & 0xffn)}.${Number((v >> 16n) & 0xffn)}.${Number((v >> 8n) & 0xffn)}.${Number(v & 0xffn)}`
}

/** Маска по длине префикса. */
function maskFor(bits: number, version: 4 | 6): bigint {
  if (bits <= 0) return 0n
  const max = version === 4 ? IPV4_MAX : IPV6_MAX
  return (max << (BigInt(version === 4 ? 32 : 128) - BigInt(bits))) & max
}

/**
 * Разбор CIDR: "192.168.0.0/16", "10.0.0.1", "fd00::/8".
 * Без "/" префикс равен длине адреса (одна точность).
 */
export function parseCidr(spec: string): CidrRange | null {
  const raw = String(spec || '').trim()
  if (!raw) return null
  const slash = raw.indexOf('/')
  const addr = slash >= 0 ? raw.slice(0, slash) : raw
  const lenPart = slash >= 0 ? raw.slice(slash + 1) : null

  const v4 = parseIPv4(addr)
  if (v4 !== null) {
    const bits = lenPart === null ? 32 : Number(lenPart)
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null
    return { net: v4 & maskFor(bits, 4), bits, version: 4 }
  }

  const v6 = parseIPv6(addr)
  if (v6 !== null) {
    const bits = lenPart === null ? 128 : Number(lenPart)
    if (!Number.isInteger(bits) || bits < 0 || bits > 128) return null
    return { net: v6 & maskFor(bits, 6), bits, version: 6 }
  }

  return null
}

/** Попадает ли IP-адрес в подсеть. */
export function ipInCidr(ip: string, cidr: string): boolean {
  const range = parseCidr(cidr)
  if (!range) return false
  const addr = parseIp(ip)
  if (!addr) return false

  if (addr.version === range.version) {
    return (addr.value & maskFor(range.bits, range.version)) === range.net
  }
  // IPv4-mapped IPv6 против IPv4-подсети: ::ffff:192.168.0.1 -> 192.168.0.1
  if (addr.version === 6 && range.version === 4) {
    const v4 = mappedIPv4(ip)
    if (!v4) return false
    const value = parseIPv4(v4)
    if (value === null) return false
    return (value & maskFor(range.bits, 4)) === range.net
  }
  return false
}

/** Список доверенных подсетей из NODE_TRUSTED_CIDRS. */
export function trustedCidrs(raw?: string): string[] {
  const source = raw === undefined ? process.env.NODE_TRUSTED_CIDRS || '' : raw
  return String(source)
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Доверен ли хост: попадает в одну из подсетей NODE_TRUSTED_CIDRS
 * или совпадает с одной из перечисленных записей (имя хоста / IP).
 */
export function isTrustedHost(host: string, list?: string[]): boolean {
  const entries = list ?? trustedCidrs()
  if (!entries.length) return false
  const h = String(host || '').trim().toLowerCase()
  if (!h) return false
  for (const entry of entries) {
    const e = entry.toLowerCase()
    if (e === h) return true
    if (ipInCidr(h, e)) return true
    // запись может быть именем хоста, а адрес - его IPv4-формой
    const mapped = mappedIPv4(h)
    if (mapped && e === mapped) return true
  }
  return false
}
