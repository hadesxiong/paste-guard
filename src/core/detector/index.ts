import type { DetectionItem, DetectionResult } from '../types'
import { scanRegexRules } from './regexRules'
import { semanticFilter, removeDuplicates } from './semanticRules'
import { getNERDetector, nerResultToDetectionItem } from './nerDetector'

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
        
        // 构建正则检测的排除区间（用于NER去重）
        const regexIntervals = items.map(item => ({
          start: item.startIndex,
          end: item.endIndex
        }))

        for (const nerResult of nerResults) {
          const nerItem = nerResultToDetectionItem(nerResult, text, 0)
          if (nerItem) {
            // 检查是否与正则结果有重叠（使用容差）
            const overlapsWithRegex = regexIntervals.some(interval => {
              const overlapStart = Math.max(nerItem.startIndex, interval.start)
              const overlapEnd = Math.min(nerItem.endIndex, interval.end)
              return overlapEnd - overlapStart > 0
            })
            
            // 也检查是否与已添加的NER结果重叠
            const overlapsWithNER = items.some(
              item => item.detectionTypes?.includes('ENV_PASSWORD') || item.detectionTypes?.includes('API_KEY') || item.detectionTypes?.includes('HIGH_ENTROPY')
            ) && items.some(item => {
              const overlapStart = Math.max(nerItem.startIndex, item.startIndex)
              const overlapEnd = Math.min(nerItem.endIndex, item.endIndex)
              return overlapEnd - overlapStart > 0
            })

            if (!overlapsWithRegex && !overlapsWithNER) {
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
    items = removeDuplicates(items, 3) // 3字符容差
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

// 合并相同值的检测项（支持相似值合并）
const mergeDuplicateValues = (items: DetectionItem[]): DetectionItem[] => {
  const merged: DetectionItem[] = []

  for (const item of items) {
    // 查找是否有相似的已合并项
    let matchedIndex = -1
    for (let i = 0; i < merged.length; i++) {
      if (isSimilarValue(item.original, merged[i].original)) {
        matchedIndex = i
        break
      }
    }

    if (matchedIndex >= 0) {
      const existing = merged[matchedIndex]
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

      // 更新原始值（保留较长的，通常更完整）
      if (item.original.length > existing.original.length) {
        existing.original = item.original
      }

      // 更新上下文（保留更长的）
      if (item.context && item.context.length > (existing.context?.length || 0)) {
        existing.context = item.context
      }

      console.log('[PasteGuard] Merged similar value:', item.original.substring(0, 20) + '...', 'types:', existing.detectionTypes)
    } else {
      merged.push({ ...item })
    }
  }

  return merged
}

// 判断两个值是否相似（用于去重）
const isSimilarValue = (a: string, b: string): boolean => {
  if (a === b) return true

  // 如果一个是另一个的子串（且长度差不大），视为相似
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a

  if (longer.includes(shorter)) {
    const ratio = shorter.length / longer.length
    return ratio > 0.7 // 短串占长串70%以上
  }

  // 计算编辑距离相似度（简化版：公共子串比例）
  const similarity = calculateSimilarity(a, b)
  return similarity > 0.85
}

// 简化的相似度计算：最长公共子串长度 / 最大长度
const calculateSimilarity = (a: string, b: string): number => {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1

  // 找最长公共子串
  let maxCommon = 0
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) {
        k++
      }
      maxCommon = Math.max(maxCommon, k)
    }
  }

  return maxCommon / maxLen
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
