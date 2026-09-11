<script setup lang="ts">
import { computed } from 'vue'
import { useVModel } from '@vueuse/core'

interface Props {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  error?: boolean
  type?: 'text' | 'password' | 'email' | 'number'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  disabled: false,
  error: false,
  type: 'text'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const modelValue = useVModel(props, 'modelValue', emit)

const inputClasses = computed(() => [
  'w-full px-4 py-2.5 text-sm rounded-lg transition-all duration-200',
  'bg-gray-50 dark:bg-gray-900 border',
  'text-gray-900 dark:text-gray-100',
  'placeholder-gray-400 dark:placeholder-gray-500',
  'focus:outline-none focus:ring-2 focus:ring-offset-0',
  props.error
    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
    : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500 focus:border-blue-500',
  props.disabled && 'opacity-50 cursor-not-allowed'
])
</script>

<template>
  <input
    v-model="modelValue"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="inputClasses"
  />
</template>
