import type { DetectionItem, ReplaceConfig, MappingTable } from '../types'
import { getMappingManager } from './mapping'

// 替换引擎
export class Replacer {
  private mappingManager = getMappingManager()

  // 应用替换
  apply(
    text: string,
    detections: DetectionItem[],
    configs: ReplaceConfig[]
  ): { sanitizedText: string; mappingTable: MappingTable } {
    // 构建映射表
    const mappingTable = this.mappingManager.applyConfigs(configs, detections)

    // 按位置排序检测项（从后往前替换，避免索引偏移）
    const sortedDetections = [...detections].sort(
      (a, b) => b.startIndex - a.startIndex
    )

    let sanitizedText = text

    for (const detection of sortedDetections) {
      const config = configs.find(c => c.itemId === detection.id)

      // 跳过保留的项
      if (config?.action === 'keep') {
        continue
      }

      // 获取占位符
      const placeholder = this.mappingManager.getPlaceholder(detection.original)
      if (placeholder) {
        // 替换文本
        sanitizedText =
          sanitizedText.substring(0, detection.startIndex) +
          placeholder +
          sanitizedText.substring(detection.endIndex)
      }
    }

    return {
      sanitizedText,
      mappingTable
    }
  }

  // 批量替换所有项
  replaceAll(
    text: string,
    detections: DetectionItem[]
  ): { sanitizedText: string; mappingTable: MappingTable } {
    const configs: ReplaceConfig[] = detections.map(d => ({
      itemId: d.id,
      action: 'replace'
    }))

    return this.apply(text, detections, configs)
  }

  // 保留所有项
  keepAll(
    text: string,
    _detections: DetectionItem[]
  ): { sanitizedText: string; mappingTable: MappingTable } {
    // 保留所有项，返回原文
    return {
      sanitizedText: text,
      mappingTable: {}
    }
  }

  // 清空映射表
  clearMapping(): void {
    this.mappingManager.clear()
  }

  // 获取当前映射表
  getMappingTable(): MappingTable {
    return this.mappingManager.getMappings()
  }
}

// 单例替换引擎实例
let replacer: Replacer | null = null

export const getReplacer = (): Replacer => {
  if (!replacer) {
    replacer = new Replacer()
  }
  return replacer
}

// 导出替换函数（供直接调用）
export const sanitizeText = (
  text: string,
  detections: DetectionItem[],
  action: 'replace' | 'keep' = 'replace'
): { sanitizedText: string; mappingTable: MappingTable } => {
  const replacer = getReplacer()

  if (action === 'keep') {
    return replacer.keepAll(text, detections)
  }

  return replacer.replaceAll(text, detections)
}
