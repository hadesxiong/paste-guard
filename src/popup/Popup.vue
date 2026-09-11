<script setup lang="ts">
const openSidePanel = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab.id) {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL', tabId: tab.id })
    window.close()
  }
}
</script>

<template>
  <div class="w-64 p-4 bg-white dark:bg-gray-800">
    <div class="text-center">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        PasteGuard
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        AI对话敏感信息脱敏助手
      </p>
      <button
        @click="openSidePanel"
        class="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        打开脱敏助手
      </button>
    </div>
  </div>
</template>
