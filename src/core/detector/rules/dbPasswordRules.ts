// DB_PASSWORD 规则 - 数据库连接串密码检测

import type { DetectionRule } from '../../types'
import { DB_SCHEMES } from './constants'

export const dbPasswordRules: DetectionRule[] = [
  // 连接串密码（全数据库支持）
  // 支持密码中包含特殊字符（包括 @、! 等），只将最后一个 @ 视为分隔符
  // 也支持无用户名格式：redis://:password@host
  {
    type: 'DB_PASSWORD',
    pattern: new RegExp(
      `(${DB_SCHEMES.join('|')}):\\/\\/(?:([^:\\s]*):)?([^@\\s]{3,}(?:@[^@\\s]+)*)@`,
      'g'
    ),
    confidence: 'high',
    extractor: (match) => {
      // match[2] 是密码（用户名可能为空）
      const password = match[3] || match[2]
      const fullMatch = match[0]
      const passwordIndex = fullMatch.lastIndexOf(':' + password) + 1

      console.log('[PasteGuard] Found DB_PASSWORD in connection string:', password.substring(0, 20) + (password.length > 20 ? '...' : ''))

      return {
        original: password,
        startIndex: match.index! + passwordIndex,
        endIndex: match.index! + passwordIndex + password.length
      }
    }
  },
  // 独立 user:password@host 格式（无 scheme 前缀）
  // 允许密码中包含特殊字符（包括 @、! 等），只将最后一个 @ 视为分隔符
  {
    type: 'DB_PASSWORD',
    pattern: /(?<![a-zA-Z0-9])([^:\s]{2,30}):([^@\s]{3,50}(?:@[^@\s]+)*)@(?=[a-zA-Z0-9])/g,
    confidence: 'medium',
    extractor: (match) => {
      const user = match[1]
      const password = match[2]
      const passwordIndex = user.length + 1

      // 排除明显的非连接串格式
      if (password.length < 3 || password.length > 100) {
        return null
      }

      if (/^\d+$/.test(user)) {
        return null
      }

      // 进一步验证：host 部分看起来像主机名/IP
      const afterAt = match[0].substring(match[0].lastIndexOf('@') + 1)
      if (!/^[a-zA-Z0-9.-]+/.test(afterAt)) {
        return null
      }

      console.log('[PasteGuard] Found DB_PASSWORD (standalone):', password.substring(0, 20) + (password.length > 20 ? '...' : ''))

      return {
        original: password,
        startIndex: match.index! + passwordIndex,
        endIndex: match.index! + passwordIndex + password.length
      }
    }
  }
]
