// @ts-nocheck
// /api/auth/* — NextAuth: OAuth (управляются из админки) + вход по паролю.
// Провайдеры собираются НА КАЖДЫЙ ЗАПРОС из БД (а не из .env на старте),
// поэтому тумблеры в Admin → Настройки действуют без рестарта панели.
// Кэш — 60 секунд, чтобы не дёргать БД на каждый auth-хит.
import { NuxtAuthHandler } from '#auth'
import DiscordProvider from 'next-auth/providers/discord'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import getDb from '../../db'
import { users, userTotp } from '../../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { randomUUID } from 'uncrypto'
import { verifyPassword, hashPassword } from '../../utils/password'
import { verifyTotp, hashBackupCode } from '../../utils/totp'
import { seedOAuthFromEnv, getOAuthCreds } from '../../utils/settings'
import { checkAttemptBucket, resetAttemptBucket } from '../../utils/ratelimit'

// Заглушка для verify при отсутствующем пользователе: scrypt всегда
// считается одинаковое время, иначе по времени ответа отличался бы
// существующий email от несуществующего (user enumeration по таймингу).
// Генерим один раз при старте — формат и длина заведомо валидные.
const DUMMY_HASH = hashPassword('__dummy-fallback__')

// Троттлинг входа.
//
// Ключ счётчика — ИДЕНТИЧНОСТЬ (e-mail), а не IP: IP приходит из
// X-Forwarded-For, который подделывается клиентом. Раньше бакет был
// `${ip}:${email}`, и смена заголовка на каждом запросе полностью
// отключала ограничение на перебор паролей (H1).
//
// IP-ведро остаётся как дополнение, но IP берётся из доверенного
// источника — см. server/utils/clientip.ts.
const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_IP_MAX_ATTEMPTS = 30
const LOGIN_IP_WINDOW_MS = 10 * 60 * 1000

// Троттлинг 2FA-кодов: 5 подборов за 5 минут на пользователя.
// 6-значный код иначе перебирается; окно короткое, чтобы не локаулить надолго.
const TOTP_MAX_ATTEMPTS = 5
const TOTP_WINDOW_MS = 5 * 60 * 1000
function totpThrottled(userId: number): boolean {
  return checkAttemptBucket(`totp:${userId}`, TOTP_MAX_ATTEMPTS, TOTP_WINDOW_MS)
}

function parseBackupHashes(raw: any): string[] {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(v)) return v.filter((c) => typeof c === 'string')
  } catch {}
  return []
}

