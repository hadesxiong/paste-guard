import type { DetectionRule, DetectionItem } from '../types'

// 敏感变量名关键词
const SENSITIVE_KEYWORDS = [
  'PASSWORD', 'PASSWD', 'SECRET', 'TOKEN', 'KEY', 'APIKEY', 'API_KEY',
  'CREDENTIAL', 'AUTH', 'PRIVATE', 'ACCESS_KEY', 'SECRET_KEY'
]

// 非敏感变量名白名单
const NON_SENSITIVE_KEYWORDS = [
  'PORT', 'HOST', 'DEBUG', 'NODE_ENV', 'LOG_LEVEL', 'TIMEOUT', 'WORKERS', 'THREADS'
]

// 正则规则集
export const regexRules: DetectionRule[] = [
  // 环境变量赋值（优先级最高）
  {
    type: 'ENV_PASSWORD',
    pattern: /^([A-Z0-9_]+)\s*=\s*(.+)$/gm,
    confidence: 'high',
    extractor: (match) => {
      const varName = match[1]
      const value = match[2].trim()

      // 检查是否在白名单中
      if (NON_SENSITIVE_KEYWORDS.some(kw => varName.includes(kw))) {
        return null
      }

      // 检查是否是敏感变量名
      const isSensitive = SENSITIVE_KEYWORDS.some(kw => varName.includes(kw))
      if (!isSensitive) {
        return null
      }

      // 计算值在原始文本中的位置
      const fullMatch = match[0]
      const equalsIndex = fullMatch.indexOf('=')
      const valueStartInMatch = fullMatch.indexOf(value, equalsIndex)

      return {
        original: value,
        startIndex: match.index! + valueStartInMatch,
        endIndex: match.index! + valueStartInMatch + value.length
      }
    }
  },
  // OpenAI API Key
  {
    type: 'API_KEY',
    pattern: /sk-[A-Za-z0-9]{20,}/g,
    confidence: 'high'
  },
  // GitHub Token
  {
    type: 'API_KEY',
    pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g,
    confidence: 'high'
  },
  // AWS Access Key
  {
    type: 'API_KEY',
    pattern: /AKIA[0-9A-Z]{16}/g,
    confidence: 'high'
  },
  // Google API Key
  {
    type: 'API_KEY',
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    confidence: 'high'
  },
  // Slack Token
  {
    type: 'API_KEY',
    pattern: /xox[baprs]-[0-9A-Za-z\-]+/g,
    confidence: 'high'
  },
  // JWT Token
  {
    type: 'JWT',
    pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
    confidence: 'high'
  },
  // 私钥
  {
    type: 'PRIVATE_KEY',
    pattern: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----[\s\S]*?-----END (?:RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/g,
    confidence: 'high'
  },
  // 连接串密码
  {
    type: 'DB_PASSWORD',
    pattern: /(postgres|mysql|mongodb|redis|amqp):\/\/[^:]+:([^@]+)@/g,
    confidence: 'high',
    extractor: (match) => {
      const fullMatch = match[0]
      const password = match[2]
      const passwordIndex = fullMatch.indexOf(':' + password) + 1
      return {
        original: password,
        startIndex: match.index! + passwordIndex,
        endIndex: match.index! + passwordIndex + password.length
      }
    }
  }
]

// 生成唯一ID
let idCounter = 0
const generateId = (): string => `det_${++idCounter}_${Date.now()}`

// 计算高熵字符串的信息熵
const calculateEntropy = (str: string): number => {
  const freq: Record<string, number> = {}
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1
  }
  const len = str.length
  let entropy = 0
  for (const count of Object.values(freq)) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  return entropy
}

// 检测高熵字符串
const detectHighEntropy = (text: string): DetectionItem[] => {
  const items: DetectionItem[] = []
  // 匹配长度>=20的字母数字字符串
  const pattern = /[A-Za-z0-9]{20,}/g
  let match

  while ((match = pattern.exec(text)) !== null) {
    const str = match[0]
    const entropy = calculateEntropy(str)

    // 熵值>3.5且包含大小写和数字
    if (entropy > 3.5 && /[a-z]/.test(str) && /[A-Z]/.test(str) && /[0-9]/.test(str)) {
      items.push({
        id: generateId(),
        type: 'HIGH_ENTROPY',
        original: str,
        placeholder: `<<SECRET:${items.length + 1}>>`,
        startIndex: match.index,
        endIndex: match.index + str.length,
        confidence: 'low',
        context: text.substring(Math.max(0, match.index - 20), match.index + str.length + 20)
      })
    }
  }

  return items
}

