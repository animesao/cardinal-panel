// @ts-nocheck
// PUT /api/servers/[id]/setup {image?, startup?, variables?} — смена
// образа/переменных/стартапа.
// Образ (проверяется по списку чертежа) применяется через reinstall в wings
// (пересоздание с тем же томом данных), переменные мержатся в environment,
// стартап — через /update с перерендером шаблона. Только владелец/админ.
import { servers, allocations, blueprints } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, wingsFetch, containerRef, buildCreatePayload, renderStartup, serverVars, serverExtraPorts, needPerm, logActivity } from '../../../utils/wings'
import { enrichBlueprint, parseEnvObject, applyVariables } from '../../../utils/blueprints'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  const { image, startup, variables } = body || {}

  if (!id) throw createError({ statusCode: 400, message: 'Server ID required' })

  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  if (srv.suspended) throw createError({ statusCode: 403, message: 'Сервер заморожен администратором' })
  needPerm(ctx, 'startup.update')

  let bpVars = []
  if (srv.blueprintId) {
    const brows = await db.select().from(blueprints).where(eq(blueprints.id, srv.blueprintId)).limit(1)
    if (brows.length) {
      const bp = enrichBlueprint(brows[0])
      bpVars = bp.variables
      if (image && bp.images.length && !bp.images.includes(image)) {
        throw createError({ statusCode: 400, message: 'Образ не входит в список чертежа' })
      }
    }
  }

  const updates: any = {}
  if (image) updates.image = image
  if (startup) updates.startup = startup
  if (variables && typeof variables === 'object') {
    const current = parseEnvObject(srv.environment)
    const { env: merged, errors } = applyVariables(bpVars, current, variables)
    if (errors.length) throw createError({ statusCode: 400, message: `Переменные: ${errors.join('; ')}` })
    updates.environment = JSON.stringify(merged)
  }
  if (Object.keys(updates).length) {
    await db.update(servers).set(updates).where(eq(servers.id, id))
  } else {
    return { success: true }
  }
  const next = { ...srv, ...updates }

  try {
    if (image) {
      let allocation = null
      if (next.allocationId) {
        const rows = await db.select().from(allocations).where(eq(allocations.id, next.allocationId)).limit(1)
        allocation = rows[0] || null
      }
      const extras = await serverExtraPorts(db, next.id, next.allocationId)
      await wingsFetch(node, `/v1/containers/${containerRef(next.uuid)}/reinstall`, {
        method: 'POST',
        body: buildCreatePayload(next, allocation, extras),
      })
      await db.update(servers).set({ status: 'running' }).where(eq(servers.id, id))
    } else {
      const template = next.startup
      const extraEnv = parseEnvObject(next.environment)
      await wingsFetch(node, `/v1/containers/${containerRef(next.uuid)}/update`, {
        method: 'POST',
        body: { startup_script: renderStartup(template, serverVars(next, null, extraEnv)) },
      })
    }
  } catch (e: any) {
    console.warn('Wings setup sync failed:', e?.message)
    throw createError({ statusCode: 502, message: `Нода не применила изменения: ${e?.message || e}` })
  }
  await logActivity(db, srv.id, ctx.session.user.id, 'setup.update', image ? `Сменил образ на ${image}` : 'Обновил настройки установки')

  return { success: true }
})
