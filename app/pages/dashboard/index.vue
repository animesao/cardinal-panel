<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <h2 class="text-2xl font-bold text-white/95">{{ $t('dashboard.myServers') }}</h2>
        <span class="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
          {{ filteredServers.length }} / {{ serversList.length }}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <div v-if="session?.user?.role === 'admin'" class="flex items-center gap-2">
          <span class="text-xs text-white/40">{{ showAllServers ? $t('dashboard.allServers') : $t('dashboard.myServersOnly') }}</span>
          <button
            @click="showAllServers = !showAllServers; loadServers()"
            :class="[
              'relative w-9 h-5 rounded-full transition-colors',
              showAllServers ? 'bg-emerald-300' : 'bg-white/20'
            ]"
          >
            <span :class="[
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
              showAllServers ? 'translate-x-4' : ''
            ]" />
          </button>
        </div>
        <button
          @click="refreshLive()"
          :title="$t('dashboard.refreshStatuses')"
          class="flex items-center gap-1.5 text-xs text-white/50 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition-all"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" />
          </svg>
          {{ $t('dashboard.refresh') }}
        </button>
      </div>
    </div>

    <!-- Поиск / фильтр / сортировка -->
    <div v-if="!loading && serversList.length > 0" class="flex flex-wrap items-center gap-2">
      <div class="relative flex-1 min-w-[200px]">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="search"
          :placeholder="$t('dashboard.searchPh')"
          class="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/50"
        />
      </div>
      <div class="w-full sm:w-52">
        <UiSelect
          v-model="statusFilter"
          :options="statusFilters.map((f) => ({ value: f.key, label: f.label }))"
        />
      </div>
      <div class="w-full sm:w-52">
        <UiSelect
          v-model="sortBy"
          :options="[
            { value: 'name', label: $t('dashboard.sortName') },
            { value: 'status', label: $t('dashboard.sortStatus') },
            { value: 'newest', label: $t('dashboard.sortNewest') },
          ]"
        />
      </div>
    </div>

    <!-- Загрузка -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 animate-pulse">
        <div class="flex items-center gap-3">
          <div class="w-2.5 h-2.5 rounded-full bg-white/15" />
          <div class="h-4 w-1/2 rounded bg-white/10" />
        </div>
        <div class="h-3 w-2/3 rounded bg-white/5" />
        <div class="space-y-1.5">
          <div class="h-1.5 rounded bg-white/10" />
          <div class="h-1.5 rounded bg-white/5" />
        </div>
      </div>
    </div>

    <!-- Нет серверов -->
    <div v-else-if="serversList.length === 0" class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12">
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
          <svg class="w-8 h-8 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2" width="20" height="8" rx="2"/>
            <rect x="2" y="14" width="20" height="8" rx="2"/>
            <line x1="6" y1="6" x2="6" y2="6.01"/>
            <line x1="6" y1="18" x2="6" y2="18.01"/>
          </svg>
        </div>
        <p class="text-white/50 mb-2">
          {{ showAllServers ? $t('dashboard.noServers') : $t('dashboard.noServersMine') }}
        </p>
        <p class="text-white/30 text-sm">
          {{ showAllServers ? $t('dashboard.noServersHintAdmin') : $t('dashboard.noServersHintUser') }}
        </p>
      </div>
    </div>

    <!-- Ничего не найдено -->
    <div v-else-if="filteredServers.length === 0" class="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
      <p class="text-white/50">{{ $t('dashboard.nothingFound') }}</p>
      <button @click="search = ''; statusFilter = 'all'" class="mt-2 text-emerald-300 text-sm hover:text-emerald-200">{{ $t('dashboard.resetFilters') }}</button>
    </div>

    <!-- Список серверов -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="(server, i) in filteredServers"
        :key="server.id"
        :style="{ animationDelay: `${Math.min(i * 40, 320)}ms` }"
        class="kt-enter kt-lift bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] hover:border-white/20 transition-all flex flex-col gap-3"
      >
        <!-- Шапка: статус + имя -->
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="relative flex w-2.5 h-2.5 flex-shrink-0">
            <span v-if="liveStatus(server) === 'running'" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
            <span :class="['relative inline-flex rounded-full w-2.5 h-2.5', dotClass(server)]" />
          </span>
          <NuxtLink :to="`/dashboard/server/${server.id}`" class="font-semibold text-white/90 hover:text-emerald-300 transition-colors truncate">
            {{ server.name }}
          </NuxtLink>
          <span v-if="server.shared" class="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">{{ $t('dashboard.shared') }}</span>
          <span v-if="server.suspended" class="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">{{ $t('server.suspended') }}</span>
          <span class="ml-auto flex-shrink-0 text-xs" :class="stateTextClass(server)">{{ liveStateText(server) }}</span>
        </div>

        <!-- Нода + адрес -->
        <div class="flex items-center gap-2 text-xs text-white/40">
          <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2"/>
            <rect x="2" y="14" width="20" height="8" rx="2"/>
            <line x1="6" y1="6" x2="6" y2="6.01"/>
            <line x1="6" y1="18" x2="6" y2="18.01"/>
          </svg>
          <span class="truncate">{{ server.node?.name || '—' }}</span>
          <button
            v-if="serverAddress(server)"
            @click="copyToClipboard(serverAddress(server))"
            :title="$t('server.copy')"
            class="ml-auto font-mono text-white/60 hover:text-emerald-200 transition-colors truncate"
          >
            {{ serverAddress(server) }}
          </button>
        </div>

        <!-- Нагрузка -->
        <div class="space-y-1.5">
          <div>
            <div class="flex justify-between text-[11px] mb-0.5">
              <span class="text-white/40">CPU</span>
              <span class="text-white/70 font-mono">{{ cpuText(server) }}</span>
            </div>
            <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div :class="['h-full rounded-full transition-all duration-500', barClass(cpuPct(server))]" :style="{ width: cpuPct(server) + '%' }" />
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[11px] mb-0.5">
              <span class="text-white/40">RAM</span>
              <span class="text-white/70 font-mono">{{ ramText(server) }}</span>
            </div>
            <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div :class="['h-full rounded-full transition-all duration-500', barClass(ramPct(server))]" :style="{ width: ramPct(server) + '%' }" />
            </div>
          </div>
          <div>
            <div class="flex justify-between text-[11px] mb-0.5">
              <span class="text-white/40">{{ $t('server.disk') }}</span>
              <span class="text-white/70 font-mono">{{ diskText(server) }}</span>
            </div>
            <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div :class="['h-full rounded-full transition-all duration-500', barClass(diskPct(server))]" :style="{ width: diskPct(server) + '%' }" />
            </div>
          </div>
        </div>

        <!-- Действия -->
        <div class="pt-2.5 border-t border-white/10 flex items-center gap-1.5">
          <button
            v-if="liveStatus(server) !== 'running'"
            @click="power(server, 'start')"
            :disabled="actingId === server.id || server.suspended"
            :title="$t('dashboard.start')"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-all disabled:opacity-50"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            {{ $t('dashboard.start') }}
          </button>
          <button
            v-if="liveStatus(server) === 'running'"
            @click="power(server, 'restart')"
            :disabled="actingId === server.id || server.suspended"
            :title="$t('dashboard.restart')"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/25 transition-all disabled:opacity-50"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" />
            </svg>
            {{ $t('dashboard.restart') }}
          </button>
          <button
            v-if="liveStatus(server) === 'running'"
            @click="power(server, 'stop')"
            :disabled="actingId === server.id || server.suspended"
            :title="$t('dashboard.stop')"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all disabled:opacity-50"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
            {{ $t('dashboard.stop') }}
          </button>
          <span v-if="actingId === server.id" class="text-xs text-white/40">{{ $t('common.executing') }}</span>
          <NuxtLink :to="`/dashboard/server/${server.id}`" class="ml-auto text-xs text-emerald-300/80 hover:text-emerald-200 transition-colors">
            {{ $t('dashboard.manage') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <NoAccessModal />
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
definePageMeta({
  layout: 'dashboard',
  auth: true
})

const { data: session } = useAuth()
const { t } = useI18n()
const showAllServers = ref(false)
const loading = ref(true)
// liveBusy — внутренний guard от наложения тиков опроса друг на друга.
// К шаблону НЕ привязан специально: шапка статична, тики идут молча,
// обновляются только данные внутри карточек.
const liveBusy = ref(false)
const actingId = ref(null)
const serversList = ref([])
const liveMap = ref({})
const search = ref('')
const statusFilter = ref('all')
const sortBy = ref('status')

const statusFilters = computed(() => [
  { key: 'all', label: t('dashboard.filterAll') },
  { key: 'running', label: t('dashboard.filterRunning') },
  { key: 'offline', label: t('dashboard.filterOffline') },
  { key: 'shared', label: t('dashboard.filterShared') },
])

let refreshTimer = null

const loadServers = async () => {
  loading.value = true
  try {
    const url = showAllServers.value ? '/api/admin/servers' : '/api/servers/my'
    const data = await $fetch(url)
    serversList.value = data || []
    refreshLive()
  } catch (e) {
    serversList.value = []
  } finally {
    loading.value = false
  }
}

// Живые данные одним батчем на сервер (status+ресурсы), best effort.
// Важно: мутация по ключу, а не замена всего объекта — иначе каждый тик
// перерисовывает ВСЕ карточки разом (отсюда "всё грузится").
const fetchLiveOne = async (id) => {
  try {
    const data = await $fetch(`/api/servers/${id}/live`)
    liveMap.value[id] = data
  } catch {}
}

const refreshLive = async () => {
  if (!serversList.value.length || liveBusy.value) return
  liveBusy.value = true
  try {
    await Promise.all(serversList.value.map((s) => fetchLiveOne(s.id)))
  } finally {
    liveBusy.value = false
  }
}

const power = async (server, action) => {
  if (actingId.value) return
  actingId.value = server.id
  try {
    await $fetch(`/api/servers/${server.id}/power`, { method: 'POST', body: { action } })
    liveMap.value[server.id] = { ...liveMap.value[server.id], status: action === 'start' ? 'starting' : action === 'restart' ? 'starting' : 'offline' }
    setTimeout(() => fetchLiveOne(server.id), 2500)
  } catch (e) {
    deny(e)
  } finally {
    actingId.value = null
  }
}

const liveStatus = (server) => liveMap.value[server.id]?.status || server.status || 'offline'

const liveStateText = (server) => {
  const s = liveStatus(server)
  return s === 'running' ? t('dashboard.stateRunning') : s === 'starting' ? t('dashboard.stateStarting') : s === 'installing' ? t('dashboard.stateInstalling') : t('dashboard.stateOffline')
}

const dotClass = (server) => {
  const s = liveStatus(server)
  return s === 'running' ? 'bg-green-400' : s === 'starting' || s === 'installing' ? 'bg-yellow-400' : 'bg-gray-500'
}

const stateTextClass = (server) => {
  const s = liveStatus(server)
  return s === 'running' ? 'text-green-400' : s === 'starting' || s === 'installing' ? 'text-yellow-400' : 'text-white/30'
}

const serverAddress = (server) => {
  if (server.address) return String(server.address).replace(/\/tcp$/, '').replace(/\/udp$/, '')
  const a = server.allocation
  if (!a) return ''
  if (typeof a === 'string') return a
  const ip = String(a.ip || '').replace(/\/tcp$/, '').replace(/\/udp$/, '')
  return ip && a.port ? `${ip}:${a.port}` : ''
}

const cpuText = (server) => {
  const live = liveMap.value[server.id]
  if (!live) return '—'
  return `${Math.round(live.cpu || 0)}%`
}

const cpuPct = (server) => {
  const live = liveMap.value[server.id]
  if (!live) return 0
  const limit = Number(live.limits?.cpu) || 100
  return Math.min(100, Math.round(((live.cpu || 0) / Math.max(limit, 1)) * 100))
}

const ramText = (server) => {
  const live = liveMap.value[server.id]
  if (!live) return '—'
  const mb = Math.round((live.memory || 0) / 1048576)
  const limit = Number(live.limits?.memory) || 0
  return limit > 0 ? `${formatMb(mb)} / ${formatMb(limit)}` : formatMb(mb)
}

const ramPct = (server) => {
  const live = liveMap.value[server.id]
  if (!live) return 0
  const limit = Number(live.limits?.memory) || 0
  if (limit <= 0) return 0
  return Math.min(100, Math.round(((live.memory || 0) / 1048576 / limit) * 100))
}

const barClass = (pct) => pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-yellow-400' : 'bg-emerald-300'

const diskText = (server) => {
  const live = liveMap.value[server.id]
  if (!live) return '—'
  const limit = Number(live.limits?.disk) || 0
  return limit > 0 ? `${formatBytes(live.disk)} / ${formatBytes(limit * 1048576)}` : formatBytes(live.disk)
}

const diskPct = (server) => {
  const live = liveMap.value[server.id]
  if (!live) return 0
  const limit = Number(live.limits?.disk) || 0
  if (limit <= 0) return 0
  return Math.min(100, Math.round(((live.disk || 0) / 1048576 / limit) * 100))
}

const filteredServers = computed(() => {
  const q = search.value.trim().toLowerCase()
  let out = serversList.value.filter((s) => {
    if (statusFilter.value === 'running' && liveStatus(s) !== 'running') return false
    if (statusFilter.value === 'offline' && liveStatus(s) === 'running') return false
    if (statusFilter.value === 'shared' && !s.shared) return false
    if (q) {
      const hay = `${s.name || ''} ${s.node?.name || ''} ${serverAddress(s)}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru')
  if (sortBy.value === 'name') out = [...out].sort(byName)
  else if (sortBy.value === 'newest') out = [...out].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  else out = [...out].sort((a, b) => (liveStatus(b) === 'running' ? 1 : 0) - (liveStatus(a) === 'running' ? 1 : 0) || byName(a, b))
  return out
})

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(String(text))
  } catch {}
}

onMounted(() => {
  loadServers()
  // Живой опрос как на странице сервера: каждые 3с, на паузе когда
  // вкладка скрыта (не долбим ноды в фоне).
  refreshTimer = setInterval(() => {
    if (!document.hidden) refreshLive()
  }, 3000)
  document.addEventListener('visibilitychange', onVisibility)
})

const onVisibility = () => {
  if (!document.hidden) refreshLive()
}

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  document.removeEventListener('visibilitychange', onVisibility)
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
