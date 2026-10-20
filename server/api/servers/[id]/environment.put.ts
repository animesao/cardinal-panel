// @ts-nocheck
// PUT /api/servers/[id]/environment — замена окружения целиком.
// Проверяется по variables чертежа (editable/required/max), extras
// разрешены. Применяется в cardinal через /update (на следующий старт).
import { servers, blueprints } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireServer, wingsFetch, containerRef, renderStartup, serverVars, needPerm, logActivity } from '../../../utils/wings'
import { enrichBlueprint, parseEnvObject, applyVariables } from '../../../utils/blueprints'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  if (!id || !body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Нужен объект переменных' })
  }

  const ctx = await requireServer(event, id)
  const { db, srv, node } = ctx
  needPerm(ctx, 'startup.update')

  let bpVars = []
  if (srv.blueprintId) {
    const brows = await db.select().from(blueprints).where(eq(blueprints.id, srv.blueprintId)).limit(1)
    if (brows.length) bpVars = enrichBlueprint(brows[0]).variables
  }

  // PUT = полный новый набор: валидируем как ввод поверх пустого,
  // extras из body сохраняются.
  const { env: merged, errors } = applyVariables(bpVars, {}, body)
  if (errors.length) throw createError({ statusCode: 400, message: `Переменные: ${errors.join('; ')}` })
  await db.update(servers).set({ environment: JSON.stringify(merged) }).where(eq(servers.id, id))

  try {
    const extraEnv = parseEnvObject(JSON.stringify(merged))
    await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/update`, {
      method: 'POST',
      body: {
        env: Object.entries(merged).map(([k, v]) => `${k}=${v}`),
        startup_script: renderStartup(srv.startup, serverVars(srv, null, merged)),
      },
    })
  } catch (e) {
    console.warn('Wings env sync failed:', e?.message)
  }
  await logActivity(db, srv.id, ctx.session.user.id, 'environment.update', 'Обновил переменные окружения')

  return { success: true }
})
