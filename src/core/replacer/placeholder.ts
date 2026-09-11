import type { DetectionType } from '../types'

// 占位符命名规范
const PLACEHOLDER_FORMAT: Record<DetectionType, string> = {
  'ENV_PASSWORD': 'ENV_PASSWORD',
  'API_KEY': 'API_KEY',
  'DB_PASSWORD': 'DB_PASSWORD',
  'JWT': 'JWT',
  'PRIVATE_KEY': 'PRIVATE_KEY',
  'HIGH_ENTROPY': 'SECRET'
}

// 生成占位符
export const generatePlaceholder = (
  type: DetectionType,
  index: number
): string => {
  const typeName = PLACEHOLDER_FORMAT[type] || 'SECRET'
  return `<<${typeName}:${index}>>`
}

// 解析占位符
export const parsePlaceholder = (placeholder: string): {
  type: DetectionType
  index: number
} | null => {
  const pattern = /^<<([A-Z_]+):(\d+)>>$/
  const match = placeholder.match(pattern)

  if (!match) {
    return null
  }

  const [, typeName, indexStr] = match
  const index = parseInt(indexStr, 10)

  // 反向映射类型
  const typeMapping: Record<string, DetectionType> = {
    'ENV_PASSWORD': 'ENV_PASSWORD',
    'API_KEY': 'API_KEY',
    'DB_PASSWORD': 'DB_PASSWORD',
    'JWT': 'JWT',
    'PRIVATE_KEY': 'PRIVATE_KEY',
    'SECRET': 'HIGH_ENTROPY'
  }

  const type = typeMapping[typeName]
  if (!type) {
    return null
  }

  return { type, index }
}

// 验证占位符格式
export const isValidPlaceholder = (str: string): boolean => {
  return /^<<[A-Z_]+:\d+>>$/.test(str)
}

// 获取占位符显示文本（简化版，用于UI显示）
export const getPlaceholderDisplayText = (placeholder: string): string => {
  const parsed = parsePlaceholder(placeholder)
  if (!parsed) {
    return placeholder
  }

  const typeNames: Record<DetectionType, string> = {
    'ENV_PASSWORD': '环境变量密码',
    'API_KEY': 'API Key',
    'DB_PASSWORD': '数据库密码',
    'JWT': 'JWT Token',
    'PRIVATE_KEY': '私钥',
    'HIGH_ENTROPY': '高熵字符串'
  }

  return `${typeNames[parsed.type]} #${parsed.index}`
}
