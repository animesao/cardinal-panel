<template>
  <div class="min-h-screen bg-black flex items-center justify-center p-4">
    <div class="bg-[#171717] rounded-3xl p-8 max-w-md w-full">
      <h2 class="text-white text-center text-xl mb-8">{{ $t('login.title', { name: appName }) }}</h2>

      <!-- Первичная настройка: панель ещё без администратора -->
      <div v-if="needsSetup" class="flex flex-col gap-3">
        <p class="text-white/70 text-sm text-center">
          Панель не инициализирована. Создайте первого администратора.
        </p>
        <p class="text-white/40 text-xs text-center">
          Нужен токен <code class="text-white/60">PANEL_SETUP_TOKEN</code> из .env
          (или выполните <code class="text-white/60">npm run create-admin</code>).
        </p>
        <div v-if="setupDone" class="text-emerald-300 text-sm text-center">
          Администратор создан. Теперь войдите.
        </div>
        <template v-else>
          <input
            v-model="setupEmail"
            type="email"
            required
            autocomplete="username"
            placeholder="E-mail администратора"
            class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
          />
          <input
            v-model="setupPassword"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            placeholder="Пароль (мин. 8)"
            class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
          />
          <input
            v-model="setupToken"
            type="password"
            required
            autocomplete="off"
            placeholder="Токен настройки"
            class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
          />
          <button
            type="button"
            @click="createFirstAdmin"
            :disabled="loading !== null"
            class="w-full flex items-center justify-center gap-3 bg-emerald-300 hover:bg-emerald-200 text-black rounded-lg px-4 py-3 font-medium transition-all disabled:opacity-50"
          >
            <svg v-if="loading === 'setup'" class="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <span>Создать администратора</span>
          </button>
        </template>
        <div v-if="setupError" class="text-center text-red-400 text-sm mt-2">{{ setupError }}</div>
      </div>

      <!-- Почта + пароль -->
      <form v-else-if="!need2fa" @submit.prevent="loginWithPassword" class="flex flex-col gap-3">
        <input
          v-model="credEmail"
          type="email"
          required
          autocomplete="email"
          :placeholder="$t('login.email')"
          class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
        />
        <input
          v-model="credPassword"
          type="password"
          required
          autocomplete="current-password"
          :placeholder="$t('login.password')"
          class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
        />
        <button
          type="submit"
          :disabled="loading !== null"
          class="w-full flex items-center justify-center gap-3 bg-emerald-300 hover:bg-emerald-200 text-black rounded-lg px-4 py-3 font-medium transition-all disabled:opacity-50"
        >
          <svg v-if="loading === 'credentials'" class="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <span>{{ loading === 'credentials' ? $t('login.signingIn') : $t('login.signIn') }}</span>
        </button>
      </form>

      <!-- Второй фактор -->
      <form v-else-if="!needsSetup" @submit.prevent="loginWithTotp" class="flex flex-col gap-3">
        <p class="text-white/60 text-sm text-center">{{ $t('login.twoFaHint', { email: credEmail }) }}</p>
        <input
          v-model="totpCode"
          type="text"
          required
          inputmode="text"
          autocomplete="one-time-code"
          :placeholder="$t('login.twoFaPh')"
          class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm text-center tracking-[0.3em] placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
        />
        <button
          type="submit"
          :disabled="loading !== null || !totpCode.trim()"
          class="w-full flex items-center justify-center gap-3 bg-emerald-300 hover:bg-emerald-200 text-black rounded-lg px-4 py-3 font-medium transition-all disabled:opacity-50"
        >
          <svg v-if="loading === 'totp'" class="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <span>{{ loading === 'totp' ? $t('login.signingIn') : $t('login.twoFaGo') }}</span>
        </button>
        <button
          type="button"
          @click="need2fa = false; totpCode = ''; totpError = ''"
          class="text-white/40 hover:text-white/70 text-xs transition-colors"
        >
          {{ $t('common.back') }}
        </button>
      </form>

      <div v-if="!needsSetup && oauthProviders.length" class="flex items-center gap-3 my-4">
        <div class="flex-1 h-px bg-white/10" />
        <span class="text-white/30 text-xs">{{ $t('login.orVia') }}</span>
        <div class="flex-1 h-px bg-white/10" />
      </div>

      <div v-if="status === 'loading'" class="text-center text-gray-400 my-4">
        {{ $t('common.loading') }}
      </div>

      <div v-else-if="!needsSetup && oauthProviders.length" class="flex flex-col gap-4">
        <!-- Discord -->
        <button
          v-if="oauthProviders.includes('discord')"
          @click="loginWithProvider('discord')"
          :disabled="loading !== null"
          class="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg px-4 py-3 transition-all disabled:opacity-50"
        >
          <svg v-if="loading === 'discord'" class="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
          </svg>
          <span>Discord</span>
        </button>
        
        <!-- GitHub -->
        <button
          v-if="oauthProviders.includes('github')"
          @click="loginWithProvider('github')"
          :disabled="loading !== null"
          class="w-full flex items-center justify-center gap-3 bg-[#24292e] hover:bg-[#2f363d] text-white rounded-lg px-4 py-3 transition-all disabled:opacity-50"
        >
          <svg v-if="loading === 'github'" class="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"/>
          </svg>
          <span>GitHub</span>
        </button>
        
        <!-- Google -->
        <button
          v-if="oauthProviders.includes('google')"
          @click="loginWithProvider('google')"
          :disabled="loading !== null"
          class="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 rounded-lg px-4 py-3 transition-all disabled:opacity-50"
        >
          <svg v-if="loading === 'google'" class="h-5 w-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          <svg v-else class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Google</span>
        </button>
      </div>
      
      <div class="flex justify-center mt-6">
        <LanguageSwitcher />
      </div>

      <div v-if="localError || errorText" class="text-center text-red-400 text-sm mt-4">
        {{ localError || errorText }}
      </div>
    </div>
  </div>
