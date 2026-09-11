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

  async load(): Promise<void> {
    try {
      // 动态导入transformers.js
      const { pipeline } = await import('@xenova/transformers')

      // 加载量化后的BERT-NER模型
      this.pipeline = await pipeline('ner', 'Xenova/bert-base-NER', {
        quantized: true,
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            this.loadProgress = progress.progress || 0
          }
        }
      })

      this.ready = true
      console.log('NER model loaded successfully')
    } catch (error) {
      console.error('Failed to load NER model:', error)
      throw error
    }
  }

  async detect(text: string): Promise<NERResult[]> {
    if (!this.ready || !this.pipeline) {
      return []
    }

    try {
      const results = await this.pipeline(text, {
        aggregation_strategy: 'simple'
      })

      return results.map((result: any) => ({
        entity_group: result.entity_group,
        word: result.word,
        start: result.start,
        end: result.end,
        score: result.score
      }))
    } catch (error) {
      console.error('NER detection failed:', error)
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
