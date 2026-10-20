<template>
  <div class="space-y-4">
    <!-- Заголовок -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white/95">{{ $t('admin.blueprints') }}</h2>
        <p class="text-white/40 text-xs sm:text-sm mt-1">{{ $t('adminPages.blueprints.subtitle') }}</p>
      </div>
      <button
        v-if="!isEditing && !isCreating && !isImporting"
        @click="isImporting = true"
        class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all inline-flex items-center gap-1.5"
      >
        <UiIcon name="download" class="w-3.5 h-3.5" /> {{ $t('adminPages.blueprints.importEgg') }}
      </button>
      <button
        v-if="!isEditing && !isCreating && !isImporting"
        @click="isCreating = true; isEditing = false"
        class="bg-emerald-300 hover:bg-emerald-200 text-black px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all"
      >
        {{ $t('adminPages.blueprints.newBp') }}
      </button>
    </div>

    <!-- Список чертежей -->
    <div v-if="!isEditing && !isCreating && !isImporting" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="blueprint in blueprints"
        :key="blueprint.id"
        class="kt-lift bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex flex-col"
      >
        <div @click="editBlueprint(blueprint)" class="flex-1 cursor-pointer">
          <h3 class="text-white font-medium hover:text-emerald-300 transition-colors">{{ blueprint.name }}</h3>
          <p class="text-white/40 text-sm mt-1 line-clamp-2">{{ blueprint.description || $t('adminPages.blueprints.noDesc') }}</p>
          <div class="flex items-center gap-4 mt-3 text-xs text-white/30">
            <span class="truncate">{{ blueprint.image }}</span>
          </div>
          <div class="flex items-center gap-2 mt-1.5 text-[11px] text-white/40">
            <span class="bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.07] inline-flex items-center gap-1"><UiIcon name="image" class="w-3 h-3" /> {{ $t('adminPages.blueprints.images', { n: (blueprint.images || []).length || 1 }) }}</span>
            <span class="bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.07] inline-flex items-center gap-1"><UiIcon name="gear" class="w-3 h-3" /> {{ $t('adminPages.blueprints.vars', { n: (blueprint.variables || []).length }) }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
          <span v-if="blueprint.install_script" class="text-xs text-green-400/60">{{ $t('adminPages.blueprints.hasScript') }}</span>
          <span v-else class="text-xs text-white/20">{{ $t('adminPages.blueprints.noScript') }}</span>
          <button @click="deleteBp(blueprint.id)" class="text-red-400 hover:text-red-300 p-1">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="none"/>
              <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="blueprints.length === 0" class="col-span-full text-center py-12 text-white/50 text-sm">
        {{ $t('adminPages.blueprints.empty') }}
      </div>
    </div>

    <!-- Импорт яйца Pterodactyl -->
    <div v-if="isImporting" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <div class="flex items-center gap-3 mb-4">
        <button @click="closeImport" class="text-white/40 hover:text-white/80">
          <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m7-7l-7 7l7 7"/></svg>
        </button>
        <h3 class="text-lg font-medium text-white">{{ $t('adminPages.blueprints.importTitle') }}</h3>
      </div>
      <p class="text-white/40 text-xs sm:text-sm mb-3">{{ $t('adminPages.blueprints.importHint') }}</p>
      <textarea v-model="importText" rows="8" placeholder='{"name": "...", "images": [...], "variables": [...]}' class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40 text-xs font-mono mb-3"></textarea>
      <div class="flex flex-wrap items-center gap-3">
        <label class="bg-white/[0.04] hover:bg-white/10 text-white/70 border border-white/10 px-4 py-2 rounded-xl text-sm cursor-pointer transition-all">
          {{ $t('adminPages.blueprints.chooseFile') }}
          <input type="file" accept=".json,application/json" @change="onImportFile" class="hidden" />
        </label>
        <button @click="doImport" :disabled="importing || !importText.trim()" class="bg-emerald-300 hover:bg-emerald-200 text-black px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
          {{ importing ? $t('adminPages.blueprints.importing') : $t('adminPages.blueprints.doImport') }}
        </button>
        <button @click="closeImport" class="text-white/40 hover:text-white/70 text-sm px-2">{{ $t('admin.cancel') }}</button>
      </div>
      <div v-if="importMessage" :class="['text-sm p-3 rounded-lg mt-3', importOk ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30']">
        {{ importMessage }}
      </div>
    </div>

    <!-- Форма создания/редактирования -->
    <div v-if="isEditing || isCreating" class="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <div class="flex items-center gap-3 mb-6">
        <button @click="closeForm" class="text-white/40 hover:text-white/80">
          <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <rect width="24" height="24" fill="none"/>
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m7-7l-7 7l7 7"/>
          </svg>
        </button>
        <h3 class="text-lg font-medium text-white">
          {{ isEditing ? $t('adminPages.blueprints.editTitle') : $t('adminPages.blueprints.createTitle') }}
        </h3>
      </div>

      <form @submit.prevent="saveBlueprint" class="space-y-4">
        <div>
          <label class="text-white/70 text-xs block mb-1">{{ $t('admin.name') }} *</label>
          <input v-model="form.name" required class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40 text-sm" />
        </div>

        <div>
          <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.blueprints.fDesc') }}</label>
          <textarea v-model="form.description" rows="3" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40 text-sm"></textarea>
        </div>

        <div>
          <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.blueprints.fImage') }}</label>
          <input v-model="form.image" required class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40 text-sm" />
        </div>

        <div>
          <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.blueprints.fImages') }}</label>
          <textarea v-model="form.images_text" rows="3" placeholder="ghcr.io/pterodactyl/yolks:java_17&#10;ghcr.io/pterodactyl/yolks:java_21" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40 text-sm font-mono"></textarea>
        </div>

        <div>
          <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.blueprints.fStartup') }}</label>
          <input v-model="form.startup_command" required class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40 text-sm" />
        </div>

        <div>
          <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.blueprints.fEnv') }}</label>
          <textarea v-model="form.environment" rows="4" placeholder='{"SERVER_JARFILE": "server.jar", "VERSION": "latest"}' class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40 text-sm font-mono"></textarea>
        </div>

        <div>
          <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.blueprints.fVars') }}</label>
          <textarea v-model="form.variables_text" rows="6" placeholder='[{"name": "Version", "env_variable": "VERSION", "default_value": "latest", "user_editable": true, "rules": "required|string"}]' class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40 text-sm font-mono"></textarea>
        </div>

        <div>
          <label class="text-white/70 text-xs block mb-1">{{ $t('adminPages.blueprints.fScript') }}</label>
          <textarea v-model="form.install_script" rows="8" placeholder="#!/bin/bash&#10;echo 'Installing...'" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 focus:outline-none focus:border-emerald-300/40 text-sm font-mono"></textarea>
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
const blueprints = ref([])
const isEditing = ref(false)
const isCreating = ref(false)
const editingId = ref(null)
const saving = ref(false)

const defaultForm = {
  name: '',
  description: '',
  image: 'ghcr.io/pterodactyl/yolks:java_17',
  images_text: '',
  startup_command: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
  environment: '{"SERVER_JARFILE": "server.jar"}',
  variables_text: '',
  install_script: '',
}

const form = ref({ ...defaultForm })

// ==================== ИМПОРТ ЯЙЦА ====================
const isImporting = ref(false)
const importText = ref('')
const importing = ref(false)
const importMessage = ref('')
const importOk = ref(false)

const closeImport = () => {
  isImporting.value = false
  importText.value = ''
  importMessage.value = ''
}

const onImportFile = async (event) => {
  const file = event.target?.files?.[0]
  if (!file) return
  importText.value = await file.text()
  event.target.value = ''
}

const doImport = async () => {
  importing.value = true
  importMessage.value = ''
  importOk.value = false
  try {
    let egg
    try {
      egg = JSON.parse(importText.value)
    } catch {
      throw new Error(t('adminPages.blueprints.invalidJson'))
    }
    const data = await $fetch('/api/admin/blueprints/import', { method: 'POST', body: { egg } })
    importOk.value = true
    importMessage.value = t('adminPages.blueprints.imported', { name: data?.blueprint?.name || '', images: data?.images || 0, vars: data?.variables || 0 })
    closeForm()
    await loadBlueprints()
    setTimeout(closeImport, 1200)
  } catch (e) {
    importMessage.value = e.data?.message || e.message || t('adminPages.blueprints.importError')
  } finally {
    importing.value = false
  }
}

const loadBlueprints = async () => {
  const data = await $fetch('/api/admin/blueprints')
  blueprints.value = data
}

const editBlueprint = (bp) => {
  editingId.value = bp.id
  isEditing.value = true
  isCreating.value = false
  form.value = {
    name: bp.name || '',
    description: bp.description || '',
    image: bp.image || '',
    images_text: (bp.images || []).join('\n'),
    startup_command: bp.startup_command || '',
    environment: bp.environment || '{}',
    variables_text: (bp.variables || []).length ? JSON.stringify(bp.variables, null, 2) : '',
    install_script: bp.install_script || '',
  }
}

const closeForm = () => {
  isEditing.value = false
  isCreating.value = false
  editingId.value = null
  form.value = { ...defaultForm }
}

const saveBlueprint = async () => {
  saving.value = true
  try {
    if (isEditing.value) {
      await $fetch(`/api/admin/blueprints/${editingId.value}`, {
        method: 'PUT',
        body: form.value
      })
    } else {
      await $fetch('/api/admin/blueprints', {
        method: 'POST',
        body: form.value
      })
    }
    closeForm()
    await loadBlueprints()
  } catch (e) {
    alert(t('adminPages.blueprints.saveError'))
  } finally {
    saving.value = false
  }
}

const deleteBp = async (id) => {
  if (!(await confirmDialog({ message: t('adminPages.blueprints.deleteConfirm'), confirmText: t('admin.delete'), danger: true }))) return
  try {
    await $fetch(`/api/admin/blueprints/${id}`, { method: 'DELETE' })
    await loadBlueprints()
  } catch (e) {
    alert(t('adminPages.blueprints.deleteError'))
  }
}

onMounted(() => {
  loadBlueprints()
})

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
})
</script>
