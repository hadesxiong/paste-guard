<script setup lang="ts">
import { computed } from 'vue'
import { Primitive, type PrimitiveProps } from 'reka-ui'

interface Props extends PrimitiveProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'disabled'
  btnType?: 'normal' | 'outline' | 'text'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  variant: 'primary',
  btnType: 'normal',
  size: 'md',
  loading: false,
  disabled: false
})

defineEmits<{ (e: 'click', value: MouseEvent): void }>()

const variantClasses = computed(() => {
  if (props.variant === 'disabled') {
    return 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-transparent'
  }

  const colors = {
    primary: {
      normal: 'bg-blue-500 text-white hover:bg-blue-600 focus-visible:ring-blue-500 shadow-sm',
      outline: 'bg-transparent text-blue-500 dark:text-blue-400 border-blue-500 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus-visible:ring-blue-500',
      text: 'bg-transparent text-blue-500 dark:text-blue-400 hover:text-blue-800 dark:text-blue-200 focus-visible:ring-blue-500 shadow-none'
    },
    secondary: {
      normal: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 focus-visible:ring-gray-500 shadow-sm',
      outline: 'bg-transparent text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:ring-gray-500',
      text: 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus-visible:ring-gray-500 shadow-none'
    },
    danger: {
      normal: 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500 shadow-sm',
      outline: 'bg-transparent text-red-500 dark:text-red-400 border-red-500 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus-visible:ring-red-500',
      text: 'bg-transparent text-red-500 dark:text-red-400 hover:text-red-800 dark:text:bg-red-200 focus-visible:ring-red-500 shadow-none'
    }
  }

  return colors[props.variant][props.btnType]
})

const typeClasses = computed(() => {
  if (props.btnType === 'outline') {
    return 'border'
  }
  return 'border border-transparent'
})

const sizeClasses = computed(() => {
  if (props.btnType === 'text') {
    return {
      sm: 'h-auto px-0 py-0 text-xs gap-1',
      md: 'h-auto px-0 py-0 text-sm gap-1.5',
      lg: 'h-auto px-0 py-0 text-base gap-2'
    }[props.size]
  }
  return {
    sm: 'h-8 px-3 text-xs rounded-sm gap-1.5',
    md: 'h-auto px-3 py-1.5 text-sm rounded-sm gap-2',
    lg: 'h-12 px-6 text-base rounded-sm gap-2.5'
  }[props.size]
})
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="[
      'inline-flex items-center justify-center font-medium transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'active:scale-[0.98]',
      variantClasses,
      typeClasses,
      sizeClasses
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <svg
      v-if="loading"
      class="animate-spin -ml-1 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24">
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"/>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
    <slot />
  </Primitive>
</template>
