// @ts-nocheck
// GET /api/settings/public — публичные настройки панели (название +
// включённые способы входа + признак инициализации). Без авторизации:
// видно на странице входа и во вкладке браузера. Секретов здесь нет.
import { getPanelName, getOAuthPublic, panelInitialized } from '../../utils/settings'

export default defineEventHandler(async () => {
  return {
    name: await getPanelName(),
    providers: await getOAuthPublic(),
    // Панель не инициализирована, пока нет админа. Страница входа в этом
    // состоянии показывает форму первичной настройки вместо обычного входа.
    initialized: await panelInitialized(),
  }
})