</template>

<script setup>
const { signIn, status } = useAuth()
const { panelName: appName, usePanelTitle } = usePanelName()
usePanelTitle()
const { t, locale } = useI18n()
const route = useRoute()

const loading = ref(null)
const error = computed(() => route.query.error)
const errorText = computed(() => {
  if (error.value === 'CredentialsSignin') return t('login.errorInvalid')
  if (!error.value) return ''
  return t('login.errorGeneric', { error: error.value })
})
const credEmail = ref('')
const credPassword = ref('')
const need2fa = ref(false)
const totpCode = ref('')
const totpError = ref('')
const localError = computed(() => totpError.value)

// Включённые в админке OAuth-кнопки (по умолчанию все выключены).
const { data: publicSettings, refresh: refreshPublic } = await useFetch('/api/settings/public', { key: 'panel-public-login' })
const oauthProviders = computed(() => (publicSettings.value?.providers || []).filter((p) => p?.enabled).map((p) => p.id))
// Панель без администратора: обычный вход недоступен, показываем настройку.
const needsSetup = computed(() => publicSettings.value?.initialized === false)

const loginWithProvider = async (provider) => {
  loading.value = provider
  try {
    await signIn(provider, {
      callbackUrl: '/dashboard',
      redirect: true,
    })
  } catch (e) {
    console.error(`${provider} login error:`, e)
    loading.value = null
  }
}

const loginWithPassword = async () => {
  if (!credEmail.value || !credPassword.value) return
  loading.value = 'credentials'
  totpError.value = ''
  try {
    const res = await signIn('credentials', {
      email: credEmail.value.trim(),
      password: credPassword.value,
      redirect: false,
    })
    if (res?.error) {
      if (String(res.error).includes('2FA_REQUIRED')) {
        need2fa.value = true
        totpCode.value = ''
      } else {
        totpError.value = t('login.errorInvalid')
      }
      loading.value = null
      return
    }
    await navigateTo('/dashboard')
  } catch (e) {
    console.error('credentials login error:', e)
    totpError.value = t('login.errorInvalid')
    loading.value = null
  }
}

const loginWithTotp = async () => {
  if (!totpCode.value.trim()) return
  loading.value = 'totp'
  totpError.value = ''
  try {
    const res = await signIn('credentials', {
      email: credEmail.value.trim(),
      password: credPassword.value,
      totp: totpCode.value.trim(),
      redirect: false,
    })
    if (res?.error) {
      const err = String(res.error)
      totpError.value = err.includes('2FA_THROTTLED')
        ? t('login.twoFaThrottled')
        : t('login.twoFaInvalid')
      loading.value = null
      return
    }
    await navigateTo('/dashboard')
  } catch (e) {
    console.error('totp login error:', e)
    totpError.value = t('login.twoFaInvalid')
    loading.value = null
  }
}

// Первичная настройка: панель без админа (initialized === false).
// Создать первого админа может только оператор, у которого есть
// PANEL_SETUP_TOKEN из .env (или доступ к БД через `npm run create-admin`).
const setupEmail = ref('')
const setupPassword = ref('')
const setupToken = ref('')
const setupError = ref('')
const setupDone = ref(false)

const createFirstAdmin = async () => {
  setupError.value = ''
  if (!setupEmail.value.trim() || !setupPassword.value || !setupToken.value.trim()) return
  loading.value = 'setup'
  try {
    await $fetch('/api/setup/bootstrap', {
      method: 'POST',
      body: {
        email: setupEmail.value.trim(),
        password: setupPassword.value,
        setupToken: setupToken.value.trim(),
      },
    })
    setupDone.value = true
    loading.value = null
    await refreshPublic()
  } catch (e) {
    setupError.value = e?.data?.message || e?.data?.statusMessage || 'Setup failed'
    loading.value = null
  }
}

definePageMeta({
  layout: false
})
</script>
<style scoped>
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
</style>