// 扫描正则规则
export const scanRegexRules = (text: string): DetectionItem[] => {
  const items: DetectionItem[] = []

  for (const rule of regexRules) {
    let match
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)

    while ((match = pattern.exec(text)) !== null) {
      // 连接串密码需要特殊处理
      if (rule.extractor) {
        const extracted = rule.extractor(match, text)
        if (extracted) {
          // 检查是否已有相同位置的检测项
          const existingItem = items.find(
            item => item.startIndex <= extracted.startIndex && item.endIndex >= extracted.endIndex
          )

          if (existingItem) {
            // 合并检测类型
            if (!existingItem.detectionTypes) {
              existingItem.detectionTypes = [existingItem.type]
            }
            if (!existingItem.detectionTypes.includes(rule.type)) {
              existingItem.detectionTypes.push(rule.type)
            }
          } else {
            items.push({
              id: generateId(),
              type: rule.type,
              original: extracted.original,
              placeholder: `<<${rule.type}:${items.length + 1}>>`,
              startIndex: extracted.startIndex,
              endIndex: extracted.endIndex,
              confidence: rule.confidence,
              context: text.substring(Math.max(0, extracted.startIndex - 20), extracted.endIndex + 20),
              detectionTypes: [rule.type]
            })
          }
        }
      } else {
        // 普通匹配
        const original = match[0]
        const startIndex = match.index!
        const endIndex = startIndex + original.length

        // 检查是否是环境变量赋值
        const lineStart = text.lastIndexOf('\n', startIndex) + 1
        const line = text.substring(lineStart, endIndex)
        const varMatch = line.match(/^([A-Z0-9_]+)\s*=/)

        if (varMatch) {
          const varName = varMatch[1]

          // 检查是否在白名单中
          if (NON_SENSITIVE_KEYWORDS.some(kw => varName.includes(kw))) {
            continue
          }

          // 检查是否是敏感变量名
          const isSensitive = SENSITIVE_KEYWORDS.some(kw => varName.includes(kw))

          // 检查是否已有相同位置的检测项
          const existingItem = items.find(
            item => item.startIndex <= startIndex && item.endIndex >= endIndex
          )

          if (existingItem) {
            // 合并检测类型
            const newType = isSensitive ? 'ENV_PASSWORD' : rule.type
            if (!existingItem.detectionTypes) {
              existingItem.detectionTypes = [existingItem.type]
            }
            if (!existingItem.detectionTypes.includes(newType)) {
              existingItem.detectionTypes.push(newType)
            }
          } else {
            items.push({
              id: generateId(),
              type: isSensitive ? 'ENV_PASSWORD' : rule.type,
              original,
              placeholder: `<<${isSensitive ? 'ENV_PASSWORD' : rule.type}:${items.length + 1}>>`,
              startIndex,
              endIndex,
              confidence: isSensitive ? 'high' : rule.confidence,
              context: line.trim(),
              detectionTypes: [isSensitive ? 'ENV_PASSWORD' : rule.type]
            })
          }
        } else {
          // 检查是否已有相同位置的检测项
          const existingItem = items.find(
            item => item.startIndex <= startIndex && item.endIndex >= endIndex
          )

          if (existingItem) {
            // 合并检测类型
            if (!existingItem.detectionTypes) {
              existingItem.detectionTypes = [existingItem.type]
            }
            if (!existingItem.detectionTypes.includes(rule.type)) {
              existingItem.detectionTypes.push(rule.type)
            }
          } else {
            items.push({
              id: generateId(),
              type: rule.type,
              original,
              placeholder: `<<${rule.type}:${items.length + 1}>>`,
              startIndex,
              endIndex,
              confidence: rule.confidence,
              context: text.substring(Math.max(0, startIndex - 20), endIndex + 20),
              detectionTypes: [rule.type]
            })
          }
        }
      }
    }
  }

  // 添加高熵字符串检测
  const highEntropyItems = detectHighEntropy(text)
  for (const item of highEntropyItems) {
    // 检查是否已有相同位置的检测项
    const existingItem = items.find(
      existing => existing.startIndex <= item.startIndex && existing.endIndex >= item.endIndex
    )

    if (existingItem) {
      // 合并检测类型
      if (!existingItem.detectionTypes) {
        existingItem.detectionTypes = [existingItem.type]
      }
      if (!existingItem.detectionTypes.includes('HIGH_ENTROPY')) {
        existingItem.detectionTypes.push('HIGH_ENTROPY')
      }
    } else {
      items.push({
        ...item,
        detectionTypes: ['HIGH_ENTROPY']
      })
    }
  }

  return items
}
