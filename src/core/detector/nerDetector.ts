import type { NERResult, DetectionItem, DetectionType } from '../types'

// NER检测器接口
export interface NERDetector {
  load(): Promise<void>
  detect(text: string): Promise<NERResult[]>
  isReady(): boolean
  getLoadProgress(): number
}

// Transformers.js NER检测器实现
export class TransformersNERDetector implements NERDetector {
  private pipeline: any = null
  private ready = false
  private loadProgress = 0
  private loading = false

  async load(): Promise<void> {
    if (this.loading || this.ready) {
      console.log('[PasteGuard] NER model already loading or loaded')
      return
    }

    this.loading = true
    console.log('[PasteGuard] Loading NER model...')

    try {
      // 动态导入transformers.js和onnxruntime-web
      const transformers = await import('@xenova/transformers')
      const ort = await import('onnxruntime-web')

      // 配置环境
      const { env } = transformers
      env.allowLocalModels = false
      env.useBrowserCache = true

      // 配置 onnxruntime-web：禁用多线程和代理，避免 Chrome 扩展 CSP 问题
      ort.env.wasm.numThreads = 1
      ort.env.wasm.proxy = false

      // 设置国内镜像地址
      env.remoteHost = 'https://hf-mirror.com'
      env.remotePathTemplate = '{model}/resolve/main/'

      // 禁用多线程，避免 Chrome 扩展 CSP 阻止 blob URL worker
      env.backends.onnx.wasm.numThreads = 1

      console.log('[PasteGuard] Using mirror host:', env.remoteHost)
      console.log('[PasteGuard] ONNX numThreads:', env.backends.onnx.wasm.numThreads)
      console.log('[PasteGuard] ONNX proxy:', ort.env.wasm.proxy)

      // 加载量化后的BERT-NER模型
      this.pipeline = await transformers.pipeline('ner', 'Xenova/bert-base-NER', {
        quantized: true,
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            this.loadProgress = progress.progress || 0
            console.log(`[PasteGuard] NER model loading progress: ${this.loadProgress}%`)
          } else if (progress.status === 'done') {
            console.log('[PasteGuard] NER model download completed')
          }
        }
      })

      this.ready = true
      this.loading = false
      console.log('[PasteGuard] NER model loaded successfully')
    } catch (error) {
      this.loading = false
      console.error('[PasteGuard] Failed to load NER model:', error)
      throw error
    }
  }

  async detect(text: string): Promise<NERResult[]> {
    if (!this.ready || !this.pipeline) {
      console.warn('[PasteGuard] NER detector not ready')
      return []
    }

    try {
      const results = await this.pipeline(text, {
        aggregation_strategy: 'simple'
      })

      console.log('[PasteGuard] NER detection results:', results.length, 'entities')

      return results.map((result: any) => ({
        entity_group: result.entity_group,
        word: result.word,
        start: result.start,
        end: result.end,
        score: result.score
      }))
    } catch (error) {
      console.error('[PasteGuard] NER detection failed:', error)
      return []
    }
  }

  isReady(): boolean {
    return this.ready
  }

  getLoadProgress(): number {
    return this.loadProgress
  }
}

// NER结果转检测项
export const nerResultToDetectionItem = (
  result: NERResult,
  fullText: string,
  startIndex: number
): DetectionItem | null => {
  // 根据NER实体类型映射到检测类型
  const typeMapping: Record<string, DetectionType> = {
    'PER': 'ENV_PASSWORD',  // 人名可能作为密码
    'ORG': 'API_KEY',       // 组织名可能作为API Key
    'LOC': 'ENV_PASSWORD',  // 地址可能作为敏感信息
    'MISC': 'HIGH_ENTROPY'  // 其他实体
  }

  const type = typeMapping[result.entity_group]
  if (!type) {
    return null
  }

  // 计算在原始文本中的绝对位置
  const absoluteStart = startIndex + result.start
  const absoluteEnd = startIndex + result.end

  return {
    id: `ner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    original: result.word,
    placeholder: `<<${type}:1>>`,
    startIndex: absoluteStart,
    endIndex: absoluteEnd,
    confidence: result.score > 0.9 ? 'high' : result.score > 0.7 ? 'medium' : 'low',
    context: fullText.substring(Math.max(0, absoluteStart - 20), absoluteEnd + 20)
  }
}

// 单例NER检测器实例
let nerDetector: NERDetector | null = null

export const getNERDetector = (): NERDetector => {
  if (!nerDetector) {
    nerDetector = new TransformersNERDetector()
  }
  return nerDetector
}

// 后台预加载NER模型
export const preloadNERModel = async (): Promise<void> => {
  const detector = getNERDetector()
  if (!detector.isReady()) {
    await detector.load()
  }
}
