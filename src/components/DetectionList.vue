<script setup lang="ts">
import { computed } from 'vue'
import type { DetectionItem } from '../core/types'
import DetectionItemComponent from './DetectionItem.vue'

const props = defineProps<{
  detections: DetectionItem[]
}>()

// 按类型分组
const groupedDetections = computed(() => {
  const groups: Record<string, DetectionItem[]> = {}

  for (const item of props.detections) {
    if (!groups[item.type]) {
      groups[item.type] = []
    }
    groups[item.type].push(item)
  }

  return groups
})

// 类型显示名称
const typeNames: Record<string, string> = {
  ENV_PASSWORD: '环境变量密码',
  API_KEY: 'API Key',
  DB_PASSWORD: '数据库密码',
  JWT: 'JWT Token',
  PRIVATE_KEY: '私钥',
  HIGH_ENTROPY: '高熵字符串'
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-medium text-gray-700 dark:text-gray-300">
        识别结果 ({{ detections.length }})
      </h2>
    </div>

    <div v-if="detections.length === 0" class="text-center py-8">
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        未检测到敏感信息
      </p>
    </div>

    <div v-else class="space-y-3">
      <div v-for="(items, type) in groupedDetections" :key="type" class="space-y-2">
        <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {{ typeNames[type as string] || type }} ({{ items.length }})
        </h3>

        <DetectionItemComponent
          v-for="item in items"
          :key="item.id"
          :item="item"
        />
      </div>
    </div>
  </div>
</template>
