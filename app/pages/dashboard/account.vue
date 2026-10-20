<template>
  <div class="space-y-6">
    <h2 class="text-xl sm:text-2xl font-bold text-white/95">{{ $t('account.title') }}</h2>

    <div class="grid gap-6 lg:grid-cols-2 items-start">
      <!-- Левая колонка: профиль -->
      <div class="space-y-6 min-w-0">
        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6">
          <div class="flex items-center gap-3 sm:gap-4 mb-6">
            <div v-if="session?.user?.image" class="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0">
              <img :src="session.user.image" :alt="session.user.name" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-emerald-300/15 border-2 border-white/20 flex items-center justify-center flex-shrink-0">
              <span class="text-xl sm:text-2xl text-emerald-300 font-bold">
                {{ userInitial }}
              </span>
            </div>
            <div>
              <h3 class="text-lg sm:text-xl font-semibold text-white">{{ session?.user?.name || $t('account.notSpecified') }}</h3>
              <p class="text-white/50 text-xs sm:text-sm">{{ providerName }}</p>
            </div>
          </div>

          <div class="space-y-3 sm:space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 sm:py-3 border-b border-white/10 gap-1">
              <span class="text-white/60 text-xs sm:text-sm">{{ $t('account.email') }}</span>
              <span class="text-white/90 text-sm sm:text-base break-all">{{ session?.user?.email || $t('account.notSpecifiedEmail') }}</span>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 sm:py-3 border-b border-white/10 gap-1">
              <span class="text-white/60 text-xs sm:text-sm">{{ $t('account.nickname') }}</span>
              <span class="text-white/90 text-sm sm:text-base">{{ session?.user?.name || $t('account.notSpecified') }}</span>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 sm:py-3 border-b border-white/10 gap-1">
              <span class="text-white/60 text-xs sm:text-sm">{{ $t('account.provider') }}</span>
              <span class="text-white/90 text-sm sm:text-base flex items-center gap-2">
                <span :class="providerIconClass">{{ providerName }}</span>
              </span>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 sm:py-3 border-b border-white/10 gap-1">
              <span class="text-white/60 text-xs sm:text-sm">{{ $t('account.lastLogin') }}</span>
              <span class="text-white/90 text-sm sm:text-base">{{ lastLoginFormatted }}</span>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 sm:py-3 gap-1">
              <span class="text-white/60 text-xs sm:text-sm">ID</span>
              <span class="text-white/90 font-mono text-xs sm:text-sm break-all">{{ session?.user?.id || '—' }}</span>
            </div>
          </div>
        </div>

        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-white font-medium text-sm sm:text-base">{{ $t('account.languageTitle') }}</h3>
              <p class="text-white/40 text-xs mt-0.5">{{ $t('account.languageHint') }}</p>
            </div>
            <LanguageSwitcher />
          </div>
        </div>

        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-white font-medium text-sm sm:text-base">{{ $t('account.apiKeysTitle') }}</h3>
            <button
              v-if="!keyForm.open && !justCreatedKey"
              @click="keyForm.open = true"
              class="bg-emerald-300 hover:bg-emerald-200 text-black px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            >
              {{ $t('account.newKey') }}
            </button>
          </div>
          <p class="text-white/40 text-xs mb-3">{{ $t('account.apiKeysHint') }}</p>
          <div v-if="justCreatedKey" class="bg-emerald-300/[0.07] border border-emerald-300/30 rounded-xl p-3 space-y-2 mb-3">
            <p class="text-emerald-300 text-xs font-medium">{{ $t('account.createdTitle') }}</p>
            <div class="flex gap-2">
              <code class="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-emerald-200 text-xs font-mono break-all">{{ justCreatedKey }}</code>
              <button @click="copyKey" class="bg-emerald-300 hover:bg-emerald-200 text-black px-3 rounded-xl text-xs font-medium transition-all flex-shrink-0">
                {{ keyCopied ? $t('common.copied') : $t('common.copy') }}
              </button>
            </div>
            <button @click="justCreatedKey = null; loadKeys()" class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-3 py-1.5 rounded-xl text-xs transition-all">
              {{ $t('account.done') }}
            </button>
          </div>
          <div v-if="keyForm.open" class="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2.5 mb-3">
            <input v-model="keyForm.name" :placeholder="$t('account.keyNamePh')" @keyup.enter="createKey" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
            <div class="grid sm:grid-cols-2 gap-1.5">
              <div v-for="r in keyResources" :key="r.key" class="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-2.5 py-1.5">
                <span class="text-white/75 text-xs truncate">{{ r.key }}</span>
                <div class="flex gap-1">
                  <button v-for="lvl in (r.maxLevel === 2 ? [0, 1, 2] : [0, 1])" :key="lvl" type="button" @click="keyForm.levels[r.key] = lvl; if (!lvl) delete keyForm.levels[r.key]" :class="['px-2 py-1 rounded-md text-[11px] font-medium border transition-all', (keyForm.levels[r.key] || 0) === lvl ? 'bg-emerald-300 text-black border-transparent' : 'bg-black/30 text-white/50 border-white/10']">
                    {{ lvl === 0 ? '—' : lvl === 1 ? 'R' : 'W' }}
                  </button>
                </div>
              </div>
            </div>
            <div v-if="keyError" class="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{{ keyError }}</div>
            <div class="flex gap-2">
              <button @click="keyForm.open = false" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl px-4 py-2 text-xs transition-all">{{ $t('common.cancel') }}</button>
              <button @click="createKey" :disabled="keySaving || !keyForm.name.trim()" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black rounded-xl px-4 py-2 text-xs font-medium transition-all disabled:opacity-50">
                {{ keySaving ? $t('account.issuing') : $t('account.issue') }}
              </button>
            </div>
          </div>
          <div v-if="loadingKeys" class="text-center py-4">
            <div class="w-5 h-5 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
          </div>
          <div v-else-if="!apiKeys.length" class="text-white/40 text-xs text-center py-4">{{ $t('account.empty') }}</div>
          <div v-else class="space-y-1.5">
            <div v-for="k in apiKeys" :key="k.id" class="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-black/20 border border-white/5">
              <div class="min-w-0 flex-1">
                <p class="text-white/85 text-xs sm:text-sm font-medium truncate">{{ k.name }}</p>
                <p class="text-white/30 text-[11px] font-mono truncate">{{ k.prefix }}... · {{ k.scopes.join(', ') }}</p>
              </div>
              <span class="text-white/30 text-[11px] whitespace-nowrap hidden sm:block">{{ k.lastUsedAt ? $t('account.used', { v: shortLoginDate(k.lastUsedAt) }) : $t('account.neverUsed') }}</span>
              <button @click="revokeKey(k)" :title="k.name" class="text-red-400/70 hover:text-red-300 p-1 transition-colors">
                <UiIcon name="trash" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Правая колонка: пароль, входы, 2FA, выход -->
      <div class="space-y-6 min-w-0">
        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6 space-y-3">
          <div>
            <h3 class="text-white font-medium text-sm sm:text-base">{{ $t('account.passwordTitle') }}</h3>
            <p class="text-white/40 text-xs mt-0.5">{{ $t('account.passwordHint') }}</p>
          </div>
          <input
            v-model="pwCurrent"
            type="password"
            autocomplete="current-password"
            :placeholder="$t('account.currentPw')"
            class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
          />
          <div class="grid sm:grid-cols-2 gap-3">
            <input
              v-model="pwNew"
              type="password"
              autocomplete="new-password"
              :placeholder="$t('account.newPw')"
              class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
            />
            <input
              v-model="pwRepeat"
              type="password"
              autocomplete="new-password"
              :placeholder="$t('account.repeatPw')"
              @keyup.enter="savePassword"
              class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
            />
          </div>
          <div v-if="pwMessage" :class="[
            'text-sm px-3 py-2 rounded-xl border',
            pwOk ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
          ]">
            {{ pwMessage }}
          </div>
          <button
            @click="savePassword"
            :disabled="pwSaving || !pwNew"
            class="bg-emerald-300 hover:bg-emerald-200 text-black px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
          >
            {{ pwSaving ? $t('common.saving') : $t('account.changePw') }}
          </button>
        </div>

        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-white font-medium text-sm sm:text-base">{{ $t('account.loginsTitle') }}</h3>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/10">{{ logins.length }}</span>
          </div>
          <div v-if="loadingLogins" class="text-center py-6">
            <div class="w-5 h-5 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
          </div>
          <div v-else-if="!logins.length" class="text-white/40 text-xs text-center py-6">{{ $t('account.noLogins') }}</div>
          <div v-else class="space-y-1.5">
            <div
              v-for="(l, i) in logins"
              :key="l.id"
              class="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-black/20 border border-white/5"
            >
              <span :class="['w-2 h-2 rounded-full flex-shrink-0', (i === 0 && page === 1) ? 'bg-emerald-300' : 'bg-white/25']" />
              <div class="min-w-0 flex-1">
                <p class="text-white/85 text-xs sm:text-sm font-mono truncate">{{ l.ip || '—' }}</p>
                <p class="text-white/30 text-[11px] truncate">{{ l.providerName }}{{ l.userAgent ? ` · ${l.userAgent}` : '' }}</p>
              </div>
              <div class="text-right flex-shrink-0">
                <p class="text-white/50 text-[11px] whitespace-nowrap">{{ shortLoginDate(l.createdAt) }}</p>
                <p v-if="i === 0 && page === 1" class="text-emerald-300/70 text-[10px]">{{ $t('account.currentLogin') }}</p>
              </div>
            </div>
          </div>
          <div v-if="loginPageCount > 1" class="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span class="text-[11px] text-white/35">
              {{ totalLogins ? $t('common.range', { a: (page - 1) * LOGIN_PER_PAGE + 1, b: Math.min(page * LOGIN_PER_PAGE, totalLogins), c: totalLogins }) : '' }}
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
                v-for="p in loginPageNums"
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
                @click="page = Math.min(loginPageCount, page + 1)"
                :disabled="page >= loginPageCount"
                class="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/90 transition-all disabled:opacity-30 flex items-center justify-center"
              >
                <UiIcon name="chevron-right" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p class="text-white/30 text-[11px] mt-3">{{ $t('account.strangeIpHint') }}</p>
        </div>

        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-white font-medium text-sm sm:text-base">{{ $t('account.twoFaTitle') }}</h3>
            <span v-if="!loading2fa" :class="['text-[11px] px-2 py-0.5 rounded-full border', twoFa.enabled ? 'bg-emerald-300/10 text-emerald-300 border-emerald-300/25' : 'bg-white/[0.06] text-white/50 border-white/10']">
              {{ twoFa.enabled ? $t('account.twoFaOn') : $t('account.twoFaOff') }}
            </span>
          </div>
          <p class="text-white/40 text-xs mb-3">{{ $t('account.twoFaHint') }}</p>
          <div v-if="loading2fa" class="text-center py-4">
            <div class="w-5 h-5 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
          </div>
          <div v-else-if="!twoFa.enabled && !twoFa.pending" class="space-y-2.5">
            <input v-model="twoFa.password" type="password" autocomplete="current-password" :placeholder="$t('account.currentPw')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
            <div v-if="twoFa.error" class="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{{ twoFa.error }}</div>
            <button @click="start2fa" :disabled="twoFa.busy || !twoFa.password" class="bg-emerald-300 hover:bg-emerald-200 text-black px-4 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50">
              {{ twoFa.busy ? $t('common.saving') : $t('account.twoFaEnable') }}
            </button>
          </div>
          <div v-else-if="twoFa.pending" class="space-y-2.5">
            <p class="text-white/60 text-xs">{{ $t('account.twoFaScanHint') }}</p>
            <img v-if="twoFa.pending.qr" :src="twoFa.pending.qr" alt="QR" class="w-40 h-40 mx-auto rounded-xl border border-white/10 bg-white p-1" />
            <code class="block bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-emerald-200 text-xs font-mono break-all text-center">{{ twoFa.pending.secret }}</code>
            <button @click="copy2faSecret" class="text-emerald-300/80 hover:text-emerald-200 text-xs transition-colors">{{ $t('common.copy') }}</button>
            <input v-model="twoFa.token" type="text" inputmode="numeric" autocomplete="one-time-code" :placeholder="$t('login.twoFaPh')" @keyup.enter="confirm2fa" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm text-center tracking-[0.3em] placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
            <div v-if="twoFa.error" class="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{{ twoFa.error }}</div>
            <div class="flex gap-2">
              <button @click="twoFa.pending = null; twoFa.error = ''" class="flex-1 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl px-4 py-2 text-xs transition-all">{{ $t('common.cancel') }}</button>
              <button @click="confirm2fa" :disabled="twoFa.busy || !twoFa.token.trim()" class="flex-1 bg-emerald-300 hover:bg-emerald-200 text-black rounded-xl px-4 py-2 text-xs font-medium transition-all disabled:opacity-50">
                {{ twoFa.busy ? $t('common.saving') : $t('account.twoFaConfirm') }}
              </button>
            </div>
          </div>
          <div v-else-if="twoFa.codes" class="space-y-2.5">
            <p class="text-emerald-300 text-xs font-medium">{{ $t('account.twoFaCodesTitle') }}</p>
            <div class="grid grid-cols-2 gap-1.5">
              <code v-for="c in twoFa.codes" :key="c" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-white/85 text-xs font-mono text-center">{{ c }}</code>
            </div>
            <button @click="twoFa.codes = null; load2fa()" class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-4 py-2 rounded-xl text-xs transition-all">
              {{ $t('account.done') }}
            </button>
          </div>
          <div v-else class="space-y-2.5">
            <div class="flex flex-wrap gap-2">
              <button @click="twoFa.regenPw = !twoFa.regenPw; twoFa.error = ''" :disabled="twoFa.busy" class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-3 py-1.5 rounded-xl text-xs transition-all disabled:opacity-50">
                {{ $t('account.twoFaNewCodes') }}
              </button>
              <button @click="twoFa.disabling = !twoFa.disabling" class="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 px-3 py-1.5 rounded-xl text-xs transition-all">
                {{ $t('account.twoFaDisable') }}
              </button>
            </div>
            <div v-if="twoFa.disabling" class="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
              <input v-model="twoFa.password" type="password" autocomplete="current-password" :placeholder="$t('account.currentPw')" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
              <input v-model="twoFa.token" type="text" inputmode="text" autocomplete="one-time-code" :placeholder="$t('login.twoFaPh')" @keyup.enter="disable2fa" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm text-center tracking-[0.3em] placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
              <div v-if="twoFa.error" class="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{{ twoFa.error }}</div>
              <button @click="disable2fa" :disabled="twoFa.busy || !twoFa.token.trim()" class="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl px-4 py-2 text-xs font-medium transition-all disabled:opacity-50">
                {{ twoFa.busy ? $t('common.saving') : $t('account.twoFaDisableConfirm') }}
              </button>
            </div>
            <div v-if="twoFa.regenPw" class="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
              <input v-model="twoFa.password" type="password" autocomplete="current-password" :placeholder="$t('account.currentPw')" @keyup.enter="disable2fa" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-300/40" />
              <div v-if="twoFa.error" class="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{{ twoFa.error }}</div>
              <button @click="doRegen2faCodes" :disabled="twoFa.busy || !twoFa.password" class="w-full bg-emerald-300 hover:bg-emerald-200 text-black rounded-xl px-4 py-2 text-xs font-medium transition-all disabled:opacity-50">
                {{ twoFa.busy ? $t('common.saving') : $t('account.twoFaNewCodesConfirm') }}
              </button>
            </div>
          </div>
        </div>

        <div>
          <button
            @click="logout"
            class="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg px-4 py-2.5 sm:py-3 text-sm sm:text-base font-medium transition-all"
          >
            {{ $t('account.logout') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'dashboard'
})

