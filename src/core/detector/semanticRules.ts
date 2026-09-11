import type { DetectionItem, Confidence } from '../types'

// 敏感变量名关键词
const SENSITIVE_KEYWORDS = [
  'PASSWORD', 'PASSWD', 'SECRET', 'TOKEN', 'KEY', 'APIKEY', 'API_KEY',
  'CREDENTIAL', 'AUTH', 'PRIVATE', 'ACCESS_KEY', 'SECRET_KEY'
]

// 非敏感变量名白名单
const NON_SENSITIVE_KEYWORDS = [
  'PORT', 'HOST', 'DEBUG', 'NODE_ENV', 'LOG_LEVEL', 'TIMEOUT', 'WORKERS', 'THREADS'
]

// 分析变量名语义
export const analyzeVariableName = (varName: string): {
  isSensitive: boolean
  confidence: Confidence
} => {
  const upperVarName = varName.toUpperCase()

  // 检查白名单
  if (NON_SENSITIVE_KEYWORDS.some(kw => upperVarName.includes(kw))) {
    return { isSensitive: false, confidence: 'high' }
  }

  // 检查敏感关键词
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (upperVarName.includes(keyword)) {
      return { isSensitive: true, confidence: 'high' }
    }
  }

  return { isSensitive: false, confidence: 'low' }
}

// 分析值的特征
export const analyzeValue = (value: string): {
  isLikelySecret: boolean
  confidence: Confidence
} => {
  // 常见占位符或示例值
  const commonPlaceholders = [
    'your_password', 'password', 'secret', 'changeme', 'xxx',
    'placeholder', 'example', 'test', 'demo', 'sample'
  ]

  if (commonPlaceholders.includes(value.toLowerCase())) {
    return { isLikelySecret: false, confidence: 'high' }
  }

  // 非敏感值（端口号、布尔值、数字等）
  if (/^\d+$/.test(value) || /^(true|false)$/i.test(value)) {
    return { isLikelySecret: false, confidence: 'high' }
  }

  // 长度较短的值
  if (value.length < 6) {
    return { isLikelySecret: false, confidence: 'medium' }
  }

  // 看起来像密钥的值（长字符串，包含特殊字符）
  if (value.length >= 20 && /[!@#$%^&*]/.test(value)) {
    return { isLikelySecret: true, confidence: 'high' }
  }

  return { isLikelySecret: false, confidence: 'low' }
}

// 语义过滤：基于上下文调整置信度
export const semanticFilter = (items: DetectionItem[]): DetectionItem[] => {
  return items.map(item => {
    // 提取变量名
    const varMatch = item.context.match(/^([A-Z0-9_]+)\s*=/i)
    if (varMatch) {
      const varName = varMatch[1]
      const varAnalysis = analyzeVariableName(varName)

      if (varAnalysis.isSensitive) {
        // 变量名明确是敏感的，提升置信度
        return {
          ...item,
          type: 'ENV_PASSWORD',
          confidence: varAnalysis.confidence
        }
      } else if (varAnalysis.confidence === 'high') {
        // 变量名明确不是敏感的，降低置信度或移除
        return {
          ...item,
          confidence: 'low'
        }
      }
    }

    // 分析值的特征
    const valueAnalysis = analyzeValue(item.original)
    if (!valueAnalysis.isLikelySecret && valueAnalysis.confidence === 'high') {
      return {
        ...item,
        confidence: 'low'
      }
    }

    return item
  })
}

// 移除重复检测项（基于位置）
export const removeDuplicates = (items: DetectionItem[]): DetectionItem[] => {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = `${item.startIndex}-${item.endIndex}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
