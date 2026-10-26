// server/utils/file-path.ts — валидация путей файлового менеджера
// Защита от path traversal: пути должны быть в пределах корня сервера (/).
// Wings сам дополнительно проверяет, но панель — первый барьер.

export function sanitizeFileName(name: string): string {
  // Удаляем опасные символы и пути
  return String(name || '')
    .replace(/[\r\n"]/g, '')
    .replace(/[\\\/]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, 255) || 'file'
}

export function validateServerFilePath(input: unknown): string {
  if (typeof input !== 'string') {
    throw createError({ statusCode: 400, message: 'Некорректный путь' })
  }
  let p = input.trim()
  if (!p) {
    throw createError({ statusCode: 400, message: 'Путь не указан' })
  }
  // Нормализуем слеши
  p = p.replace(/\\/g, '/')
  // Запрещаем абсолютные пути вне / или относительные с ..
  if (p.includes('..')) {
    throw createError({ statusCode: 400, message: 'Некорректный путь' })
  }
  // Должен начинаться с /
  if (!p.startsWith('/')) {
    p = '/' + p
  }
  // Убираем дублирующиеся слеши
  p = p.replace(/\/+/g, '/')
  // Не позволяем пустой путь
  if (p === '') p = '/'
  // Запрещаем очень длинные пути
  if (p.length > 1024) {
    throw createError({ statusCode: 400, message: 'Слишком длинный путь' })
  }
  // Проверка на null byte
  if (p.includes('\0')) {
    throw createError({ statusCode: 400, message: 'Некорректный путь' })
  }
  return p
}

export function getFileNameFromPath(p: string): string {
  const parts = p.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

export function sanitizeContentDisposition(name: string): string {
  // Жёсткая санитизация для Content-Disposition
  return String(name || 'file')
    .replace(/[\r\n"]/g, '')
    .replace(/[\\\/]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_') // только ASCII
    .slice(0, 128) || 'file'
}
