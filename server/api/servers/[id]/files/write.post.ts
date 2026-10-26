// @ts-nocheck
// POST /api/servers/[id]/files/write {path, content} — запись текста через
// wings fm/write (контент кодируется в base64 на панели).
import { requireServer, wingsFetch, containerRef, needPerm, logActivity, wingsFileExists } from '../../../../utils/wings'
import { validateServerFilePath } from '../../../../utils/file-path'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event)
  const { path: rawPath, content } = body
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx

  if (!id || rawPath === undefined) throw createError({ statusCode: 400, message: 'Неверные параметры' })
  const path = validateServerFilePath(rawPath)
  // Перезапись существующего — file.update, создание нового — file.create.
  needPerm(ctx, (await wingsFileExists(node, containerRef(srv.uuid), String(path))) ? 'file.update' : 'file.create')

  // Лимит записи: base64 раздувает тело на треть, без капа мембер
  // с file.create кладёт RAM панели и диск ноды циклом.
  const raw = Buffer.from(content ?? '', 'utf8')
  if (raw.length > 64 * 1024 * 1024) throw createError({ statusCode: 413, message: 'Файл больше 64 МБ — заливай частями или через SFTP' })

  await wingsFetch(node, `/v1/containers/${containerRef(srv.uuid)}/fm/write`, {
    method: 'POST',
    body: { path, content: raw.toString('base64') },
  })
  await logActivity(ctx.db, srv.id, ctx.session.user.id, 'file.save', `Сохранил ${path}`)

  return { success: true }
})
