<template>
  <div ref="root" class="relative" :class="disabled && 'opacity-50 pointer-events-none'">
    <button
      ref="btn"
      type="button"
      @click="toggle"
      @keydown="onKeydown"
      :disabled="disabled"
      :class="[
        'w-full flex items-center justify-between gap-2 bg-black/30 border rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-left transition-colors hover:border-white/25 focus:outline-none focus:border-emerald-300/50',
        open ? 'border-emerald-300/50 text-white' : hasValue ? 'border-white/10 text-white' : 'border-white/10 text-white/30',
        mono && 'font-mono'
      ]"
    >
      <span class="truncate">{{ currentLabel }}</span>
      <svg
        :class="['w-4 h-4 flex-shrink-0 text-white/40 transition-transform', open && 'rotate-180']"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    <Teleport to="body">
      <ul
        v-if="open"
        ref="popup"
        data-uiselect-popup
        :style="popupStyle"
        class="kt-menu fixed z-[100] max-h-56 overflow-y-auto rounded-lg border border-white/15 bg-[#161616] shadow-xl shadow-black/50 py-1"
      >
        <li v-for="opt in normOptions" :key="String(opt.value)">
          <button
            type="button"
            @click="pick(opt.value)"
            :class="[
              'w-full text-left px-3 py-2 text-sm truncate transition-colors flex items-center gap-2',
              mono && 'font-mono',
              isSelected(opt) ? 'bg-emerald-300/20 text-emerald-300' : 'text-white/75 hover:bg-white/10 hover:text-white'
            ]"
          >
            <svg v-if="isSelected(opt)" class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span v-else class="w-3.5 flex-shrink-0" />
            <span class="truncate">{{ opt.label }}</span>
          </button>
        </li>
        <li v-if="!normOptions.length" class="px-3 py-2 text-sm text-white/30">{{ $t('dashboard.nothingFound') }}</li>
      </ul>
    </Teleport>
    <!-- Скрытый нативный селект: сохраняет required-валидацию форм.
         Валидность зеркалит hasValue, клики до него не долетают. -->
    <select
      v-if="required"
      :value="hasValue ? '1' : ''"
      required
      tabindex="-1"
      aria-hidden="true"
      class="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
    >
      <option value="">—</option>
      <option value="1">—</option>
    </select>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
// UiSelect — тёмный дропдаун в стиле панели взамен нативного <select>,
// чей белый popup выбивается из темы. API: v-model + options
// ([{value, label}] или строки) + placeholder/disabled/required/mono.
const props = defineProps({
  modelValue: { required: false, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  mono: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])
const { t } = useI18n()

const root = ref(null)
const btn = ref(null)
const popup = ref(null)
const open = ref(false)
const popupStyle = ref({})

const normOptions = computed(() => (props.options || []).map((o) =>
  (o !== null && typeof o === 'object' && 'value' in o) ? o : { value: o, label: String(o) }
))

const matched = computed(() => normOptions.value.find((o) => o.value === props.modelValue))

const hasValue = computed(() => {
  const m = matched.value
  if (!m) return props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined
  return m.value !== '' && m.value !== null && m.value !== undefined
})

const currentLabel = computed(() => matched.value ? matched.value.label : (props.placeholder || t('common.select')))
const isSelected = (opt) => opt.value === props.modelValue

const pick = (value) => {
  emit('update:modelValue', value)
  emit('change', value)
  close()
}

const toggle = () => { open.value ? close() : openPopup() }
const openPopup = async () => {
  if (props.disabled) return
  open.value = true
  await nextTick()
  placePopup()
}

// Попап живёт в body (не режется overflow-hidden родителей) — позицию
// считаем от кнопки: вниз, а если места нет — вверх с урезкой высоты.
const placePopup = () => {
  const el = btn.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const width = Math.max(r.width, 160)
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
  const gap = 6
  const maxH = 224
  const below = window.innerHeight - r.bottom - gap - 8
  if (below >= 140 || below >= r.top) {
    popupStyle.value = {
      left: left + 'px',
      top: (r.bottom + gap) + 'px',
      width: width + 'px',
      maxHeight: Math.max(120, Math.min(maxH, below)) + 'px',
    }
  } else {
    const h = Math.max(120, Math.min(maxH, r.top - gap - 8))
    popupStyle.value = {
      left: left + 'px',
      top: (r.top - gap - h) + 'px',
      width: width + 'px',
      maxHeight: h + 'px',
    }
  }
}

const onReposition = () => { if (open.value) placePopup() }
const close = () => { open.value = false }

const onClickOutside = (e) => {
  if (root.value && !root.value.contains(e.target)) close()
}

const onFocusOut = (e) => {
  // mousedown по пункту меню уводит фокус с кнопки раньше клика —
  // закрывать при этом нельзя, иначе клик умрёт вместе с попапом.
  const t = e.relatedTarget
  if (t && (root.value?.contains(t) || t.closest?.('[data-uiselect-popup]'))) return
  close()
}

const onKeydown = (e) => {
  if (e.key === 'Escape') close()
  else if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') && !open.value) {
    e.preventDefault()
    openPopup()
  }
}

watch(open, (v) => {
  if (v) {
    document.addEventListener('click', onClickOutside)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    root.value?.addEventListener('focusout', onFocusOut)
  } else {
    document.removeEventListener('click', onClickOutside)
    window.removeEventListener('resize', onReposition)
    window.removeEventListener('scroll', onReposition, true)
    root.value?.removeEventListener('focusout', onFocusOut)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  window.removeEventListener('resize', onReposition)
  window.removeEventListener('scroll', onReposition, true)
  root.value?.removeEventListener('focusout', onFocusOut)
})
</script>
