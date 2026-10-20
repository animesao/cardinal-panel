<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="text-lg font-medium text-white">{{ $t('activity.title') }}</h3>
        <span class="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/10">{{ $t('activity.latest', { n: entries.length }) }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="load()"
          :disabled="loading"
          :title="$t('common.refresh')"
          class="text-white/40 hover:text-white/70 p-1.5 transition-colors disabled:opacity-40"
        >
          <UiIcon name="restart" class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        </button>
        <button
          v-if="canClear"
          @click="clearAll"
          :disabled="clearing || !entries.length"
          :title="$t('activity.clear')"
          class="text-white/40 hover:text-red-400 p-1.5 transition-colors disabled:opacity-40 text-xs"
        >
          {{ clearing ? '...' : $t('activity.clear') }}
        </button>
      </div>
    </div>

    <div v-if="loading && !entries.length" class="text-center py-8">
      <div class="w-6 h-6 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
    </div>
    <div v-else-if="error" class="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
      <p class="text-red-400 text-sm">{{ error }}</p>
    </div>
    <div v-else-if="!entries.length" class="text-center py-8 text-white/50 text-sm">
      {{ $t('activity.empty') }}
    </div>
    <div v-else class="space-y-1.5">
      <div v-for="e in entries" :key="e.id" class="flex items-start gap-3 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5">
        <span :class="['w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0', meta(e.action).cls]">
          <UiIcon :name="meta(e.action).icon" class="w-4 h-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-white/85 text-xs sm:text-sm">
            <span class="font-medium">{{ actorName(e) }}</span>
            <span class="text-white/40"> · {{ meta(e.action).label }}</span>
          </p>
          <p v-if="e.detail" class="text-white/50 text-xs font-mono truncate mt-0.5" :title="e.detail">{{ e.detail }}</p>
        </div>
        <span class="text-white/30 text-[11px] whitespace-nowrap flex-shrink-0 mt-0.5" :title="fullDate(e.createdAt)">{{ shortDate(e.createdAt) }}</span>
      </div>
    </div>

    <!-- Пагинация: по 20 на страницу, как в портах ноды -->
    <div v-if="pageCount > 1" class="flex flex-wrap items-center justify-between gap-2 pt-1">
      <span class="text-xs text-white/40">
        {{ total ? $t('common.range', { a: (page - 1) * PER_PAGE + 1, b: Math.min(page * PER_PAGE, total), c: total }) : '' }}
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
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
// ServerActivity — журнал действий на сервере: кто что заливал, удалял,
// правил, запускал и останавливал. Владелец/админ + мемберы с activity.read.
const props = defineProps<{
  serverId: number
  canClear?: boolean
}>()

const entries = ref<any[]>([])
const loading = ref(false)
const clearing = ref(false)
const error = ref('')

// Пагинация: по 20 на страницу (как в портах ноды), total — из X-Total-Count.
const PER_PAGE = 20
const page = ref(1)
const total = ref(0)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PER_PAGE)))
const pageNums = computed(() => {
  const max = pageCount.value
  const cur = page.value
  const set = new Set([1, max, cur - 1, cur, cur + 1])
  return [...set].filter((p) => p >= 1 && p <= max).sort((a, b) => a - b)
})

