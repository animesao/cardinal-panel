<template>
  <div class="space-y-2">
    <!-- Статус и версия -->
    <div class="flex items-center gap-2">
      <span class="text-white/40">{{ $t('nodes.statusLabel') }}</span>
      <div class="flex items-center gap-1">
        <!-- Загрузка -->
        <svg v-if="status === 'loading'" class="w-4 h-4 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <rect width="24" height="24" fill="none"/>
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V3m4.25 4.75L18.4 5.6M18 12h3m-4.75 4.25l2.15 2.15M12 18v3m-4.25-4.75L5.6 18.4M6 12H3m4.75-4.25L5.6 5.6"/>
        </svg>
        <!-- Онлайн -->
        <svg v-else-if="status === 'online'" class="w-4 h-4 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <rect width="24" height="24" fill="none"/>
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12h4.5L9 6l4 12l2-9l1.5 3H21"/>
        </svg>
        <!-- Оффлайн -->
        <svg v-else class="w-4 h-4 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <rect width="24" height="24" fill="none"/>
          <path fill="currentColor" d="M11.001 3.8L11 5.763l-1.894 3.79l-.047.11A1 1 0 0 0 9.4 10.8l3.332 2.499l-1.626 3.254A1 1 0 0 0 11 17v3.417L3.803 13.29a6 6 0 0 1 6.956-9.621zm5.77-.739l.246.037a6 6 0 0 1 3.184 10.193l-.044.037L13 20.416v-3.181l1.894-3.788l.047-.11A1 1 0 0 0 14.6 12.2l-3.333-2.5l1.627-3.253A1 1 0 0 0 13 6V3.813a6 6 0 0 1 3.77-.752"/>
        </svg>
        <span :class="statusClass">{{ statusText }}</span>
      </div>
      <span v-if="status === 'online' && nodeInfo?.version" class="text-white/30 text-xs ml-1">
        {{ nodeInfo.version }}
      </span>
      <button @click="refresh" class="ml-auto text-white/30 hover:text-white/60 transition-colors" :title="$t('common.refresh')">
        <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <rect width="24" height="24" fill="none"/>
          <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
            <path d="M19.933 13.041a8 8 0 1 1-9.925-8.788c3.899-1 7.935 1.007 9.425 4.747"/>
            <path d="M20 4v5h-5"/>
          </g>
        </svg>
      </button>
    </div>

    <!-- Информация о системе (если онлайн) -->
    <div v-if="status === 'online' && nodeInfo" class="flex items-center gap-3 text-xs">
      <div class="flex items-center gap-1 text-white/40">
        <span>{{ nodeInfo.os || 'Linux' }}</span>
      </div>
      <div class="flex items-center gap-1 text-white/40">
        <span>•</span>
        <span>{{ nodeInfo.architecture || 'amd64' }}</span>
      </div>
      <div class="flex items-center gap-1 text-white/40">
        <span>•</span>
        <span>{{ $t('nodes.cores', { n: nodeInfo.cpu_cores || 0 }) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
interface NodeStatusResponse {
  status: 'online' | 'offline'
  version?: string
  os?: string
  architecture?: string
  cpu_cores?: number
}

const props = defineProps<{ nodeId: number }>()

const status = ref<'online' | 'offline' | 'loading'>('loading')
const nodeInfo = ref<NodeStatusResponse | null>(null)

const statusText = computed(() => {
  if (status.value === 'loading') return t('admin.loading')
  if (status.value === 'online') return t('nodes.online')
  return t('nodes.offline')
})

const statusClass = computed(() => ({
  'text-yellow-400': status.value === 'loading',
  'text-green-400': status.value === 'online',
  'text-red-400': status.value === 'offline'
}))

const refresh = async () => {
  try {
    const response = await $fetch<NodeStatusResponse>(`/api/nodes/${props.nodeId}/status`)
    status.value = response.status
    if (response.status === 'online') {
      nodeInfo.value = response
    } else {
      nodeInfo.value = null
    }
  } catch {
    status.value = 'offline'
    nodeInfo.value = null
  }
}

let interval: NodeJS.Timeout

onMounted(() => {
  refresh()
  interval = setInterval(refresh, 30000)
})

onUnmounted(() => {
  clearInterval(interval)
})
</script>
