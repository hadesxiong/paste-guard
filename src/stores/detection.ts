import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DetectionItem, ReplaceConfig, MappingTable } from '../core/types'
import { detect, preloadNER } from '../core/detector'
import { getReplacer } from '../core/replacer'

export const useDetectionStore = defineStore('detection', () => {
  // 状态
  const originalText = ref('')
  const detections = ref<DetectionItem[]>([])
  const replaceConfigs = ref<ReplaceConfig[]>([])
  const mappingTable = ref<MappingTable>({})
  const isProcessing = ref(false)
  const isNERReady = ref(false)
  const nerLoadProgress = ref(0)

  // 计算属性
  const sanitizedText = computed(() => {
    if (!originalText.value || detections.value.length === 0) {
      return originalText.value
    }

    const replacer = getReplacer()
    const { sanitizedText: result } = replacer.apply(
      originalText.value,
      detections.value,
      replaceConfigs.value
    )

    return result
  })

  const detectionCount = computed(() => detections.value.length)

  const highConfidenceCount = computed(
    () => detections.value.filter(d => d.confidence === 'high').length
  )

  // 操作
  const detectText = async (text: string) => {
    isProcessing.value = true
    originalText.value = text

    try {
      const result = await detect(text)
      detections.value = result.items

      // 初始化替换配置（默认全部替换）
      replaceConfigs.value = result.items.map(item => ({
        itemId: item.id,
        action: 'replace' as const
      }))

      // 更新映射表
      const replacer = getReplacer()
      mappingTable.value = replacer.getMappingTable()
    } catch (error) {
      console.error('Detection failed:', error)
      detections.value = []
    } finally {
      isProcessing.value = false
    }
  }

  const setReplaceAction = (
    itemId: string,
    action: 'replace' | 'keep' | 'whitelist'
  ) => {
    const config = replaceConfigs.value.find(c => c.itemId === itemId)
    if (config) {
      config.action = action
    } else {
      replaceConfigs.value.push({ itemId, action })
    }
  }

  const replaceAll = () => {
    replaceConfigs.value = detections.value.map(item => ({
      itemId: item.id,
      action: 'replace' as const
    }))
  }

  const keepAll = () => {
    replaceConfigs.value = detections.value.map(item => ({
      itemId: item.id,
      action: 'keep' as const
    }))
  }

  const clearMapping = () => {
    mappingTable.value = {}
    const replacer = getReplacer()
    replacer.clearMapping()
  }

  const clearAll = () => {
    originalText.value = ''
    detections.value = []
    replaceConfigs.value = []
    mappingTable.value = {}
  }

  const copySanitizedText = async () => {
    try {
      await navigator.clipboard.writeText(sanitizedText.value)
      return true
    } catch (error) {
      console.error('Failed to copy text:', error)
      return false
    }
  }

  // 后台预加载NER模型
  const initNER = async () => {
    try {
      // 在后台加载，不阻塞UI
      preloadNER().then(() => {
        isNERReady.value = true
      }).catch(error => {
        console.warn('NER preload failed:', error)
      })
    } catch (error) {
      console.warn('NER initialization failed:', error)
    }
  }

  return {
    // 状态
    originalText,
    detections,
    replaceConfigs,
    mappingTable,
    isProcessing,
    isNERReady,
    nerLoadProgress,

    // 计算属性
    sanitizedText,
    detectionCount,
    highConfidenceCount,

    // 操作
    detect: detectText,
    setReplaceAction,
    replaceAll,
    keepAll,
    clearMapping,
    clearAll,
    copySanitizedText,
    initNER
  }
})