const callbacks = {
  async signIn({ user, account }) {
    if (!user.email) return false

    try {
      const db = await getDb()  // ← ВАЖНО: await getDb()
      const email = String(user.email).trim().toLowerCase()
      const provider = String(account?.provider || 'unknown')
      // Парольный вход (credentials) — отдельный путь: правила OAuth
      // (обход пароля, привязка провайдера, обязательная 2FA) к нему
      // не применяются, иначе вход по e-mail+паролю был бы невозможен
      // для аккаунтов, созданных оператором (create-admin).
      const isCredentials = provider === 'credentials'
      const providerId = String(account?.providerAccountId || user.id || '')

      // 1. Устойчивая привязка (provider, providerAccountId). Раньше её не
      //    было вовсе: личность целиком определялась строкой e-mail, которую
      //    вернул провайдер, поэтому смена e-mail у провайдера (или
      //    переиспользованный корпоративный адрес) мгновенно отдавала чужой
      //    аккаунт — вместе с ролью admin.
      let bound = null
      if (providerId) {
        bound = await db.query.users.findFirst({
          where: and(eq(users.provider, provider), eq(users.providerId, providerId)),
        })
      }

      const existingUser = bound || await db.query.users.findFirst({
        where: sql`lower(${users.email}) = ${email}`,
      })

      if (!existingUser) {
        // Новый OAuth-пользователь. Роль ВСЕГДА 'user'.
        //
        // Раньше здесь стояло автопромоушен: «если в таблице users ровно
        // одна строка — сделать её админом». Состояние пустой таблицы — это
        // дефолт после `npm run db:migrate`, поэтому любой, кто первым
        // дошёл до панели, становился админом без всякой аутентификации.
        // Первого админа создаёт оператор: `npm run create-admin` либо
        // POST /api/setup/bootstrap с PANEL_SETUP_TOKEN.
        await db.insert(users).values({
          uuid: randomUUID(),
          email,
          name: user.name || null,
          avatar: user.image || null,
          provider,
          providerId,
          role: 'user',
          locale: 'en',
          lastLogin: new Date(),
        })
      } else {
        if (!bound) {
          // Нашли аккаунт по e-mail, а не по привязке провайдера.
          //
          // ВАЖНО: парольный вход (provider = 'credentials') — законный
          // путь для аккаунта с паролем. Все проверки ниже относятся только
          // к OAuth: OAuth-вход не должен обходить пароль, а наоборот —
          // не должен и запрещаться из-за наличия пароля. Раньше здесь
          // стояло условие без проверки провайдера, и вход по e-mail+паролю
          // был невозможен ровно для тех аккаунтов, у которых есть пароль
          // (то есть созданных оператором через create-admin).
          if (existingUser.passwordHash && !isCredentials) {
            // У аккаунта есть пароль: OAuth-вход не должен его обходить.
            console.warn('[auth] OAuth-вход в аккаунт с паролем отклонён:', email, provider)
            return '/login?error=PasswordAccountRequired'
          }
          if (!isCredentials && existingUser.provider && existingUser.provider !== provider) {
            console.warn('[auth] Аккаунт уже привязан к другому провайдеру:', email)
            return '/login?error=ProviderAlreadyLinked'
          }
          if (!isCredentials && existingUser.provider === provider && existingUser.providerId && existingUser.providerId !== providerId) {
            // Тот же провайдер, но другой аккаунт с тем же e-mail.
            console.warn('[auth] e-mail уже занят другим аккаунтом провайдера:', email)
            return '/login?error=EmailAlreadyUsed'
          }
        }
        await db.update(users)
          .set({
            lastLogin: new Date(),
            name: user.name || existingUser.name,
            avatar: user.image || existingUser.avatar,
            // Привязку провайдера обновляем только для OAuth: парольный вход
            // не должен затирать существующую привязку (например, к Discord).
            ...(bound || isCredentials ? {} : { provider, providerId }),
          })
          .where(eq(users.id, existingUser.id))
      }

      // 2. 2FA обязателен для ВСЕХ способов входа. Раньше TOTP проверялся
      //    только внутри CredentialsProvider.authorize, то есть OAuth-вход
      //    (самый популярный) второй фактор полностью обходил.
      //    Для парольного входа TOTP уже проверен в authorize() — повторная
      //    проверка здесь отклоняла бы верный вход с кодом.
      const tfaRows = await db.select().from(userTotp).where(eq(userTotp.userId, existingUser?.id ?? 0)).limit(1)
      if (tfaRows[0]?.enabled && !isCredentials) {
        console.warn('[auth] OAuth-вход требует 2FA, вход по паролю:', email)
        return '/login?error=TwoFactorRequired'
      }

      return true
    } catch (error) {
      console.error('SignIn error:', error)
      return false
    }
  },

  async jwt({ token, user, account }) {
    if (user) {
      const db = await getDb()  // ← ВАЖНО: await getDb()

      const dbUser = await db.query.users.findFirst({
        where: sql`lower(${users.email}) = ${String(user.email || '').trim().toLowerCase()}`,
      })

      if (!dbUser) {
        // Панельного аккаунта для этой OAuth-идентичности нет. id
        // провайдера подставлять НЕЛЬЗЯ: он строковый, а users.id — целое,
        // и при неудачном поиске по e-mail сравнение могло указать на ЧУЖОЙ
        // аккаунт (в том числе админа).
        token.id = null
        token.role = null
        return token
      }
      token.id = dbUser.id
      token.uuid = dbUser.uuid
      token.role = dbUser.role
      token.provider = account?.provider
      token.lastLogin = dbUser.lastLogin?.toISOString()
      token.locale = dbUser.locale || 'en'
    }
    return token
  },

  async session({ session, token }) {
    if (session?.user) {
      session.user.id = token.id
      session.user.uuid = token.uuid
      session.user.provider = token.provider
      session.user.role = token.role
      session.user.lastLogin = token.lastLogin
      session.user.locale = token.locale || 'en'
    }
    return session
  },

  async redirect({ url, baseUrl }) {
    if (url === '/login') return '/dashboard'
    if (url.startsWith(baseUrl)) return url
    else if (url.startsWith('/')) return new URL(url, baseUrl).toString()
    return baseUrl
  },
}

let providersCache: { at: number; list: any[] } | null = null

