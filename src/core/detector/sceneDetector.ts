// 场景识别器 - 使用 MobileBERT 零样本分类

// HuggingFace 镜像地址（中国大陆可访问）
const HF_MIRROR = 'https://hf-mirror.com'

export type SceneType = 'yaml' | 'env' | 'code' | 'log' | 'json' | 'plain'

export interface SceneResult {
  type: SceneType
  confidence: number
  scores: Record<SceneType, number>
}

// 零样本分类标签
const SCENE_LABELS = [
  'YAML configuration file with key-value pairs',
  'environment variables file with KEY=VALUE format',
  'source code with functions and imports',
  'log file with timestamps and messages',
  'JSON data file',
  'plain text'
]

// 标签到场景类型的映射
const LABEL_MAP: Record<string, SceneType> = {
  'YAML configuration file with key-value pairs': 'yaml',
  'environment variables file with KEY=VALUE format': 'env',
  'source code with functions and imports': 'code',
  'log file with timestamps and messages': 'log',
  'JSON data file': 'json',
  'plain text': 'plain'
}

// 模型单例
let classifierPipeline: any = null
let loading = false
let ready = false

// 加载场景识别模型
export const loadSceneModel = async (): Promise<void> => {
  if (loading || ready) return
  loading = true

  try {
    const transformers = await import('@xenova/transformers')
    const ort = await import('onnxruntime-web')

    const { env } = transformers
    env.allowLocalModels = false
    env.useBrowserCache = true
    env.remoteHost = HF_MIRROR
    env.backends.onnx.wasm.numThreads = 1

    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false

    classifierPipeline = await transformers.pipeline(
      'zero-shot-classification',
      'Xenova/mobilebert-uncased-mnli',
      {
        quantized: true,
        progress_callback: (progress: any) => {
          if (progress.status === 'done') {
            console.log('[PasteGuard] Scene model loaded')
          }
        }
      }
    )

    ready = true
    loading = false
    console.log('[PasteGuard] Scene detector ready')
  } catch (error) {
    loading = false
    console.error('[PasteGuard] Failed to load scene model:', error)
    throw error
  }
}

// 检测场景类型
export const detectScene = async (text: string): Promise<SceneResult> => {
  if (!ready || !classifierPipeline) {
    // 模型未就绪，返回默认值
    return { type: 'plain', confidence: 0, scores: {} as any }
  }

  try {
    const result = await classifierPipeline(text, SCENE_LABELS, {
      multi_label: false
    })

    const scores: Record<string, number> = {}
    result.labels.forEach((label: string, i: number) => {
      scores[LABEL_MAP[label] || 'plain'] = result.scores[i]
    })

    const topLabel = result.labels[0] as string
    const sceneType = LABEL_MAP[topLabel] || 'plain'

    return {
      type: sceneType,
      confidence: result.scores[0],
      scores: scores as Record<SceneType, number>
    }
  } catch (error) {
    console.error('[PasteGuard] Scene detection failed:', error)
    return { type: 'plain', confidence: 0, scores: {} as any }
  }
}

// 检查模型是否就绪
export const isSceneModelReady = (): boolean => ready

// 预加载模型
export const preloadSceneModel = async (): Promise<void> => {
  await loadSceneModel()
}
