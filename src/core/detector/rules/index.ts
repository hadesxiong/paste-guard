// 规则模块汇总导出

import type { DetectionRule } from '../../types'
import { envPasswordRules } from './envPasswordRules'
import { dbPasswordRules } from './dbPasswordRules'
import { apiKeyRules } from './apiKeyRules'
import { privateKeyRules } from './privateKeyRules'

// 所有正则规则（按优先级排列）
export const regexRules: DetectionRule[] = [
  ...envPasswordRules,
  ...dbPasswordRules,
  ...apiKeyRules,
  ...privateKeyRules
]

// 重新导出扫描器
export { scanRegexRules } from './scanner'

// 重新导出常量和过滤器（供外部使用）
export { SENSITIVE_KEYWORDS, NON_SENSITIVE_KEYWORDS, DB_SCHEMES } from './constants'
export { isWeakPassword, isTooShort, isNumericOnly, shouldSkipValue, WEAK_PASSWORDS } from './valueFilters'
export { detectHighEntropy, calculateEntropy } from './highEntropyRules'
