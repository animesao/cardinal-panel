// usePanelName — название панели из БД (Admin → Настройки).
// Один ключ useFetch-кэша на всё приложение: шапки, вход и вкладка
// браузера показывают одно имя и обновляются после сохранения.
export const usePanelName = () => {
  const { data, refresh } = useFetch('/api/settings/public', {
    key: 'panel-name',
    default: () => ({ name: 'Cardinal Panel' }),
  })
  const panelName = computed(() => data.value?.name || 'Cardinal Panel')

  // Вкладка браузера: имя панели + суффикс страницы, если передан.
  const usePanelTitle = (suffix?: string) => {
    useHead({
      title: computed(() => (suffix ? `${suffix} · ${panelName.value}` : panelName.value)),
    })
  }

  return { panelName, refreshPanelName: refresh, usePanelTitle }
}
