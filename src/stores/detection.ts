import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DetectionItem, ReplaceConfig, MappingTable } from '../core/types'
import { detect, preloadNER } from '../core/detector'
import { getReplacer } from '../core/replacer'

// NER 模型状态类型
type NERStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout' | 'disabled'

// 检测引擎状态
interface DetectionEngineStatus {
  regexRules: boolean      // 正则规则是否生效
  semanticRules: boolean   // 语义规则是否生效
  nerModel: boolean        // NER模型是否生效
  connectionStringParser: boolean  // 连接串解析是否生效
}

export const useDetectionStore = defineStore('detection', () => {
  // 状态
  const originalText = ref('')
  const detections = ref<DetectionItem[]>([])
  const replaceConfigs = ref<ReplaceConfig[]>([])
  const mappingTable = ref<MappingTable>({})
  const isProcessing = ref(false)

  // NER 模型状态
  const nerStatus = ref<NERStatus>('disabled') // [NER-disabled] 与 enableNER 配置同步
  const nerLoadProgress = ref(0)
  const nerError = ref<string | null>(null)

  // 检测引擎状态
  const engineStatus = ref<DetectionEngineStatus>({
    regexRules: true,
    semanticRules: true,
    nerModel: false,
    connectionStringParser: true
  })

  // 计算属性
  const isNERReady = computed(() => nerStatus.value === 'success')

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

    console.log('[PasteGuard] Starting detection for text:', text.substring(0, 100) + '...')

    try {
      const result = await detect(text)
      detections.value = result.items

      console.log('[PasteGuard] Detection completed. Found', result.items.length, 'items:')

      // 初始化替换配置（默认全部替换）
      replaceConfigs.value = result.items.map(item => ({
        itemId: item.id,
        action: 'replace' as const
      }))

      // 更新映射表
      const replacer = getReplacer()
      mappingTable.value = replacer.getMappingTable()

      console.log('[PasteGuard] Mapping table updated:', mappingTable.value)
    } catch (error) {
      console.error('[PasteGuard] Detection failed:', error)
      detections.value = []
    } finally {
      isProcessing.value = false
    }
  }

  const setReplaceAction = (
    itemId: string,
    action: 'replace' | 'keep'
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
      console.log('[PasteGuard] Copied sanitized text to clipboard')
      return true
    } catch (error) {
      console.error('[PasteGuard] Failed to copy text:', error)
      return false
    }
  }

  // 后台预加载NER模型
  const initNER = async () => {
    console.log('[PasteGuard] Initializing NER model...')
    nerStatus.value = 'loading'
    nerLoadProgress.value = 0
    nerError.value = null

    try {
      // 在后台加载，不阻塞UI
      const timeout = 15000 // 15秒超时

      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.warn('[PasteGuard] NER model load timeout')
          resolve()
        }, timeout)
      })

      const loadPromise = preloadNER().then(() => {
        nerStatus.value = 'success'
        nerLoadProgress.value = 100
        engineStatus.value.nerModel = true
        console.log('[PasteGuard] NER model loaded successfully')
      }).catch(error => {
        console.error('[PasteGuard] NER preload failed:', error)
        nerStatus.value = 'error'
        nerError.value = error instanceof Error ? error.message : '网络请求被阻止或模型下载失败'
        engineStatus.value.nerModel = false
      })

      // 等待加载完成或超时
      await Promise.race([loadPromise, timeoutPromise])

      // 如果超时但还在加载，标记为超时
      if (nerStatus.value === 'loading') {
        nerStatus.value = 'timeout'
        nerError.value = '模型下载超时，请检查网络连接'
        engineStatus.value.nerModel = false
      }
    } catch (error) {
      console.error('[PasteGuard] NER initialization failed:', error)
      nerStatus.value = 'error'
      nerError.value = error instanceof Error ? error.message : '未知错误'
      engineStatus.value.nerModel = false
    }
  }

  // 重新加载NER模型
  const retryLoadNER = async () => {
    console.log('[PasteGuard] Retrying NER model load...')
    await initNER()
  }

  // 禁用NER模型（降级模式）
  const disableNER = () => {
    nerStatus.value = 'disabled'
    engineStatus.value.nerModel = false
    console.log('[PasteGuard] NER model disabled')
  }

  return {
    // 状态
    originalText,
    detections,
    replaceConfigs,
    mappingTable,
    isProcessing,

    // NER 状态
    nerStatus,
    nerLoadProgress,
    nerError,

    // 引擎状态
    engineStatus,

    // 计算属性
    isNERReady,
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
    initNER,
    retryLoadNER,
    disableNER
  }
})
