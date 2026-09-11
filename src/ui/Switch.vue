<script setup lang="ts">
import { computed } from 'vue'
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const props = defineProps<{
  modelValue?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const checked = computed({
  get: () => props.modelValue ?? false,
  set: (val: boolean) => emit('update:modelValue', val)
})
</script>

<template>
  <SwitchRoot
    v-model:checked="checked"
    :disabled="disabled"
    :class="[
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      checked
        ? 'bg-blue-500'
        : 'bg-gray-200 dark:bg-gray-700'
    ]"
  >
    <SwitchThumb
      :class="[
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
        checked ? 'translate-x-5' : 'translate-x-0.5'
      ]"
    />
  </SwitchRoot>
</template>
