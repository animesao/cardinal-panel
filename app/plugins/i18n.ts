import { createI18n } from 'vue-i18n'
import ru from '~/locales/ru.json'
import en from '~/locales/en.json'
import de from '~/locales/de.json'
import es from '~/locales/es.json'
import fr from '~/locales/fr.json'
import pt from '~/locales/pt.json'
import zh from '~/locales/zh.json'
import ar from '~/locales/ar.json'
import hi from '~/locales/hi.json'
import ja from '~/locales/ja.json'

export const LANGS = [
  { code: 'ru', name: 'Русский', native: 'Русский' },
  { code: 'en', name: 'Английский', native: 'English' },
  { code: 'de', name: 'Немецкий', native: 'Deutsch' },
  { code: 'es', name: 'Испанский', native: 'Español' },
  { code: 'fr', name: 'Французский', native: 'Français' },
  { code: 'pt', name: 'Португальский', native: 'Português' },
  { code: 'zh', name: 'Китайский', native: '中文' },
  { code: 'ar', name: 'Арабский', native: 'العربية' },
  { code: 'hi', name: 'Хинди', native: 'हिन्दी' },
  { code: 'ja', name: 'Японский', native: '日本語' },
]

export const RTL_LOCALES = ['ar']

const savedLocale = () => {
  try {
    return localStorage.getItem('panel-locale') || ''
  } catch {
    return ''
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const cookie = useCookie('panel-locale')
  // Кука первична (работает и на сервере), localStorage — запасной источник.
  let initial = cookie.value || ''
  if (!initial && process.client) initial = savedLocale()
  if (!LANGS.some((l) => l.code === initial)) initial = 'en'

  const i18n = createI18n({
    legacy: false,
    locale: initial,
    fallbackLocale: 'en',
    messages: { ru, en, de, es, fr, pt, zh, ar, hi, ja },
  })
  nuxtApp.vueApp.use(i18n)

  if (process.client) {
    try {
      localStorage.setItem('panel-locale', initial)
    } catch {}
  }
  cookie.value = initial
})
