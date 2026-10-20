<template>
  <div
    v-if="state.open"
    class="fixed inset-0 z-[90] flex items-center justify-center p-4"
    @click.self="closeConfirm(false)"
    @keydown.esc="closeConfirm(false)"
  >
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm kt-fade-in"></div>
    <div class="kt-pop relative bg-[#12141b] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/60">
      <h3 class="text-lg font-bold text-white/95 mb-2">{{ state.title }}</h3>
      <p class="text-sm text-white/60 leading-relaxed">{{ state.message }}</p>
      <div class="flex gap-3 mt-5">
        <button
          @click="closeConfirm(false)"
          class="flex-1 bg-white/[0.05] hover:bg-white/10 text-white/70 hover:text-white/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
        >
          {{ state.cancelText }}
        </button>
        <button
          ref="confirmBtn"
          @click="closeConfirm(true)"
          :class="[
            'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
            state.danger
              ? 'bg-red-500 hover:bg-red-400 text-white'
              : 'bg-emerald-300 hover:bg-emerald-200 text-black'
          ]"
        >
          {{ state.confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
const state = useConfirmState()
const confirmBtn = ref(null)

watch(() => state.value.open, (open) => {
  if (open) nextTick(() => confirmBtn.value?.focus())
})
</script>
