<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-white/95">{{ $t('adminPages.overview.title') }}</h2>
        <p class="text-sm text-white/40 mt-0.5">{{ $t('adminPages.overview.liveState', { date: currentDate }) }}</p>
      </div>
      <button
        @click="loadAll()"
        :disabled="loading"
        class="flex items-center gap-1.5 text-xs text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 transition-all disabled:opacity-50"
      >
        <svg class="w-3.5 h-3.5" :class="loading && 'animate-spin'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6" />
          <path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" />
        </svg>
        {{ $t('common.refresh') }}
      </button>
    </div>

    <!-- Стат-карточки -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex items-center gap-3.5">
        <div class="relative w-14 h-14 flex-shrink-0">
          <svg viewBox="0 0 84 84" class="w-14 h-14 -rotate-90">
            <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="9" />
            <circle
              cx="42" cy="42" r="34" fill="none" stroke="#6ee7b7" stroke-width="9" stroke-linecap="round"
              :stroke-dasharray="`${donutLen} 213.6`" class="transition-all duration-500"
            />
          </svg>
          <span class="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/90">{{ runningCount }}</span>
        </div>
        <div class="min-w-0">
          <p class="text-2xl font-bold text-white/95 leading-none">{{ servers.length }}</p>
          <p class="text-xs text-white/40 mt-1">{{ $t('adminPages.overview.serversRunning', { n: runningCount }) }}</p>
        </div>
      </div>

      <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
        <div class="flex items-center gap-2 text-white/40 mb-2">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          </svg>
          <span class="text-xs">{{ $t('admin.users') }}</span>
        </div>
        <p class="text-2xl font-bold text-white/95 leading-none">{{ users.length }}</p>
        <p class="text-xs text-white/40 mt-1">{{ $t('adminPages.overview.adminsOf', { n: adminCount }) }}</p>
      </div>

      <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
        <div class="flex items-center gap-2 text-white/40 mb-2">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
          </svg>
          <span class="text-xs">{{ $t('admin.nodes') }}</span>
        </div>
        <p class="text-2xl font-bold text-white/95 leading-none">{{ nodesUp }}<span class="text-sm text-white/40">/{{ nodes.length }}</span></p>
        <p class="text-xs text-white/40 mt-1">{{ $t('adminPages.overview.online') }}</p>
      </div>

      <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
        <div class="flex items-center gap-2 text-white/40 mb-2">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm0 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />
          </svg>
          <span class="text-xs">{{ $t('adminPages.overview.fleetMem') }}</span>
        </div>
        <p class="text-2xl font-bold text-white/95 leading-none">{{ fmtGb(memUsed) }}</p>
        <p class="text-xs text-white/40 mt-1">{{ memTotal > 0 ? $t('adminPages.overview.memOf', { v: fmtGb(memTotal) }) : $t('adminPages.overview.memNoLimits') }}</p>
        <div v-if="memTotal > 0" class="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
          <div class="h-full rounded-full bg-emerald-300 transition-all duration-500" :style="{ width: Math.min(100, Math.round(memUsed / memTotal * 100)) + '%' }" />
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-5 gap-3">
      <!-- Серверы по нодам -->
      <div class="xl:col-span-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
        <h3 class="font-semibold text-white/90">{{ $t('adminPages.overview.byNodes') }}</h3>
        <p class="text-xs text-white/40 mt-0.5 mb-3">{{ $t('adminPages.overview.byNodesHint') }}</p>
        <div v-if="!nodes.length" class="text-sm text-white/30 py-4 text-center">{{ $t('adminPages.overview.noNodesHint') }}</div>
        <div v-else class="space-y-2.5">
          <div v-for="n in nodesBar" :key="n.id">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-white/70 truncate">{{ n.name }}</span>
              <span class="text-white/40 font-mono flex-shrink-0 ml-2">{{ n.count }} · {{ fmtGb(n.mem) }}</span>
            </div>
            <div class="h-2 rounded-full bg-white/[0.07] overflow-hidden">
              <div class="h-full rounded-full bg-emerald-300/80 transition-all duration-500" :style="{ width: n.pct + '%' }" />
            </div>
          </div>
        </div>
      </div>

      <!-- Состояние нод -->
      <div class="xl:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
        <h3 class="font-semibold text-white/90">{{ $t('admin.nodes') }}</h3>
        <p class="text-xs text-white/40 mt-0.5 mb-3">{{ $t('adminPages.overview.nodesHint') }}</p>
        <div v-if="!nodes.length" class="text-sm text-white/30 py-4 text-center">{{ $t('adminPages.overview.noNodes') }}</div>
        <div v-else class="space-y-2">
          <NuxtLink
            v-for="n in nodes"
            :key="n.id"
            to="/admin/nodes"
            class="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-white/[0.04] transition-colors"
          >
            <span class="relative flex w-2.5 h-2.5 flex-shrink-0">
              <span v-if="nodeLive(n.id)" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-60" />
              <span :class="['relative inline-flex rounded-full w-2.5 h-2.5', nodeLive(n.id) ? 'bg-emerald-300' : 'bg-gray-500']" />
            </span>
            <span class="text-sm text-white/80 truncate">{{ n.name }}</span>
            <span class="ml-auto text-xs text-white/40 font-mono flex-shrink-0">
              {{ $t('adminPages.overview.nodeSrv', { n: nodeServers(n.id), mem: nodeMem(n.id) }) }}
            </span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Топ серверов -->
    <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
      <div class="flex items-center justify-between mb-1">
        <h3 class="font-semibold text-white/90">{{ $t('adminPages.overview.topServers') }}</h3>
        <NuxtLink to="/admin/servers" class="text-xs text-emerald-300/80 hover:text-emerald-300">{{ $t('adminPages.overview.allServers') }}</NuxtLink>
      </div>
      <p class="text-xs text-white/40 mb-3">{{ $t('adminPages.overview.topHint') }}</p>
      <div v-if="!servers.length" class="text-sm text-white/30 py-4 text-center">{{ $t('adminPages.overview.noServers') }}</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[560px]">
          <thead>
            <tr class="text-left text-xs text-white/35">
              <th class="font-medium py-2 pr-4">#</th>
              <th class="font-medium py-2 pr-4">{{ $t('adminPages.overview.colServer') }}</th>
              <th class="font-medium py-2 pr-4">{{ $t('adminPages.overview.colNode') }}</th>
              <th class="font-medium py-2 pr-4">{{ $t('adminPages.overview.colStatus') }}</th>
              <th class="font-medium py-2 w-[38%]">{{ $t('adminPages.overview.colMemory') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in topServers" :key="s.id" class="border-t border-white/[0.06]">
              <td class="py-2.5 pr-4 text-white/30 font-mono text-xs">{{ String(i + 1).padStart(2, '0') }}</td>
              <td class="py-2.5 pr-4">
                <NuxtLink :to="`/dashboard/server/${s.id}`" class="text-white/85 hover:text-emerald-300 transition-colors truncate block max-w-[220px]">{{ s.name }}</NuxtLink>
                <span class="text-[11px] text-white/35">{{ s.owner?.email || '' }}</span>
              </td>
              <td class="py-2.5 pr-4 text-white/55 text-xs">{{ s.node?.name || '—' }}</td>
              <td class="py-2.5 pr-4">
                <span :class="['text-[11px] px-2 py-0.5 rounded-full border', statusCls(s.status)]">{{ statusTxt(s.status) }}</span>
              </td>
              <td class="py-2.5">
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                    <div class="h-full rounded-full bg-emerald-300/80" :style="{ width: Math.min(100, Math.round(s.memory / Math.max(maxMem, 1) * 100)) + '%' }" />
                  </div>
                  <span class="text-xs text-white/50 font-mono flex-shrink-0">{{ fmtGb(s.memory * 1048576) }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
// @ts-nocheck
const { t } = useI18n()
definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

const loading = ref(true)
const servers = ref([])
const users = ref([])
const nodes = ref([])
const usage = ref({})

const currentDate = ref(new Date().toLocaleDateString('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric'
}))

const loadAll = async () => {
  loading.value = true
  try {
    const [srv, usr, nds] = await Promise.all([
      $fetch('/api/admin/servers').catch(() => []),
      $fetch('/api/admin/users').catch(() => []),
      $fetch('/api/admin/nodes').catch(() => []),
    ])
    servers.value = Array.isArray(srv) ? srv : []
    users.value = Array.isArray(usr) ? usr : []
    nodes.value = Array.isArray(nds) ? nds : []
    const u = {}
    await Promise.all(nodes.value.map(async (n) => {
      try {
        u[n.id] = await $fetch(`/api/admin/nodes/${n.id}/usage`)
      } catch {}
    }))
    usage.value = u
  } finally {
    loading.value = false
  }
}

const runningCount = computed(() => servers.value.filter((s) => s.status === 'running').length)
const adminCount = computed(() => users.value.filter((u) => u.role === 'admin').length)
const donutLen = computed(() => {
  if (!servers.value.length) return 0
  return (runningCount.value / servers.value.length * 213.6).toFixed(1)
})
const memUsed = computed(() => servers.value.reduce((a, s) => a + (Number(s.memory) || 0) + (Number(s.swap) || 0), 0) * 1048576)
const memTotal = computed(() => nodes.value.reduce((a, n) => a + (Number(n.memory) || 0) + (Number(n.swap) || 0), 0) * 1048576)
const maxMem = computed(() => Math.max(1, ...servers.value.map((s) => Number(s.memory) || 0)))

const nodesUp = computed(() => {
  if (!nodes.value.length) return 0
  // Нода "на связи", если usage-опрос прошёл (best effort, без отдельных статусов).
  return nodes.value.filter((n) => usage.value[n.id]).length
})

const nodesBar = computed(() => {
  const max = Math.max(1, ...nodes.value.map((n) => servers.value.filter((s) => s.nodeId === n.id).length))
  return nodes.value.map((n) => {
    const list = servers.value.filter((s) => s.nodeId === n.id)
    const mem = list.reduce((a, s) => a + (Number(s.memory) || 0), 0) * 1048576
    return {
      id: n.id,
      name: n.name,
      count: list.length,
      mem,
      pct: Math.round(list.length / max * 100),
    }
  })
})

const nodeServers = (id) => servers.value.filter((s) => s.nodeId === id).length
const nodeLive = (id) => !!usage.value[id]
const nodeMem = (id) => {
  const u = usage.value[id]
  if (!u) return '—'
  const total = Number(u.memory_total) || 0
  const used = Number(u.memory_used) || 0
  return total > 0 ? `${fmtGb(used * 1048576)} / ${fmtGb(total * 1048576)}` : fmtGb(used * 1048576)
}

const topServers = computed(() =>
  [...servers.value].sort((a, b) => (Number(b.memory) || 0) - (Number(a.memory) || 0)).slice(0, 5)
)

const statusTxt = (s) => ({ installing: t('dashboard.stateInstalling'), running: t('dashboard.stateRunning'), stopped: t('dashboard.stateOffline'), error: t('adminPages.overview.statusError') }[s] || s || '—')
const statusCls = (s) => ({
  installing: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  running: 'bg-emerald-300/15 text-emerald-300 border-emerald-300/30',
  stopped: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  error: 'bg-red-500/15 text-red-400 border-red-500/30',
}[s] || 'bg-gray-500/15 text-gray-400 border-gray-500/30')

const fmtGb = (bytes) => {
  const b = Number(bytes) || 0
  if (b < 1073741824) return `${Math.round(b / 1048576)} ${t('units.mb')}`
  return `${(b / 1073741824).toFixed(1)} ${t('units.gb')}`
}

onMounted(() => {
  loadAll()
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
