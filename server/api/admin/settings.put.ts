// @ts-nocheck
// PUT /api/admin/settings {panel_name?, oauth?} — настройки панели.
// oauth: {github: {enabled, clientId, clientSecret?}, ...} — секрет
// шифруется (AES-256-GCM); пустой = оставить прежний. Применяется сразу
// везде (провайдеры пересобираются до 60 секунд): шапки, вход, вкладка.
import { requireAdmin } from '../../utils/admin'
import { setSetting, sanitizePanelName, OAUTH_PROVIDERS, getSetting } from '../../utils/settings'
import { sealSecret } from '../../utils/oauth-seal'
import { getDb } from '../../db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { session } = await requireAdmin(event)
  const body = await readBody(event).catch(() => ({}))
  const out: any = {}

  if (body?.panel_name !== undefined) {
    const panel_name = sanitizePanelName(body.panel_name)
    await setSetting('panel_name', panel_name)
    out.panel_name = panel_name
  }

  if (body?.oauth && typeof body.oauth === 'object') {
    // Сначала считаем будущее состояние, чтобы не дать админу
    // отрезать себе все входы: хотя бы один способ должен остаться.
    const nextEnabled: Record<string, boolean> = {}
    for (const pid of OAUTH_PROVIDERS) {
      const cfg = body.oauth[pid]
      if (!cfg || typeof cfg !== 'object') {
        nextEnabled[pid] = (await getSetting(`oauth_${pid}_enabled`, '')) === '1'
      } else {
        nextEnabled[pid] = !!cfg.enabled
      }
    }
    if (!Object.values(nextEnabled).some(Boolean)) {
      // OAuth весь выключен — у вызывающего обязан быть пароль,
      // иначе после сохранения никто не войдёт.
      const db = await getDb()
      const urows = await db.select({ passwordHash: users.passwordHash })
        .from(users).where(eq(users.id, session.user.id)).limit(1)
      if (!urows[0]?.passwordHash) {
        throw createError({ statusCode: 400, message: 'Нельзя выключить всё: задай себе пароль в Аккаунте, иначе не войдёшь' })
      }
    }

    const saved: Record<string, { enabled: boolean; secretSet: boolean }> = {}
    for (const pid of OAUTH_PROVIDERS) {
      const cfg = body.oauth[pid]
      if (!cfg || typeof cfg !== 'object') continue
      const enabled = !!cfg.enabled
      const clientId = String(cfg.clientId || '').trim().slice(0, 255)
      const secret = String(cfg.clientSecret || '')
      if (enabled && !clientId) {
        throw createError({ statusCode: 400, message: `Провайдер ${pid}: для включения нужен Client ID` })
      }
      await setSetting(`oauth_${pid}_enabled`, enabled ? '1' : '0')
      await setSetting(`oauth_${pid}_id`, clientId)
      let secretSet = false
      if (secret) {
        await setSetting(`oauth_${pid}_secret`, sealSecret(secret))
        secretSet = true
      } else {
        secretSet = !!(await getSetting(`oauth_${pid}_secret`, ''))
      }
      if (enabled && !secretSet) {
        throw createError({ statusCode: 400, message: `Провайдер ${pid}: вставь Client Secret` })
      }
      saved[pid] = { enabled, secretSet }
    }
    out.oauth = saved
  }

  return { success: true, ...out }
})
