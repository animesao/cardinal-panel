<template>
  <div class="space-y-4">
    <!-- Заголовок -->
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-white/95">{{ $t('admin.nodes') }}</h2>
      <div class="flex items-center gap-3">
        <span class="text-[11px] text-white/40 bg-white/[0.03] px-3 py-1 rounded-full border border-white/[0.07]">{{ $t('admin.total') }}: {{ nodesList.length }}</span>
        <button
          @click="syncAllNodes"
          :disabled="syncingAll"
          class="flex items-center gap-1.5 text-xs text-emerald-300/90 hover:text-emerald-300 bg-emerald-300/10 hover:bg-emerald-300/15 border border-emerald-300/25 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
        >
          <svg :class="['w-3.5 h-3.5', syncingAll && 'animate-spin']" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" />
          </svg>
          {{ syncingAll ? $t('nodes.syncingAll') : $t('nodes.syncAll') }}
        </button>
        <button @click="openCreateModal" class="bg-emerald-300 hover:bg-emerald-200 text-black px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2">
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          {{ $t('nodes.addNode') }}
        </button>
      </div>
    </div>

    <div v-if="pending" class="text-center py-12"><div class="w-8 h-8 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div></div>
    <div v-else-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl p-6"><p class="text-red-400 text-center">{{ error }}</p></div>
    <div v-else-if="nodesList.length === 0" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-12 text-center"><p class="text-white/40">{{ $t('nodes.empty') }}</p></div>

    <div v-else class="grid grid-cols-1 gap-4">
      <div v-for="node in nodesList" :key="node.id" class="kt-lift bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div class="p-5 border-b border-white/[0.07]">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-emerald-300/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6" y2="6.01"/><line x1="6" y1="18" x2="6" y2="18.01"/></svg>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-white/90">{{ node.name }}</h3>
                <p class="text-white/40 text-sm">{{ node.url }}</p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button
                @click="syncNode(node.id)"
                :disabled="syncingId === node.id"
                :title="$t('nodes.syncTitle')"
                class="text-white/40 hover:text-emerald-300 p-2 transition-colors disabled:opacity-50"
              >
                <svg :class="['w-4 h-4', syncingId === node.id && 'animate-spin']" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" />
                </svg>
              </button>
              <button @click="openEditModal(node)" class="text-white/40 hover:text-emerald-300 p-2 transition-colors"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></button>
              <button @click="deleteNode(node.id)" class="text-red-400 hover:text-red-300 p-2"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14"/></svg></button>
            </div>
          </div>
          <div class="mt-3"><NodeStatus :node-id="node.id" /></div>
        </div>

        <div class="border-b border-white/[0.07] px-5">
          <div class="flex gap-4">
            <button @click="setActiveTab(node.id, 'info')" :class="tabClass(node.id, 'info')">{{ $t('nodes.tabInfo') }}</button>
            <button @click="setActiveTab(node.id, 'allocations')" :class="tabClass(node.id, 'allocations')">{{ $t('nodes.tabAllocs') }}</button>
          </div>
        </div>

        <div class="p-5">
          <div v-if="getActiveTab(node.id) === 'info'" class="space-y-3">
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-white/40">{{ $t('nodes.location') }}:</span>
                <p class="text-white/80 mt-1">{{ node.location?.name || $t('nodes.notSet') }}</p>
              </div>
              <div>
                <span class="text-white/40">{{ $t('nodes.created') }}:</span>
                <p class="text-white/80 mt-1">{{ formatDate(node.createdAt) }}</p>
              </div>
              <div>
                <span class="text-white/40">{{ $t('nodes.dbHost') }}:</span>
                <p class="text-white/80 mt-1">{{ node.databaseHost?.name || $t('nodes.notAssigned') }}</p>
              </div>
            </div>
            <!-- Память -->
            <div v-if="node.memory">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-white/40">{{ $t('nodes.memory') }}</span>
                <span class="text-white/60">{{ formatMb(nodeUsage[node.id]?.memory_used) }} / {{ formatMb(node.memory) }}</span>
              </div>
              <div class="w-full h-2 bg-white/[0.07] rounded-full overflow-hidden">
                <div class="h-full bg-emerald-300/80 rounded-full transition-all" :style="{ width: `${Math.min((nodeUsage[node.id]?.memory_used || 0) / node.memory * 100, 100)}%` }" />
              </div>
            </div>
            <!-- Диск -->
            <div v-if="node.disk">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-white/40">{{ $t('nodes.disk') }}</span>
                <span class="text-white/60">{{ formatMb(nodeUsage[node.id]?.disk_used) }} / {{ formatMb(node.disk) }}</span>
              </div>
              <div class="w-full h-2 bg-white/[0.07] rounded-full overflow-hidden">
                <div class="h-full bg-emerald-300/80 rounded-full transition-all" :style="{ width: `${Math.min((nodeUsage[node.id]?.disk_used || 0) / node.disk * 100, 100)}%` }" />
              </div>
            </div>
            <!-- Swap -->
            <div v-if="node.swap">
              <div class="flex justify-between text-xs mb-1">
                <span class="text-white/40">{{ $t('nodes.swap') }}</span>
                <span class="text-white/60">{{ formatMb(nodeUsage[node.id]?.swap_used) }} / {{ formatMb(node.swap) }}</span>
              </div>
              <div class="w-full h-2 bg-white/[0.07] rounded-full overflow-hidden">
                <div class="h-full bg-emerald-300/80 rounded-full transition-all" :style="{ width: `${Math.min((nodeUsage[node.id]?.swap_used || 0) / node.swap * 100, 100)}%` }" />
              </div>
            </div>
          </div>

          <div v-if="getActiveTab(node.id) === 'allocations'"><AllocationManager :node-id="node.id" /></div>
        </div>
      </div>
    </div>

    <NodeModal v-if="showModal" :node="editingNode" :locations="locationsList" @close="closeModal" @saved="onNodeSaved" />
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
const { t } = useI18n()
definePageMeta({ layout: 'admin', middleware: 'admin' })

