<template>
  <div class="space-y-4">
    <!-- Шапка + степпер -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-lg font-bold text-white/95">{{ $t('serverSetup.title') }}</h3>
        <p class="text-xs text-white/40 mt-0.5">{{ hasEgg ? $t('serverSetup.blueprintOf', { name: server.blueprint.name }) : $t('serverSetup.manual') }}</p>
      </div>
      <div class="flex items-center gap-1.5">
        <template v-for="(s, i) in steps" :key="s">
          <span
            :class="[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
              stepState(i) === 'done'
                ? 'bg-emerald-300/15 text-emerald-300 border-emerald-300/30'
                : stepState(i) === 'current'
                  ? 'bg-white/[0.06] text-white/85 border-white/20'
                  : 'text-white/30 border-white/10'
            ]"
          >
            <span
              :class="[
                'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold',
                stepState(i) === 'done' ? 'bg-emerald-300 text-black' : 'bg-white/10 text-white/50'
              ]"
            >
              <template v-if="stepState(i) === 'done'">✓</template>
              <template v-else>{{ i + 1 }}</template>
            </span>
            {{ s }}
          </span>
        </template>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-5">
      <!-- Левая колонка: шаги -->
      <div class="lg:col-span-3 space-y-4">
        <!-- Чертеж сервера: образы и переменные из яйца -->
        <template v-if="hasEgg">
          <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-bold">1</span>
              <h4 class="text-sm font-semibold text-white/90">{{ $t('serverSetup.image') }}</h4>
            </div>
            <UiSelect v-model="eggImage" :options="server.blueprint.images" :placeholder="$t('serverSetup.selectImage')" mono />
          </div>

          <div v-if="eggVarList.length" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-bold">2</span>
              <h4 class="text-sm font-semibold text-white/90">{{ $t('serverSetup.blueprintSettings') }}</h4>
            </div>
            <p class="text-xs text-white/40 mb-3">{{ $t('serverSetup.rerenderHint') }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div v-for="v in eggVarList" :key="v.env_variable">
                <label class="block text-xs text-white/50 mb-1 truncate" :title="v.env_variable">
                  {{ v.name || v.env_variable }}
                  <span v-if="String(v.rules || '').includes('required')" class="text-red-400">*</span>
                  <span v-if="v.user_editable === false" class="text-white/30">{{ $t('serverSetup.readonlyShort') }}</span>
                </label>
                <input
                  v-model="eggVars[v.env_variable]"
                  :disabled="v.user_editable === false"
                  type="text"
                  :placeholder="String(v.default_value ?? '')"
                  class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/25 focus:outline-none focus:border-emerald-300/50 disabled:opacity-50"
                />
                <p v-if="v.description" class="text-white/30 text-[11px] mt-1 truncate" :title="v.description">{{ v.description }}</p>
              </div>
            </div>
          </div>

          <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-bold">3</span>
              <h4 class="text-sm font-semibold text-white/90">{{ $t('serverSetup.finalCommand') }}</h4>
            </div>
            <p class="text-white/80 text-xs sm:text-sm font-mono break-all bg-black/40 border border-white/10 rounded-xl px-3 py-2.5">{{ eggPreview || '—' }}</p>
            <div v-if="eggMessage" :class="[
              'text-sm px-3 py-2 rounded-xl mt-3 border',
              eggMessageType === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
            ]">
              {{ eggMessage }}
            </div>
            <p class="text-[11px] text-white/30 mt-2">{{ $t('serverSetup.applyHint') }}</p>
          </div>
        </template>

        <template v-else>
          <!-- Тип сервера -->
          <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
            <div class="flex items-center gap-2 mb-3">
              <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-bold">1</span>
              <h4 class="text-sm font-semibold text-white/90">{{ $t('serverSetup.serverType') }}</h4>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                v-for="type in serverTypes"
                :key="type.id"
                @click="selectType(type.id)"
                :disabled="!type.available"
                :class="[
                  'p-3 rounded-xl border text-center transition-all',
                  !type.available ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/5' :
                  selectedType === type.id
                    ? 'bg-emerald-300/15 border-emerald-300/50 text-white'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.06]'
                ]"
              >
                <div class="mb-1 flex justify-center"><UiIcon :name="type.icon" class="w-6 h-6 text-white/70" /></div>
                <div class="font-medium text-sm">{{ type.name }}</div>
                <div v-if="!type.available" class="text-[10px] text-red-400 mt-1">{{ $t('serverSetup.unavailable') }}</div>
                <div v-if="type.requirements" class="text-[10px] text-white/30 mt-1">{{ type.requirements }}</div>
              </button>
            </div>
          </div>

          <!-- Версия / конфигурация -->
          <div v-if="selectedType" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-bold">2</span>
              <h4 class="text-sm font-semibold text-white/90">
                {{ selectedType === 'minecraft' ? $t('serverSetup.coreVersion') : selectedType === 'scpsl' ? $t('serverSetup.config') : $t('serverSetup.stack') }}
              </h4>
            </div>

            <template v-if="selectedType === 'minecraft'">
              <div v-for="core in minecraftCores" :key="core.id" class="bg-black/30 rounded-xl p-3 border border-white/[0.07]">
                <div class="flex items-center gap-2 mb-2">
                  <UiIcon :name="core.icon" class="w-5 h-5 text-white/70 flex-shrink-0" />
                  <span class="font-medium text-white text-sm">{{ core.name }}</span>
                  <span v-if="core.recommended" class="text-[10px] text-emerald-300 bg-emerald-300/15 border border-emerald-300/25 px-1.5 py-0.5 rounded-full">{{ $t('serverSetup.recommended') }}</span>
                  <span class="text-[10px] text-white/30 ml-auto hidden sm:inline">{{ core.description }}</span>
                </div>
                <UiSelect
                  v-model="selectedVersions[core.id]"
                  :options="core.versions.map((version) => ({ value: version, label: `Minecraft ${version}` }))"
                  :placeholder="$t('serverSetup.selectVersion')"
                />
              </div>
            </template>

            <template v-else-if="selectedType === 'scpsl'">
              <div class="flex items-center gap-2 mb-2">
                <UiIcon name="flask" class="w-5 h-5 text-white/70" />
                <span class="font-medium text-white text-sm">SCP: Secret Laboratory</span>
                <span class="text-[10px] text-yellow-400 bg-yellow-500/15 border border-yellow-500/25 px-1.5 py-0.5 rounded-full ml-auto">3+ GB RAM</span>
              </div>
              <UiSelect
                v-model="selectedScpslVersion"
                :options="[
                  { value: 'standard', label: $t('serverSetup.scpslStandard') },
                  { value: 'minimal', label: $t('serverSetup.scpslMinimal') },
                ]"
                :placeholder="$t('serverSetup.selectConfig')"
              />
            </template>

            <template v-else-if="selectedType === 'coding'">
              <div class="bg-black/30 rounded-xl p-3 border border-white/[0.07] space-y-3">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <UiIcon name="file-code" class="w-5 h-5 text-white/70" />
                    <span class="font-medium text-white text-sm">Python</span>
                  </div>
                  <UiSelect
                    v-model="selectedPythonVersion"
                    :options="[
                      { value: '3.12', label: 'Python 3.12 (slim)' },
                      { value: '3.11', label: 'Python 3.11 (slim)' },
                      { value: '3.10', label: 'Python 3.10 (slim)' },
                      { value: '3.9', label: 'Python 3.9 (slim)' },
                    ]"
                    :placeholder="$t('serverSetup.selectVersion')"
                  />
                </div>
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <UiIcon name="hexagon" class="w-5 h-5 text-white/70" />
                    <span class="font-medium text-white text-sm">Node.js</span>
                  </div>
                  <UiSelect
                    v-model="selectedNodeVersion"
                    :options="[
                      { value: '22', label: 'Node.js 22 (slim)' },
                      { value: '20', label: 'Node.js 20 (slim)' },
                      { value: '18', label: 'Node.js 18 (slim)' },
                    ]"
                    :placeholder="$t('serverSetup.selectVersion')"
                  />
                </div>
                <div class="border-t border-white/[0.07] pt-3">
                  <p class="text-xs text-white/40 mb-2">{{ $t('serverSetup.customImage') }}</p>
                  <input
                    v-model="customDockerImage"
                    type="text"
                    placeholder="python:3.12-slim"
                    class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/25 focus:outline-none focus:border-emerald-300/50 mb-2"
                  />
                  <input
                    v-model="customStartup"
                    type="text"
                    placeholder="python main.py"
                    class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/25 focus:outline-none focus:border-emerald-300/50"
                  />
                </div>
              </div>
            </template>
          </div>

          <div v-if="selectedType === 'scpsl' && !hasScpslResources" class="bg-red-500/[0.07] border border-red-500/25 rounded-2xl px-4 py-3 flex gap-2.5">
            <svg class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="currentColor" d="M12 1.67c.955 0 1.845.467 2.39 1.247l.105.16l8.114 13.548a2.914 2.914 0 0 1-2.307 4.363l-.195.008H3.882a2.914 2.914 0 0 1-2.582-4.2l.099-.185l8.11-13.538A2.91 2.91 0 0 1 12 1.67M12.01 15l-.127.007a1 1 0 0 0 0 1.986L12 17l.127-.007a1 1 0 0 0 0-1.986zM12 8a1 1 0 0 0-.993.883L11 9v4l.007.117a1 1 0 0 0 1.986 0L13 13V9l-.007-.117A1 1 0 0 0 12 8"/>
            </svg>
            <p class="text-xs text-white/60 leading-relaxed">
              <span class="text-red-400 font-medium">{{ $t('serverSetup.needRam') }}</span>
              {{ $t('serverSetup.hasRam', { ram: formatMb(server?.memory) }) }}
            </p>
          </div>
        </template>
      </div>

      <!-- Правая колонка: итог -->
      <div class="lg:col-span-2">
        <div class="lg:sticky lg:top-0 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-3">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-bold">✓</span>
            <h4 class="text-sm font-semibold text-white/90">{{ $t('serverSetup.summary') }}</h4>
          </div>
          <div v-if="summaryConfig">
            <p class="text-white font-medium">{{ summaryConfig.name }}</p>
            <div class="mt-2 space-y-1.5 text-xs">
              <div class="flex gap-2">
                <span class="text-white/35 w-20 flex-shrink-0">{{ $t('serverSetup.imageShort') }}</span>
                <span class="text-white/75 font-mono break-all">{{ summaryConfig.image }}</span>
              </div>
              <div class="flex gap-2">
                <span class="text-white/35 w-20 flex-shrink-0">{{ $t('serverSetup.startup') }}</span>
                <span class="text-white/75 font-mono break-all">{{ summaryConfig.startup }}</span>
              </div>
              <div v-if="summaryConfig.envVars && Object.keys(summaryConfig.envVars).length" class="bg-black/30 border border-white/[0.07] rounded-xl p-2.5 mt-1">
                <p class="text-white/35 text-[11px] mb-1">{{ $t('serverSetup.variables') }}</p>
                <div v-for="(value, key) in summaryConfig.envVars" :key="key" class="text-white/55 text-[11px] font-mono break-all">
                  {{ key }}={{ value }}
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-xs text-white/30 bg-black/30 border border-dashed border-white/10 rounded-xl px-3 py-4 text-center">
            {{ hasEgg ? $t('serverSetup.pickImage') : $t('serverSetup.pickType') }}
          </div>
          <button
            @click="hasEgg ? applyEgg() : applySetup()"
            :disabled="!summaryConfig || loading || eggLoading"
            class="w-full bg-emerald-300 hover:bg-emerald-200 text-black px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span v-if="loading || eggLoading" class="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin"></span>
            {{ (loading || eggLoading) ? $t('serverSetup.installing') : $t('serverSetup.install') }}
          </button>
          <div v-if="message" :class="[
            'text-sm px-3 py-2.5 rounded-xl border text-center',
            messageType === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
          ]">
            {{ message }}
          </div>
          <p v-if="!hasEgg" class="text-[11px] text-white/30 leading-relaxed">{{ $t('serverSetup.recreateNote') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
const props = defineProps<{ serverId: number; server: any }>()
const emit = defineEmits(['updated'])
const { t } = useI18n()

// ==================== ЧЕРТЕЖ (ЯЙЦО) ====================
// Если у сервера есть чертёж с образами/переменными — data-driven UI
// вместо захардкоженных пресетов ниже.
const hasEgg = computed(() => {
  const bp = props.server?.blueprint
  return !!(bp && (bp.images?.length > 1 || (bp.variables || []).some((v) => v?.user_viewable !== false)))
})

const parseEnv = (raw) => {
  if (!raw) return {}
  if (typeof raw === 'object') return { ...raw }
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? v : {}
  } catch { return {} }
}

const initEggState = () => {
  const bp = props.server?.blueprint
  const current = parseEnv(props.server?.environment)
  eggImage.value = props.server?.image || bp?.images?.[0] || ''
  const next = {}
  for (const v of bp?.variables || []) {
    if (!v?.env_variable) continue
    next[v.env_variable] = current[v.env_variable] ?? v.default_value ?? ''
  }
  eggVars.value = next
  eggMessage.value = ''
}

const eggImage = ref('')
const eggVars = ref<Record<string, any>>({})
const eggLoading = ref(false)
const eggMessage = ref('')
const eggMessageType = ref<'success' | 'error'>('success')

const eggVarList = computed(() => {
  const vars = props.server?.blueprint?.variables || []
  return vars.filter((v) => v?.env_variable && v?.user_viewable !== false)
})

const eggPreview = computed(() => {
  let out = props.server?.startup || ''
  const sys = {
    memory: props.server?.memory, cpu: props.server?.cpu, disk: props.server?.disk,
    SERVER_MEMORY: props.server?.memory, SERVER_PORT: props.server?.allocation?.port, SERVER_IP: props.server?.allocation?.ip,
  }
  const all = { ...eggVars.value, ...sys }
  out = out.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m, key) => {
    if (all[key] !== undefined && all[key] !== null) return String(all[key])
    return m
  })
  return out
})

