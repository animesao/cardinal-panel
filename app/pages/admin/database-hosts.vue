<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white/95">{{ dbTab === 'hosts' ? $t('adminPages.dbHosts.titleHosts') : $t('adminPages.dbHosts.titleDbs') }}</h2>
        <p class="text-white/40 text-xs sm:text-sm mt-1">{{ dbTab === 'hosts' ? $t('adminPages.dbHosts.subHosts') : $t('adminPages.dbHosts.subDbs') }}</p>
      </div>
      <button
        v-if="dbTab === 'hosts' && !isCreating && !isEditing"
        @click="isCreating = true"
        class="bg-emerald-300 hover:bg-emerald-200 text-black px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all"
      >
        {{ $t('adminPages.dbHosts.newHost') }}
      </button>
    </div>

    <!-- Вкладки: хосты | базы серверов -->
    <div v-if="!isCreating && !isEditing" class="flex gap-2">
      <button
        @click="dbTab = 'hosts'"
        :class="[
          'px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all border',
          dbTab === 'hosts'
            ? 'bg-emerald-300 text-black border-transparent'
            : 'bg-white/[0.04] text-white/60 border-white/10 hover:bg-white/10 hover:text-white/80'
        ]"
      >
        {{ $t('adminPages.dbHosts.tabHosts') }}
      </button>
      <button
        @click="dbTab = 'databases'"
        :class="[
          'px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all border flex items-center gap-1.5',
          dbTab === 'databases'
            ? 'bg-emerald-300 text-black border-transparent'
            : 'bg-white/[0.04] text-white/60 border-white/10 hover:bg-white/10 hover:text-white/80'
        ]"
      >
        {{ $t('adminPages.dbHosts.tabDbs') }}
        <span
          :class="[
            'text-[11px] px-1.5 py-0.5 rounded-full',
            dbTab === 'databases' ? 'bg-black/20 text-black/70' : 'bg-white/[0.06] text-white/40'
          ]"
        >{{ serverDbs.length }}</span>
      </button>
    </div>

    <!-- Список хостов -->
    <div v-if="dbTab === 'hosts' && !isCreating && !isEditing" class="grid gap-4">
      <div
        v-for="host in hosts"
        :key="host.id"
        class="kt-lift bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4"
      >
        <div class="flex items-start justify-between">
          <div @click="editHost(host)" class="flex-1 cursor-pointer">
            <div class="flex items-center gap-2">
              <h3 class="text-white font-medium hover:text-emerald-300 transition-colors">{{ host.name }}</h3>
              <span :class="host.type === 'mysql' ? 'text-orange-400' : 'text-emerald-300'" class="text-[11px] bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.07]">
                {{ host.type.toUpperCase() }}
              </span>
              <span v-if="host.provisioning === 'container'" class="text-[11px] bg-emerald-300/15 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300/30 inline-flex items-center gap-1">
                <UiIcon name="box" class="w-3 h-3" /> {{ $t('adminPages.dbHosts.container') }}
              </span>
              <span v-else class="text-[11px] bg-white/[0.04] text-white/50 px-2 py-0.5 rounded-full border border-white/[0.07] inline-flex items-center gap-1">
                <UiIcon name="plug" class="w-3 h-3" /> {{ $t('adminPages.dbHosts.external') }}
              </span>
            </div>
            <p class="text-white/40 text-sm mt-1">{{ host.host }}:{{ host.port }}</p>
            <p class="text-white/30 text-xs mt-1">{{ $t('adminPages.dbHosts.userLine', { v: host.username }) }}</p>
            <p v-if="host.nodeName" class="text-white/30 text-xs mt-1">{{ $t('adminPages.dbHosts.storedOn', { v: host.nodeName }) }}</p>
            <p v-if="host.allowed_node_ids?.length" class="text-white/30 text-xs mt-1">{{ $t('adminPages.dbHosts.availableTo', { n: host.allowed_node_ids.length }) }}</p>
          </div>
          <button @click="deleteHost(host.id)" class="text-red-400 hover:text-red-300 p-1 flex-shrink-0 ml-4">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="hosts.length === 0 && dbTab === 'hosts'" class="text-center py-12 text-white/50 text-sm">
        {{ $t('adminPages.dbHosts.emptyHosts') }}
      </div>
    </div>

    <!-- Вкладка: базы серверов (без кредов) -->
    <div v-if="dbTab === 'databases' && !isCreating && !isEditing" class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-[200px]">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="dbSearch"
            :placeholder="$t('adminPages.dbHosts.searchPh')"
            class="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40"
          />
        </div>
        <span class="text-[11px] text-white/40 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.07]">{{ $t('admin.total') }}: {{ filteredDbs.length }}</span>
        <button
          @click="loadServerDbs()"
          class="text-xs text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 transition-all"
        >
          {{ $t('common.refresh') }}
        </button>
      </div>
      <div v-if="loadingDbs" class="text-center py-8">
        <div class="w-6 h-6 mx-auto border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin"></div>
      </div>
      <div v-else-if="filteredDbs.length === 0" class="text-center py-12 text-white/50 text-sm">
        {{ serverDbs.length ? $t('dashboard.nothingFound') : $t('adminPages.dbHosts.emptyDbs') }}
      </div>
      <div v-else class="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[560px]">
            <thead>
              <tr class="text-left text-xs text-white/35">
                <th class="font-medium py-2.5 pl-4 pr-3">{{ $t('adminPages.dbHosts.colDb') }}</th>
                <th class="font-medium py-2.5 px-3">{{ $t('adminPages.dbHosts.colServer') }}</th>
                <th class="font-medium py-2.5 px-3">{{ $t('adminPages.dbHosts.colHost') }}</th>
                <th class="font-medium py-2.5 px-3">{{ $t('adminPages.dbHosts.colCreated') }}</th>
                <th class="w-10"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in filteredDbs" :key="d.id" class="border-t border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                <td class="py-2.5 pl-4 pr-3 font-mono text-white/85">{{ d.name }}</td>
                <td class="py-2.5 px-3">
                  <NuxtLink :to="`/dashboard/server/${d.serverId}`" :title="$t('adminPages.dbHosts.serverTitle', { id: d.serverId })" class="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 transition-colors font-medium">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
                    </svg>
                    {{ d.server?.name || `#${d.serverId}` }}
                  </NuxtLink>
                </td>
                <td class="py-2.5 px-3 text-white/50 text-xs">{{ d.host?.name || '—' }}</td>
                <td class="py-2.5 px-3 text-white/40 text-xs whitespace-nowrap">{{ formatDate(d.createdAt) }}</td>
                <td class="py-2.5 pr-3">
                  <button @click="deleteServerDb(d)" :title="$t('adminPages.dbHosts.deleteDbTitle')" class="text-red-400/70 hover:text-red-300 p-1 transition-colors">
                    <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <rect width="24" height="24" fill="none"/>
                      <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14"/>
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Форма создания/редактирования -->
    <div v-if="isCreating || isEditing" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <div class="flex items-center gap-3 mb-6">
        <button @click="closeForm" class="text-white/40 hover:text-white/80">
          <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <rect width="24" height="24" fill="none"/>
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m7-7l-7 7l7 7"/>
          </svg>
        </button>
        <h3 class="text-lg font-medium text-white">
          {{ isEditing ? $t('adminPages.dbHosts.editTitle') : $t('adminPages.dbHosts.createTitle') }}
        </h3>
      </div>

      <form @submit.prevent="saveHost" class="space-y-6">
        <!-- Шаг 1: какую БД поднимаем -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="w-5 h-5 rounded-full bg-emerald-300/10 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-medium">1</span>
            <h4 class="text-white/90 text-sm font-medium">{{ $t('adminPages.dbHosts.stepDb') }}</h4>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              @click="selectDbType('mysql')"
              :class="['rounded-xl border p-4 text-left transition-all', form.type === 'mysql' ? 'bg-emerald-300/15 border-emerald-300/40' : 'bg-black/40 border-white/10 hover:bg-white/[0.06]']"
            >
              <div class="mb-2 text-orange-400"><UiIcon name="database" class="w-7 h-7" /></div>
              <div class="text-white text-sm font-medium">MySQL / MariaDB</div>
              <div class="text-white/40 text-xs mt-0.5">{{ $t('adminPages.dbHosts.mysqlPort') }}</div>
            </button>
            <button
              type="button"
              @click="selectDbType('postgresql')"
              :class="['rounded-xl border p-4 text-left transition-all', form.type === 'postgresql' ? 'bg-emerald-300/15 border-emerald-300/40' : 'bg-black/40 border-white/10 hover:bg-white/[0.06]']"
            >
              <div class="mb-2 text-emerald-300"><UiIcon name="database" class="w-7 h-7" /></div>
              <div class="text-white text-sm font-medium">PostgreSQL</div>
              <div class="text-white/40 text-xs mt-0.5">{{ $t('adminPages.dbHosts.pgPort') }}</div>
            </button>
          </div>
        </div>

        <!-- Шаг 2: режим (только при создании; у существующего не меняется) -->
        <div v-if="!isEditing">
          <div class="flex items-center gap-2 mb-3">
            <span class="w-5 h-5 rounded-full bg-emerald-300/10 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-medium">2</span>
            <h4 class="text-white/90 text-sm font-medium">{{ $t('adminPages.dbHosts.stepHow') }}</h4>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              @click="form.mode = 'container'"
              :class="['rounded-xl border p-4 text-left transition-all', form.mode === 'container' ? 'bg-emerald-300/15 border-emerald-300/40' : 'bg-black/40 border-white/10 hover:bg-white/[0.06]']"
            >
              <div class="mb-2 text-emerald-300"><UiIcon name="box" class="w-7 h-7" /></div>
              <div class="text-white text-sm font-medium">{{ $t('adminPages.dbHosts.containerName') }}</div>
              <div class="text-white/40 text-xs mt-0.5">{{ $t('adminPages.dbHosts.containerHint') }}</div>
            </button>
            <button
              type="button"
              @click="form.mode = 'external'"
              :class="['rounded-xl border p-4 text-left transition-all', form.mode === 'external' ? 'bg-emerald-300/15 border-emerald-300/40' : 'bg-black/40 border-white/10 hover:bg-white/[0.06]']"
            >
              <div class="mb-2 text-white/60"><UiIcon name="plug" class="w-7 h-7" /></div>
              <div class="text-white text-sm font-medium">{{ $t('adminPages.dbHosts.externalName') }}</div>
              <div class="text-white/40 text-xs mt-0.5">{{ $t('adminPages.dbHosts.externalHint') }}</div>
            </button>
          </div>
        </div>

        <!-- Шаг 3: подключение / развёртывание -->
        <div v-if="form.mode === 'external'">
          <div class="flex items-center gap-2 mb-3">
            <span class="w-5 h-5 rounded-full bg-emerald-300/10 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-medium">3</span>
            <h4 class="text-white/90 text-sm font-medium">{{ $t('adminPages.dbHosts.stepConn') }}</h4>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-white/70 text-xs block mb-1">{{ $t('admin.name') }} *</label>
              <input v-model="form.name" required placeholder="db-on-test4" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40 placeholder-white/25" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.dbHosts.fHost') }} *</label>
                <input v-model="form.host" required placeholder="127.0.0.1" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40 placeholder-white/25" />
              </div>
              <div>
                <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.dbHosts.fPort') }} *</label>
                <input v-model.number="form.port" type="number" required placeholder="3306" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40 placeholder-white/25" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.dbHosts.fRootUser') }} *</label>
                <input v-model="form.username" required placeholder="root" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40 placeholder-white/25" />
              </div>
              <div>
                <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.dbHosts.fRootPw') }} {{ isEditing ? $t('adminPages.dbHosts.keepPw') : '*' }}</label>
                <input v-model="form.password" type="password" :required="!isEditing" :placeholder="isEditing ? $t('adminPages.dbHosts.noChange') : ''" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40" />
              </div>
            </div>
            <p class="text-white/30 text-xs">{{ $t('adminPages.dbHosts.connHint') }}</p>
            <div class="flex items-center gap-3">
              <button type="button" @click="testConnection" :disabled="testing" class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-50 flex items-center gap-2">
                <span v-if="testing" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                {{ testing ? $t('adminPages.dbHosts.testing') : $t('adminPages.dbHosts.testConn') }}
              </button>
              <span v-if="testResult" :class="testResult.ok ? 'text-green-400' : 'text-red-400'" class="text-xs">{{ testResult.message }}</span>
            </div>
          </div>
        </div>

        <div v-else>
          <div class="flex items-center gap-2 mb-3">
            <span class="w-5 h-5 rounded-full bg-emerald-300/10 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-medium">3</span>
            <h4 class="text-white/90 text-sm font-medium">{{ $t('adminPages.dbHosts.stepDeploy') }}</h4>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-white/70 text-xs block mb-1">{{ $t('admin.name') }} *</label>
              <input v-model="form.name" required placeholder="db-on-test4" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-300/40 placeholder-white/25" />
            </div>
            <div>
              <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.dbHosts.nodeForMysql') }} *</label>
              <UiSelect
                v-model="form.node_id"
                required
                :placeholder="$t('adminPages.dbHosts.chooseNode')"
                :options="[{ value: null, label: $t('adminPages.dbHosts.chooseNode') }, ...nodes.map((node) => ({ value: node.id, label: `${node.name} (${node.url})` }))]"
              />
            </div>
            <div>
              <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.dbHosts.fRootPwMysql') }} {{ isEditing ? $t('adminPages.dbHosts.keepPw') : '*' }}</label>
              <div class="flex gap-2">
                <input v-model="form.password" type="text" :required="!isEditing" :placeholder="isEditing ? $t('adminPages.dbHosts.noChange') : ''" class="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-emerald-300/40" />
                <button type="button" @click="genRootPassword" class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-3 py-2 rounded-xl text-xs flex-shrink-0 transition-all">{{ $t('adminPages.dbHosts.generate') }}</button>
              </div>
            </div>
            <p class="text-white/30 text-xs">{{ $t('adminPages.dbHosts.autoHint') }}</p>
            <div class="flex items-center gap-3">
              <button type="button" @click="testConnection" :disabled="testing" class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-50 flex items-center gap-2">
                <span v-if="testing" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                {{ testing ? $t('adminPages.dbHosts.testing') : $t('adminPages.dbHosts.testNode') }}
              </button>
              <span v-if="testResult" :class="testResult.ok ? 'text-green-400' : 'text-red-400'" class="text-xs">{{ testResult.message }}</span>
            </div>
          </div>
        </div>

        <!-- Шаг 4: слоты для серверов -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="w-5 h-5 rounded-full bg-emerald-300/10 border border-emerald-300/30 text-emerald-300 text-[11px] flex items-center justify-center font-medium">4</span>
            <h4 class="text-white/90 text-sm font-medium">{{ $t('adminPages.dbHosts.stepSlots') }}</h4>
          </div>
          <div class="flex flex-wrap gap-2">
            <label v-for="node in nodes" :key="node.id" :class="['flex items-center gap-2 text-sm cursor-pointer border rounded-lg px-3 py-2 transition-all', (form.allowed_node_ids || []).includes(node.id) ? 'bg-emerald-300/15 border-emerald-300/40 text-white' : 'bg-black/40 border-white/10 text-white/70 hover:bg-white/[0.06]']">
              <UiToggle :model-value="(form.allowed_node_ids || []).includes(node.id)" @change="toggleAllowedNode(node.id)" small />
              <UiIcon name="monitor" class="w-4 h-4 text-white/40 flex-shrink-0" /> {{ node.name }}
            </label>
          </div>
          <p class="text-white/30 text-xs mt-1">{{ $t('adminPages.dbHosts.slotsHint') }}</p>
          <p v-if="nodes.length === 0" class="text-white/30 text-xs mt-1">{{ $t('adminPages.dbHosts.noNodes') }}</p>
        </div>

        <div class="flex gap-3 pt-4">
          <button type="button" @click="closeForm" class="px-4 py-2.5 rounded-xl text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-white/10 text-sm font-medium transition-all">
            {{ $t('admin.cancel') }}
          </button>
          <button type="submit" :disabled="saving" class="bg-emerald-300 hover:bg-emerald-200 text-black px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {{ saving ? $t('common.saving') : isEditing ? $t('admin.save') : $t('admin.create') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
