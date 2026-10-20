// @ts-nocheck
// server/utils/password.ts — пароли аккаунтов (вход по почте+пароль).
// scrypt из node:crypto (встроенный, без зависимостей):
// соль 16 байт, параметры N=16384 r=8 p=1. Формат:
//   scrypt$16384$8$1$<salt-b64url>$<hash-b64url>
// Сравнение — timingSafeEqual.
import crypto from 'node:crypto'

const N = 16384
const R = 8
const P = 1
const KEYLEN = 64

export function assertPasswordRules(pw: any): string {
  const s = String(pw || '')
  if (s.length < 8) throw createError({ statusCode: 400, message: 'Пароль: минимум 8 символов' })
  if (s.length > 128) throw createError({ statusCode: 400, message: 'Пароль: максимум 128 символов' })
  return s
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('base64url')
  const hash = crypto.scryptSync(pw, salt, KEYLEN, { N, R, p: P }).toString('base64url')
  return `scrypt$${N}$${R}$${P}$${salt}$${hash}`
}

export function verifyPassword(pw: string, stored: string): boolean {  try {
    const parts = String(stored || '').split('$')
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false
    const [, n, r, p, salt, expected] = parts
    const hash = crypto.scryptSync(String(pw || ''), salt, KEYLEN, {
      N: parseInt(n), R: parseInt(r), p: parseInt(p),
    }).toString('base64url')
    const a = Buffer.from(hash)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
