<template>
  <div class="min-h-screen bg-black text-white flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold mb-4">{{ panelName }}</h1>
      <div class="flex items-center justify-center gap-3">
        <NuxtLink to="/dashboard" class="bg-emerald-300 text-black px-6 py-3 rounded-xl font-semibold hover:bg-emerald-200 transition-colors">
          {{ $t('landing.enter') }}
        </NuxtLink>
        <LanguageSwitcher />
      </div>
    </div>
  </div>
</template>

<script setup>
const { panelName, usePanelTitle } = usePanelName()
usePanelTitle()
</script>