const { t } = useI18n()
const hosts = ref([])
const nodes = ref([])
// Вкладки: хосты | все базы серверов (без кредов).
const dbTab = ref<'hosts' | 'databases'>('hosts')
const serverDbs = ref([])
const loadingDbs = ref(false)
const dbSearch = ref('')

const filteredDbs = computed(() => {
  const q = dbSearch.value.trim().toLowerCase()
  if (!q) return serverDbs.value
  return serverDbs.value.filter((d: any) =>
    `${d.name || ''} ${d.server?.name || ''} ${d.host?.name || ''}`.toLowerCase().includes(q)
  )
})

const loadServerDbs = async () => {
  loadingDbs.value = true
  try {
    serverDbs.value = await $fetch('/api/admin/databases') || []
  } catch {
    serverDbs.value = []
  } finally {
    loadingDbs.value = false
  }
}

const deleteServerDb = async (d: any) => {
  if (!(await confirmDialog({ message: t('adminPages.dbHosts.deleteDbConfirm', { name: d.name }), confirmText: t('admin.delete'), danger: true }))) return
  try {
    await $fetch(`/api/servers/${d.serverId}/databases/${d.id}`, { method: 'DELETE' })
    await loadServerDbs()
  } catch (e: any) {
    alert(e.data?.message || t('adminPages.dbHosts.deleteError'))
  }
}

