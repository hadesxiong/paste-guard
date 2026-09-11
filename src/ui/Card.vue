<script setup lang="ts">
interface Props {
    padding?: boolean
    hover?: boolean
}

withDefaults(defineProps<Props>(), {
    padding: true,
    hover: false
})
</script>

<template>
    <div :class="[
        'bg-white dark:bg-gray-800 rounded-sm border border-gray-200 dark:border-gray-700',
        'shadow-xs transition-all duration-200',
        hover && 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600',
        padding && 'px-3 py-3']">
        <slot></slot>
    </div>
</template>