async function buildProviders() {
  await seedOAuthFromEnv()
  if (providersCache && Date.now() - providersCache.at < 60000) return providersCache.list

  const list: any[] = []

  // Вход по почте + паролю — всегда включён (страховка от локаута,
  // если админ выключит все OAuth).
  // @ts-ignore
  list.push(CredentialsProvider.default({
    name: 'Почта и пароль',
    credentials: {
      email: { label: 'Почта', type: 'email' },
      password: { label: 'Пароль', type: 'password' },
      totp: { label: 'Код 2FA', type: 'text' },
    },
    async authorize(credentials, req) {
      const email = String(credentials?.email || '').trim().toLowerCase()
      const password = String(credentials?.password || '')
      const totp = String(credentials?.totp || '').trim()
      if (!email || !password) return null
      // Лимит по идентичности (e-mail) — подделать его нельзя.
      // Лимит по IP живёт в server/middleware/auth-ratelimit.ts: там доступен
      // реальный адрес сокета, а не заголовок, который присылает клиент.
      if (checkAttemptBucket(`login:${email}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)) return null
      try {
        const db = await getDb()
        const rows = await db.select().from(users)
          .where(sql`lower(${users.email}) = ${email}`).limit(1)
        const found = rows[0]
        const ok = !!found?.passwordHash && verifyPassword(password, found.passwordHash)
        if (!found?.passwordHash) verifyPassword(password, DUMMY_HASH)
        if (!ok) return null
        // Второй фактор: пароль верный, дальше решает TOTP.
        // 2FA проверяется для всех способов входа (см. signIn).
        const trows = await db.select().from(userTotp).where(eq(userTotp.userId, found.id)).limit(1)
        const tfa = trows[0]
        if (tfa?.enabled) {
          if (!totp) throw new Error('2FA_REQUIRED')
          // Бюджет подбора кода: 5 попыток на 5 минут на пользователя.
          // verifyTotp принимает окно ±1 шаг, то есть одновременно живут
          // 3 кода из 10^6 — 10 попыток в окне давали ~0.9% успеха в сутки.
          if (totpThrottled(found.id)) throw new Error('2FA_THROTTLED')
          const { unsealSecret } = await import('../../utils/oauth-seal')
          let secret = ''
          try {
            secret = unsealSecret(tfa.secret)
          } catch {
            return null
          }
          if (verifyTotp(secret, totp)) {
            // ok — код из приложения
          } else {
            // Резервный код: одноразовый, после успеха сгорает.
            const hashes = parseBackupHashes(tfa.backupCodes)
            const hit = hashBackupCode(totp)
            if (!hashes.includes(hit)) throw new Error('2FA_INVALID')
            await db.update(userTotp)
              .set({ backupCodes: JSON.stringify(hashes.filter((h) => h !== hit)) })
              .where(eq(userTotp.userId, found.id))
          }
          // Успешный код — счётчик подборов сбрасываем.
          resetAttemptBucket(`totp:${found.id}`)
        }
        await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, found.id))
        // Успешный вход — сбрасываем счётчик попыток по этой почте.
        resetAttemptBucket(`login:${email}`)
        return { id: String(found.id), email: found.email, name: found.name || found.email }
      } catch (e: any) {
        // 2FA-маркеры должны дойти до формы логина как есть.
        if (e?.message && String(e.message).startsWith('2FA_')) throw e
        return null
      }
    },
  }))

  const github = await getOAuthCreds('github')
  if (github) {
    // @ts-ignore
    list.push(GitHubProvider.default({
      clientId: github.clientId,
      clientSecret: github.clientSecret,
      // GitHub App (в отличие от OAuth App) присылает в колбэке iss=
      // https://github.com/login/oauth (RFC 9207). openid-client тогда
      // требует issuer в метаданных и сверяет равенство — без этого
      // падает "OAuthCallback: issuer must be configured on the issuer".
      issuer: 'https://github.com/login/oauth',
    }))
  }
  const google = await getOAuthCreds('google')
  // @ts-ignore
  if (google) list.push(GoogleProvider.default({
    clientId: google.clientId,
    clientSecret: google.clientSecret,
  }))
  const discord = await getOAuthCreds('discord')
  // @ts-ignore
  if (discord) list.push(DiscordProvider.default({
    clientId: discord.clientId,
    clientSecret: discord.clientSecret,
  }))

  providersCache = { at: Date.now(), list }
  return list
}

// NuxtAuthHandler пересобирается только когда меняется состав провайдеров
// (тумблеры/ключи OAuth в админке меняют сигнатуру). Раньше обработчик
// создавался на каждый запрос, а sidebase печатает предупреждение
// «setup for a second time» при любом повторном вызове.
let cachedAuthHandler: { key: string; handler: any } | null = null

function authHandlerKey(list: any[]): string {
  return list.map((p) => [p?.id, p?.clientId, p?.clientSecret].join('|')).join(',')
}

export default defineEventHandler(async (event) => {
  const providers = await buildProviders()
  const key = authHandlerKey(providers)
  if (!cachedAuthHandler || cachedAuthHandler.key !== key) {
    cachedAuthHandler = {
      key,
      handler: NuxtAuthHandler({
        secret: process.env.NEXTAUTH_SECRET,
        pages: {
          signIn: '/login',
          error: '/login',
        },
        providers,
        callbacks,
        debug: process.env.NODE_ENV === 'development',
      }),
    }
  }
  return cachedAuthHandler.handler(event)
})