const formatDate = (v: any) => {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '—' }
}
const isEditing = ref(false)
const isCreating = ref(false)
const editingId = ref(null)
const saving = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; message: string } | null>(null)

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  try {
    const payload: any = {
      mode: form.value.mode,
      host: form.value.host,
      port: form.value.port,
      username: form.value.username,
      password: form.value.password,
      type: form.value.type,
      node_id: form.value.node_id,
    }
    // При правке поле пароля намеренно пусто («не менять») — панель не
    // отдаёт сохранённые пароли. Без hostId сервер не сможет взять
    // сохранённый пароль и ответит 400.
    if (isEditing.value) payload.hostId = editingId.value
    const data = await $fetch('/api/admin/database-hosts/test', {
      method: 'POST',
      body: payload,
    })
    testResult.value = { ok: true, message: data?.message || t('adminPages.dbHosts.testOk') }
  } catch (e: any) {
    testResult.value = { ok: false, message: e.data?.message || t('adminPages.dbHosts.testFail') }
  } finally {
    testing.value = false
  }
}

const defaultForm = {
  mode: 'container',
  name: '',
  host: '127.0.0.1',
  port: 3306,
  type: 'mysql',
  username: 'root',
  password: '',
  node_id: null as number | null,
  allowed_node_ids: [] as number[],
}

