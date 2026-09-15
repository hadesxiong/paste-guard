import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DetectionItem, ReplaceConfig, MappingTable } from '../core/types'
import { detect, preloadModels } from '../core/detector'
import { getReplacer } from '../core/replacer'

// 模型状态类型
type ModelStatus = 'idle' | 'loading' | 'success' | 'error' | 'timeout' | 'disabled'

// 检测引擎状态
interface DetectionEngineStatus {
    sceneModel: boolean        // 场景识别模型
    contentModel: boolean      // 内容检测模型
    regexRules: boolean        // 正则规则
}

export const useDetectionStore = defineStore('detection', () => {
    // 状态
    const originalText = ref('')
    const detections = ref<DetectionItem[]>([])
    const replaceConfigs = ref<ReplaceConfig[]>([])
    const mappingTable = ref<MappingTable>({})
    const isProcessing = ref(false)

    // 模型状态（向后兼容旧变量名）
    const nerStatus = ref<ModelStatus>('disabled')
    const nerLoadProgress = ref(0)
    const nerError = ref<string | null>(null)
    const nerRetryCount = ref(0)
    let progressInterval: ReturnType<typeof setInterval> | null = null

    // 检测引擎状态
    const engineStatus = ref<DetectionEngineStatus>({
        sceneModel: false,
        contentModel: false,
        regexRules: true
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

    // 后台预加载模型
    const initNER = async () => {
        console.log('[PasteGuard] Initializing models...')
        nerStatus.value = 'loading'
        nerLoadProgress.value = 0
        nerError.value = null

        if (progressInterval) { clearInterval(progressInterval) }

        try {
            const timeout = 30000 // 30秒超时

            const timeoutPromise = new Promise<void>((resolve) => {
                setTimeout(() => {
                    console.warn('[PasteGuard] Model load timeout')
                    resolve()
                }, timeout)
            })

            progressInterval = setInterval(() => {
                // 模拟进度
                if (nerLoadProgress.value < 90) {
                    nerLoadProgress.value += 5
                }
            }, 500)

            const loadPromise = preloadModels().then(() => {
                nerStatus.value = 'success'
                nerRetryCount.value = 0
                nerLoadProgress.value = 100
                engineStatus.value.sceneModel = true
                engineStatus.value.contentModel = true
                console.log('[PasteGuard] Models loaded successfully')
            }).catch(error => {
                console.error('[PasteGuard] Model preload failed:', error)
                if (nerRetryCount.value >= 3) {
                    nerStatus.value = 'error'
                    nerError.value = error instanceof Error ? error.message : '网络请求被阻止或模型下载失败'
                }
                engineStatus.value.sceneModel = false
                engineStatus.value.contentModel = false
            }).finally(() => {
                if (progressInterval) { clearInterval(progressInterval) }
            })

            await Promise.race([loadPromise, timeoutPromise])

            if (nerStatus.value === 'loading') {
                if (nerRetryCount.value >= 3) {
                    nerStatus.value = 'timeout'
                    nerError.value = '模型下载超时，请检查网络连接'
                }
                engineStatus.value.sceneModel = false
                engineStatus.value.contentModel = false
            }
        } catch (error) {
            console.error('[PasteGuard] Model initialization failed:', error)
            nerStatus.value = 'error'
            nerError.value = error instanceof Error ? error.message : '未知错误'
            engineStatus.value.sceneModel = false
            engineStatus.value.contentModel = false
        }
    }

    // 重新加载模型
    const retryLoadNER = async () => {
        console.log('[PasteGuard] Retrying model load...')
        await initNER()
    }

    // 禁用模型（降级模式）
    const disableNER = () => {
        nerStatus.value = 'disabled'
        engineStatus.value.sceneModel = false
        engineStatus.value.contentModel = false
        console.log('[PasteGuard] Models disabled')
    }

    return {
        // 状态
        originalText,
        detections,
        replaceConfigs,
        mappingTable,
        isProcessing,

        // 模型状态
        nerStatus,
        nerLoadProgress,
        nerError,
        nerRetryCount,

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
