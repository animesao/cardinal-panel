<template>
  <div class="space-y-4">
    <!-- Шапка -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-lg font-bold text-white/95">{{ $t('serverStartup.title') }}</h3>
        <p class="text-xs text-white/40 mt-0.5">{{ $t('serverStartup.subtitle') }}</p>
      </div>
      <span v-if="props.readonly" class="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.06] text-white/50 border border-white/10">{{ $t('serverStartup.readonly') }}</span>
      <span v-else-if="isDirty" class="text-[11px] px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">{{ $t('serverStartup.dirty') }}</span>
    </div>

    <!-- Команда запуска -->
    <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-bold">1</span>
        <h4 class="text-sm font-semibold text-white/90">{{ $t('serverStartup.cmdTitle') }}</h4>
      </div>
      <p class="text-xs text-white/40 mb-3">{{ $t('serverStartup.chipHint') }}</p>
      <div class="flex flex-wrap gap-1.5 mb-3">
        <button
          v-for="v in varChips"
          :key="v"
          @click="insertVar(v)"
          type="button"
          :disabled="props.readonly"
          :title="$t('serverStartup.insertVar', { v })"
          class="text-[11px] font-mono px-2 py-1 rounded-lg bg-emerald-300/10 text-emerald-300 border border-emerald-300/25 hover:bg-emerald-300/20 transition-colors"
        >
          <span>{{ '{{' }}</span>{{ v }}<span>}}</span>
        </button>
      </div>
      <textarea
        ref="startupInput"
        v-model="newStartup"
        rows="3"
        :disabled="props.readonly"
        placeholder="java -Xms128M -Xmx{{memory}}M -jar server.jar nogui"
        spellcheck="false"
        class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-300/50 resize-y min-h-[76px] disabled:opacity-70"
      />
      <div class="mt-3 rounded-xl bg-black/40 border border-white/10 px-4 py-2.5">
        <p class="text-[11px] uppercase tracking-wide text-white/30 mb-1">{{ $t('serverStartup.preview') }}</p>
        <p class="text-white/80 text-xs sm:text-sm font-mono break-all">{{ startupPreview || '—' }}</p>
      </div>
      <div v-if="!props.readonly" class="flex flex-wrap items-center gap-2 mt-3">
        <button
          @click="applyStartup"
          :disabled="loading || !newStartup || !isDirty"
          class="bg-emerald-300 hover:bg-emerald-200 text-black px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span v-if="loading" class="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin"></span>
          {{ loading ? $t('serverStartup.applying') : $t('serverStartup.saveCmd') }}
        </button>
        <button
          @click="resetStartup"
          :disabled="loading || !isDirty"
          class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-40"
        >
          {{ $t('serverStartup.reset') }}
        </button>
      </div>
      <div v-if="message" :class="[
        'text-sm px-3 py-2 rounded-xl mt-3 border',
        messageType === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
      ]">
        {{ message }}
      </div>
    </div>

    <!-- Переменные чертежа -->
    <div v-if="eggVarList.length" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-bold">2</span>
        <h4 class="text-sm font-semibold text-white/90">{{ $t('serverStartup.blueprintSettings', { name: server?.blueprint?.name }) }}</h4>
      </div>
      <p class="text-xs text-white/40 mb-3">{{ $t('serverStartup.rerenderHint') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div v-for="v in eggVarList" :key="v.env_variable">
          <label class="block text-xs text-white/50 mb-1 truncate" :title="v.env_variable">
            {{ v.name || v.env_variable }}
            <span v-if="String(v.rules || '').includes('required')" class="text-red-400">*</span>
            <span v-if="v.user_editable === false" class="text-white/30">{{ $t('serverStartup.readonlyShort') }}</span>
          </label>
          <input
            v-model="bpVars[v.env_variable]"
            :disabled="v.user_editable === false || props.readonly"
            type="text"
            :placeholder="String(v.default_value ?? '')"
            class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/25 focus:outline-none focus:border-emerald-300/50 disabled:opacity-50"
          />
          <p v-if="v.description" class="text-white/30 text-[11px] mt-1 truncate" :title="v.description">{{ v.description }}</p>
        </div>
      </div>
      <button
        v-if="!props.readonly"
        @click="saveBpVars"
        :disabled="savingBp"
        class="bg-emerald-300 hover:bg-emerald-200 text-black px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
      >
        {{ savingBp ? $t('serverStartup.saving') : $t('serverStartup.saveBp') }}
      </button>
      <div v-if="bpMessage" :class="[
        'text-sm px-3 py-2 rounded-xl mt-3 border',
        bpMessageType === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
      ]">
        {{ bpMessage }}
      </div>
    </div>

    <!-- Свои переменные -->
    <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-bold">3</span>
        <h4 class="text-sm font-semibold text-white/90">{{ $t('serverStartup.customVars') }}</h4>
      </div>
      <p class="text-xs text-white/40 mb-3">{{ $t('serverStartup.customVarsHint') }}</p>
      <div v-if="!envKeys.length" class="text-xs text-white/30 bg-black/30 border border-dashed border-white/10 rounded-xl px-3 py-4 text-center mb-3">
        {{ $t('serverStartup.emptyEnv') }}
      </div>
      <div class="space-y-2 mb-3">
        <div v-for="key in envKeys" :key="key" class="flex gap-2 items-center">
          <input
            :value="key"
            :disabled="props.readonly"
            @input="(e) => renameEnvKey(key, (e.target as HTMLInputElement).value)"
            :placeholder="$t('serverStartup.keyPh')"
            spellcheck="false"
            class="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/25 focus:outline-none focus:border-emerald-300/50 disabled:opacity-70"
          />
          <span class="text-white/25 font-mono flex-shrink-0">=</span>
          <input
            v-model="envVars[key]"
            :disabled="props.readonly"
            :placeholder="$t('serverStartup.valuePh')"
            spellcheck="false"
            class="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/25 focus:outline-none focus:border-emerald-300/50 disabled:opacity-70"
          />
          <button
            v-if="!props.readonly"
            @click="deleteEnvVar(key)"
            :title="$t('serverStartup.deleteVar')"
            class="text-white/30 hover:text-red-400 p-2 flex-shrink-0 transition-colors"
          >
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
            </svg>
          </button>
        </div>
      </div>
      <div v-if="!props.readonly" class="flex flex-wrap gap-2">
        <button
          @click="addEnvVar"
          class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-3 py-2 rounded-xl text-sm transition-all"
        >
          {{ $t('serverStartup.addVar') }}
        </button>
        <button
          @click="saveEnvVars"
          :disabled="savingEnv"
          class="bg-emerald-300 hover:bg-emerald-200 text-black px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
        >
          {{ savingEnv ? $t('serverStartup.saving') : $t('serverStartup.saveEnv') }}
        </button>
      </div>
      <div v-if="envMessage" :class="[
        'text-sm px-3 py-2 rounded-xl mt-3 border',
        envMessageType === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
      ]">
        {{ envMessage }}
      </div>
    </div>

    <!-- Напоминание -->
    <div class="bg-yellow-500/[0.07] border border-yellow-500/25 rounded-2xl px-4 py-3 flex gap-3">
      <svg class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <rect width="24" height="24" fill="none"/>
        <path fill="currentColor" d="M12 1.67c.955 0 1.845.467 2.39 1.247l.105.16l8.114 13.548a2.914 2.914 0 0 1-2.307 4.363l-.195.008H3.882a2.914 2.914 0 0 1-2.582-4.2l.099-.185l8.11-13.538A2.91 2.91 0 0 1 12 1.67M12.01 15l-.127.007a1 1 0 0 0 0 1.986L12 17l.127-.007a1 1 0 0 0 0-1.986zM12 8a1 1 0 0 0-.993.883L11 9v4l.007.117a1 1 0 0 0 1.986 0L13 13V9l-.007-.117A1 1 0 0 0 12 8"/>
      </svg>
      <p class="text-xs text-white/60 leading-relaxed">
        {{ $t('serverStartup.restartPre') }} <strong class="text-yellow-300">{{ $t('serverStartup.restartWord') }}</strong> {{ $t('serverStartup.restartPost') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
const props = defineProps<{
  serverId: number
  server: any
  readonly?: boolean
}>()

const emit = defineEmits(['updated'])
const { t } = useI18n()

// Startup
const currentStartup = ref(props.server?.startup || '')
const newStartup = ref(props.server?.startup || '')
const loading = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const startupInput = ref(null)

// Environment variables
const envVars = ref<Record<string, string>>({})
const savingEnv = ref(false)
const envMessage = ref('')
const envMessageType = ref<'success' | 'error'>('success')

// Переменные чертежа (яйца)
const bpVars = ref<Record<string, any>>({})
const savingBp = ref(false)
const bpMessage = ref('')
const bpMessageType = ref<'success' | 'error'>('success')

const eggVarList = computed(() => {
  const vars = props.server?.blueprint?.variables || []
  return vars.filter((v) => v?.env_variable && v?.user_viewable !== false)
})

const envKeys = computed(() => Object.keys(envVars.value))

const isDirty = computed(() => newStartup.value !== currentStartup.value)

// Чипы переменных для вставки + живое превью итоговой команды.
const varChips = computed(() => {
  const keys = new Set(['memory', 'cpu', 'disk', 'SERVER_MEMORY', 'SERVER_PORT', 'SERVER_IP'])
  for (const k of Object.keys(envVars.value || {})) keys.add(k)
  for (const v of eggVarList.value) {
    if (v?.env_variable) keys.add(v.env_variable)
  }
  return [...keys]
})

const renderVars = (tpl: string, vars: Record<string, any>) =>
  String(tpl || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m, key) => {
    if (vars[key] !== undefined && vars[key] !== null && vars[key] !== '') return String(vars[key])
    return m
  })

const startupPreview = computed(() => {
  const sys = {
    memory: props.server?.memory, cpu: props.server?.cpu, disk: props.server?.disk,
    SERVER_MEMORY: props.server?.memory,
    SERVER_PORT: props.server?.allocation?.port, SERVER_IP: props.server?.allocation?.ip,
  }
  return renderVars(newStartup.value, { ...envVars.value, ...bpVars.value, ...sys })
})

const insertVar = (key: string) => {
  const ins = `{{${key}}}`
  const el = startupInput.value
  if (!el || typeof el.selectionStart !== 'number') {
    newStartup.value += (newStartup.value && !newStartup.value.endsWith('\n') ? ' ' : '') + ins
    return
  }
  const s = el.selectionStart ?? newStartup.value.length
  const e = el.selectionEnd ?? s
  newStartup.value = newStartup.value.slice(0, s) + ins + newStartup.value.slice(e)
  nextTick(() => {
    try {
      el.focus()
      el.selectionStart = el.selectionEnd = s + ins.length
    } catch {}
  })
}

const initBpVars = () => {
  const next = {}
  for (const v of eggVarList.value) {
    next[v.env_variable] = envVars.value[v.env_variable] ?? v.default_value ?? ''
  }
  bpVars.value = next
}

const saveBpVars = async () => {
  savingBp.value = true
  bpMessage.value = ''
  try {
    await $fetch(`/api/servers/${props.serverId}/setup`, {
      method: 'PUT',
      body: { variables: bpVars.value }
    })
    bpMessage.value = t('serverStartup.bpApplied')
    bpMessageType.value = 'success'
    await loadEnvVars()
    initBpVars()
    emit('updated')
  } catch (e: any) {
    bpMessage.value = e.data?.message || t('serverStartup.errSave')
    bpMessageType.value = 'error'
  } finally {
    savingBp.value = false
  }
}

// Загрузка переменных окружения
const loadEnvVars = async () => {
  try {
    const data = await $fetch(`/api/servers/${props.serverId}/environment`)
    if (data && typeof data === 'object') {
      envVars.value = data
    }
  } catch (e) {}
}

const addEnvVar = () => {
  let base = 'NEW_VAR'
  let i = 1
  while (envVars.value[`${base}_${i}`] !== undefined) i++
  if (envVars.value[base] !== undefined) base = `${base}_${i}`
  envVars.value[base] = ''
}

const deleteEnvVar = (key: string) => {
  delete envVars.value[key]
}

const renameEnvKey = (oldKey: string, newKey: string) => {
  if (oldKey === newKey) return
  const value = envVars.value[oldKey]
  delete envVars.value[oldKey]
  envVars.value[newKey] = value
}

const saveEnvVars = async () => {
  savingEnv.value = true
  envMessage.value = ''

  try {
    await $fetch(`/api/servers/${props.serverId}/environment`, {
      method: 'PUT',
      body: envVars.value
    })
    envMessage.value = t('serverStartup.envSaved')
    envMessageType.value = 'success'
    emit('updated')
  } catch (e: any) {
    envMessage.value = e.data?.message || t('serverStartup.errSave')
    envMessageType.value = 'error'
  } finally {
    savingEnv.value = false
  }
}

// Startup
const applyStartup = async () => {
  if (!newStartup.value || newStartup.value === currentStartup.value) return

  loading.value = true
  message.value = ''

  try {
    await $fetch(`/api/servers/${props.serverId}/startup`, {
      method: 'PUT',
      body: { startup: newStartup.value }
    })
    currentStartup.value = newStartup.value
    message.value = t('serverStartup.cmdUpdated')
    messageType.value = 'success'
    emit('updated')
  } catch (e: any) {
    message.value = e.data?.message || t('serverStartup.errCmd')
    messageType.value = 'error'
  } finally {
    loading.value = false
  }
}

const resetStartup = () => {
  newStartup.value = currentStartup.value
  message.value = ''
}

watch(() => props.server?.startup, (newVal) => {
  if (newVal) {
    currentStartup.value = newVal
    newStartup.value = newVal
  }
})

onMounted(() => {
  loadEnvVars().then(() => initBpVars())
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
