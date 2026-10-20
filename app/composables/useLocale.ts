// useLocale — текущий язык панели: чтение, смена, RTL.
// Приоритет: БД пользователя (если залогинен) > кука panel-locale > localStorage > ru.
// Смена пишется везде: i18n, кука, localStorage и PUT /api/account/locale.
import { LANGS, RTL_LOCALES } from '~/plugins/i18n'

export const useLocale = () => {
  const { locale } = useI18n()
  const cookie = useCookie<string>('panel-locale')

  const applyDir = (code: string) => {
    const dir = RTL_LOCALES.includes(code) ? 'rtl' : 'ltr'
    useHead({ htmlAttrs: { lang: code, dir } })
  }

  const current = computed(() => locale.value)

  const applyLocal = (code: string) => {
    locale.value = code
    cookie.value = code
    try {
      localStorage.setItem('panel-locale', code)
    } catch {}
    applyDir(code)
  }

  const setLocale = async (code: string) => {
    if (!LANGS.some((l) => l.code === code)) return
    applyLocal(code)
    try {
      await $fetch('/api/account/locale', { method: 'PUT', body: { locale: code } })
    } catch {}
  }

  const loadLocale = async () => {
    try {
      const me: any = await $fetch('/api/account/locale')
      if (me?.locale && LANGS.some((l) => l.code === me.locale) && me.locale !== locale.value) {
        applyLocal(me.locale)
      }
    } catch {}
  }

  onMounted(() => {
    applyDir(locale.value)
    loadLocale()
  })

  return { locale: current, setLocale, loadLocale, LANGS }
}
