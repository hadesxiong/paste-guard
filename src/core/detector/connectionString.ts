import type { DetectionItem } from '../types'

// 支持的数据库类型
type DBType = 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'amqp'

// 连接串解析结果
interface ConnectionStringParsed {
  type: DBType
  user?: string
  password?: string
  host: string
  port?: string
  database?: string
  raw: string
}

// 生成唯一ID
let idCounter = 0
const generateId = (): string => `conn_${++idCounter}_${Date.now()}`

// 解析连接串
export const parseConnectionString = (connectionString: string): ConnectionStringParsed | null => {
  // 匹配连接串格式：scheme://user:password@host:port/db
  const pattern = /(postgres|mysql|mongodb|redis|amqp):\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?(?:\/([^?\s]+))?/
  const match = connectionString.match(pattern)

  if (!match) {
    return null
  }

  const [, type, user, password, host, port, database] = match

  return {
    type: type as DBType,
    user,
    password,
    host,
    port: port || undefined,
    database: database || undefined,
    raw: connectionString
  }
}

// 从连接串中提取密码作为检测项
export const extractPasswordFromConnectionString = (
  connectionString: string,
  startIndex: number
): DetectionItem | null => {
  const parsed = parseConnectionString(connectionString)

  if (!parsed || !parsed.password) {
    return null
  }

  // 找到密码在原始字符串中的位置
  const passwordPattern = new RegExp(`:${parsed.password}@`)
  const match = connectionString.match(passwordPattern)

  if (!match) {
    return null
  }

  // 计算密码在原始文本中的绝对位置
  const passwordRelativeIndex = match.index! + 1 // +1 跳过冒号
  const absoluteStartIndex = startIndex + passwordRelativeIndex
  const absoluteEndIndex = absoluteStartIndex + parsed.password.length

  // 根据数据库类型确定占位符类型
  const placeholderType = 'DB_PASSWORD'

  return {
    id: generateId(),
    type: placeholderType,
    original: parsed.password,
    placeholder: `<<${placeholderType}:1>>`,
    startIndex: absoluteStartIndex,
    endIndex: absoluteEndIndex,
    confidence: 'high',
    context: connectionString
  }
}

// 生成替换后的连接串
export const replaceConnectionStringPassword = (
  connectionString: string,
  newPassword: string
): string => {
  return connectionString.replace(
    /:\/\/([^:]+):([^@]+)@/,
    `://$1:${newPassword}@`
  )
}

// 验证连接串格式
export const isValidConnectionString = (str: string): boolean => {
  const pattern = /^(postgres|mysql|mongodb|redis|amqp):\/\/[^:]+:[^@]+@[^:\/]+/
  return pattern.test(str)
}
