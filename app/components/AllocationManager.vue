<template>
  <div class="space-y-4">
    <!-- Форма добавления -->
    <div class="flex gap-3 items-end">
      <div class="flex-1">
        <label class="block text-xs text-white/40 mb-1">{{ $t('nodes.allocIp') }}</label>
        <input
          v-model="newAllocation.ip"
          type="text"
          :placeholder="$t('nodes.allocIpPh')"
          :title="$t('nodes.allocIpHint')"
          class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        />
      </div>
      <div class="flex-1">
        <label class="block text-xs text-white/40 mb-1">{{ $t('nodes.allocPorts') }}</label>
        <input
          v-model="newAllocation.ports"
          type="text"
          :placeholder="$t('nodes.allocPortsPh')"
          class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        />
      </div>
      <button
        @click="addAllocation"
        :disabled="adding"
        class="bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
      >
        {{ adding ? $t('nodes.adding') : $t('nodes.add') }}
      </button>
    </div>

    <!-- Панель массовых действий -->
    <div v-if="selectedIds.length > 0" class="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
      <span class="text-sm text-white/60">{{ $t('nodes.selected', { n: selectedIds.length }) }}</span>
      <button
        @click="selectAll"
        class="text-xs text-emerald-300 hover:text-emerald-200"
      >
        {{ $t('nodes.selectAllFree') }}
      </button>
      <button
        @click="clearSelection"
        class="text-xs text-white/40 hover:text-white/60"
      >
        {{ $t('nodes.clearSelection') }}
      </button>
      <button
        @click="batchDelete"
        :disabled="deleting"
        class="ml-auto bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
      >
        {{ deleting ? $t('common.deleting') : $t('nodes.deleteSelected') }}
      </button>
    </div>

    <!-- Список аллокаций -->
    <div v-if="pending" class="text-center py-8">
      <div class="w-6 h-6 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      <p class="text-white/40 mt-2">{{ $t('admin.loading') }}</p>
    </div>

    <div v-else-if="allocations.length === 0" class="text-center py-8">
      <p class="text-white/40">{{ $t('nodes.noAllocs') }}</p>
    </div>

    <div v-else class="space-y-2">
      <div class="grid grid-cols-5 gap-2 text-xs text-white/40 px-2">
        <span class="col-span-1">
          <UiToggle :model-value="allFreeSelected" @change="toggleAllFree" small />
        </span>
        <span>IP</span>
        <span>{{ $t('nodes.allocPort') }}</span>
        <span>{{ $t('nodes.allocStatus') }}</span>
        <span></span>
      </div>

      <div
        v-for="alloc in pagedAllocations"
        :key="alloc.id"
        class="grid grid-cols-5 gap-2 items-center p-2 rounded-lg hover:bg-white/5"
        :class="{ 'bg-emerald-300/5': selectedIds.includes(alloc.id) }"
      >
        <span class="col-span-1">
          <UiToggle
            v-model="selectedIds"
            :value="alloc.id"
            :disabled="alloc.assigned === 'yes'"
            small
          />
        </span>
        <span class="text-white/80 font-mono">{{ alloc.ip }}</span>
        <span class="text-white/80 font-mono">{{ alloc.port }}</span>
        <span>
          <span
            :class="alloc.assigned === 'yes'
              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
              : 'bg-green-500/20 text-green-400 border-green-500/30'"
            class="px-2 py-0.5 rounded-full text-xs border inline-flex items-center gap-1"
          >
            <!-- Занят: двойная галочка -->
            <svg v-if="alloc.assigned === 'yes'" class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m7 12l5 5L22 7M2 12l5 5m5-5l5-5"/>
            </svg>
            <!-- Свободен: галочка -->
            <svg v-else class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 12l5 5L20 7"/>
            </svg>
            {{ alloc.assigned === 'yes' ? $t('nodes.assigned') : $t('nodes.free') }}
          </span>
        </span>
        <div class="flex justify-end">
          <button
            v-if="alloc.assigned === 'no'"
            @click="deleteAllocation(alloc.id)"
            class="text-red-400 hover:text-red-300 p-1"
            :title="$t('nodes.deleteAllocTitle')"
          >
            <!-- Корзина -->
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Пагинация: по 20 на страницу -->
    <div v-if="pageCount > 1" class="flex flex-wrap items-center justify-between gap-2 pt-1">
      <span class="text-xs text-white/40">
        {{ (page - 1) * PER_PAGE + 1 }}–{{ Math.min(page * PER_PAGE, allocations.length) }} {{ $t('nodes.ofCount', { n: allocations.length }) }}
      </span>
      <div class="flex items-center gap-1">
        <button
          @click="page = Math.max(1, page - 1)"
          :disabled="page <= 1"
          class="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/90 transition-all disabled:opacity-30 flex items-center justify-center"
        >
          <UiIcon name="chevron-left" class="w-3.5 h-3.5" />
        </button>
        <button
          v-for="p in pageNums"
          :key="p"
          @click="page = p"
          :class="[
            'min-w-[28px] px-2 py-1.5 rounded-lg text-xs transition-all',
            p === page
              ? 'bg-emerald-300 text-black font-semibold'
              : 'bg-white/[0.04] border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/90'
          ]"
        >
          {{ p }}
        </button>
        <button
          @click="page = Math.min(pageCount, page + 1)"
          :disabled="page >= pageCount"
          class="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/90 transition-all disabled:opacity-30 flex items-center justify-center"
        >
          <UiIcon name="chevron-right" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <div v-if="error" class="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