// meta — иконка, цвет и ключ подписи для каждого действия.
const ACTION_META = {
  'power.start': { icon: 'play', key: 'activity.actions.powerStart', cls: 'bg-emerald-300/10 border-emerald-300/25 text-emerald-300' },
  'power.stop': { icon: 'stop', key: 'activity.actions.powerStop', cls: 'bg-white/[0.06] border-white/10 text-white/60' },
  'power.restart': { icon: 'restart', key: 'activity.actions.powerRestart', cls: 'bg-emerald-300/10 border-emerald-300/25 text-emerald-300' },
  'power.kill': { icon: 'x', key: 'activity.actions.powerKill', cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
  'console.open': { icon: 'eye', key: 'activity.actions.consoleOpen', cls: 'bg-white/[0.06] border-white/10 text-white/60' },
  'console.command': { icon: 'eye', key: 'activity.actions.consoleCommand', cls: 'bg-white/[0.06] border-white/10 text-white/60' },
  'file.upload': { icon: 'upload', key: 'activity.actions.fileUpload', cls: 'bg-emerald-300/10 border-emerald-300/25 text-emerald-300' },
  'file.save': { icon: 'pencil', key: 'activity.actions.fileSave', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'file.delete': { icon: 'trash', key: 'activity.actions.fileDelete', cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
  'file.rename': { icon: 'pencil', key: 'activity.actions.fileRename', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'file.chmod': { icon: 'shield', key: 'activity.actions.fileChmod', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'file.mkdir': { icon: 'folder-open', key: 'activity.actions.fileMkdir', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'backup.create': { icon: 'archive', key: 'activity.actions.backupCreate', cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
  'backup.delete': { icon: 'trash', key: 'activity.actions.backupDelete', cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
  'backup.restore': { icon: 'archive', key: 'activity.actions.backupRestore', cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
  'user.invite': { icon: 'users', key: 'activity.actions.userInvite', cls: 'bg-purple-500/10 border-purple-500/30 text-purple-300' },
  'user.update': { icon: 'users', key: 'activity.actions.userUpdate', cls: 'bg-purple-500/10 border-purple-500/30 text-purple-300' },
  'user.remove': { icon: 'users', key: 'activity.actions.userRemove', cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
  'database.create': { icon: 'database', key: 'activity.actions.dbCreate', cls: 'bg-orange-500/10 border-orange-500/30 text-orange-300' },
  'database.delete': { icon: 'trash', key: 'activity.actions.dbDelete', cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
  'ports.add': { icon: 'plug', key: 'activity.actions.portsAdd', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'ports.remove': { icon: 'plug', key: 'activity.actions.portsRemove', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'ports.primary': { icon: 'plug', key: 'activity.actions.portsPrimary', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'startup.update': { icon: 'gear', key: 'activity.actions.startupUpdate', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'environment.update': { icon: 'gear', key: 'activity.actions.envUpdate', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'setup.update': { icon: 'gear', key: 'activity.actions.setupUpdate', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'server.reinstall': { icon: 'restart', key: 'activity.actions.reinstall', cls: 'bg-orange-500/10 border-orange-500/30 text-orange-300' },
  'server.autostart': { icon: 'play', key: 'activity.actions.autostart', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
  'sftp.password': { icon: 'key', key: 'activity.actions.sftpPw', cls: 'bg-white/[0.06] border-white/10 text-white/70' },
}

const { t, locale } = useI18n()
const meta = (action) => {
  const m = ACTION_META[action]
  if (!m) return { icon: 'eye', label: action, cls: 'bg-white/[0.06] border-white/10 text-white/60' }
  return { ...m, label: t(m.key) }
}

const actorName = (e) => {
  if (e.actor?.name) return e.actor.name
  if (e.actor?.email) return e.actor.email
  return '—'
}

const shortDate = (v) => {
  if (!v) return ''
  try {
    const d = new Date(v)
    const now = new Date()
    const loc = locale.value || 'en'
    const time = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
    return d.toDateString() === now.toDateString()
      ? time
      : `${d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })} ${time}`
  } catch { return '' }
}

const fullDate = (v) => {
  if (!v) return ''
  try { return new Date(v).toLocaleString(locale.value || 'en') } catch { return '' }
}

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch.raw(`/api/servers/${props.serverId}/activity`, {
      params: { limit: PER_PAGE, offset: (page.value - 1) * PER_PAGE },
    })
    entries.value = Array.isArray(res._data) ? res._data : []
    total.value = Number(res.headers.get('x-total-count')) || entries.value.length
    if (page.value > pageCount.value) page.value = pageCount.value
  } catch (e) {
    if (deny(e)) return
    error.value = e.data?.message || t('activity.loadError')
  } finally {
    loading.value = false
  }
}

watch(page, () => load())

const clearAll = async () => {
  if (!(await confirmDialog({ message: t('activity.clearConfirm'), confirmText: t('activity.clear'), danger: true }))) return
  clearing.value = true
  try {
    await $fetch(`/api/servers/${props.serverId}/activity`, { method: 'DELETE' })
    entries.value = []
    total.value = 0
    page.value = 1
  } catch (e) {
    if (!deny(e)) alert(e.data?.message || t('activity.clearError'))
  } finally {
    clearing.value = false
  }
}

onMounted(() => load())
</script>
