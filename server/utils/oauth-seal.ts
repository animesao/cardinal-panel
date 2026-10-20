// @ts-nocheck
// server/utils/oauth-seal.ts — секреты OAuth-провайдеров в БД.
// Хранить открытым текстом нельзя (утёкший дамп = уведённые приложения),
// хэш не подходит (секрет нужен в исходном виде для обмена code→token).
// Поэтому шифрование AES-256-GCM, ключ — scrypt из NEXTAUTH_SECRET
// (он и так обязателен и никуда не утекает из сервера).
import crypto from 'node:crypto'

function sealKey(): Buffer {
  const master = process.env.NEXTAUTH_SECRET || ''
  if (master.length < 16) {
    throw createError({ statusCode: 500, message: 'NEXTAUTH_SECRET слишком короткий (нужно 16+ символов)' })
  }
  return crypto.scryptSync(master, 'oauth-seal-v1', 32)
}

// seal — {iv, tag, data} в base64url через точку.
export function sealSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', sealKey(), iv)
  const enc = Buffer.concat([cipher.update(String(plain || ''), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

export function unsealSecret(sealed: string): string {
  const [ivB, tagB, dataB] = String(sealed || '').split('.')
  if (!ivB || !tagB || !dataB) throw new Error('bad sealed secret')
  const decipher = crypto.createDecipheriv('aes-256-gcm', sealKey(), Buffer.from(ivB, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64url')), decipher.final()]).toString('utf8')
}
