<template>
  <button
    type="button"
    role="switch"
    :aria-checked="isOn"
    @click="toggle"
    :disabled="disabled"
    :title="title"
    :class="[
      'relative rounded-full transition-colors flex-shrink-0 focus:outline-none',
      small ? 'w-7 h-4' : 'w-9 h-5',
      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      isOn ? 'bg-emerald-300' : 'bg-white/20 hover:bg-white/30'
    ]"
  >
    <span :class="[
      'absolute rounded-full bg-white transition-transform shadow',
      small ? 'top-0.5 left-0.5 w-3 h-3' : 'top-0.5 left-0.5 w-4 h-4',
      isOn && (small ? 'translate-x-3' : 'translate-x-4')
    ]" />
  </button>
</template>

<script setup lang="ts">
// @ts-nocheck
// UiToggle — ползунок в стиле панели взамен нативного чекбокса.
// Поддерживает v-model с boolean и с массивом (как нативный чекбокс
// с :value), а также пару :model-value + @change для ручных хендлеров.
const props = defineProps({
  modelValue: { required: false, default: false },
  value: { required: false, default: undefined },
  disabled: { type: Boolean, default: false },
  title: { type: String, default: '' },
  small: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOn = computed(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue.includes(props.value)
  return !!props.modelValue
})

const toggle = () => {
  if (props.disabled) return
  let next
  if (Array.isArray(props.modelValue)) {
    next = props.modelValue.includes(props.value)
      ? props.modelValue.filter((v) => v !== props.value)
      : [...props.modelValue, props.value]
  } else {
    next = !props.modelValue
  }
  emit('update:modelValue', next)
  emit('change', next)
}
</script>
