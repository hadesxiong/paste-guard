<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'sm'
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'warning':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'danger':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'info':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-2 py-1 text-xs'
    case 'md':
      return 'px-2.5 py-1.5 text-sm'
    default:
      return ''
  }
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center font-medium rounded-sm transition-colors',
      variantClasses,
      sizeClasses
    ]"
  >
    <slot />
  </span>
</template>
