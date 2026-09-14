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
  private hasSeenRealProgress = false  // 是否见过真实进度（< 100%）

  async load(): Promise<void> {
    if (this.loading || this.ready) {
      console.log('[PasteGuard] NER model already loading or loaded')
      return
    }

    this.loading = true
    this.loadProgress = 0
    this.hasSeenRealProgress = false
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
    //   env.remoteHost = 'https://hf-mirror.com'
      env.remoteHost = 'https://huggingface.co'
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
            const rawProgress = progress.progress || 0
            
            // 如果第一次进度就是100%，可能是缓存命中，不视为真实进度
            if (!this.hasSeenRealProgress && rawProgress >= 100) {
              console.log('[PasteGuard] NER model cached, waiting for real download progress...')
              return
            }
            
            this.hasSeenRealProgress = true
            // 保留小数点后两位
            this.loadProgress = Math.round(rawProgress * 100) / 100
            console.log(`[PasteGuard] NER model loading progress: ${this.loadProgress}%`)
          } else if (progress.status === 'done') {
            console.log('[PasteGuard] NER model download completed')
            this.loadProgress = 100
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

      const merged = this.mergeAdjacentEntities(results, text)
      const deduped = this.removeRedundantEntities(merged)

      console.log('[PasteGuard] NER detection results:', deduped.length, 'entities (from', results.length, 'raw)')

      return deduped.map((result: any) => ({
        entity_group: result.entity_group,
        word: text.substring(result.start, result.end),
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
    // 确保返回值保留小数点后两位
    return Math.round(this.loadProgress * 100) / 100
  }

  private mergeAdjacentEntities(results: any[], text: string): any[] {
    if (results.length === 0) return []

    const sorted = [...results].sort((a, b) => a.start - b.start)
    const merged: any[] = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const prev = merged[merged.length - 1]
      const curr = sorted[i]

      // 当前实体完全包含在前一个实体内
      if (curr.start >= prev.start && curr.end <= prev.end) {
        continue
      }

      // 前一个实体完全包含在当前实体内
      if (prev.start >= curr.start && prev.end <= curr.end) {
        merged[merged.length - 1] = curr
        continue
      }

      // 部分重叠或相邻：合并它们
      if (curr.start <= prev.end + 1) {
        prev.end = Math.max(prev.end, curr.end)
        prev.word = text.substring(prev.start, prev.end)
        prev.score = Math.max(prev.score, curr.score)
        if (curr.score > prev.score) {
          prev.entity_group = curr.entity_group
        }
      } else {
        merged.push(curr)
      }
    }

    return merged
  }

  private removeRedundantEntities(results: any[]): any[] {
    if (results.length <= 1) return results

    const sorted = [...results].sort((a, b) => a.start - b.start)
    const keep: any[] = []

    for (const curr of sorted) {
      // 检查当前实体是否与已保留的实体重叠
      let redundantResult: 'skip' | 'replace' | false = false

      for (const existing of keep) {
        // 完全包含关系
        const currContained = curr.start >= existing.start && curr.end <= existing.end
        const existingContained = existing.start >= curr.start && existing.end <= curr.end

        if (currContained) {
          redundantResult = 'skip'
          break
        }
        if (existingContained) {
          redundantResult = 'replace'
          break
        }

        // 部分重叠：计算重叠比例
        const overlapStart = Math.max(curr.start, existing.start)
        const overlapEnd = Math.min(curr.end, existing.end)
        const overlapLength = overlapEnd - overlapStart

        if (overlapLength > 0) {
          const currLength = curr.end - curr.start
          const existingLength = existing.end - existing.start
          const overlapRatio = overlapLength / Math.min(currLength, existingLength)

          // 如果重叠超过50%，保留置信度高的
          if (overlapRatio > 0.5) {
            redundantResult = curr.score > existing.score ? 'replace' : 'skip'
            break
          }
        }
      }

      if (redundantResult === 'replace') {
        // 替换已有项
        const idx = keep.findIndex(existing => {
          const overlapStart = Math.max(curr.start, existing.start)
          const overlapEnd = Math.min(curr.end, existing.end)
          return overlapEnd - overlapStart > 0
        })
        if (idx >= 0) keep[idx] = curr
      } else if (redundantResult !== 'skip') {
        keep.push(curr)
      }
    }

    return keep
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
