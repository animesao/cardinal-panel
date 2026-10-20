// @ts-nocheck
// server/utils/settings.ts — настройки панели (ключ-значение).
// Название панели (panel_name) живёт в БД и меняется из админки
// (Admin → Настройки), в .env его больше нет.
import { getDb } from '../db'
import { settings, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'

export const DEFAULT_PANEL_NAME = 'Cardinal Panel'

export async function getSetting(name: string, fallback = ''): Promise<string> {
  try {
    const db = await getDb()
    const rows = await db.select().from(settings).where(eq(settings.name, name)).limit(1)
    if (rows.length && typeof rows[0].value === 'string' && rows[0].value) return rows[0].value
  } catch {}
  return fallback
}

export async function setSetting(name: string, value: string) {
  const db = await getDb()
  const rows = await db.select().from(settings).where(eq(settings.name, name)).limit(1)
  if (rows.length) {
    await db.update(settings).set({ value }).where(eq(settings.name, name))
  } else {
    await db.insert(settings).values({ name, value })
  }
}

export function sanitizePanelName(raw: any): string {
  // Имя панели: видимый текст 2..60 символов, без управляющих символов.
  const s = String(raw || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().replace(/\s+/g, ' ')
  if (s.length < 2) throw createError({ statusCode: 400, message: 'Название: минимум 2 символа' })
  if (s.length > 60) throw createError({ statusCode: 400, message: 'Название: максимум 60 символов' })
  return s
}

export async function getPanelName(): Promise<string> {
  return getSetting('panel_name', DEFAULT_PANEL_NAME)
}

// ---------------------------------------------------------------------------
// Первичная настройка (C3)
// ---------------------------------------------------------------------------
//
// Раньше панель становилась «админской» сама: при пустой таблице users
// первый вошедший через OAuth получал role=admin. Состояние пустой таблицы
// — это дефолт после `npm run db:migrate`, поэтому любой, кто первым дошёл
// до панели, становился админом.
//
// Теперь админа создаёт оператор одним из двух способов:
//   1. `npm run create-admin` — CLI с доступом к БД;
//   2. POST /api/setup/bootstrap с PANEL_SETUP_TOKEN из .env — форма на
//      странице входа, когда панель ещё не инициализирована.

// hasAdmin — есть ли в панели хотя бы один админ.
export async function hasAdmin(): Promise<boolean> {
  try {
    const db = await getDb()
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1)
    return rows.length > 0
  } catch {
    return false
  }
}

// panelInitialized — панель готова к работе (есть админ).
export async function panelInitialized(): Promise<boolean> {
  return hasAdmin()
}

// getSetupToken — токен первичной настройки из окружения.
export function getSetupToken(): string {
  return String(process.env.PANEL_SETUP_TOKEN || '').trim()
}

// setupTokenMatches — сравнение токена в постоянном времени.
export function setupTokenMatches(presented: string): boolean {
  const expected = getSetupToken()
  if (!expected) return false
  const a = Buffer.from(String(presented || ''))
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    // Длины не должны утекать: всё равно делаем сравнение фиксированной
    // длины, но результат всегда false.
    crypto.timingSafeEqual(b, b)
    return false
  }
  return crypto.timingSafeEqual(a, b)
}

export const OAUTH_PROVIDERS = ['github', 'google', 'discord'] as const

// getOAuthPublic — что отдаём наружу (вход, без секретов).
export async function getOAuthPublic(): Promise<Array<{ id: string; enabled: boolean }>> {
  const out: Array<{ id: string; enabled: boolean }> = []
  for (const id of OAUTH_PROVIDERS) {
    out.push({ id, enabled: (await getSetting(`oauth_${id}_enabled`, '')) === '1' })
  }
  return out
}

// getOAuthAdmin — всё для админки: секретов нет, только факт наличия.
export async function getOAuthAdmin() {
  const out: Record<string, { enabled: boolean; clientId: string; secretSet: boolean }> = {}
  for (const id of OAUTH_PROVIDERS) {
    out[id] = {
      enabled: (await getSetting(`oauth_${id}_enabled`, '')) === '1',
      clientId: await getSetting(`oauth_${id}_id`, ''),
      secretSet: !!(await getSetting(`oauth_${id}_secret`, '')),
    }
  }
  return out
}

// getOAuthCreds — id+секрет провайдера (только серверная сторона,
// для обмена code→token). null — провайдер не настроен/выключен.
export async function getOAuthCreds(id: string): Promise<{ clientId: string; clientSecret: string } | null> {
  if (!OAUTH_PROVIDERS.includes(id as any)) return null
  const { unsealSecret } = await import('./oauth-seal')
  const enabled = (await getSetting(`oauth_${id}_enabled`, '')) === '1'
  const clientId = await getSetting(`oauth_${id}_id`, '')
  const sealed = await getSetting(`oauth_${id}_secret`, '')
  if (!enabled || !clientId || !sealed) return null
  try {
    const clientSecret = unsealSecret(sealed)
    if (!clientSecret) return null
    return { clientId, clientSecret }
  } catch {
    return null
  }
}

// seedOAuthFromEnv — одноразовый переезд с .env в БД: если настроек ещё нет,
// а в окружении лежат *_CLIENT_ID/SECRET — забираем (шифруя секрет).
// Дальше живут только в БД и рулятся из админки.
export async function seedOAuthFromEnv() {
  try {
    const probe = await getSetting('oauth_seeded', '')
    if (probe) return
    const { sealSecret } = await import('./oauth-seal')
    const map: Record<string, { id: string; secret: string }> = {
      github: { id: process.env.GITHUB_CLIENT_ID || '', secret: process.env.GITHUB_CLIENT_SECRET || '' },
      google: { id: process.env.GOOGLE_CLIENT_ID || '', secret: process.env.GOOGLE_CLIENT_SECRET || '' },
      discord: { id: process.env.DISCORD_CLIENT_ID || '', secret: process.env.DISCORD_CLIENT_SECRET || '' },
    }
    for (const pid of OAUTH_PROVIDERS) {
      const { id, secret } = map[pid]
      if (id && secret) {
        await setSetting(`oauth_${pid}_enabled`, '1')
        await setSetting(`oauth_${pid}_id`, id)
        try { await setSetting(`oauth_${pid}_secret`, sealSecret(secret)) } catch {}
      }
    }
    await setSetting('oauth_seeded', '1')
  } catch {}
}
