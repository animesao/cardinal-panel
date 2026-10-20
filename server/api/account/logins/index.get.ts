// @ts-nocheck
// GET /api/account/logins — свои последние 20 входов (только владелец).
import { getDb } from '../../../db'
import { loginHistory } from '../../../db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { getServerSession } from '#auth'
import { pageAliases } from '../../../utils/pagination'

const PROVIDERS = { github: 'GitHub', google: 'Google', discord: 'Discord', credentials: 'Почта и пароль' }

// shortUa — коротко устройство из User-Agent: браузер · ОС.
function shortUa(ua: string): string {
  const s = String(ua || '')
  if (!s) return ''
  let browser = ''
  if (/Edg\//.test(s)) browser = 'Edge'
  else if (/OPR\//.test(s)) browser = 'Opera'
  else if (/Firefox\//.test(s)) browser = 'Firefox'
  else if (/Chrome\//.test(s)) browser = 'Chrome'
  else if (/Safari\//.test(s)) browser = 'Safari'
  let os = ''
  if (/Windows/.test(s)) os = 'Windows'
  else if (/Android/.test(s)) os = 'Android'
  else if (/iPhone|iPad/.test(s)) os = 'iOS'
  else if (/Mac OS/.test(s)) os = 'macOS'
  else if (/Linux/.test(s)) os = 'Linux'
  return [browser, os].filter(Boolean).join(' · ')
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Не авторизован' })

  const query = { ...getQuery(event), ...pageAliases(getQuery(event)) }
  const limit = Math.min(Math.max(parseInt(query.limit) || 5, 1), 50)
  const offset = Math.max(parseInt(query.offset) || 0, 0)

  const db = await getDb()
  const totalRows = await db.select({ n: sql`count(*)` })
    .from(loginHistory)
    .where(eq(loginHistory.userId, session.user.id))
  event.node.res.setHeader('X-Total-Count', Number(totalRows[0]?.n) || 0)
  const rows = await db.select().from(loginHistory)
    .where(eq(loginHistory.userId, session.user.id))
    .orderBy(desc(loginHistory.id))
    .limit(limit)
    .offset(offset)
  return rows.map((r) => ({
    id: r.id,
    ip: r.ip,
    userAgent: shortUa(r.userAgent),
    providerName: PROVIDERS[r.provider] || r.provider || '—',
    createdAt: r.createdAt,
  }))
})
