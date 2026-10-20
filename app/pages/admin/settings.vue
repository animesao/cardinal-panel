<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white/95">{{ $t('admin.settings') }}</h2>
        <p class="text-white/40 text-xs sm:text-sm mt-1">{{ $t('adminPages.settings.subtitle') }}</p>
      </div>
      <span class="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-emerald-300/80 bg-emerald-300/[0.07] border border-emerald-300/20 px-3 py-1 rounded-full flex-shrink-0">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
        {{ $t('adminPages.settings.liveBadge') }}
      </span>
    </div>

    <div class="grid gap-4 lg:grid-cols-2 items-start">
      <!-- Левая колонка: название -->
      <div class="space-y-4 min-w-0">
        <div class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 sm:p-6 space-y-4">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-xl bg-emerald-300/10 border border-emerald-300/25 flex items-center justify-center text-emerald-300 text-sm font-bold flex-shrink-0">Aa</span>
            <div class="min-w-0">
              <h3 class="text-white font-medium text-sm sm:text-base">{{ $t('adminPages.settings.nameTitle') }}</h3>
              <p class="text-white/35 text-[11px] sm:text-xs truncate">{{ $t('adminPages.settings.nameHint') }}</p>
            </div>
          </div>
          <div>
            <input
              v-model="form.panel_name"
              type="text"
              maxlength="60"
              placeholder="Cardinal Panel"
              @keyup.enter="save"
              class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40 placeholder-white/25"
            />
            <p class="text-white/30 text-xs mt-1">{{ $t('adminPages.settings.nameRule') }}</p>
          </div>

          <div class="bg-black/30 border border-white/10 rounded-xl px-4 py-3">
            <p class="text-[11px] uppercase tracking-wide text-white/30 mb-1">{{ $t('adminPages.settings.previewLabel') }}</p>
            <p class="text-xl font-bold text-transparent bg-clip-text" style="background-image: radial-gradient(circle 500px at 50% 100px, rgba(110,231,183,0.35), transparent);">{{ preview || 'Cardinal Panel' }}</p>
          </div>

          <div v-if="message" :class="[
            'text-sm px-3 py-2 rounded-xl border',
            messageType === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
          ]">
            {{ message }}
          </div>

          <button
            @click="save"
            :disabled="saving || !form.panel_name.trim()"
            class="w-full bg-emerald-300 hover:bg-emerald-200 text-black px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
          >
            {{ saving ? $t('common.saving') : $t('adminPages.settings.saveName') }}
          </button>
        </div>
      </div>

      <!-- Правая колонка: способы входа -->
      <div class="space-y-4 min-w-0">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-white/90 text-sm sm:text-base font-medium">{{ $t('adminPages.settings.loginMethods') }}</h3>
          <span class="text-[11px] text-white/35">{{ $t('adminPages.settings.enabledOf', { a: enabledCount, b: PROVIDERS.length }) }}</span>
        </div>

        <div v-for="p in PROVIDERS" :key="p.id" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 sm:p-5 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span :class="['w-2.5 h-2.5 rounded-full flex-shrink-0', oauth[p.id]?.enabled ? 'bg-emerald-300' : 'bg-white/20']" />
              <h4 class="text-white font-medium text-sm truncate">{{ p.name }}</h4>
              <span v-if="oauth[p.id]?.enabled" class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-300/15 text-emerald-300 border border-emerald-300/25 flex-shrink-0">{{ $t('adminPages.settings.on') }}</span>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button @click="detailsProvider = p.id" :title="$t('adminPages.settings.howTo')" class="text-white/40 hover:text-emerald-300 text-[11px] px-2 py-1 rounded-lg hover:bg-white/5 transition-all">
                {{ $t('adminPages.settings.details') }}
              </button>
              <UiToggle :model-value="!!oauth[p.id]?.enabled" @change="(v) => oauth[p.id].enabled = v" />
            </div>
          </div>

          <div v-if="oauth[p.id]?.enabled" class="grid gap-3">
            <div>
              <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.settings.clientId') }} *</label>
              <input
                v-model="oauth[p.id].clientId"
                type="text"
                placeholder="Iv1.abc123…"
                autocomplete="off"
                class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
              />
            </div>
            <div>
              <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.settings.clientSecret') }} {{ oauth[p.id]?.secretSet ? $t('adminPages.settings.secretKept') : '*' }}</label>
              <input
                v-model="oauth[p.id].clientSecret"
                type="password"
                autocomplete="new-password"
                :placeholder="oauth[p.id]?.secretSet ? $t('adminPages.settings.noChange') : $t('adminPages.settings.phSecret')"
                class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
              />
            </div>
          </div>
          <p v-if="oauth[p.id]?.enabled" class="text-white/30 text-[11px] break-all">
            {{ $t('adminPages.settings.callbackUrl') }}: <span class="font-mono text-white/50">{{ callbackBase }}/api/auth/callback/{{ p.id }}</span>
          </p>

          <div v-if="oauthMsg[p.id]" :class="[
            'text-sm px-3 py-2 rounded-xl border',
            oauthOk[p.id] ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
          ]">
            {{ oauthMsg[p.id] }}
          </div>

          <button
            @click="saveProvider(p.id)"
            :disabled="oauthSaving[p.id]"
            class="w-full bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-5 py-2 rounded-xl text-xs sm:text-sm transition-all disabled:opacity-50"
          >
            {{ oauthSaving[p.id] ? $t('common.saving') : $t('adminPages.settings.saveProvider') }}
          </button>
        </div>
        <p class="px-1 text-white/30 text-[11px]">{{ $t('adminPages.settings.secretsHint') }}</p>
      </div>
    </div>

    <!-- Модалка: как подключить провайдера -->
    <Teleport to="body">
      <div v-if="detailsProvider" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="detailsProvider = null">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm kt-fade-in"></div>
        <div class="kt-pop relative bg-[#141414] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base sm:text-lg font-medium text-white">{{ $t('adminPages.settings.connectTitle', { name: detailsName }) }}</h3>
            <button @click="detailsProvider = null" :title="$t('common.close')" class="text-white/40 hover:text-white/80 p-1 transition-colors">
              <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <ol class="space-y-2.5">
            <li v-for="(s, i) in detailsSteps" :key="i" class="flex gap-3">
              <span class="w-5 h-5 rounded-full bg-emerald-300/10 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-medium flex-shrink-0 mt-0.5">{{ i + 1 }}</span>
              <p class="text-white/70 text-xs sm:text-sm leading-relaxed" v-html="s" />
            </li>
          </ol>

          <div class="bg-black/30 border border-white/10 rounded-xl px-4 py-3">
            <p class="text-[11px] uppercase tracking-wide text-white/30 mb-1.5">{{ $t('adminPages.settings.callbackTitle') }}</p>
            <div class="flex gap-2">
              <code class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-emerald-200 text-xs font-mono break-all">{{ callbackBase }}/api/auth/callback/{{ detailsProvider }}</code>
              <button @click="copyCallback" class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-3 rounded-lg text-xs transition-all flex-shrink-0">
                {{ copiedCallback ? $t('common.copied') : $t('common.copy') }}
              </button>
            </div>
          </div>

          <p class="text-white/30 text-[11px]">{{ $t('adminPages.settings.afterHint') }}</p>

          <button @click="detailsProvider = null" class="w-full bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 rounded-xl px-4 py-2.5 text-sm transition-all">
            {{ $t('adminPages.settings.gotIt') }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
// @ts-nocheck
// Admin → Настройки: название панели (panel_name в БД) + способы входа.
// После сохранения имя обновляется в шапках и вкладке без перезагрузки.
const { t } = useI18n()
const { refreshPanelName } = usePanelName()

const form = ref({ panel_name: '' })
const saving = ref(false)
const message = ref('')
const messageType = ref('success')

const preview = computed(() => form.value.panel_name.trim())

const PROVIDERS = [
  { id: 'github', name: 'GitHub' },
  { id: 'google', name: 'Google' },
  { id: 'discord', name: 'Discord' },
]
const oauth = ref({
  github: { enabled: false, clientId: '', clientSecret: '', secretSet: false },
  google: { enabled: false, clientId: '', clientSecret: '', secretSet: false },
  discord: { enabled: false, clientId: '', clientSecret: '', secretSet: false },
})
const oauthSaving = ref({})
const oauthMsg = ref({})
const oauthOk = ref({})
const callbackBase = ref('')

// Пошаговые инструкции по подключению — модалка «Подробнее».
const GUIDE = computed(() => ({
  github: {
    name: 'GitHub',
    steps: [
      t('adminPages.settings.guideGithub1'),
      t('adminPages.settings.guideGithub2'),
      t('adminPages.settings.guideGithub3'),
      t('adminPages.settings.guideGithub4'),
    ],
  },
  google: {
    name: 'Google',
    steps: [
      t('adminPages.settings.guideGoogle1'),
      t('adminPages.settings.guideGoogle2'),
      t('adminPages.settings.guideGoogle3'),
      t('adminPages.settings.guideGoogle4'),
      t('adminPages.settings.guideGoogle5'),
    ],
  },
  discord: {
    name: 'Discord',
    steps: [
      t('adminPages.settings.guideDiscord1'),
      t('adminPages.settings.guideDiscord2'),
      t('adminPages.settings.guideDiscord3'),
      t('adminPages.settings.guideDiscord4'),
    ],
  },
}))
const detailsProvider = ref(null)
const copiedCallback = ref(false)
const detailsName = computed(() => GUIDE.value[detailsProvider.value]?.name || '')
const detailsSteps = computed(() => GUIDE.value[detailsProvider.value]?.steps || [])

const copyCallback = async () => {
  try {
    await navigator.clipboard.writeText(`${callbackBase.value}/api/auth/callback/${detailsProvider.value}`)
    copiedCallback.value = true
    setTimeout(() => { copiedCallback.value = false }, 2000)
  } catch {}
}

const enabledCount = computed(() => PROVIDERS.filter((p) => oauth.value[p.id]?.enabled).length)

const load = async () => {
  try {
    const data = await $fetch('/api/admin/settings')
    form.value.panel_name = data?.panel_name || ''
    for (const p of PROVIDERS) {
      const cfg = data?.oauth?.[p.id]
      if (cfg) {
        oauth.value[p.id] = {
          enabled: !!cfg.enabled,
          clientId: cfg.clientId || '',
          clientSecret: '',
          secretSet: !!cfg.secretSet,
        }
      }
    }
    try {
      callbackBase.value = window.location.origin
    } catch {}
  } catch (e) {
    message.value = e.data?.message || t('adminPages.settings.loadError')
    messageType.value = 'error'
  }
}

const save = async () => {
  saving.value = true
  message.value = ''
  try {
    const data = await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: { panel_name: form.value.panel_name },
    })
    form.value.panel_name = data?.panel_name || form.value.panel_name.trim()
    await refreshPanelName()
    message.value = t('adminPages.settings.savedName')
    messageType.value = 'success'
  } catch (e) {
    message.value = e.data?.message || t('adminPages.settings.saveError')
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}

const saveProvider = async (pid) => {
  oauthSaving.value[pid] = true
  oauthMsg.value[pid] = ''
  try {
    const cfg = oauth.value[pid]
    const data = await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: { oauth: { [pid]: { enabled: cfg.enabled, clientId: cfg.clientId, clientSecret: cfg.clientSecret } } },
    })
    const saved = data?.oauth?.[pid]
    if (saved) {
      oauth.value[pid] = { enabled: !!saved.enabled, clientId: cfg.clientId, clientSecret: '', secretSet: !!saved.secretSet }
    }
    oauthMsg.value[pid] = cfg.enabled ? t('adminPages.settings.providerOn') : t('adminPages.settings.providerOff')
    oauthOk.value[pid] = true
  } catch (e) {
    oauthMsg.value[pid] = e.data?.message || t('adminPages.settings.saveError')
    oauthOk.value[pid] = false
  } finally {
    oauthSaving.value[pid] = false
  }
}

onMounted(load)

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})
</script>
