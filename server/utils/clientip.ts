// @ts-nocheck
// server/utils/clientip.ts — IP клиента из ДОВЕРЕННОГО источника.
//
// Заголовок X-Forwarded-For присылает клиент, поэтому доверять ему нельзя:
// иначе троттлинг входа обходится одной сменой заголовка (H1).
//
// Откуда берём IP:
//   1. socket.remoteAddress — реальный адрес TCP-соединения. Единственный
//      источник, которому клиент повлиять не может.
//   2. X-Forwarded-For — только если прямой пир (remoteAddress) в списке
//      доверенных прокси (TRUSTED_PROXY). Стандартная схема обратного
//      прокси добавляет реальный адрес клиента в конец цепочки, поэтому
//      берём ПОСЛЕДНИЙ адрес из XFF, а не первый.

const DEFAULT_TRUSTED_PROXIES = ['127.0.0.1', '::1', '::ffff:127.0.0.1']

function normalizeIp(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  // IPv6 в квадратных скобках, возможно с портом: [::1]:8080
  const bracketed = s.match(/^\[([^\]]+)\](?::\d+)?$/)
  if (bracketed) return bracketed[1]
  // Голый IPv6: двоеточий больше одного — это адрес, а не порт.
  // Иначе хвост адреса съедался бы регуляркой порта: 'fe80::1' → 'fe80:',
  // и все адреса с одинаковым префиксом попадали в один rate-limit бакет.
  if ((s.match(/:/g) || []).length > 1) return s
  // IPv4, возможно с портом.
  const ipv4 = s.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/)
  if (ipv4) return ipv4[1]
  return s
}

export function trustedProxies() {
  const raw = process.env.TRUSTED_PROXY || ''
  const list = raw
    .split(',')
    .map((s) => normalizeIp(s))
    .filter(Boolean)
  return list.length ? list : DEFAULT_TRUSTED_PROXIES
}

export function isTrustedProxy(ip) {
  const target = normalizeIp(ip)
  if (!target) return false
  return trustedProxies().includes(target)
}

// clientIp — адрес клиента для троттлинга и аудита.
// event — H3Event; если передан, IP берётся из socket'а.
export function clientIp(event) {
  let remote = ''
  try {
    remote = event?.node?.req?.socket?.remoteAddress || event?.req?.socket?.remoteAddress || ''
  } catch {}
  remote = normalizeIp(remote)

  if (!remote) {
    // Тесты/утилиты без сокета: заголовки — единственный источник.
    const headers = event?.headers || {}
    const xff = String(headers['x-forwarded-for'] || '').split(',').map((s) => normalizeIp(s)).filter(Boolean)
    return xff.length ? xff[xff.length - 1] : 'unknown'
  }

  if (!isTrustedProxy(remote)) return remote

  const headers = event?.headers || {}
  const xff = String(headers['x-forwarded-for'] || '').split(',').map((s) => normalizeIp(s)).filter(Boolean)
  if (xff.length) return xff[xff.length - 1]
  const real = normalizeIp(headers['x-real-ip'] || '')
  return real || remote
}
