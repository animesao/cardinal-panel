<template>
  <div class="flex h-screen w-screen overflow-hidden bg-[#0b0d12] relative text-white">
    <!-- Оверлей для мобильного сайдбара -->
    <div
      v-if="sidebarOpen"
      @click="sidebarOpen = false"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
    />

    <!-- Сайдбар -->
    <aside
      :class="[
        'fixed lg:relative z-30 lg:z-10 w-[228px] m-0 lg:m-3 lg:mr-0 bg-[#12141b] border border-white/[0.07] lg:rounded-2xl flex flex-col py-5 px-3 h-full lg:h-auto transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      ]"
    >
      <div class="px-2 mb-7 flex items-center gap-2.5">
        <span class="w-2.5 h-2.5 rounded-full bg-red-400/80" />
        <span class="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-300/80" />
        <span class="ml-1 text-sm font-bold tracking-wide text-white/90">{{ adminName }}</span>
      </div>

      <div class="px-2 mb-3">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="navQuery"
            :placeholder="$t('admin.search')"
            class="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
          />
        </div>
      </div>

      <nav class="flex-1 flex flex-col gap-1 overflow-y-auto">
        <template v-for="item in visibleNav" :key="item.to || item.label">
          <div v-if="item.divider" class="mx-3 my-2 border-t border-white/[0.07]" />
          <p v-else-if="item.section" class="px-3 mt-3 mb-1 text-[11px] uppercase tracking-wider text-white/30">{{ item.label }}</p>
          <NuxtLink
            v-else
            :to="item.to"
            @click="sidebarOpen = false"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            :class="isActive(item)
              ? 'bg-emerald-300 text-black'
              : 'text-white/55 hover:bg-white/[0.06] hover:text-white/90'"
          >
            <span class="w-5 h-5 flex-shrink-0" v-html="item.icon" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </template>
        <div v-if="navQuery && !visibleNav.some((i) => !i.divider && !i.section)" class="px-3 py-4 text-sm text-white/30">
          {{ $t('dashboard.nothingFound') }}
        </div>
      </nav>

      <div class="mt-auto border-t border-white/[0.07] pt-3">
        <button
          @click="exit"
          class="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-white/55 text-sm font-medium transition-all hover:bg-white/[0.06] hover:text-white/90"
        >
          <span class="w-5 h-5 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 12v.01M3 21h18M5 21V5a2 2 0 0 1 2-2h7.5M17 13.5V21M14 7h7m-3-3l3 3l-3 3"/>
            </svg>
          </span>
          <span>{{ $t('nav.toPanel') }}</span>
        </button>
      </div>
    </aside>

    <!-- Основной контент -->
    <main class="flex-1 flex flex-col overflow-y-auto py-3 px-3 lg:p-3 gap-3 relative z-10 custom-scrollbar w-full min-w-0">
      <header class="flex justify-between items-center gap-3 bg-[#12141b] border border-white/[0.07] rounded-2xl px-4 py-3">
        <div class="flex items-center gap-3 min-w-0">
          <button @click="sidebarOpen = !sidebarOpen" class="lg:hidden text-white/60 hover:text-white/90 p-1">
            <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 class="text-lg lg:text-xl font-bold text-white/95 truncate">{{ pageTitle }}</h1>
        </div>
        <div class="flex items-center gap-2.5 flex-shrink-0">
          <span class="hidden sm:block text-xs text-emerald-300/90 bg-emerald-300/10 px-3 py-1.5 rounded-full border border-emerald-300/20">{{ $t('admin.admin') }}</span>
          <NuxtLink to="/dashboard" :title="$t('nav.toPanel')" class="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/60 hover:text-white/90 hover:border-white/25 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                <path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
              </g>
            </svg>
          </NuxtLink>
        </div>
      </header>

      <div class="bg-[#12141b] border border-white/[0.07] rounded-2xl p-4 lg:p-5 flex-1 text-white/90 animate-fade-in min-w-0">
        <slot />
      </div>
    </main>
    <UiConfirmModal />
  </div>
</template>

<script setup>
const route = useRoute()
const { t } = useI18n()
const { panelName: adminName, usePanelTitle } = usePanelName()
usePanelTitle()

