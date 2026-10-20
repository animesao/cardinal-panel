// @ts-nocheck
// server/middleware/admin.ts — единая калитка админки.
// Каждый роут /api/admin/* требует роль admin; без неё — 403 даже при
// валидной сессии. Закрывает класс багов «забыли проверку в новом файле»
// раз и навсегда (находили: создание/удаление серверов, ноды, локации,
// аллокации, users/role вообще без проверки сессии).
import { requireAdmin } from '../utils/admin'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/admin')) return
  await requireAdmin(event)
})
