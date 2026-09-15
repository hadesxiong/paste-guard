// 值质量过滤器 - 集中管理所有值质量校验逻辑

// 常见弱密码字典
export const WEAK_PASSWORDS = [
  'password', 'admin', 'secret', '123456', 'root', 'test',
  'changeme', 'default', 'pass', 'qwerty', 'abc123',
  'letmein', 'welcome', 'monkey', 'master', 'dragon',
  'login', 'princess', 'solo', 'qwe123', 'trustno1'
]

// 最小密码长度
export const MIN_PASSWORD_LENGTH = 4

// 检查是否是弱密码（大小写不敏感）
export const isWeakPassword = (value: string): boolean => {
  return WEAK_PASSWORDS.includes(value.toLowerCase())
}

// 检查值是否太短
export const isTooShort = (value: string): boolean => {
  return value.length < MIN_PASSWORD_LENGTH
}

// 检查是否是纯数字
export const isNumericOnly = (value: string): boolean => {
  return /^\d+$/.test(value)
}

// 综合值质量检查：返回 true 表示应该跳过（不识别）
export const shouldSkipValue = (value: string): { skip: boolean; reason?: string } => {
  if (!value || value.length === 0) {
    return { skip: true, reason: 'empty' }
  }
  if (isTooShort(value)) {
    return { skip: true, reason: 'too_short' }
  }
  if (isNumericOnly(value)) {
    return { skip: true, reason: 'numeric_only' }
  }
  if (isWeakPassword(value)) {
    return { skip: true, reason: 'weak_password' }
  }
  return { skip: false }
}
