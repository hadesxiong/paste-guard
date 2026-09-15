// API_KEY 规则 - API 密钥检测

import type { DetectionRule } from '../../types'

export const apiKeyRules: DetectionRule[] = [
  // OpenAI API Key (支持 sk- 和 sk-proj- 格式)
  {
    type: 'API_KEY',
    pattern: /sk-(?:proj-)?[A-Za-z0-9]{20,}/g,
    confidence: 'high'
  },
  // JWT Secret / 通用 Secret Key（如 jwt-secret-key-xxx, secret-key-xxx 等）
  {
    type: 'API_KEY',
    pattern: /\b(?:jwt[_-]?secret|secret[_-]?key)[_-]?[A-Za-z0-9\-_]{16,}/gi,
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
  }
]