const applyEgg = async () => {
  eggLoading.value = true
  eggMessage.value = ''
  try {
    await $fetch(`/api/servers/${props.serverId}/setup`, {
      method: 'PUT',
      body: { image: eggImage.value, variables: eggVars.value },
    })
    eggMessage.value = t('serverSetup.appliedRestart')
    eggMessageType.value = 'success'
    emit('updated')
  } catch (e: any) {
    eggMessage.value = e.data?.message || t('serverSetup.errApply')
    eggMessageType.value = 'error'
  } finally {
    eggLoading.value = false
  }
}

watch(() => props.server?.id, () => { if (hasEgg.value) initEggState() })
onMounted(() => { if (hasEgg.value) initEggState() })

// Степпер шапки: 1 источник → 2 параметры → 3 итог.
const steps = computed(() => hasEgg.value
  ? [t('serverSetup.stepImage'), t('serverSetup.stepSettings'), t('serverSetup.stepSummary')]
  : [t('serverSetup.stepType'), t('serverSetup.stepVersion'), t('serverSetup.stepSummary')])

const summaryConfig = computed(() => {
  if (hasEgg.value) {
    if (!eggImage.value) return null
    return { name: eggImage.value, image: eggImage.value, startup: eggPreview.value, envVars: eggVars.value }
  }
  return selectedConfig.value
})

