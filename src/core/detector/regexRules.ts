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

// 函数调用模式（需要排除）
const FUNCTION_PATTERNS = [
  /^[a-zA-Z_]+\.[a-zA-Z_]+/,  // os.getenv, process.env
  /^[a-zA-Z_]+\(/,            // getenv(), GetEnv()
]

// 支持的数据库类型（全量）
const DB_SCHEMES = [
  // 关系型数据库
  'postgres', 'postgresql', 'mysql', 'mariadb', 'sqlite', 'sqlite3',
  'mssql', 'sqlserver', 'oracle', 'oracledb', 'db2', 'ibmdb',
  'cockroachdb', 'crdb', 'citus',
  // NoSQL 数据库
  'mongodb', 'mongo', 'redis', 'rediss', 'memcached', 'memcache',
  'couchdb', 'couch', 'cassandra', 'scylla', 'dynamodb', 'dynamo',
  // 消息队列
  'amqp', 'amqps', 'rabbitmq', 'kafka', 'nats', 'natsws',
  'mosquitto', 'mqtt',
  // 其他
  'elasticsearch', 'elastic', 'influxdb', 'influx', 'timescaledb',
  'neo4j', 'arangodb', 'rethinkdb', 'etcd', 'zookeeper'
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
        console.log('[PasteGuard] Skipping whitelisted variable:', varName)
        return null
      }

      // 检查是否是函数调用（如 os.getenv、process.env）
      if (FUNCTION_PATTERNS.some(pattern => pattern.test(varName))) {
        console.log('[PasteGuard] Skipping function call:', varName)
        return null
      }

      // 检查变量名是否包含点号（对象属性访问）
      if (varName.includes('.')) {
        console.log('[PasteGuard] Skipping object property:', varName)
        return null
      }

      // 检查是否是敏感变量名
      const isSensitive = SENSITIVE_KEYWORDS.some(kw => varName.includes(kw))
      if (!isSensitive) {
        console.log('[PasteGuard] Skipping non-sensitive variable:', varName)
        return null
      }

      // 空值不识别
      if (!value || value.length === 0) {
        return null
      }

      // 计算值在原始文本中的位置
      const fullMatch = match[0]
      const equalsIndex = fullMatch.indexOf('=')
      const valueStartInMatch = fullMatch.indexOf(value, equalsIndex)

      console.log('[PasteGuard] Found ENV_PASSWORD:', varName, '=', value.substring(0, 20) + (value.length > 20 ? '...' : ''))

      return {
        original: value,
        startIndex: match.index! + valueStartInMatch,
        endIndex: match.index! + valueStartInMatch + value.length
      }
    }
  },
  // 连接串密码（全数据库支持）
  {
    type: 'DB_PASSWORD',
    pattern: new RegExp(
      `(${DB_SCHEMES.join('|')}):\\/\\/([^:\\s]+):([^@\\s]+)@`,
      'g'
    ),
    confidence: 'high',
    extractor: (match) => {
      const password = match[3]
      const fullMatch = match[0]
      const passwordIndex = fullMatch.indexOf(':' + password) + 1

      console.log('[PasteGuard] Found DB_PASSWORD in connection string:', password.substring(0, 20) + (password.length > 20 ? '...' : ''))

      return {
        original: password,
        startIndex: match.index! + passwordIndex,
        endIndex: match.index! + passwordIndex + password.length
      }
    }
  },
  // 独立 user:password@host 格式（无 scheme 前缀）
  {
    type: 'DB_PASSWORD',
    pattern: /(?<![a-zA-Z0-9])([^:\s]{2,30}):([^@\s]{3,50})@(?=[a-zA-Z0-9])/g,
    confidence: 'medium',
    extractor: (match) => {
      const user = match[1]
      const password = match[2]
      const passwordIndex = user.length + 1

      // 排除明显的非连接串格式
      // 密码太短或太长可能是误报
      if (password.length < 3 || password.length > 50) {
        return null
      }

      // 用户名看起来像时间戳或数字（可能是误报）
      if (/^\d+$/.test(user)) {
        return null
      }

      console.log('[PasteGuard] Found DB_PASSWORD (standalone):', password.substring(0, 20) + (password.length > 20 ? '...' : ''))

      return {
        original: password,
        startIndex: match.index! + passwordIndex,
        endIndex: match.index! + passwordIndex + password.length
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
  // AWS Access Key ID
  {
    type: 'API_KEY',
    pattern: /AKIA[0-9A-Z]{16}/g,
    confidence: 'high'
  },
  // AWS Secret Key（40位字符串）
  {
    type: 'API_KEY',
    pattern: /(?<![A-Z0-9])[A-Za-z0-9/+=]{40}(?![A-Z0-9])/g,
    confidence: 'medium'
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
  // Stripe API Key
  {
    type: 'API_KEY',
    pattern: /[sr]k_(live|test)_[A-Za-z0-9]{20,}/g,
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
    pattern: /-----BEGIN (RSA|EC|OPENSSH|PGP|DSA) PRIVATE KEY-----[\s\S]*?-----END (?:RSA|EC|OPENSSH|PGP|DSA) PRIVATE KEY-----/g,
    confidence: 'high'
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
  // 匹配长度>=25的字母数字字符串（支持特殊字符密码）
  const pattern = /[A-Za-z0-9!@#$%^&*()_+\-=]{25,}/g
  let match

  while ((match = pattern.exec(text)) !== null) {
    const str = match[0]
    const entropy = calculateEntropy(str)

    // 熵值>3.5且包含大小写和数字
    if (entropy > 3.5 && /[a-z]/.test(str) && /[A-Z]/.test(str) && /[0-9]/.test(str)) {
      console.log('[PasteGuard] Found HIGH_ENTROPY:', str.substring(0, 30) + (str.length > 30 ? '...' : ''), 'entropy:', entropy.toFixed(2))
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

  console.log('[PasteGuard] Scanning regex rules...')

  for (const rule of regexRules) {
    let match
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)
    let ruleMatchCount = 0

    while ((match = pattern.exec(text)) !== null) {
      ruleMatchCount++

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
              console.log('[PasteGuard] Merged detection types:', existingItem.detectionTypes)
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
            console.log('[PasteGuard] Skipping whitelisted variable:', varName)
            continue
          }

          // 检查是否是函数调用
          if (FUNCTION_PATTERNS.some(pattern => pattern.test(varName))) {
            console.log('[PasteGuard] Skipping function call:', varName)
            continue
          }

          // 检查变量名是否包含点号
          if (varName.includes('.')) {
            console.log('[PasteGuard] Skipping object property:', varName)
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
              console.log('[PasteGuard] Merged detection types:', existingItem.detectionTypes)
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
              console.log('[PasteGuard] Merged detection types:', existingItem.detectionTypes)
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

    if (ruleMatchCount > 0) {
      console.log(`[PasteGuard] Rule ${rule.type} matched ${ruleMatchCount} times`)
    }
  }

  // 添加高熵字符串检测
  console.log('[PasteGuard] Detecting high entropy strings...')
  const highEntropyItems = detectHighEntropy(text)
  console.log('[PasteGuard] Found', highEntropyItems.length, 'high entropy strings')
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
        console.log('[PasteGuard] Merged detection types:', existingItem.detectionTypes)
      }
    } else {
      items.push({
        ...item,
        detectionTypes: ['HIGH_ENTROPY']
      })
    }
  }

  console.log('[PasteGuard] Total items found:', items.length)
  return items
}