const { t } = useI18n()
const props = defineProps<{ nodeId: number }>()

const { data, pending, refresh } = await useFetch(`/api/admin/nodes/${props.nodeId}/allocations`)
const allocations = computed(() => data.value || [])

const newAllocation = ref({ ip: '', ports: '' })
const adding = ref(false)
const deleting = ref(false)
const error = ref('')
const selectedIds = ref<number[]>([])

// Пагинация: по 20 на страницу, выборка переживает листание.
const PER_PAGE = 20
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(allocations.value.length / PER_PAGE)))
const pagedAllocations = computed(() =>
  allocations.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE)
)
const pageNums = computed(() => {
  const total = pageCount.value
  const cur = page.value
  const set = new Set([1, total, cur - 1, cur, cur + 1])
  return [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
})
watch(() => allocations.value.length, () => {
  if (page.value > pageCount.value) page.value = pageCount.value
})

// Свободные аллокации
const freeAllocations = computed(() =>
  allocations.value.filter(a => a.assigned === 'no')
)

// Все свободные выбраны?
const allFreeSelected = computed(() =>
  freeAllocations.value.length > 0 &&
  freeAllocations.value.every(a => selectedIds.value.includes(a.id))
)

// Переключить все свободные
const toggleAllFree = () => {
  if (allFreeSelected.value) {
    // Убрать все свободные из выбранных
    selectedIds.value = selectedIds.value.filter(
      id => !freeAllocations.value.some(a => a.id === id)
    )
  } else {
    // Добавить все свободные
    const freeIds = freeAllocations.value.map(a => a.id)
    selectedIds.value = [...new Set([...selectedIds.value, ...freeIds])]
  }
}

const selectAll = () => {
  const freeIds = freeAllocations.value.map(a => a.id)
  selectedIds.value = [...new Set([...selectedIds.value, ...freeIds])]
}

const clearSelection = () => {
  selectedIds.value = []
}

const addAllocation = async () => {
  if (!newAllocation.value.ports) {
    error.value = t('nodes.portsRequired')
    return
  }

  adding.value = true
  error.value = ''

  try {
    await $fetch(`/api/admin/nodes/${props.nodeId}/allocations`, {
      method: 'POST',
      body: newAllocation.value
    })

    newAllocation.value.ports = ''
    await refresh()
    clearSelection()
  } catch (e: any) {
    error.value = e.data?.message || t('nodes.addError')
  } finally {
    adding.value = false
  }
}

const deleteAllocation = async (id: number) => {
  if (!(await confirmDialog({ message: t('nodes.deleteAllocConfirm'), confirmText: t('admin.delete'), danger: true }))) return

  try {
    await $fetch(`/api/admin/allocations/${id}`, { method: 'DELETE' })
    await refresh()
    selectedIds.value = selectedIds.value.filter(sid => sid !== id)
  } catch (e: any) {
    error.value = e.data?.message || t('nodes.deleteError')
  }
}

const batchDelete = async () => {
  if (selectedIds.value.length === 0) return
  if (!(await confirmDialog({ message: t('nodes.deleteManyConfirm', { n: selectedIds.value.length }), confirmText: t('admin.delete'), danger: true }))) return

  deleting.value = true
  error.value = ''

  try {
    await $fetch('/api/admin/allocations/batch', {
      method: 'DELETE',
      body: { ids: selectedIds.value }
    })

    await refresh()
    clearSelection()
  } catch (e: any) {
    error.value = e.data?.message || t('nodes.deleteError')
  } finally {
    deleting.value = false
  }
}
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