const stepState = (i: number) => {
  const ready = hasEgg.value
    ? [!!eggImage.value, true, !!eggImage.value]
    : [!!selectedType.value, !!selectedConfig.value, !!selectedConfig.value]
  if (ready[i]) return 'done'
  const prevOk = i === 0 || ready.slice(0, i).every(Boolean)
  return prevOk ? 'current' : 'todo'
}

// ==================== ТИПЫ СЕРВЕРОВ ====================
const selectedType = ref('')
const serverTypes = computed(() => {
  const serverMemory = props.server?.memory || 0
  return [
    { id: 'minecraft', name: 'Minecraft', icon: 'gamepad', available: true, requirements: '1-2 GB RAM' },
    { id: 'scpsl', name: 'SCP:SL', icon: 'flask', available: serverMemory >= 3072, requirements: t('serverSetup.reqScpsl') },
    { id: 'coding', name: 'Coding', icon: 'code', available: true, requirements: '128 MB - 1 GB RAM' }
  ]
})

// ==================== MINECRAFT ====================
const selectedVersions = ref<Record<string, string>>({})
const minecraftCores = computed(() => [
  { id: 'paper', name: 'PaperMC', icon: 'box', description: t('serverSetup.mcPaperDesc'), recommended: true, versions: ['1.21.4', '1.20.4', '1.19.4', '1.18.2', '1.17.1', '1.16.5', '1.12.2'] },
  { id: 'purpur', name: 'Purpur', icon: 'gem', description: t('serverSetup.mcPurpurDesc'), recommended: false, versions: ['1.21.4', '1.20.4', '1.19.4', '1.18.2', '1.16.5'] },
  { id: 'vanilla', name: 'Vanilla', icon: 'leaf', description: t('serverSetup.mcVanillaDesc'), recommended: false, versions: ['1.21.4', '1.20.4', '1.19.4', '1.18.2', '1.16.5'] }
])

