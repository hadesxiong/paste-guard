// HIGH_ENTROPY 规则 - 高熵字符串检测

import type { DetectionItem } from '../../types'

// 计算高熵字符串的信息熵
export const calculateEntropy = (str: string): number => {
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

// 生成唯一ID
let idCounter = 0
const generateId = (): string => `det_${++idCounter}_${Date.now()}`

// 检测高熵字符串
export const detectHighEntropy = (text: string): DetectionItem[] => {
  const items: DetectionItem[] = []
  // 匹配长度>=25的字符串（支持更多特殊字符）
  const pattern = /[A-Za-z0-9!@#$%^&*()_+\-=\/\\[\]{}:;"'.,<>?~`|]{25,}/g
  let match

  while ((match = pattern.exec(text)) !== null) {
    const str = match[0]
    const entropy = calculateEntropy(str)

    // 熵值>3.5 且至少包含 2 类字符（大小写/数字/特殊字符）
    const hasLower = /[a-z]/.test(str)
    const hasUpper = /[A-Z]/.test(str)
    const hasDigit = /[0-9]/.test(str)
    const hasSpecial = /[^A-Za-z0-9]/.test(str)
    const charClasses = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length

    if (entropy > 3.5 && charClasses >= 2) {
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