// ==================== IMPORTS ====================
import { ref, computed, onMounted, watch } from 'vue'

// ==================== API ЗАПРОСЫ ====================
// Получаем список всех нод с информацией о локациях
const { data: nodesData, pending, error, refresh } = await useFetch('/api/admin/nodes')
// Получаем список всех локаций для модалки создания/редактирования
const { data: locationsData } = await useFetch('/api/admin/locations')

// ==================== ВЫЧИСЛЯЕМЫЕ СВОЙСТВА ====================
const nodesList = computed(() => nodesData.value || [])
const locationsList = computed(() => locationsData.value || [])

// ==================== СОСТОЯНИЕ МОДАЛКИ (создание/редактирование ноды) ====================
const showModal = ref(false)       // modal open
const editingNode = ref(null)      // node being edited (null = create)

// ==================== СОСТОЯНИЕ ВКЛАДОК В КАРТОЧКАХ НОД ====================
// Ключ: ID ноды, Значение: 'info' | 'allocations'
const activeTabs = ref<Record<number, string>>({})

// ==================== КЭШ ИСПОЛЬЗОВАНИЯ РЕСУРСОВ ====================
// Ключ: ID ноды, Значение: { memory_used, disk_used }
const nodeUsage = ref<Record<number, { memory_used: number; disk_used: number }>>({})

// ==================== ИНДИКАТОРЫ ЗАГРУЗКИ ====================
// const loadingUsage = ref<Record<number, boolean>>({})  // Можно добавить для скелетонов

// ==================== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ====================
// Сразу загружаем usage для всех нод, не дожидаясь открытия вкладок
onMounted(() => {
  nodesList.value.forEach(node => loadNodeUsage(node.id))
})