const sidebarOpen = ref(false)
const navQuery = ref('')

watch(() => route.path, () => {
  sidebarOpen.value = false
})

// Запись входа (IP/устройство) — для прямых заходов в /admin мимо дашборда.
onMounted(async () => {
  try { await $fetch('/api/account/logins', { method: 'POST' }) } catch {}
})

const ICONS = {
  home: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M5 12H3l9-9l9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/></g></svg>',
  db: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M4 6a8 3 0 1 0 16 0A8 3 0 1 0 4 6"/><path d="M4 6v6a8 3 0 0 0 16 0V6"/><path d="M4 12v6a8 3 0 0 0 16 0v-6"/></g></svg>',
  pin: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/><path d="M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0m8-10v2m0 16v2m8-10h2M2 12h2"/></g></svg>',
  node: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M6 9a6 6 0 1 0 12 0A6 6 0 0 0 6 9"/><path d="M12 3q2 .5 2 6c0 5.5-.667 5.667-2 6m0-12q-2 .5-2 6c0 5.5.667 5.667 2 6M6 9h12M3 20h7m4 0h7m-11 0a2 2 0 1 0 4 0a2 2 0 0 0-4 0m2-5v3"/></g></svg>',
  server: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm0 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm4-7v.01M7 16v.01M11 8h6m-6 8h6"/></g></svg>',
  users: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m1-17.87a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85"/></g></svg>',
  key: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></g></svg>',  egg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 21h4L20 8a1.5 1.5 0 0 0-4-4L3 17zM14.5 5.5l4 4"/><path d="M12 8L7 3L3 7l5 5M7 8L5.5 9.5M16 12l5 5l-4 4l-5-5m4 1l-1.5 1.5"/></g></svg>',
  gear: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></g></svg>',
}

const NAV = computed(() => [
  { to: '/admin', label: t('admin.overview'), icon: ICONS.home, exact: true },
  { divider: true },
  { section: true, label: t('admin.secInfra') },
  { to: '/admin/nodes', label: t('admin.nodes'), icon: ICONS.node },
  { to: '/admin/location', label: t('admin.locations'), icon: ICONS.pin },
  { to: '/admin/servers', label: t('admin.servers'), icon: ICONS.server },
  { divider: true },
  { section: true, label: t('admin.secData') },
  { to: '/admin/database-hosts', label: t('admin.databases'), icon: ICONS.db },
  { to: '/admin/blueprints', label: t('admin.blueprints'), icon: ICONS.egg },
  { divider: true },
  { section: true, label: t('admin.secAccess') },
  { to: '/admin/users', label: t('admin.users'), icon: ICONS.users },
  { to: '/admin/api-keys', label: t('admin.apiKeys'), icon: ICONS.key },
  { divider: true },
  { section: true, label: t('admin.secPanel') },
  { to: '/admin/settings', label: t('admin.settings'), icon: ICONS.gear },
])

const isActive = (item) => item.exact
  ? route.path === item.to
  : route.path === item.to || route.path.startsWith(item.to + '/')

const visibleNav = computed(() => {
  const q = navQuery.value.trim().toLowerCase()
  if (!q) return NAV.value
  return NAV.value.filter((i) => i.divider || i.section || i.label.toLowerCase().includes(q))
})

const pageTitle = computed(() => {
  if (route.path === '/admin') return t('admin.overview')
  if (route.path.includes('/admin/database-hosts')) return t('admin.databases')
  if (route.path.includes('/admin/servers')) return t('admin.servers')
  if (route.path.includes('/admin/location')) return t('admin.locations')
  if (route.path.includes('/admin/nodes')) return t('admin.nodes')
  if (route.path.includes('/admin/users')) return t('admin.users')
  if (route.path.includes('/admin/blueprints')) return t('admin.blueprints')
  if (route.path.includes('/admin/api-keys')) return t('admin.apiKeys')
  if (route.path.includes('/admin/settings')) return t('admin.settings')
  return t('admin.title')
})

const exit = async () => {
  await navigateTo('/dashboard')
}
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

.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}
</style>
