<script setup lang="ts">
import { ref } from 'vue'
import { useDetectionStore } from '../stores/detection'

const emit = defineEmits<{
  (e: 'copy'): void
  (e: 'replaceAll'): void
  (e: 'keepAll'): void
  (e: 'clearMapping'): void
}>()

const store = useDetectionStore()
const copySuccess = ref(false)

// 复制脱敏文本
const handleCopy = async () => {
  const success = await store.copySanitizedText()
  if (success) {
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  }
  emit('copy')
}

// 全部替换
const handleReplaceAll = () => {
  store.replaceAll()
  emit('replaceAll')
}

// 全部保留
const handleKeepAll = () => {
  store.keepAll()
  emit('keepAll')
}

// 清空映射表
const handleClearMapping = () => {
  store.clearMapping()
  emit('clearMapping')
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
    <div class="flex flex-wrap gap-2">
      <!-- 复制脱敏文本 -->
      <button
        @click="handleCopy"
        class="flex-1 min-w-[120px] bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {{ copySuccess ? '已复制!' : '复制脱敏文本' }}
      </button>

      <!-- 全部替换 -->
      <button
        @click="handleReplaceAll"
        class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
      >
        全部替换
      </button>

      <!-- 全部保留 -->
      <button
        @click="handleKeepAll"
        class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
      >
        全部保留
      </button>

      <!-- 清空映射表 -->
      <button
        @click="handleClearMapping"
        class="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
      >
        清空映射表
      </button>
    </div>
  </div>
</template>