// При обновлении списка нод (после создания/удаления) — подгружаем usage для новых
watch(nodesList, (nodes) => {
  nodes.forEach(node => {
    if (!nodeUsage.value[node.id]) loadNodeUsage(node.id)
  })
})

// ==================== СТИЛИ ВКЛАДОК ====================
const tabClass = (nodeId: number, tab: string) => [
  'py-3 text-sm font-medium transition-all border-b-2',
  getActiveTab(nodeId) === tab ? 'text-emerald-300 border-emerald-300' : 'text-white/50 border-transparent hover:text-white/70'
]

// ==================== УПРАВЛЕНИЕ ВКЛАДКАМИ ====================
// Устанавливает активную вкладку и загружает данные при необходимости
const setActiveTab = (nodeId: number, tab: string) => {
  activeTabs.value[nodeId] = tab
  // Usage загружается в onMounted, но на всякий случай:
  if (tab === 'info' && !nodeUsage.value[nodeId]) loadNodeUsage(nodeId)
}

// Возвращает активную вкладку для ноды (по умолчанию 'info')
const getActiveTab = (nodeId: number) => activeTabs.value[nodeId] || 'info'

// ==================== API: ИСПОЛЬЗОВАНИЕ РЕСУРСОВ ====================
// Загружает занятые ресурсы (memory_used, disk_used) для ноды
const loadNodeUsage = async (nodeId: number) => {
  try {
    const data = await $fetch(`/api/admin/nodes/${nodeId}/usage`)
    nodeUsage.value[nodeId] = data  // { memory_used: 512, disk_used: 10240 }
  } catch (e) {
    nodeUsage.value[nodeId] = { memory_used: 0, disk_used: 0 }
  }
}

// ==================== ДЕЙСТВИЯ С МОДАЛКОЙ ====================
// Открыть модалку для создания новой ноды
const openCreateModal = () => {
  editingNode.value = null
  showModal.value = true
}

// Открыть модалку для редактирования существующей ноды
const openEditModal = (node: any) => {
  editingNode.value = node
  showModal.value = true
}

// Закрыть модалку
const closeModal = () => {
  showModal.value = false
  editingNode.value = null
}

// Вызывается после успешного сохранения ноды в модалке
const onNodeSaved = async () => {
  closeModal()
  await refresh()
}

// ==================== СИНХРОНИЗАЦИЯ С ХОСТОМ ====================
// Тянет реальные память/диск с самой ноды и пишет в БД — руками
// ничего вбивать не нужно. Swap остаётся ручным (wings его не отдаёт).
const syncingId = ref<number | null>(null)
const syncingAll = ref(false)

const syncNode = async (id: number, silent = false) => {
  if (syncingId.value) return
  syncingId.value = id
  try {
    await $fetch(`/api/admin/nodes/${id}/sync`, { method: 'POST' })
    await refresh()
    await loadNodeUsage(id)
    return true
  } catch (e: any) {
    if (!silent) alert(e.data?.message || t('nodes.syncError'))
    return false
  } finally {
    if (syncingId.value === id) syncingId.value = null
  }
}

const syncAllNodes = async () => {
  if (syncingAll.value) return
  syncingAll.value = true
  try {
    let ok = 0
    let fail = 0
    for (const n of nodesList.value) {
      // eslint-disable-next-line no-await-in-loop
      if (await syncNode(n.id, true)) ok++
      else fail++
    }
    if (fail > 0) alert(t('nodes.syncResult', { ok, fail }))
  } finally {
    syncingAll.value = false
  }
}

// ==================== УДАЛЕНИЕ НОДЫ ====================
const deleteNode = async (id: number) => {
  if (!(await confirmDialog({ message: t('nodes.deleteConfirm'), confirmText: t('admin.delete'), danger: true }))) return
  try {
    await $fetch(`/api/admin/nodes/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    alert(t('nodes.deleteError'))
  }
}

// ==================== УТИЛИТЫ ====================
// Форматирует дату в человекочитаемый вид
const formatDate = (dateStr: string) => {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(dateStr))
}
</script>
