// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // Глобальные стили панели (Tailwind + тёмные скроллбары и т.п.).
  css: ['~/assets/css/main.css', '~/assets/css/animations.css'],

  // Привязка ко всем IPv4-интерфейсам: дефолтный 'localhost' на Windows
  // резолвится в ::1 (только IPv6), и клиенты на 127.0.0.1 получают
  // ERR_CONNECTION_REFUSED. 0.0.0.0 чинит и localhost, и доступ по LAN-IP
  // (нужен для OAuth-колбэков на 192.168.42.100). Только для dev.
  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },

  // @nuxtjs/tailwindcss сам добавляет плагин tailwindcss/nesting, который в
  // этой связке не загружается ([NUXT_B7027]). Nesting-синтаксис в стилях
  // панели не используется — отключаем, чтобы перестать спамить в лог.
  postcss: {
    plugins: {
      'tailwindcss/nesting': false,
    },
  },

  srcDir: 'app/',

  imports: {
    presets: [
      { from: 'vue-i18n', imports: ['useI18n'] }
    ]
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@sidebase/nuxt-auth'
  ],

  auth: {
    originEnvKey: 'AUTH_ORIGIN',
    baseURL: process.env.AUTH_ORIGIN || 'http://localhost:3000/api/auth',
    provider: {
      type: 'authjs',
      trustHost: true,
      defaultProvider: 'discord',
      addDefaultCallbackUrl: true
    },
    sessionRefresh: {
      enableOnWindowFocus: true,
      enablePeriodically: 60000
    },
    globalAppMiddleware: false,
  },

  runtimeConfig: {
    jwtSecret: process.env.NUXT_JWT_SECRET,
    panelUrl: process.env.NUXT_PANEL_URL,
    authSecret: process.env.NEXTAUTH_SECRET,
    discordClientId: process.env.DISCORD_CLIENT_ID,
    discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
    githubClientId: process.env.GITHUB_CLIENT_ID,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    public: {
      panelUrl: process.env.NUXT_PANEL_URL
    }
  },

  routeRules: {
    '/': { redirect: '/dashboard' }
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Cardinal Panel',
    }
  }
})
