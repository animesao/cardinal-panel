<template>
  <div class="relative" v-click-outside="close">
    <button
      type="button"
      @click="open = !open"
      :title="$t('common.language')"
      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60 hover:text-white/90 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <span class="font-medium uppercase">{{ locale }}</span>
      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <div
      v-if="open"
      class="kt-menu absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden z-[60] min-w-[160px] max-h-72 overflow-y-auto"
    >
      <button
        v-for="l in LANGS"
        :key="l.code"
        type="button"
        @click="pick(l.code)"
        :class="[
          'w-full text-left px-3.5 py-2 text-xs hover:bg-white/10 transition-all flex items-center justify-between gap-2',
          locale === l.code ? 'bg-emerald-300/15 text-emerald-300' : 'text-white/80'
        ]"
      >
        <span>{{ l.native }}</span>
        <svg v-if="locale === l.code" class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
// LanguageSwitcher — выбор языка панели (10 языков).
// Пишет в БД через useLocale, панель перестраивается мгновенно.
const { locale, setLocale, LANGS } = useLocale()
const open = ref(false)
const close = () => { open.value = false }
const pick = async (code: string) => {
  open.value = false
  await setLocale(code)
}

const vClickOutside = {
  mounted(el: any, binding: any) {
    el.clickOutsideEvent = (event: Event) => {
      if (!(el === event.target || el.contains(event.target))) binding.value()
    }
    document.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el: any) { document.removeEventListener('click', el.clickOutsideEvent) }
}
</script>
