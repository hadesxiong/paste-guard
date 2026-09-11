import type { DetectionItem, DetectionResult } from '../types'
import { scanRegexRules } from './regexRules'
import { semanticFilter, removeDuplicates } from './semanticRules'
import { getNERDetector } from './nerDetector'

// 检测引擎配置
interface DetectorConfig {
  enableNER: boolean
  enableSemanticFilter: boolean
  removeDuplicates: boolean
  mergeDuplicateValues: boolean
}

const defaultConfig: DetectorConfig = {
  enableNER: false, // [NER-disabled] 网络环境较差时禁用，启用时改为 true
  enableSemanticFilter: true,
  removeDuplicates: true,
  mergeDuplicateValues: true
}

// 主检测函数
export const detect = async (
  text: string,
  config: Partial<DetectorConfig> = {}
): Promise<DetectionResult> => {
  const mergedConfig = { ...defaultConfig, ...config }
  let items: DetectionItem[] = []

  console.log('[PasteGuard] Detection started. Text length:', text.length)
  console.log('[PasteGuard] Config:', mergedConfig)

  // 1. 正则规则扫描
  console.log('[PasteGuard] Step 1: Scanning regex rules...')
  const regexItems = scanRegexRules(text)
  console.log('[PasteGuard] Regex scan found', regexItems.length, 'items')
  items.push(...regexItems)

  // 2. NER检测（如果启用）
  console.log('[PasteGuard] Step 2: NER detection...')
  if (mergedConfig.enableNER) {
    try {
      const nerDetector = getNERDetector()
      if (nerDetector.isReady()) {
        console.log('[PasteGuard] NER detector is ready, running detection...')
        const nerResults = await nerDetector.detect(text)
        console.log('[PasteGuard] NER found', nerResults.length, 'entities')
        for (const nerResult of nerResults) {
          const nerItem = nerResultToDetectionItem(nerResult, text, 0)
          if (nerItem) {
            // 检查是否已被其他规则捕获
            const alreadyDetected = items.some(
              item => item.startIndex <= nerItem.startIndex && item.endIndex >= nerItem.endIndex
            )
            if (!alreadyDetected) {
              items.push(nerItem)
              console.log('[PasteGuard] NER entity:', nerResult.entity_group, nerResult.word)
            }
          }
        }
      } else {
        console.log('[PasteGuard] NER detector not ready, skipping')
      }
    } catch (error) {
      console.warn('[PasteGuard] NER detection failed, continuing without NER:', error)
    }
  } else {
    console.log('[PasteGuard] NER disabled, skipping')
  }

  // 3. 语义过滤（如果启用）
  console.log('[PasteGuard] Step 3: Semantic filtering...')
  if (mergedConfig.enableSemanticFilter) {
    const beforeFilter = items.length
    items = semanticFilter(items)
    console.log('[PasteGuard] Semantic filter: before', beforeFilter, '-> after', items.length)
  }

  // 4. 位置去重（如果启用）
  console.log('[PasteGuard] Step 4: Removing position duplicates...')
  if (mergedConfig.removeDuplicates) {
    const beforeDedup = items.length
    items = removeDuplicates(items)
    console.log('[PasteGuard] Position dedup: before', beforeDedup, '-> after', items.length)
  }

  // 5. 相同值合并（如果启用）
  console.log('[PasteGuard] Step 5: Merging duplicate values...')
  if (mergedConfig.mergeDuplicateValues) {
    const beforeMerge = items.length
    items = mergeDuplicateValues(items)
    console.log('[PasteGuard] Value merge: before', beforeMerge, '-> after', items.length)
  }

  // 6. 按位置排序
  console.log('[PasteGuard] Step 6: Sorting by position...')
  items.sort((a, b) => a.startIndex - b.startIndex)

  // 7. 重新生成占位符（确保一致性）
  console.log('[PasteGuard] Step 7: Regenerating placeholders...')
  items = regeneratePlaceholders(items)

  console.log('[PasteGuard] Detection completed. Total items:', items.length)

  return {
    items,
    text
  }
}

// 合并相同值的检测项
const mergeDuplicateValues = (items: DetectionItem[]): DetectionItem[] => {
  const merged = new Map<string, DetectionItem>()

  for (const item of items) {
    const existing = merged.get(item.original)

    if (existing) {
      // 合并类型
      const existingTypes = existing.detectionTypes || [existing.type]
      const newTypes = item.detectionTypes || [item.type]
      const allTypes = new Set([...existingTypes, ...newTypes])

      existing.detectionTypes = Array.from(allTypes)

      // 更新置信度（取最高）
      const confidenceOrder = { 'high': 3, 'medium': 2, 'low': 1 }
      if (confidenceOrder[item.confidence] > confidenceOrder[existing.confidence]) {
        existing.confidence = item.confidence
      }

      // 更新上下文（保留更长的）
      if (item.context && item.context.length > (existing.context?.length || 0)) {
        existing.context = item.context
      }

      console.log('[PasteGuard] Merged value:', item.original.substring(0, 20) + '...', 'types:', existing.detectionTypes)
    } else {
      merged.set(item.original, { ...item })
    }
  }

  return Array.from(merged.values())
}

// 重新生成占位符（确保同一类型使用连续索引）
const regeneratePlaceholders = (items: DetectionItem[]): DetectionItem[] => {
  const typeCounters: Record<string, number> = {}

  return items.map(item => {
    typeCounters[item.type] = (typeCounters[item.type] || 0) + 1
    return {
      ...item,
      placeholder: `<<${item.type}:${typeCounters[item.type]}>>`
    }
  })
}

// 后台预加载NER模型
export const preloadNER = async (): Promise<void> => {
  try {
    const { preloadNERModel } = await import('./nerDetector')
    await preloadNERModel()
  } catch (error) {
    console.warn('[PasteGuard] Failed to preload NER model:', error)
    throw error
  }
}

// 导入nerResultToDetectionItem（供NER检测使用）
import { nerResultToDetectionItem } from './nerDetector'
