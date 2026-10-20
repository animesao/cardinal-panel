// @ts-nocheck
// GET /api/v1/account — кто владеет ключом (любой валидный ключ).
// Pterodactyl-стиль: `Authorization: Bearer cp_...`.
import { requireApiKey } from '../../utils/apikeys'

export default defineEventHandler(async (event) => {
  const { user, key, levels } = await requireApiKey(event)
  return {
    id: user.id,
    uuid: user.uuid,
    email: user.email,
    name: user.name,
    role: user.role,
    key: { name: key.name, prefix: key.prefix, levels },
  }
})
