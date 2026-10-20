<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-white/95">{{ $t('admin.servers') }}</h2>
      <button
        @click="openCreateModal"
        class="bg-emerald-300 hover:bg-emerald-200 text-black px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        {{ $t('adminPages.servers.createServer') }}
      </button>
    </div>

    <!-- Список серверов -->
    <div v-if="pending" class="text-center py-12">
      <div class="w-8 h-8 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="serversList.length === 0" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-12 text-center">
      <p class="text-white/40">{{ $t('adminPages.servers.empty') }}</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="server in serversList"
        :key="server.id"
        class="kt-lift bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 hover:bg-white/[0.05] transition-all"
      >
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="text-lg font-semibold text-white/90">{{ server.name }}</h3>
            <p class="text-white/40 text-xs font-mono">{{ server.uuid?.slice(0, 8) }}...</p>
          </div>
          <div class="flex gap-1">
            <span :class="statusClass(server.status)" class="px-2 py-0.5 rounded-full text-[11px] border">
              {{ statusText(server.status) }}
            </span>
            <span v-if="server.suspended" class="px-2 py-0.5 rounded-full text-[11px] border bg-red-500/15 text-red-400 border-red-500/30">
              {{ $t('server.suspended') }}
            </span>
            <!-- Кнопка "Перейти на сервер" -->
            <NuxtLink
              :to="`/dashboard/server/${server.id}`"
              class="text-emerald-300/80 hover:text-emerald-300 p-1"
              :title="$t('adminPages.servers.gotoTitle')"
            >
              <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <rect width="24" height="24" fill="none"/>
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12H3l9-9l9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>
                <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/>
              </svg>
            </NuxtLink>
            <button @click="openEditModal(server)" class="text-white/40 hover:text-emerald-300 p-1 transition-colors" :title="$t('admin.edit')">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
            </button>
            <button @click="toggleSuspend(server)" class="p-1 transition-colors" :class="server.suspended ? 'text-emerald-300 hover:text-emerald-200' : 'text-yellow-400 hover:text-yellow-300'" :title="server.suspended ? $t('adminPages.servers.unsuspend') : $t('adminPages.servers.suspend')">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
              </svg>
            </button>
            <button @click="deleteServer(server.id)" class="text-red-400 hover:text-red-300 p-1" :title="$t('admin.delete')">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-white/40">{{ $t('adminPages.servers.owner') }}:</span>
            <span class="text-white/80">{{ server.owner?.name || server.owner?.email }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-white/40">{{ $t('adminPages.servers.node') }}:</span>
            <span class="text-white/80">{{ server.node?.name }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-white/40">{{ $t('adminPages.servers.resources') }}:</span>
            <span class="text-white/80">{{ formatMb(server.memory) }} / {{ server.cpu }}% / {{ formatMb(server.disk) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Модалка создания / редактирования -->
    <ServerModal
      v-if="showModal"
      :key="editingServer ? `edit-${editingServer.id}` : 'create'"
      :server="editingServer"
      @close="closeModal"
      @created="onServerSaved"
      @saved="onServerSaved"
    />
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
const { t } = useI18n()
definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

const { data, pending, refresh } = await useFetch('/api/admin/servers')
const serversList = computed(() => data.value || [])

const showModal = ref(false)
const editingServer = ref(null)

const openCreateModal = () => {
  editingServer.value = null
  showModal.value = true
}

const openEditModal = (server) => {
  editingServer.value = server
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingServer.value = null
}

const onServerSaved = async () => {
  closeModal()
  await refresh()
}

const deleteServer = async (id: number) => {
  if (!(await confirmDialog({ message: t('adminPages.servers.deleteConfirm'), confirmText: t('admin.delete'), danger: true }))) return
  try {
    await $fetch(`/api/admin/servers/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    alert(t('adminPages.servers.deleteError'))
  }
}

const toggleSuspend = async (server: any) => {
  const suspending = !server.suspended
  if (!(await confirmDialog({
    message: t('adminPages.servers.suspendConfirm'),
    confirmText: suspending ? t('adminPages.servers.suspend') : t('adminPages.servers.unsuspend'),
    danger: suspending,
  }))) return
  try {
    await $fetch(`/api/admin/servers/${server.id}/${suspending ? 'suspend' : 'unsuspend'}`, { method: 'POST' })
    await refresh()
  } catch (e) {
    alert(t('adminPages.servers.suspendError'))
  }
}

const statusClass = (status: string) => {
  const classes = {
    installing: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    running: 'bg-emerald-300/15 text-emerald-300 border-emerald-300/30',
    stopped: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    error: 'bg-red-500/15 text-red-400 border-red-500/30',
  }
  return classes[status] || classes.stopped
}

const statusText = (status: string) => {
  const texts = {
    installing: t('dashboard.stateInstalling'),
    running: t('dashboard.stateRunning'),
    stopped: t('dashboard.stateOffline'),
    error: t('adminPages.servers.statusError'),
  }
  return texts[status] || status
}
</script>
