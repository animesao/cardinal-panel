<!-- components/NoAccessModal.vue -->
<template>
  <div
    v-if="state.open"
    class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    @click.self="close"
  >
    <div class="absolute inset-0 bg-black/70 backdrop-blur-sm kt-fade-in"></div>
    <div class="kt-pop relative bg-[#1a1a1a] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm text-center">
      <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
        <svg class="w-6 h-6 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <rect width="24" height="24" fill="none"/>
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 10v11h16V10M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>
        </svg>
      </div>
      <h3 class="text-white font-medium text-base mb-1">{{ $t('noAccess.title') }}</h3>
      <p class="text-white/60 text-sm mb-1 break-words">{{ state.message }}</p>
      <p class="text-white/30 text-xs mb-4">{{ $t('noAccess.hint') }}</p>
      <button
        @click="close"
        class="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-6 py-2 rounded-lg text-sm font-medium transition-all"
      >
        {{ $t('noAccess.ok') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { state, close } = useNoAccess()
</script>
