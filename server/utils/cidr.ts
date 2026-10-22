// server/utils/cidr.ts — разбор IP-адресов и CIDR-подсетей.
//
// Нужна панели для одного: оператор явно перечисляет подсети, в которых
// лежат wings-ноды (NODE_TRUSTED_CIDRS), а панель проверяет, что адрес
// ноды попадает в этот список. Без allowlist внутренние адреса запрещены,
// поэтому в типовой схеме «панель и нода в одной локальной сети» оператор
// обязан один раз прописать подсеть в env.
//
// Считаем без BigInt: IPv4 помещается в 32-битное число, IPv6 разбирается
// на восемь 16-битных групп. BigInt-литералы (0n) не поддерживаются
// целевым es2019 в сборке Nitro и давали предупреждение esbuild.
//
// Поддерживаются IPv4 и IPv6, а также IPv4-mapped IPv6 (::ffff:10.0.0.1) —
// иначе адрес вида ::ffff:192.168.0.1 проскочил бы мимо проверки IPv4.

export interface CidrRange {
  /** база сети: число для IPv4, восемь групп для IPv6 */
  base: number | number[]
  /** длина префикса */
  bits: number
  /** 4 или 6 */
  version: 4 | 6
}

/** IPv4 -> 32-битное число. null, если это не IPv4. */
export function parseIPv4(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || '').trim())
  if (!m) return null
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  if (parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null
  return (
    ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
  )
}

/** IPv6 -> восемь 16-битных групп. null, если это не IPv6. */
export function parseIPv6(ip: string): number[] | null {
  let s = String(ip || '').trim().toLowerCase()
  if (!s.includes(':')) return null
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1)
  s = s.split('%')[0] ?? s // zone id (fe80::1%eth0) — не влияет на адрес
  // встроенный IPv4-хвост: ::ffff:192.168.0.1 -> ::ffff:c0a8:1
  const m4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s)
  if (m4) {
    const v4 = parseIPv4(m4[1]!)
    if (v4 === null) return null
    s = `${s.slice(0, m4.index!)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`
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
  const out: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out
}

/** Разбор адреса в общем виде. */
export function parseIp(ip: string): { value: number | number[]; version: 4 | 6 } | null {
  const v4 = parseIPv4(ip)
  if (v4 !== null) return { value: v4, version: 4 }
  const v6 = parseIPv6(ip)
  if (v6 !== null) return { value: v6, version: 6 }
  return null
}

/** IPv4-mapped IPv6 (::ffff:10.0.0.1) -> IPv4-строка. */
export function mappedIPv4(ip: string): string | null {
  const groups = parseIPv6(ip)
  if (!groups) return null
  // ::ffff:a.b.c.d -> группы 0..4 = 0, группа 5 = 0xffff, 6 и 7 = a.b.c.d
  for (let i = 0; i < 5; i++) {
    if (groups[i] !== 0) return null
  }
  if (groups[5] !== 0xffff) return null
  const hi = groups[6] ?? 0
  const lo = groups[7] ?? 0
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`
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
    return { base: v4, bits, version: 4 }
  }

  const v6 = parseIPv6(addr)
  if (v6 !== null) {
    const bits = lenPart === null ? 128 : Number(lenPart)
    if (!Number.isInteger(bits) || bits < 0 || bits > 128) return null
    return { base: v6, bits, version: 6 }
  }

  return null
}

/** IPv4-адрес входит в подсеть. */
function ipv4InCidr(ip: number, base: number, bits: number): boolean {
  if (bits <= 0) return true
  const mask = (0xffffffff << (32 - bits)) >>> 0
  return (((ip & mask) >>> 0) === ((base & mask) >>> 0))
}

/** IPv6-адрес входит в подсеть (сравнение по 16-битным группам). */
function ipv6InCidr(ip: number[], base: number[], bits: number): boolean {
  let remaining = bits
  for (let i = 0; i < 8 && remaining > 0; i++) {
    if (remaining >= 16) {
      if (ip[i] !== base[i]) return false
      remaining -= 16
    } else {
      const mask = (0xffff << (16 - remaining)) & 0xffff
      if (((ip[i] ?? 0) & mask) !== ((base[i] ?? 0) & mask)) return false
      remaining = 0
    }
  }
  return true
}

/** Попадает ли IP-адрес в подсеть. */
export function ipInCidr(ip: string, cidr: string): boolean {
  const range = parseCidr(cidr)
  if (!range) return false

  const v4 = parseIPv4(ip)
  if (v4 !== null) {
    if (range.version !== 4) return false
    return ipv4InCidr(v4, range.base as number, range.bits)
  }

  const v6 = parseIPv6(ip)
  if (v6 !== null) {
    if (range.version === 6) return ipv6InCidr(v6, range.base as number[], range.bits)
    // IPv4-mapped IPv6 против IPv4-подсети: ::ffff:192.168.0.1 -> 192.168.0.1
    const mapped = mappedIPv4(ip)
    if (!mapped) return false
    const value = parseIPv4(mapped)
    if (value === null) return false
    return ipv4InCidr(value, range.base as number, range.bits)
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
