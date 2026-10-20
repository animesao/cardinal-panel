<template>
  <div class="space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h2 class="text-xl sm:text-2xl font-bold text-white/95">{{ $t('adminPages.locations.title') }}</h2>
      <div class="flex items-center gap-3">
        <span class="text-[10px] sm:text-xs text-white/40 bg-white/[0.03] px-2 sm:px-3 py-1 rounded-full border border-white/[0.07]">
          {{ $t('admin.total') }}: {{ locationsList.length }}
        </span>
        <button
          @click="openCreateModal"
          class="bg-emerald-300 hover:bg-emerald-200 text-black px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2"
        >
          <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span class="hidden sm:inline">{{ $t('adminPages.locations.add') }}</span>
          <span class="sm:hidden">{{ $t('adminPages.locations.addShort') }}</span>
        </button>
      </div>
    </div>

    <!-- Загрузка / Ошибка / Пусто -->
    <div v-if="pending" class="text-center py-12">
      <div class="w-8 h-8 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
      <p class="text-white/50 mt-4 text-sm">{{ $t('adminPages.locations.loading') }}</p>
    </div>
    <div v-else-if="error" class="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
      <p class="text-red-400 text-center text-sm">{{ error }}</p>
    </div>
    <div v-else-if="locationsList.length === 0" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-12 text-center">
      <p class="text-white/40 text-sm">{{ $t('adminPages.locations.empty') }}</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="location in locationsList"
        :key="location.id"
        class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 sm:p-5 hover:bg-white/[0.05] transition-all group"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-emerald-300/10 flex items-center justify-center">
              <svg class="w-4 h-4 text-emerald-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10z"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <h3 class="text-base sm:text-lg font-semibold text-white/90">{{ location.name }}</h3>
          </div>
          <button @click="deleteLocation(location.id)" class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1 transition-all">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14"/>
            </svg>
          </button>
        </div>

        <div class="space-y-2 text-xs sm:text-sm">
          <div v-if="location.description" class="text-white/60">{{ location.description }}</div>
          <div v-if="location.city || location.country" class="flex items-center gap-1 text-white/40">
            <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a8 8 0 0 0-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 0 0-8-8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>{{ [location.city, location.country].filter(Boolean).join(', ') }}</span>
          </div>
          <div v-if="location.address" class="text-white/40 text-[10px] sm:text-xs">{{ location.address }}</div>
          <div class="text-white/30 text-[10px] sm:text-xs pt-2 border-t border-white/[0.06]">{{ $t('adminPages.locations.created', { v: formatDate(location.createdAt) }) }}</div>
        </div>
      </div>
    </div>

    <!-- Модальное окно создания (без изменений) -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeCreateModal">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      <div class="relative bg-[#12141b] border border-white/[0.07] rounded-2xl p-6 w-full max-w-md">
        <h3 class="text-xl font-bold text-white mb-4">{{ $t('adminPages.locations.newTitle') }}</h3>
        <form @submit.prevent="createLocation" class="space-y-4">
          <div><label class="block text-sm text-white/60 mb-1">{{ $t('admin.name') }} *</label><input v-model="form.name" type="text" required :placeholder="$t('adminPages.locations.phName')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-emerald-300/40" /></div>
          <div><label class="block text-sm text-white/60 mb-1">{{ $t('adminPages.locations.fDesc') }}</label><textarea v-model="form.description" rows="3" :placeholder="$t('adminPages.locations.phDesc')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-emerald-300/40 resize-none" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-sm text-white/60 mb-1">{{ $t('adminPages.locations.fCity') }}</label><input v-model="form.city" type="text" :placeholder="$t('adminPages.locations.phCity')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-emerald-300/40" /></div>
            <div><label class="block text-sm text-white/60 mb-1">{{ $t('adminPages.locations.fCountry') }}</label><input v-model="form.country" type="text" :placeholder="$t('adminPages.locations.phCountry')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-emerald-300/40" /></div>
          </div>
          <div><label class="block text-sm text-white/60 mb-1">{{ $t('adminPages.locations.fAddress') }}</label><input v-model="form.address" type="text" :placeholder="$t('adminPages.locations.phAddress')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-emerald-300/40" /></div>
          <div v-if="createError" class="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg">{{ createError }}</div>
          <div class="flex gap-3 pt-2">
            <button type="button" @click="closeCreateModal" class="flex-1 bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 rounded-xl px-4 py-2.5 font-medium transition-all">{{ $t('admin.cancel') }}</button>
            <button type="submit" :disabled="creating" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black rounded-xl px-4 py-2.5 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <span v-if="creating" class="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin"></span>
              <span>{{ creating ? $t('common.creating') : $t('admin.create') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
const { t } = useI18n()
definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})

const { data: locationsData, pending, error, refresh } = await useFetch('/api/admin/locations')

const locationsList = computed(() => locationsData.value || [])

// Модальное окно
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')

const form = ref({
  name: '',
  description: '',
  city: '',
  country: '',
  address: ''
})

const openCreateModal = () => {
  form.value = { name: '', description: '', city: '', country: '', address: '' }
  createError.value = ''
  showCreateModal.value = true
}

const closeCreateModal = () => {
  showCreateModal.value = false
}

const createLocation = async () => {
  creating.value = true
  createError.value = ''

  try {
    await $fetch('/api/admin/locations', {
      method: 'POST',
      body: form.value
    })

    closeCreateModal()
    await refresh()
  } catch (e) {
    createError.value = e.data?.message || t('adminPages.locations.createError')
  } finally {
    creating.value = false
  }
}

const deleteLocation = async (id) => {
  if (!(await confirmDialog({ message: t('adminPages.locations.deleteConfirm'), confirmText: t('admin.delete'), danger: true }))) return

  try {
    await $fetch(`/api/admin/locations/${id}`, {
      method: 'DELETE'
    })
    await refresh()
  } catch (e) {
    alert(t('adminPages.locations.deleteError'))
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date)
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
