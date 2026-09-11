// 检测项类型
export type DetectionType =
  | 'ENV_PASSWORD'
  | 'API_KEY'
  | 'DB_PASSWORD'
  | 'JWT'
  | 'PRIVATE_KEY'
  | 'HIGH_ENTROPY'

// 置信度类型
export type Confidence = 'high' | 'medium' | 'low'

// 检测项
export interface DetectionItem {
  id: string
  type: DetectionType
  original: string
  placeholder: string
  startIndex: number
  endIndex: number
  confidence: Confidence
  context: string
  detectionTypes?: DetectionType[]  // 命中的所有检测类型
}

// 检测结果
export interface DetectionResult {
  items: DetectionItem[]
  text: string
}

// 替换操作
export type ReplaceAction = 'replace' | 'keep'

// 替换配置
export interface ReplaceConfig {
  itemId: string
  action: ReplaceAction
  customPlaceholder?: string
}

// 映射表
export interface MappingTable {
  [placeholder: string]: string
}

// 检测规则
export interface DetectionRule {
  type: DetectionType
  pattern: RegExp
  confidence: Confidence
  extractor?: (match: RegExpMatchArray, fullText: string) => { original: string; startIndex: number; endIndex: number } | null
}

// NER检测结果
export interface NERResult {
  entity_group: string
  word: string
  start: number
  end: number
  score: number
}
