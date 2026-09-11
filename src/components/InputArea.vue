<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  isProcessing: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'detect', text: string): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const localText = ref(props.modelValue)

// 防抖计时器
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// 监听外部值变化
watch(
  () => props.modelValue,
  (newVal) => {
    localText.value = newVal
  }
)

// 监听本地值变化（防抖300ms后自动检测）
watch(localText, (newVal) => {
  emit('update:modelValue', newVal)

  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  if (newVal.trim()) {
    debounceTimer = setTimeout(() => {
      emit('detect', newVal)
    }, 300)
  }
})

// 手动检测
const handleDetect = () => {
  if (localText.value.trim()) {
    emit('detect', localText.value)
  }
}

// 清空
const handleClear = () => {
  localText.value = ''
  emit('update:modelValue', '')
}

// 粘贴处理
const handlePaste = (_event: ClipboardEvent) => {
  // 允许默认粘贴行为，然后自动检测
  setTimeout(() => {
    if (textareaRef.value) {
      localText.value = textareaRef.value.value
    }
  }, 0)
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-3 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          输入文本
        </label>
        <button
          v-if="localText"
          @click="handleClear"
          class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          清空
        </button>
      </div>
    </div>

    <div class="p-3">
      <textarea
        ref="textareaRef"
        v-model="localText"
        @paste="handlePaste"
        placeholder="粘贴或输入包含敏感信息的文本..."
        class="w-full h-40 p-3 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
        :disabled="isProcessing"
      ></textarea>
    </div>

    <div class="p-3 border-t border-gray-200 dark:border-gray-700">
      <button
        @click="handleDetect"
        :disabled="!localText.trim() || isProcessing"
        class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
      >
        {{ isProcessing ? '检测中...' : '检测' }}
      </button>
    </div>
  </div>
</template>