const { data: session, signOut } = useAuth()
const { locale } = useLocale()
const { t } = useI18n()

// Инициалы для аватара
const userInitial = computed(() => {
  const name = session.value?.user?.name
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
})

// Название провайдера на русском
const providerName = computed(() => {
  const provider = session.value?.user?.provider
  const providers = {
    github: 'GitHub',
    google: 'Google',
    discord: 'Discord'
  }
  return providers[provider] || t('account.providerMail')
})

// Иконка провайдера
const providerIconClass = computed(() => {
  const provider = session.value?.user?.provider
  const classes = {
    github: 'text-gray-400',
    google: 'text-blue-400',
    discord: 'text-indigo-400'
  }
  return classes[provider] || 'text-white/60'
})

// Форматированная дата последнего входа
const lastLoginFormatted = computed(() => {
  const lastLogin = session.value?.user?.lastLogin
  if (!lastLogin) return t('account.firstLogin')

  const date = new Date(lastLogin)
  return new Intl.DateTimeFormat(locale.value || 'en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
})

const logout = async () => {
  await signOut({ callbackUrl: '/login' })
}

// Смена пароля
const pwCurrent = ref('')
const pwNew = ref('')
const pwRepeat = ref('')
const pwSaving = ref(false)
const pwMessage = ref('')
const pwOk = ref(false)

const savePassword = async () => {
  if (pwNew.value !== pwRepeat.value) {
    pwMessage.value = t('account.pwMismatch')
    pwOk.value = false
    return
  }
  pwSaving.value = true
  pwMessage.value = ''
  try {
    await $fetch('/api/account/password', {
      method: 'PUT',
      body: { currentPassword: pwCurrent.value, newPassword: pwNew.value },
    })
    pwMessage.value = t('account.pwChanged')
    pwOk.value = true
    pwCurrent.value = ''
    pwNew.value = ''
    pwRepeat.value = ''
  } catch (e) {
    pwMessage.value = e.data?.message || t('account.pwError')
    pwOk.value = false
  } finally {
    pwSaving.value = false
  }
}

// История входов с IP — по 5 на страницу.
const LOGIN_PER_PAGE = 5
const logins = ref([])
const loadingLogins = ref(false)
const page = ref(1)
const totalLogins = ref(0)
const loginPageCount = computed(() => Math.max(1, Math.ceil(totalLogins.value / LOGIN_PER_PAGE)))
const loginPageNums = computed(() => {
  const max = loginPageCount.value
  const cur = page.value
  const set = new Set([1, max, cur - 1, cur, cur + 1])
  return [...set].filter((p) => p >= 1 && p <= max).sort((a, b) => a - b)
})

const shortLoginDate = (v) => {
  if (!v) return ''
  try {
    const d = new Date(v)
    const now = new Date()
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    return d.toDateString() === now.toDateString()
      ? time
      : `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${time}`
  } catch { return '' }
}

const loadLogins = async () => {
  loadingLogins.value = true
  try {
    const res = await $fetch.raw('/api/account/logins', {
      params: { limit: LOGIN_PER_PAGE, offset: (page.value - 1) * LOGIN_PER_PAGE },
    })
    logins.value = Array.isArray(res._data) ? res._data : []
    totalLogins.value = Number(res.headers.get('x-total-count')) || logins.value.length
    if (page.value > loginPageCount.value) page.value = loginPageCount.value
  } catch {
    logins.value = []
  } finally {
    loadingLogins.value = false
  }
}

watch(page, () => loadLogins())

onMounted(() => {
  loadLogins()
  loadKeys()
  load2fa()
})

// Личные API-ключи (как Client API keys в Pterodactyl): выпуск себе,
// уровни из API_RESOURCES. Админские ресурсы не-админу не показываем
// (бэк всё равно отрежет 403).
// Личные API-ключи: только серверные ресурсы. Админские (nodes, users,
// allocations, locations, blueprints, database_hosts, server_databases)
// в аккаунте недоступны никому — их выпускает Admin → API-ключи,
// бэк отклоняет их 403 даже админу.
const keyResources = [
  { key: 'servers', maxLevel: 2 },
  { key: 'files', maxLevel: 2 },
  { key: 'backups', maxLevel: 2 },
  { key: 'databases', maxLevel: 2 },
  { key: 'ports', maxLevel: 2 },
  { key: 'startup', maxLevel: 2 },
  { key: 'server_users', maxLevel: 2 },
  { key: 'activity', maxLevel: 1 },
]

const apiKeys = ref([])
const loadingKeys = ref(false)
const keyForm = ref({ open: false, name: '', levels: {} })
const keySaving = ref(false)
const keyError = ref('')
const justCreatedKey = ref(null)
const keyCopied = ref(false)

const loadKeys = async () => {
  loadingKeys.value = true
  try {
    apiKeys.value = await $fetch('/api/account/api-keys') || []
  } catch {
    apiKeys.value = []
  } finally {
    loadingKeys.value = false
  }
}

const createKey = async () => {
  keySaving.value = true
  keyError.value = ''
  try {
    const data = await $fetch('/api/account/api-keys', {
      method: 'POST',
      body: { name: keyForm.value.name.trim(), levels: keyForm.value.levels },
    })
    justCreatedKey.value = data.token
    keyCopied.value = false
    keyForm.value = { open: false, name: '', levels: {} }
  } catch (e) {
    keyError.value = e.data?.message || t('account.issueError')
  } finally {
    keySaving.value = false
  }
}

const copyKey = async () => {
  try {
    await navigator.clipboard.writeText(justCreatedKey.value)
    keyCopied.value = true
  } catch {
    keyCopied.value = true
  }
}

const revokeKey = async (k) => {
  if (!confirm(t('account.revokeConfirm', { name: k.name }))) return
  try {
    await $fetch(`/api/account/api-keys/${k.id}`, { method: 'DELETE' })
    await loadKeys()
  } catch (e) {
    alert(e.data?.message || t('account.revokeError'))
  }
}

// 2FA (TOTP): setup → confirm → codes; disable / regenerate — по паролю.
const twoFa = ref({ enabled: false, pending: null, codes: null, password: '', token: '', error: '', busy: false, disabling: false, regenPw: false })
const loading2fa = ref(false)

const load2fa = async () => {
  loading2fa.value = true
  try {
    const res = await $fetch('/api/account/2fa')
    twoFa.value.enabled = !!res?.enabled
  } catch {
    twoFa.value.enabled = false
  } finally {
    loading2fa.value = false
  }
}

const start2fa = async () => {
  twoFa.value.busy = true
  twoFa.value.error = ''
  try {
    const res = await $fetch('/api/account/2fa/setup', {
      method: 'POST',
      body: { password: twoFa.value.password },
    })
    twoFa.value.pending = res
    twoFa.value.token = ''
    twoFa.value.password = ''
  } catch (e) {
    twoFa.value.error = e.data?.message || t('account.twoFaError')
  } finally {
    twoFa.value.busy = false
  }
}

const confirm2fa = async () => {
  twoFa.value.busy = true
  twoFa.value.error = ''
  try {
    const res = await $fetch('/api/account/2fa/enable', {
      method: 'POST',
      body: { token: twoFa.value.token.trim() },
    })
    twoFa.value.pending = null
    twoFa.value.token = ''
    twoFa.value.codes = res.backupCodes || []
    twoFa.value.enabled = true
  } catch (e) {
    twoFa.value.error = e.data?.message || t('account.twoFaError')
  } finally {
    twoFa.value.busy = false
  }
}

const disable2fa = async () => {
  twoFa.value.busy = true
  twoFa.value.error = ''
  try {
    await $fetch('/api/account/2fa/disable', {
      method: 'POST',
      body: { password: twoFa.value.password, token: twoFa.value.token.trim() },
    })
    twoFa.value = { enabled: false, pending: null, codes: null, password: '', token: '', error: '', busy: false, disabling: false, regenPw: false }
  } catch (e) {
    twoFa.value.error = e.data?.message || t('account.twoFaError')
  } finally {
    twoFa.value.busy = false
  }
}

const doRegen2faCodes = async () => {
  twoFa.value.busy = true
  twoFa.value.error = ''
  try {
    const res = await $fetch('/api/account/2fa/backup-codes', {
      method: 'POST',
      body: { password: twoFa.value.password },
    })
    twoFa.value.password = ''
    twoFa.value.regenPw = false
    twoFa.value.codes = res.backupCodes || []
  } catch (e) {
    twoFa.value.error = e.data?.message || t('account.twoFaError')
  } finally {
    twoFa.value.busy = false
  }
}

const copy2faSecret = async () => {
  try {
    await navigator.clipboard.writeText(twoFa.value.pending?.secret || '')
  } catch {}
}
</script>
