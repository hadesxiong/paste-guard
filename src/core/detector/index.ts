import type { DetectionItem, DetectionResult } from '../types'
import { scanRegexRules } from './regexRules'
import { semanticFilter, removeDuplicates } from './semanticRules'
import { extractPasswordFromConnectionString, isValidConnectionString } from './connectionString'
import { getNERDetector } from './nerDetector'

// 检测引擎配置
interface DetectorConfig {
  enableNER: boolean
  enableSemanticFilter: boolean
  removeDuplicates: boolean
}

const defaultConfig: DetectorConfig = {
  enableNER: true,
  enableSemanticFilter: true,
  removeDuplicates: true
}

// 主检测函数
export const detect = async (
  text: string,
  config: Partial<DetectorConfig> = {}
): Promise<DetectionResult> => {
  const mergedConfig = { ...defaultConfig, ...config }
  let items: DetectionItem[] = []

  // 1. 正则规则扫描
  const regexItems = scanRegexRules(text)
  items.push(...regexItems)

  // 2. 提取连接串密码
  const connectionStringPattern = /(postgres|mysql|mongodb|redis|amqp):\/\/[^\s]+/g
  let connMatch
  while ((connMatch = connectionStringPattern.exec(text)) !== null) {
    if (isValidConnectionString(connMatch[0])) {
      const connItem = extractPasswordFromConnectionString(connMatch[0], connMatch.index)
      if (connItem) {
        // 检查是否已被正则规则捕获
        const alreadyDetected = items.some(
          item => item.startIndex <= connItem.startIndex && item.endIndex >= connItem.endIndex
        )
        if (!alreadyDetected) {
          items.push(connItem)
        }
      }
    }
  }

  // 3. NER检测（如果启用）
  if (mergedConfig.enableNER) {
    try {
      const nerDetector = getNERDetector()
      if (nerDetector.isReady()) {
        const nerResults = await nerDetector.detect(text)
        for (const nerResult of nerResults) {
          const nerItem = nerResultToDetectionItem(nerResult, text, 0)
          if (nerItem) {
            // 检查是否已被其他规则捕获
            const alreadyDetected = items.some(
              item => item.startIndex <= nerItem.startIndex && item.endIndex >= nerItem.endIndex
            )
            if (!alreadyDetected) {
              items.push(nerItem)
            }
          }
        }
      }
    } catch (error) {
      console.warn('NER detection failed, continuing without NER:', error)
    }
  }

  // 4. 语义过滤（如果启用）
  if (mergedConfig.enableSemanticFilter) {
    items = semanticFilter(items)
  }

  // 5. 去重（如果启用）
  if (mergedConfig.removeDuplicates) {
    items = removeDuplicates(items)
  }

  // 6. 按位置排序
  items.sort((a, b) => a.startIndex - b.startIndex)

  // 7. 重新生成占位符（确保一致性）
  items = regeneratePlaceholders(items)

  return {
    items,
    text
  }
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
    console.warn('Failed to preload NER model:', error)
  }
}

// 导入nerResultToDetectionItem（供NER检测使用）
import { nerResultToDetectionItem } from './nerDetector'
