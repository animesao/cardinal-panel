<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="$emit('close')">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

    <div class="relative bg-[#12141b] border border-white/[0.07] rounded-2xl p-6 w-full max-w-md">
      <h3 class="text-xl font-bold text-white mb-4">
        {{ node ? $t('nodes.editTitle') : $t('nodes.createTitle') }}
      </h3>

      <form @submit.prevent="saveNode" class="space-y-4">
        <div>
          <label class="block text-sm text-white/60 mb-1">{{ $t('admin.name') }} *</label>
          <input
            v-model="form.name"
            type="text"
            required
            placeholder="Node-1"
            class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
          />
        </div>

        <div>
          <label class="block text-sm text-white/60 mb-1">{{ $t('nodes.wingsUrl') }} *</label>
          <input
            v-model="form.url"
            type="url"
            required
            placeholder="http://localhost:8081"
            class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
          />
        </div>

        <div>
          <label class="block text-sm text-white/60 mb-1">{{ $t('nodes.apiToken') }} {{ node ? $t('nodes.tokenKeepHint') : '*' }}</label>
          <input
            v-model="form.token"
            type="password"
            :required="!node"
            placeholder="••••••••••••••••"
            class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
          />
        </div>

        <div>
          <label class="block text-sm text-white/60 mb-1">{{ $t('nodes.location') }}</label>
          <UiSelect
            v-model="form.locationId"
            :placeholder="$t('nodes.noLocation')"
            :options="[{ value: null, label: $t('nodes.noLocation') }, ...locations.map((loc) => ({ value: loc.id, label: `${loc.name}${loc.city ? ` (${loc.city})` : ''}` }))]"
          />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm text-white/60 mb-1">{{ $t('nodes.memoryMb') }}</label>
            <input v-model.number="form.memory" type="number" min="0" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-300/40" />
          </div>
          <div>
            <label class="block text-sm text-white/60 mb-1">{{ $t('nodes.diskMb') }}</label>
            <input v-model.number="form.disk" type="number" min="0" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-300/40" />
          </div>
          <div>
            <label class="block text-sm text-white/60 mb-1">{{ $t('nodes.swapMb') }}</label>
            <input v-model.number="form.swap" type="number" min="0" placeholder="0" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-300/40" />
          </div>
        </div>
        <p class="text-white/30 text-xs mt-1">{{ $t('nodes.swapHint') }}</p>
        <button
          type="button"
          @click="detectResources"
          :disabled="detecting || (!form.url && !props.node)"
          class="mt-2 flex items-center gap-1.5 text-xs text-emerald-300/90 hover:text-emerald-300 bg-emerald-300/10 hover:bg-emerald-300/15 border border-emerald-300/25 rounded-lg px-3 py-1.5 transition-all disabled:opacity-40"
        >
          <span v-if="detecting" class="w-3.5 h-3.5 border-2 border-emerald-300/40 border-t-emerald-300 rounded-full animate-spin"></span>
          {{ detecting ? $t('nodes.detecting') : $t('nodes.detect') }}
        </button>
        <p v-if="detectNote" class="text-xs mt-1.5" :class="detectOk ? 'text-emerald-300/80' : 'text-red-400/80'">{{ detectNote }}</p>

        <div>
          <label class="block text-sm text-white/60 mb-1">{{ $t('nodes.dbHost') }}</label>
          <UiSelect
            v-model="form.databaseHostId"
            :placeholder="$t('nodes.noDbHost')"
            :options="[{ value: null, label: $t('nodes.noDbHost') }, ...dbHosts.map((h) => ({ value: h.id, label: `${h.name}${h.type ? ` (${String(h.type).toUpperCase()})` : ''}` }))]"
          />
          <p class="text-white/30 text-xs mt-1">{{ $t('nodes.dbHostHint') }}</p>
        </div>

        <div v-if="error" class="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg">
          {{ error }}
        </div>

        <div class="flex gap-3 pt-2">
          <button
            type="button"
            @click="$emit('close')"
            class="flex-1 bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 rounded-xl px-4 py-2.5 font-medium transition-all"
          >
            {{ $t('admin.cancel') }}
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black rounded-xl px-4 py-2.5 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span v-if="saving" class="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin"></span>
            <span>{{ saving ? $t('common.saving') : (node ? $t('admin.save') : $t('admin.create')) }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
const { t } = useI18n()
interface Location {
  id: number
  name: string
  city?: string
  country?: string
}

interface DbHost {
  id: number
  name: string
  type?: string
}

interface Node {
  id: number
  name: string
  url: string
  token: string
  locationId?: number | null
  memory?: number
  disk?: number
  databaseHostId?: number | null
  location?: Location
  createdAt?: string
  updatedAt?: string
}

const props = defineProps<{
  node?: Node | null
  locations: Location[]
}>()

const dbHosts = ref<DbHost[]>([])
onMounted(async () => {
  try {
    const data = await $fetch('/api/admin/database-hosts')
    dbHosts.value = Array.isArray(data) ? data : []
  } catch { dbHosts.value = [] }
})

const emit = defineEmits<{
  close: []
  saved: []
}>()

const form = ref({
  name: props.node?.name || '',
  url: props.node?.url || '',
  token: '',
  locationId: props.node?.locationId || null,
  memory: props.node?.memory || 0,
  disk: props.node?.disk || 0,
  swap: props.node?.swap || 0,
  databaseHostId: props.node?.databaseHostId || null,
})

const saving = ref(false)
const error = ref('')
const detecting = ref(false)
const detectNote = ref('')
const detectOk = ref(false)

// Определить ресурсы с самой ноды (память/диск из /v1/system/info)
// и подставить в форму. Swap определяется хостом, не wings — руками.
// При правке токен уже в БД (id), при создании — из формы.
const detectResources = async () => {
  detecting.value = true
  detectNote.value = ''
  try {
    const body = props.node?.id ? { id: props.node.id } : { url: form.value.url, token: form.value.token }
    const data = await $fetch('/api/admin/nodes/detect', { method: 'POST', body })
    if (data?.memory > 0) form.value.memory = data.memory
    if (data?.disk > 0) form.value.disk = data.disk
    const bits = [t('nodes.detectRam', { v: formatMb(data?.memory) }), t('nodes.detectDisk', { v: formatMb(data?.disk) })]
    if (data?.hostname) bits.push(data.hostname)
    detectOk.value = true
    detectNote.value = t('nodes.detectOk', { info: bits.join(' · ') })
  } catch (e: any) {
    detectOk.value = false
    detectNote.value = e.data?.message || t('nodes.detectError')
  } finally {
    detecting.value = false
  }
}

const saveNode = async () => {
  saving.value = true
  error.value = ''

  try {
    const body = { ...form.value }
    if (props.node && !body.token) delete body.token
    if (props.node) {
      // Обновление
      await $fetch(`/api/admin/nodes/${props.node.id}`, {
        method: 'PUT',
        body
      })
    } else {
      // Создание
      await $fetch('/api/admin/nodes', {
        method: 'POST',
        body: form.value
      })
    }

    emit('saved')
  } catch (e: any) {
    error.value = e.data?.message || t('nodes.saveError')
  } finally {
    saving.value = false
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
