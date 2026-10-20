// @ts-nocheck
// server/utils/totp.ts — TOTP (RFC 6238, SHA1, 30с, 6 цифр) без зависимостей.
// Чистые функции: генерация секрета, код, проверка с окном ±1 шаг,
// otpauth:// URL для ручного ввода в приложение-аутентификатор,
// резервные коды (одноразовые, храним только SHA256-хэши).
import crypto from 'node:crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let out = ''
  let bits = 0
  let acc = 0
  for (const b of buf) {
    acc = (acc << 8) | b
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += B32[(acc >>> bits) & 31]
    }
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31]
  return out
}

export function base32Decode(s: string): Buffer {
  const clean = String(s || '').toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '')
  const out: number[] = []
  let bits = 0
  let acc = 0
  for (const ch of clean) {
    acc = (acc << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((acc >>> bits) & 255)
    }
  }
  return Buffer.from(out)
}

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes))
}

function hotp(secret: Buffer, counter: bigint): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(counter)
  const h = crypto.createHmac('sha1', secret).update(msg).digest()
  const off = h[h.length - 1] & 0x0f
  const code = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
  return String(code % 1000000).padStart(6, '0')
}

export function totpToken(secretB32: string, atMs = Date.now()): string {
  const step = BigInt(Math.floor(atMs / 30000))
  return hotp(base32Decode(secretB32), step)
}

// verifyTotp — сравнение в constant-time, допускается рассинхрон часов ±1 шаг.
export function verifyTotp(secretB32: string, token: string, atMs = Date.now(), window = 1): boolean {
  const t = String(token || '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(t)) return false
  const secret = base32Decode(secretB32)
  if (!secret.length) return false
  const step = Math.floor(atMs / 30000)
  const want = Buffer.from(t)
  for (let d = -window; d <= window; d++) {
    const got = Buffer.from(hotp(secret, BigInt(step + d)))
    if (got.length === want.length && crypto.timingSafeEqual(got, want)) return true
  }
  return false
}

export function otpauthUrl(secretB32: string, account: string, issuer = 'Cardinal Panel'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`
}

const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateBackupCodes(n = 8): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    let c = ''
    const rnd = crypto.randomBytes(10)
    for (const b of rnd) c += BACKUP_ALPHABET[b % BACKUP_ALPHABET.length]
    out.push(`${c.slice(0, 4)}-${c.slice(4, 8)}`)
  }
  return out
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(String(code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '')).digest('hex')
}
