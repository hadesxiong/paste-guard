<script setup lang="ts">
import { computed } from 'vue'
import type { DetectionItem, DetectionType, ReplaceAction } from '../core/types'
import { useDetectionStore } from '../stores/detection'
import { getPlaceholderDisplayText } from '../core/replacer/placeholder'

const props = defineProps<{
  item: DetectionItem
}>()

const store = useDetectionStore()

// 获取当前配置
const currentConfig = computed(() => {
  return store.replaceConfigs.find(c => c.itemId === props.item.id)
})

// 当前操作
const currentAction = computed<ReplaceAction>(() => {
  return currentConfig.value?.action || 'replace'
})

// 置信度颜色
const confidenceColor = computed(() => {
  switch (props.item.confidence) {
    case 'high':
      return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30'
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30'
    case 'low':
      return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
    default:
      return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/30'
  }
})

// 类型显示名称
const typeNames: Record<DetectionType, string> = {
  ENV_PASSWORD: '环境变量',
  API_KEY: 'API Key',
  DB_PASSWORD: '数据库密码',
  JWT: 'JWT',
  PRIVATE_KEY: '私钥',
  HIGH_ENTROPY: '高熵字符串'
}

// 获取检测类型显示文本
const detectionTypesDisplay = computed(() => {
  const types = props.item.detectionTypes || [props.item.type]
  return types.map(t => typeNames[t]).join(' + ')
})

// 截断显示文本
const truncate = (str: string, maxLength: number = 30): string => {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

// 设置操作
const setAction = (action: ReplaceAction) => {
  store.setReplaceAction(props.item.id, action)
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <!-- 类型和置信度 -->
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ detectionTypesDisplay }}
          </span>
          <span
            :class="[
              'text-xs px-2 py-0.5 rounded-full font-medium',
              confidenceColor
            ]"
          >
            {{ item.confidence === 'high' ? '高' : item.confidence === 'medium' ? '中' : '低' }}
          </span>
        </div>

        <!-- 原文 -->
        <div class="mb-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">原文:</span>
          <p class="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
            {{ truncate(item.original) }}
          </p>
        </div>

        <!-- 占位符 -->
        <div class="mb-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">替换为:</span>
          <p class="text-sm font-mono text-blue-600 dark:text-blue-400">
            {{ getPlaceholderDisplayText(item.placeholder) }}
          </p>
        </div>

        <!-- 上下文 -->
        <div v-if="item.context" class="text-xs text-gray-400 dark:text-gray-500 truncate">
          {{ truncate(item.context, 50) }}
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex flex-col gap-1">
        <button
          @click="setAction('replace')"
          :class="[
            'px-2 py-1 text-xs rounded transition-colors',
            currentAction === 'replace'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          ]"
        >
          替换
        </button>
        <button
          @click="setAction('keep')"
          :class="[
            'px-2 py-1 text-xs rounded transition-colors',
            currentAction === 'keep'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          ]"
        >
          保留
        </button>
        <button
          @click="setAction('whitelist')"
          :class="[
            'px-2 py-1 text-xs rounded transition-colors',
            currentAction === 'whitelist'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          ]"
        >
          白名单
        </button>
      </div>
    </div>
  </div>
</template>