// ==================== SCP:SL ====================
const selectedScpslVersion = ref('')
const hasScpslResources = computed(() => (props.server?.memory || 0) >= 3072)

// ==================== CODING ====================
const selectedPythonVersion = ref('')
const selectedNodeVersion = ref('')
const customDockerImage = ref('')
const customStartup = ref('')

// ==================== ВЫБОР КОНФИГУРАЦИИ ====================
const selectedConfig = computed(() => {
  for (const core of minecraftCores.value) {
    const ver = selectedVersions.value[core.id]
    if (ver) {
      const javaVer = parseInt(ver) >= 18 ? '21' : parseInt(ver) >= 17 ? '17' : parseInt(ver) >= 12 ? '11' : '8'
      return { name: `${core.name} ${ver}`, image: `ghcr.io/pterodactyl/yolks:java_${javaVer}`, startup: `java -Xms128M -Xmx{{memory}}M -jar server.jar nogui` }
    }
  }
  if (selectedScpslVersion.value) {
    const configs: Record<string, any> = {
      standard: { name: 'SCP:SL + EXILED + Discord', image: 'ipshosting/game-scpsl:latest', startup: './LocalAdmin {{SERVER_PORT}}', envVars: { INSTALL_EXILED: 'true', EXILED_PRE: 'false', REMOVE_UPDATER: 'true', INSTALL_DIBOT: 'false', INSTALL_SCPBOT: 'false' } },
      minimal: { name: t('serverSetup.scpslMinimalName'), image: 'ipshosting/game-scpsl:latest', startup: './LocalAdmin {{SERVER_PORT}}', envVars: {} }
    }
    return configs[selectedScpslVersion.value] || null
  }
  if (selectedPythonVersion.value) return { name: `Python ${selectedPythonVersion.value}`, image: `python:${selectedPythonVersion.value}-slim`, startup: `pip install -r requirements.txt && python main.py` }
  if (selectedNodeVersion.value) return { name: `Node.js ${selectedNodeVersion.value}`, image: `node:${selectedNodeVersion.value}-slim`, startup: `npm install && node index.js` }
  if (customDockerImage.value) return { name: t('serverSetup.customImage'), image: customDockerImage.value, startup: customStartup.value || 'bash' }
  return null
})

// ==================== ДЕЙСТВИЯ ====================
const loading = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

const selectType = (typeId: string) => {
  selectedType.value = typeId
  selectedVersions.value = {}
  selectedScpslVersion.value = ''
  selectedPythonVersion.value = ''
  selectedNodeVersion.value = ''
  customDockerImage.value = ''
  customStartup.value = ''
  message.value = ''
}

const applySetup = async () => {
  if (!selectedConfig.value) return

  loading.value = true
  message.value = ''

  try {
    const body: any = { image: selectedConfig.value.image, startup: selectedConfig.value.startup }
    if (selectedConfig.value.envVars) body.environment = selectedConfig.value.envVars

    await $fetch(`/api/servers/${props.serverId}/setup`, { method: 'PUT', body })

    message.value = t('serverSetup.appliedRestart')
    messageType.value = 'success'
    emit('updated')
  } catch (e: any) {
    message.value = e.data?.message || t('serverSetup.errInstall')
    messageType.value = 'error'
  } finally {
    loading.value = false
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