const genRootPassword = () => {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  form.value.password = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const toggleAllowedNode = (id: number) => {
  const arr = form.value.allowed_node_ids || (form.value.allowed_node_ids = [])
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(id)
}

const selectDbType = (type: string) => {
  form.value.type = type
  if (!form.value.port || form.value.port === 3306 || form.value.port === 5432) {
    form.value.port = type === 'postgresql' ? 5432 : 3306
  }
}

const form = ref({ ...defaultForm })

const loadHosts = async () => {
  const data = await $fetch('/api/admin/database-hosts')
  hosts.value = data
}

const loadNodes = async () => {
  const data = await $fetch('/api/admin/nodes')
  nodes.value = data
}

const editHost = (host) => {
  editingId.value = host.id
  isEditing.value = true
  isCreating.value = false
  form.value = {
    mode: host.provisioning || 'external',
    name: host.name || '',
    host: host.host || '127.0.0.1',
    port: host.port || 3306,
    type: host.type || 'mysql',
    username: host.username || 'root',
    password: '',
    node_id: host.node_id || null,
    allowed_node_ids: Array.isArray(host.allowed_node_ids) ? [...host.allowed_node_ids] : [],
  }
}

const closeForm = () => {
  isEditing.value = false
  isCreating.value = false
  editingId.value = null
  testResult.value = null
  form.value = { ...defaultForm }
}

const saveHost = async () => {
  saving.value = true
  try {
    const body = { ...form.value }
    // Пустой пароль при правке = «не менять» (бэкенд тоже игнорирует '').
    if (isEditing.value && !body.password) delete body.password
    if (isEditing.value) {
      await $fetch(`/api/admin/database-hosts/${editingId.value}`, {
        method: 'PUT',
        body
      })
    } else {
      await $fetch('/api/admin/database-hosts', {
        method: 'POST',
        body
      })
    }
    closeForm()
    await loadHosts()
  } catch (e) {
    alert(e.data?.message || t('adminPages.dbHosts.saveError'))
  } finally {
    saving.value = false
  }
}

const deleteHost = async (id) => {
  if (!(await confirmDialog({ message: t('adminPages.dbHosts.deleteHostConfirm'), confirmText: t('admin.delete'), danger: true }))) return
  try {
    await $fetch(`/api/admin/database-hosts/${id}`, { method: 'DELETE' })
    await loadHosts()
  } catch (e) {
    alert(e.data?.message || t('adminPages.dbHosts.deleteError'))
  }
}

onMounted(() => {
  loadHosts()
  loadNodes()
  loadServerDbs()
})

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})
</script>
