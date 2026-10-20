<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white/95">{{ $t('admin.apiKeys') }}</h2>
        <p class="text-white/40 text-xs sm:text-sm mt-1">{{ $t('adminPages.apiKeys.subtitle') }}</p>
      </div>
      <button
        v-if="!isCreating && !justCreated"
        @click="isCreating = true"
        class="bg-emerald-300 hover:bg-emerald-200 text-black px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all"
      >
        {{ $t('adminPages.apiKeys.newKey') }}
      </button>
    </div>

    <!-- Свежевыпущенный секрет: показывается ОДИН РАЗ -->
    <div v-if="justCreated" class="bg-emerald-300/[0.07] border border-emerald-300/30 rounded-2xl p-4 sm:p-6 space-y-3">
      <h3 class="text-emerald-300 text-sm font-medium">{{ $t('adminPages.apiKeys.createdTitle') }}</h3>
      <div class="flex gap-2">
        <code class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-emerald-200 text-xs sm:text-sm font-mono break-all">{{ justCreated.token }}</code>
        <button
          @click="copyToken"
          class="bg-emerald-300 hover:bg-emerald-200 text-black px-4 rounded-xl text-sm font-medium transition-all flex-shrink-0"
        >
          {{ copied ? $t('common.copied') : $t('common.copy') }}
        </button>
      </div>
      <p class="text-white/40 text-xs">{{ $t('adminPages.apiKeys.owner') }}: {{ justCreated.email || $t('adminPages.apiKeys.you') }} · {{ $t('adminPages.apiKeys.rights') }}: {{ justCreated.levelsText || '—' }}</p>
      <button
        @click="justCreated = null; loadKeys()"
        class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-4 py-2 rounded-xl text-xs sm:text-sm transition-all"
      >
        {{ $t('adminPages.apiKeys.done') }}
      </button>
    </div>

    <!-- Форма выпуска: модалка -->
    <Teleport to="body">
    <div v-if="isCreating" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="closeForm">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm kt-fade-in"></div>
      <div class="kt-pop relative bg-[#141414] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base sm:text-lg font-medium text-white">{{ $t('adminPages.apiKeys.newTitle') }}</h3>
            <p class="text-white/35 text-xs mt-0.5">{{ $t('adminPages.apiKeys.newHint') }}</p>
          </div>
          <button @click="closeForm" :title="$t('common.close')" class="text-white/40 hover:text-white/80 p-1 transition-colors">
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div>
          <label class="text-white/70 text-xs block mb-1">{{ $t('admin.name') }} *</label>
          <input v-model="form.name" :placeholder="$t('adminPages.apiKeys.namePh')" @keyup.enter="createKey" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
        </div>
        <div>
          <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.apiKeys.ownerEmail') }}</label>
          <input v-model="form.email" type="email" placeholder="user@example.com" @keyup.enter="createKey" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-white/70 text-xs">{{ $t('adminPages.apiKeys.accessSelected', { a: Object.keys(form.levels || {}).length, b: RESOURCES.length }) }}</label>
          <div class="flex gap-2">
            <button type="button" @click="grantAllRead" class="text-emerald-300/70 hover:text-emerald-200 text-[11px]">{{ $t('adminPages.apiKeys.allRead') }}</button>
            <button type="button" @click="resetLevels" class="text-white/40 hover:text-white/70 text-[11px]">{{ $t('adminPages.apiKeys.resetLevels') }}</button>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-2.5">
          <div v-for="r in RESOURCES" :key="r.key" class="bg-black/20 border border-white/5 rounded-xl p-2.5">
            <div class="flex items-center justify-between mb-1.5">
              <p class="text-white/85 text-xs font-medium truncate" :title="$t('adminPages.apiKeys.res_' + r.key + '_desc')">{{ $t('adminPages.apiKeys.res_' + r.key) }}</p>
              <span v-if="levelOf(r.key) > 0" class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-300/15 text-emerald-300 border border-emerald-300/25 flex-shrink-0 ml-2">{{ LEVEL_LABEL[levelOf(r.key)] }}</span>
            </div>
            <div class="flex gap-1.5">
              <button
                v-for="lvl in (r.maxLevel === 2 ? [0, 1, 2] : [0, 1])"
                :key="lvl"
                type="button"
                @click="setLevel(r.key, lvl)"
                :title="lvl === 0 ? $t('adminPages.apiKeys.noAccess') : $t('adminPages.apiKeys.res_' + r.key + '_desc')"
                :class="[
                  'flex-1 px-2 py-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1',
                  levelOf(r.key) === lvl
                    ? 'bg-emerald-300 text-black border-transparent'
                    : 'bg-black/30 text-white/50 border-white/10 hover:bg-white/5 hover:text-white/80'
                ]"
              >
                <UiIcon v-if="lvl === 0" name="x" class="w-3.5 h-3.5" />
                <UiIcon v-else-if="lvl === 1" name="eye" class="w-3.5 h-3.5" />
                <UiIcon v-else name="pencil" class="w-3.5 h-3.5" />
                {{ LEVEL_LABEL[lvl] }}
              </button>
            </div>
          </div>
        </div>
        <p class="text-white/30 text-xs mt-2">{{ $t('adminPages.apiKeys.writeHint') }}</p>
      </div>
      <div v-if="formError" class="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{{ formError }}</div>
      <div class="flex gap-2">
        <button @click="closeForm" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl px-4 py-2.5 text-sm transition-all">{{ $t('admin.cancel') }}</button>
        <button @click="createKey" :disabled="saving || !form.name.trim() || !Object.keys(form.levels || {}).length" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50">
          {{ saving ? $t('adminPages.apiKeys.issuing') : $t('adminPages.apiKeys.issue') }}
        </button>
      </div>
      </div>
    </div>
    </Teleport>

    <!-- Список ключей -->
    <div v-if="loading" class="text-center py-8">
      <div class="w-6 h-6 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
    </div>
    <div v-else-if="!keys.length" class="text-center py-12 text-white/50 text-sm">
      {{ $t('adminPages.apiKeys.empty') }}
    </div>
    <div v-else class="grid gap-3">
      <div v-for="k in keys" :key="k.id" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-emerald-300/10 border border-emerald-300/20 flex items-center justify-center flex-shrink-0">
            <UiIcon name="key" class="w-4 h-4 text-emerald-300" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-white text-sm font-medium truncate">{{ k.name }}</p>
            <p class="text-white/40 text-xs font-mono truncate">{{ k.prefix }}… · {{ k.owner?.email || '—' }}</p>
          </div>
          <button @click="revokeKey(k)" :title="$t('adminPages.apiKeys.revokeTitle')" class="text-red-400/70 hover:text-red-300 p-1.5 flex-shrink-0 transition-colors">
            <UiIcon name="trash" class="w-4 h-4" />
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 mt-2.5">
          <span v-for="s in k.scopes" :key="s" class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-300/10 text-emerald-300 border border-emerald-300/20 font-mono">{{ s }}</span>
          <span class="ml-auto text-[11px] text-white/30">
            {{ k.lastUsedAt ? $t('adminPages.apiKeys.used', { v: formatDate(k.lastUsedAt) }) : $t('adminPages.apiKeys.neverUsed') }} · {{ $t('adminPages.apiKeys.created', { v: formatDate(k.createdAt) }) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// @ts-nocheck
// Admin → API-ключи: выпуск/отзыв токенов для /api/v1/* и Bearer-доступа
// к остальному API. Каталог зеркалит API_RESOURCES (apikey-auth.ts):
// уровень 0 = нет, 1 = чтение, 2 = чтение и запись.
const { t } = useI18n()
const RESOURCES = [
  { key: 'servers', maxLevel: 2 },
  { key: 'files', maxLevel: 2 },
  { key: 'backups', maxLevel: 2 },
  { key: 'databases', maxLevel: 2 },
  { key: 'ports', maxLevel: 2 },
  { key: 'startup', maxLevel: 2 },
  { key: 'server_users', maxLevel: 2 },
  { key: 'activity', maxLevel: 1 },
  { key: 'nodes', maxLevel: 2 },
  { key: 'users', maxLevel: 2 },
  { key: 'allocations', maxLevel: 2 },
  { key: 'locations', maxLevel: 2 },
  { key: 'blueprints', maxLevel: 2 },
  { key: 'database_hosts', maxLevel: 2 },
  { key: 'server_databases', maxLevel: 1 },
]

const LEVEL_LABEL = computed(() => [t('adminPages.apiKeys.level0'), t('adminPages.apiKeys.level1'), t('adminPages.apiKeys.level2')])

const keys = ref([])
const loading = ref(false)
const isCreating = ref(false)
const saving = ref(false)
const formError = ref('')
const justCreated = ref(null)
const copied = ref(false)
const form = ref({ name: '', email: '', levels: {} })

const setLevel = (key, level) => {
  const next = { ...(form.value.levels || {}) }
  if (level > 0) next[key] = level
  else delete next[key]
  form.value.levels = next
}

const levelOf = (key) => form.value.levels?.[key] || 0

const grantAllRead = () => {
  const next = {}
  for (const r of RESOURCES) next[r.key] = 1
  form.value.levels = next
}

const resetLevels = () => {
  form.value.levels = {}
}

const formatDate = (v) => {
  if (!v) return '—'
  try { return new Date(v).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '—' }
}

const loadKeys = async () => {
  loading.value = true
  try {
    keys.value = await $fetch('/api/admin/api-keys') || []
  } catch {
    keys.value = []
  } finally {
    loading.value = false
  }
}

const closeForm = () => {
  isCreating.value = false
  formError.value = ''
  form.value = { name: '', email: '', levels: {} }
}

const levelsText = (levels) => Object.entries(levels || {})
  .map(([k, v]) => `${k}.${v === 2 ? 'write' : 'read'}`)
  .join(', ')

const createKey = async () => {
  saving.value = true
  formError.value = ''
  try {
    const data = await $fetch('/api/admin/api-keys', {
      method: 'POST',
      body: { name: form.value.name.trim(), email: form.value.email.trim(), levels: form.value.levels },
    })
    justCreated.value = { token: data.token, levelsText: levelsText(data.levels), email: form.value.email.trim() }
    copied.value = false
    closeForm()
  } catch (e) {
    formError.value = e.data?.message || t('adminPages.apiKeys.issueError')
  } finally {
    saving.value = false
  }
}

const copyToken = async () => {
  try {
    await navigator.clipboard.writeText(justCreated.value.token)
    copied.value = true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = justCreated.value.token
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
    copied.value = true
  }
}

const revokeKey = async (k) => {
  if (!(await confirmDialog({ message: t('adminPages.apiKeys.revokeConfirm', { name: k.name }), confirmText: t('adminPages.apiKeys.revokeBtn'), danger: true }))) return
  try {
    await $fetch(`/api/admin/api-keys/${k.id}`, { method: 'DELETE' })
    await loadKeys()
  } catch (e) {
    alert(e.data?.message || t('adminPages.apiKeys.revokeError'))
  }
}

onMounted(loadKeys)

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})
</script>
