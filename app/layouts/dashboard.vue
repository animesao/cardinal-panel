<template>
  <div class="flex h-screen w-screen overflow-hidden bg-[#0b0d12] relative text-white">
    <!-- Top Spotlight Background -->
    <div class="absolute inset-0 z-0 pointer-events-none">
      <div class="w-full h-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.08)_20%,rgba(0,0,0,0)_60%)]"></div>
    </div>



    <!-- Основной контент -->
    <main class="flex-1 flex flex-col overflow-y-auto py-3 px-3 lg:p-3 gap-3 relative z-10 custom-scrollbar w-full">
      <header class="flex justify-between items-center gap-3 bg-[#12141b] border border-white/[0.07] rounded-2xl px-4 py-3">
        <div class="flex items-center gap-3 min-w-0">
          <NuxtLink
            to="/dashboard"
            class="text-xl font-bold text-transparent bg-clip-text flex-shrink-0 hidden sm:inline"
            style="background-image: radial-gradient(circle 500px at 50% 100px, rgba(110,231,183,0.35), transparent);"
          >
            {{ appName }}
          </NuxtLink>
          <span class="hidden sm:inline text-white/15">/</span>
          <h1 class="text-xl lg:text-2xl font-bold text-white/95 drop-shadow-lg truncate">{{ pageTitle }}</h1>
        </div>
        <div class="flex items-center gap-2 lg:gap-3 flex-shrink-0">
          <div class="hidden sm:block text-right">
            <p class="text-sm text-white/80">{{ userName }}</p>
            <p class="text-xs text-white/40 hidden lg:block">{{ userEmail }}</p>
          </div>
          <NuxtLink
            v-if="session?.user?.role === 'admin'"
            to="/admin"
            :title="$t('nav.admin')"
            class="w-8 h-8 rounded-full hidden sm:flex items-center justify-center border border-white/20 text-white/50 hover:text-yellow-300 hover:border-yellow-300/50 transition-all"
          >
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="currentColor" d="m11.998 2l.118.007l.059.008l.061.013l.111.034a1 1 0 0 1 .217.112l.104.082l.255.218a11 11 0 0 0 7.189 2.537l.342-.01a1 1 0 0 1 1.005.717a13 13 0 0 1-9.208 16.25a1 1 0 0 1-.502 0A13 13 0 0 1 2.54 5.718a1 1 0 0 1 1.005-.717a11 11 0 0 0 7.531-2.527l.263-.225l.096-.075a1 1 0 0 1 .217-.112l.112-.034a1 1 0 0 1 .119-.021z"/>
            </svg>
          </NuxtLink>
          <NuxtLink
            to="/dashboard/account"
            :title="$t('nav.account')"
            @contextmenu.prevent="openAvatarMenu($event)"
            class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-white/20 hover:border-emerald-300/60 transition-all hover:ring-2 hover:ring-emerald-300/20"
          >
            <img
              v-if="session?.user?.image"
              :src="session.user.image"
              :alt="userName"
              class="w-full h-full object-cover pointer-events-none"
            />
            <span
              v-else
              class="w-full h-full flex items-center justify-center bg-emerald-300/15 text-emerald-300 text-sm font-bold pointer-events-none"
            >
              {{ (userName || '?').charAt(0).toUpperCase() }}
            </span>
          </NuxtLink>
        </div>

        <!-- Меню аватарки по правому клику -->
        <Teleport to="body">
          <div
            v-if="avatarMenu"
            class="kt-menu fixed z-[100] w-56 rounded-xl border border-white/15 bg-[#161616] shadow-xl shadow-black/60 py-1.5"
            :style="{ left: avatarMenu.x + 'px', top: avatarMenu.y + 'px' }"
            @click.stop
          >
            <p class="px-3.5 pt-1.5 pb-1 text-[11px] text-white/35 truncate">{{ userEmail || userName }}</p>
            <NuxtLink
              to="/dashboard/account"
              @click="avatarMenu = null"
              class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <svg class="w-4 h-4 text-white/50 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1"/></svg>
              {{ $t('nav.accountSettings') }}
            </NuxtLink>
            <div class="my-1 border-t border-white/10" />
            <button
              @click="askLogout"
              class="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
            >
              <svg class="w-4 h-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 12v.01M3 21h18M5 21V5a2 2 0 0 1 2-2h7.5M17 13.5V21M14 7h7m-3-3l3 3l-3 3"/></svg>
              {{ $t('nav.logoutAsk') }}
            </button>
          </div>
        </Teleport>
      </header>
      
      <div class="bg-[#12141b] border border-white/[0.07] rounded-2xl p-3 lg:p-5 flex-1 text-white/90 animate-fade-in">
        <slot />
      </div>
    </main>
    <UiConfirmModal />
  </div>
</template>

<script setup>
const route = useRoute()
const { panelName: appName, usePanelTitle } = usePanelName()
usePanelTitle()
const { data: session, signOut } = useAuth()
const { t } = useI18n()

const loading = ref(false)

// Запись входа (IP/устройство) — сервер отсекает дубли за 10 минут.
onMounted(async () => {
  try { await $fetch('/api/account/logins', { method: 'POST' }) } catch {}
})

const pageTitle = computed(() => {
  if (route.path === '/dashboard') return t('nav.dashboard')
  if (route.path.includes('/dashboard/account')) return t('nav.account')
  return t('nav.panel')
})

const userName = computed(() => session.value?.user?.name || t('common.noName'))
const userEmail = computed(() => session.value?.user?.email || '')

const handleLogout = async () => {
  loading.value = true
  try {
    await signOut({ callbackUrl: '/login' })
  } catch (error) {
    console.error('Logout error:', error)
    loading.value = false
  }
}

// Меню аватарки по правому клику (вопрос про выход).
const avatarMenu = ref(null)

const openAvatarMenu = (e) => {
  const w = 224
  const h = 130
  avatarMenu.value = {
    x: Math.max(8, Math.min(e.clientX, window.innerWidth - w - 8)),
    y: Math.max(8, Math.min(e.clientY, window.innerHeight - h - 8)),
  }
}

const closeAvatarMenu = () => { avatarMenu.value = null }

const askLogout = async () => {
  closeAvatarMenu()
  if (!(await confirmDialog({ message: t('nav.logoutAsk'), confirmText: t('nav.logout'), danger: true }))) return
  await handleLogout()
}

watch(avatarMenu, (v) => {
  if (v) document.addEventListener('click', closeAvatarMenu)
  else document.removeEventListener('click', closeAvatarMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeAvatarMenu)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>