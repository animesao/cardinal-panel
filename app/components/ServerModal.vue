<template>
  <Teleport to="body">
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="$emit('close')">
    <div class="absolute inset-0 bg-black/70 backdrop-blur-sm kt-fade-in"></div>

    <div class="kt-pop relative bg-[#141414] border border-white/10 rounded-2xl p-4 sm:p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg sm:text-xl font-bold text-white">{{ isEdit ? $t('serverModal.editTitle', { name: props.server?.name }) : $t('serverModal.newTitle') }}</h3>
        <button @click="$emit('close')" :title="$t('serverModal.close')" class="text-white/40 hover:text-white/80 p-1 transition-colors">
          <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <form @submit.prevent="saveServer" class="space-y-6">
        <!-- Основное -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/40 text-emerald-300 text-[11px] flex items-center justify-center font-medium">1</span>
            <h4 class="text-white/90 text-sm font-medium">{{ $t('serverModal.server') }}</h4>
          </div>
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.name') }}</label>
              <input v-model="form.name" type="text" required :placeholder="$t('serverModal.namePh')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
            </div>
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.owner') }}</label>
              <div class="relative" v-click-outside="closeOwnerDropdown">
                <div
                  @click="showOwnerDropdown = !showOwnerDropdown"
                  class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm cursor-pointer flex items-center justify-between"
                >
                  <span v-if="selectedOwner" class="truncate">{{ selectedOwner.name || selectedOwner.email }}</span>
                  <span v-else class="text-white/30">{{ $t('serverModal.selectOwner') }}</span>
                  <svg class="w-4 h-4 text-white/40 flex-shrink-0 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                </div>

                <div v-if="showOwnerDropdown" class="kt-menu absolute z-10 top-full mt-1 left-0 right-0 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  <div class="p-2 border-b border-white/10">
                    <input
                      v-model="ownerSearch"
                      type="text"
                      :placeholder="$t('serverModal.ownerSearchPh')"
                      class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-300/50"
                      @keydown.esc="showOwnerDropdown = false"
                    />
                  </div>
                  <div class="max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      v-for="user in filteredUsers"
                      :key="user.id"
                      @click="selectOwner(user)"
                      :class="[
                        'w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-all flex items-center gap-2',
                        form.ownerId === user.id ? 'bg-emerald-300/20 text-emerald-300' : 'text-white/80'
                      ]"
                    >
                      <span class="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0">
                        {{ (user.name || user.email).charAt(0).toUpperCase() }}
                      </span>
                      <span class="truncate">{{ user.name || $t('serverModal.noName') }}</span>
                      <span class="text-white/40 text-xs truncate ml-auto">{{ user.email }}</span>
                    </button>
                    <div v-if="filteredUsers.length === 0" class="px-4 py-3 text-sm text-white/40 text-center">
                      {{ $t('serverModal.noUsers') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-4">
            <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.description') }}</label>
            <textarea v-model="form.description" rows="2" :placeholder="$t('serverModal.descriptionPh')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm resize-none placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
          </div>
        </div>

        <template v-if="!isEdit">
        <!-- Шаг 2: чертёж -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/40 text-emerald-300 text-[11px] flex items-center justify-center font-medium">2</span>
            <h4 class="text-white/90 text-sm font-medium">{{ $t('serverModal.blueprint') }} <span class="text-white/30 font-normal">{{ $t('serverModal.blueprintHint') }}</span></h4>
          </div>
          <div v-if="blueprints.length === 0" class="text-white/40 text-sm bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            {{ $t('serverModal.noBlueprints') }}
          </div>
          <div v-else class="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              v-for="bp in blueprints"
              :key="bp.id"
              @click="selectBlueprint(bp)"
              :class="[
                'p-3 rounded-xl border text-left transition-all',
                form.blueprintId === bp.id
                  ? 'bg-emerald-300/15 border-emerald-300/50 text-white'
                  : 'bg-black/30 border-white/10 text-white/60 hover:bg-white/5'
              ]"
            >
              <div class="text-sm font-medium truncate">{{ bp.name }}</div>
              <div class="text-xs text-white/40 mt-0.5 truncate">{{ bp.description || bp.image }}</div>
              <div class="flex gap-2 mt-1.5 text-[11px] text-white/40">
                <span class="inline-flex items-center gap-1"><UiIcon name="image" class="w-3 h-3" /> {{ (bp.images || []).length || 1 }}</span>
                <span class="inline-flex items-center gap-1"><UiIcon name="gear" class="w-3 h-3" /> {{ (bp.variables || []).length }}</span>
              </div>
              <div v-if="form.blueprintId === bp.id" class="text-xs text-emerald-300 mt-1 font-mono truncate">{{ form.image || bp.image }}</div>
            </button>
          </div>

          <!-- Образ и переменные выбранного чертежа -->
          <div v-if="selectedBlueprint" class="mt-3 space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
            <div v-if="blueprintImages.length > 1">
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.image') }}</label>
              <UiSelect v-model="form.image" required mono :options="blueprintImages" :placeholder="$t('serverModal.selectImage')" />
            </div>
            <div v-if="blueprintVars.length">
              <label class="block text-white/70 text-xs mb-2">{{ $t('serverModal.blueprintSettings') }}</label>
              <div class="space-y-2">
                <div v-for="v in blueprintVars" :key="v.env_variable">
                  <label class="block text-xs text-white/50 mb-1">
                    {{ v.name || v.env_variable }}
                    <span v-if="String(v.rules || '').includes('required')" class="text-red-400">*</span>
                    <span v-if="v.user_editable === false" class="text-white/30">{{ $t('serverModal.readonly') }}</span>
                  </label>
                  <input
                    v-model="form.variables[v.env_variable]"
                    :disabled="v.user_editable === false"
                    type="text"
                    :placeholder="String(v.default_value ?? '')"
                    class="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/25 disabled:opacity-50 focus:outline-none focus:border-emerald-300/40"
                  />
                  <p v-if="v.description" class="text-white/30 text-[11px] mt-0.5">{{ v.description }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Шаг 3: размещение -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/40 text-emerald-300 text-[11px] flex items-center justify-center font-medium">3</span>
            <h4 class="text-white/90 text-sm font-medium">{{ $t('serverModal.placement') }}</h4>
          </div>
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.node') }}</label>
              <UiSelect
                v-model="form.nodeId"
                required
                :placeholder="$t('serverModal.select')"
                :options="nodes.map((node) => ({ value: node.id, label: `${node.name} (${node.url})` }))"
                @change="loadAllocations"
              />
            </div>
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.allocation') }}</label>
              <UiSelect
                v-model="form.allocationId"
                required
                :placeholder="$t('serverModal.select')"
                :disabled="!form.nodeId"
                :options="freeAllocations.map((alloc) => ({ value: alloc.id, label: `${alloc.ip}:${alloc.port}` }))"
              />
            </div>
          </div>
          <p v-if="form.nodeId && freeAllocations.length === 0" class="text-yellow-400/80 text-xs mt-2">{{ $t('serverModal.noAllocations') }}</p>
        </div>
        </template>

        <!-- Ресурсы -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span v-if="!isEdit" class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/40 text-emerald-300 text-[11px] flex items-center justify-center font-medium">4</span>
            <h4 class="text-white/90 text-sm font-medium">{{ $t('serverModal.resources') }}</h4>
          </div>
          <div class="grid grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.memory') }} · {{ formatMb(form.memory) }}</label>
              <input v-model.number="form.memory" type="number" required min="128" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40" />
            </div>
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.cpu') }} <span class="text-white/30">{{ $t('serverModal.cpuHint') }}</span></label>
              <input v-model.number="form.cpu" type="number" required min="10" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40" />
            </div>
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.disk') }} · {{ formatMb(form.disk) }}</label>
              <input v-model.number="form.disk" type="number" required min="128" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.swap') }} · {{ formatMb(form.swap) }}</label>
              <input v-model.number="form.swap" type="number" min="0" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40" />
            </div>
            <div><label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.io') }}</label><input v-model.number="form.io" type="number" min="0" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40" /></div>
          </div>
          <div class="mt-4">
            <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.portSlots') }}</label>
            <input v-model.number="form.portSlots" type="number" min="0" :placeholder="$t('serverModal.unlimited')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
            <p class="text-white/30 text-xs mt-1">{{ $t('serverModal.portSlotsHint') }}</p>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.backupSlots') }}</label>
              <input v-model.number="form.backupSlots" type="number" min="0" :placeholder="$t('serverModal.unlimited')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
              <p class="text-white/30 text-xs mt-1">{{ $t('serverModal.backupSlotsHint') }}</p>
            </div>
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.databaseSlots') }}</label>
              <input v-model.number="form.databaseSlots" type="number" min="0" :placeholder="$t('serverModal.unlimited')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
              <p class="text-white/30 text-xs mt-1">{{ $t('serverModal.databaseSlotsHint') }}</p>
            </div>
          </div>
          <label class="flex items-center gap-2 mt-4 text-sm text-white/70 cursor-pointer">
            <UiToggle v-model="form.autoStart" />
            {{ $t('serverModal.autoStart') }}
          </label>
        </div>

        <template v-if="!isEdit">
        <!-- Шаг 5: запуск -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="w-5 h-5 rounded-full bg-emerald-300/15 border border-emerald-300/40 text-emerald-300 text-[11px] flex items-center justify-center font-medium">5</span>
            <h4 class="text-white/90 text-sm font-medium">{{ $t('serverModal.startupStep') }}</h4>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.dockerImage') }}</label>
              <input v-model="form.image" type="text" :placeholder="$t('serverModal.dockerImagePh')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
            </div>
            <div>
              <label class="block text-white/70 text-xs mb-1">{{ $t('serverModal.startupCmd') }}</label>
              <input v-model="form.startup" type="text" required placeholder="java -Xms128M -Xmx{{memory}}M -jar server.jar" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
              <p class="text-white/30 text-xs mt-1">{{ $t('serverModal.startupVarsHint') }}</p>
            </div>
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-white/70 text-xs">{{ $t('serverModal.envVars') }}</label>
                <button type="button" @click="addEnvVar" class="text-xs text-emerald-300 hover:text-emerald-200">{{ $t('serverModal.add') }}</button>
              </div>
              <div class="space-y-2">
                <div v-for="(value, key, index) in form.environment" :key="index" class="flex gap-2">
                  <input :value="key" @input="(e) => renameEnvKey(key, (e.target as HTMLInputElement).value, index)" :placeholder="$t('serverModal.key')" class="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
                  <input v-model="form.environment[key]" :placeholder="$t('serverModal.value')" class="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
                  <button type="button" @click="deleteEnvVar(key)" class="text-red-400 hover:text-red-300 p-2 flex-shrink-0">
                    <UiIcon name="trash" class="w-4 h-4" />
                  </button>
                </div>
                <p v-if="Object.keys(form.environment).length === 0" class="text-white/30 text-xs">{{ $t('serverModal.noEnvVars') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Итог -->
        <div v-if="summary" class="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/60 font-mono break-all">
          {{ summary }}
        </div>
        </template>
        <p v-else class="text-white/30 text-xs">{{ $t('serverModal.editNote') }}</p>

        <div v-if="error" class="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-xl border border-red-500/30">{{ error }}</div>

        <div class="flex gap-3 pt-2">
          <button type="button" @click="$emit('close')" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl px-4 py-2.5 font-medium text-sm transition-all">{{ $t('serverModal.cancel') }}</button>
          <button type="submit" :disabled="saving" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black border border-transparent rounded-xl px-4 py-2.5 font-medium text-sm transition-all disabled:opacity-50">
            {{ saving ? $t('serverModal.saving') : (isEdit ? $t('serverModal.save') : $t('serverModal.create')) }}
          </button>
        </div>
      </form>
    </div>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
// @ts-nocheck
// ServerModal — создание и редактирование сервера.
// create: 5 шагов (сервер → чертёж → размещение → ресурсы → запуск).
// edit (props.server): имя/владелец/ресурсы, PUT /api/admin/servers/[id].
const props = defineProps<{ server?: any }>()
const emit = defineEmits(['close', 'saved', 'created'])
const { t } = useI18n()

const isEdit = computed(() => !!props.server)

const { data: usersData } = await useFetch('/api/admin/users')
const { data: nodesData } = await useFetch('/api/admin/nodes')
const { data: blueprintsData } = await useFetch('/api/blueprints')

const users = computed(() => usersData.value || [])
const nodes = computed(() => nodesData.value || [])
const blueprints = computed(() => blueprintsData.value || [])

// ==================== ПОИСК ВЛАДЕЛЬЦА ====================
const showOwnerDropdown = ref(false)
const ownerSearch = ref('')
const selectedOwner = ref(null)

const filteredUsers = computed(() => {
  if (!ownerSearch.value.trim()) return users.value
  const q = ownerSearch.value.toLowerCase()
  return users.value.filter((u: any) =>
    (u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  )
})

const selectOwner = (user: any) => {
  form.value.ownerId = user.id
  selectedOwner.value = user
  showOwnerDropdown.value = false
  ownerSearch.value = ''
}

const closeOwnerDropdown = () => { showOwnerDropdown.value = false }

const vClickOutside = {
  mounted(el: any, binding: any) {
    el.clickOutsideEvent = (event: Event) => {
      if (!(el === event.target || el.contains(event.target))) binding.value()
    }
    document.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el: any) { document.removeEventListener('click', el.clickOutsideEvent) }
}

// ==================== ЧЕРТЕЖИ ====================
const selectedBlueprint = ref(null)

const selectBlueprint = (bp: any) => {
  form.value.blueprintId = bp.id
  selectedBlueprint.value = bp
  const imgs = Array.isArray(bp.images) && bp.images.length ? bp.images : (bp.image ? [bp.image] : [])
  form.value.image = imgs[0] || ''
  if (bp.startup_command) form.value.startup = bp.startup_command
  const defaults: Record<string, any> = {}
  for (const v of bp.variables || []) {
    if (v?.env_variable && v.default_value !== undefined && v.default_value !== null) {
      defaults[v.env_variable] = v.default_value
    }
  }
  if (bp.environment) {
    try {
      const env = typeof bp.environment === 'string' ? JSON.parse(bp.environment) : bp.environment
      form.value.environment = { ...env }
    } catch (e) {}
  }
  form.value.variables = { ...defaults }
}

const blueprintImages = computed(() => {
  const bp: any = selectedBlueprint.value
  if (!bp) return []
  if (Array.isArray(bp.images) && bp.images.length) return bp.images
  return bp.image ? [bp.image] : []
})

const blueprintVars = computed(() => {
  const bp: any = selectedBlueprint.value
  const vars = Array.isArray(bp?.variables) ? bp.variables : []
  return vars.filter((v: any) => v?.user_viewable !== false && v?.env_variable)
})

// ==================== АЛЛОКАЦИИ ====================
const freeAllocations = ref([])
const saving = ref(false)
const error = ref('')

const form = ref({
  name: '',
  description: '',
  ownerId: '',
  nodeId: '',
  allocationId: '',
  blueprintId: null as number | null,
  variables: {} as Record<string, any>,
  memory: 2048,
  cpu: 100,
  disk: 10240,
  swap: 0,
  io: 500,
  portSlots: 0,
  backupSlots: 0,
  databaseSlots: 0,
  autoStart: false,
  image: '',
  startup: 'java -Xms128M -Xmx{{memory}}M -jar server.jar',
  environment: {} as Record<string, string>,
})

// Префилл в режиме редактирования.
if (props.server) {
  const s = props.server
  form.value.name = s.name || ''
  form.value.description = s.description || ''
  form.value.ownerId = s.owner?.id || ''
  selectedOwner.value = s.owner || null
  form.value.memory = s.memory || 2048
  form.value.cpu = s.cpu || 100
  form.value.disk = s.disk || 10240
  form.value.swap = s.swap || 0
  form.value.io = s.io || 500
  form.value.portSlots = s.portSlots || 0
  form.value.backupSlots = s.backupSlots || 0
  form.value.databaseSlots = s.databaseSlots || 0
  form.value.autoStart = !!s.autoStart
}

const addEnvVar = () => { form.value.environment['NEW_VAR'] = '' }
const deleteEnvVar = (key: string) => { delete form.value.environment[key] }
const renameEnvKey = (oldKey: string, newKey: string, index: number) => {
  if (oldKey === newKey) return
  const value = form.value.environment[oldKey]
  delete form.value.environment[oldKey]
  form.value.environment[newKey] = value
}

const loadAllocations = async () => {
  if (!form.value.nodeId) { freeAllocations.value = []; return }
  try {
    const data = await $fetch(`/api/admin/nodes/${form.value.nodeId}/allocations`)
    freeAllocations.value = data.filter(a => a.assigned === 'no')
    form.value.allocationId = ''
  } catch (e) {}
}

const selectedNode = computed(() => nodes.value.find((n: any) => n.id === form.value.nodeId))
const selectedAllocation = computed(() => freeAllocations.value.find((a: any) => a.id === form.value.allocationId))

const summary = computed(() => {
  const parts = []
  if (form.value.name) parts.push(`«${form.value.name}»`)
  if (selectedBlueprint.value) parts.push(`${t('serverModal.summaryBlueprint')} ${selectedBlueprint.value.name}`)
  else if (form.value.image) parts.push(`${t('serverModal.summaryImage')} ${form.value.image}`)
  if (selectedNode.value) parts.push(`${t('serverModal.summaryNode')} ${selectedNode.value.name}`)
  if (selectedAllocation.value) parts.push(`${selectedAllocation.value.ip}:${selectedAllocation.value.port}`)
  if (form.value.memory) parts.push(`${formatMb(form.value.memory)} / ${form.value.cpu}% / ${formatMb(form.value.disk)}`)
  return parts.length ? parts.join(' · ') : ''
})

const saveServer = async () => {
  saving.value = true
  error.value = ''
  try {
    if (isEdit.value) {
      await $fetch(`/api/admin/servers/${props.server.id}`, {
        method: 'PUT',
        body: {
          name: form.value.name,
          description: form.value.description,
          ownerId: form.value.ownerId,
          memory: form.value.memory,
          cpu: form.value.cpu,
          disk: form.value.disk,
          swap: form.value.swap,
          io: form.value.io,
          portSlots: form.value.portSlots,
          backupSlots: form.value.backupSlots,
          databaseSlots: form.value.databaseSlots,
          autoStart: form.value.autoStart,
        },
      })
      emit('saved')
      return
    }
    if (!form.value.blueprintId && !form.value.image) {
      error.value = t('serverModal.errNeedBlueprint')
      saving.value = false
      return
    }
    await $fetch('/api/admin/servers', { method: 'POST', body: form.value })
    emit('created')
  } catch (e: any) {
    error.value = e.data?.message || t('serverModal.errSave')
  } finally {
    saving.value = false
  }
}
</script>
