<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDetectionStore } from '../stores/detection'
import InputArea from '../components/InputArea.vue'
import DetectionList from '../components/DetectionList.vue'
import ActionBar from '../components/ActionBar.vue'

const store = useDetectionStore()
const inputText = ref('')
const isProcessing = computed(() => store.isProcessing)
const hasResults = computed(() => store.detections.length > 0)

const handleDetect = async (text: string) => {
  await store.detect(text)
}

const handleCopy = async () => {
  await store.copySanitizedText()
}

const handleClear = () => {
  store.clearAll()
  inputText.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
          PasteGuard
        </h1>
        <button
          @click="handleClear"
          class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          清空
        </button>
      </div>
    </header>

    <main class="p-4 space-y-4">
      <InputArea
        v-model="inputText"
        :is-processing="isProcessing"
        @detect="handleDetect"
      />

      <DetectionList
        v-if="hasResults"
        :detections="store.detections"
      />

      <ActionBar
        v-if="hasResults"
        @copy="handleCopy"
        @replace-all="store.replaceAll"
        @keep-all="store.keepAll"
        @clear-mapping="store.clearMapping"
      />
    </main>
  </div>
</template>
