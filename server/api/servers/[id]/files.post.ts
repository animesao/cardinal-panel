// @ts-nocheck
// POST /api/servers/[id]/files (multipart: files + path?) — загрузка файлов
// через wings fm/write (base64). Прокси через панель: браузеру не нужен
// прямой доступ к ноде и CORS.
import { requireServer, wingsFetch, containerRef, needPerm, logActivity, wingsFileExists } from '../../../utils/wings'

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx

  const formData = await readMultipartFormData(event)
  if (!formData) throw createError({ statusCode: 400, message: 'Нет файлов' })

  let directory = '/'
  const files: Array<{ name: string; data: Buffer }> = []
  for (const field of formData) {
    if (field.name === 'path' || field.name === 'directory') {
      directory = field.data.toString() || '/'
    }
    if ((field.name === 'file' || field.name === 'files') && field.filename) {
      files.push({ name: field.filename.split('/').pop() || field.filename, data: field.data })
    }
  }
  if (!files.length) throw createError({ statusCode: 400, message: 'Нет файлов' })

  // Лимит на файл: без капа заливка гигабайтов кладёт RAM панели
  // (multipart целиком в памяти + base64) и диск ноды.
  //
  // Плюс ЛИМИТ НА СУММУ и НА ЧИСЛО ФАЙЛОВ: раньше проверялся только
  // размер одного файла, поэтому запрос из N файлов по 256 МБ держал в
  // памяти панели N*256 МБ и ронял её одним запросом (весь панель лежал).
  const MAX_FILE_BYTES = 256 * 1024 * 1024
  const MAX_TOTAL_BYTES = 512 * 1024 * 1024
  const MAX_FILES = 32
  if (files.length > MAX_FILES) {
    throw createError({ statusCode: 413, message: `Слишком много файлов (максимум ${MAX_FILES})` })
  }
  let total = 0
  for (const f of files) {
    if (f.data.length > MAX_FILE_BYTES) {
      throw createError({ statusCode: 413, message: `Файл ${f.name} больше 256 МБ — заливай через SFTP` })
    }
    total += f.data.length
    if (total > MAX_TOTAL_BYTES) {
      throw createError({ statusCode: 413, message: 'Суммарный размер загрузки больше 512 МБ — заливай через SFTP' })
    }
  }

  const ref = containerRef(srv.uuid)
  for (const f of files) {
    const target = directory === '/' ? `/${f.name}` : `${directory}/${f.name}`
    // Заливка поверх существующего — file.update, новый файл — file.create.
    needPerm(ctx, (await wingsFileExists(node, ref, target)) ? 'file.update' : 'file.create')
    await wingsFetch(node, `/v1/containers/${ref}/fm/write`, {
      method: 'POST',
      body: { path: target, content: Buffer.from(f.data).toString('base64') },
    })
  }
  await logActivity(ctx.db, srv.id, ctx.session.user.id, 'file.upload', `Загрузил: ${files.map((f) => f.name).join(', ')} в ${directory}`)

  return { success: true, uploaded: files.length }
})
