// 值提取器 - 根据场景类型提取 value 部分

import type { SceneType } from './sceneDetector'

// 根据场景类型提取值
export const extractValue = (text: string, scene: SceneType): string => {
  switch (scene) {
    case 'yaml':
      // "DB_PASSWORD: xxx" → "xxx"
      const yamlMatch = text.match(/^[^:]+:\s*(.+)$/)
      return yamlMatch ? yamlMatch[1].trim() : text
    
    case 'env':
      // "DB_PASSWORD=xxx" → "xxx"
      const envMatch = text.match(/^[^=]+=\s*(.+)$/)
      return envMatch ? envMatch[1].trim() : text
    
    case 'json':
      // '"password": "xxx"' → "xxx"
      const jsonMatch = text.match(/"([^"]+)"\s*:\s*"([^"]+)"/)
      return jsonMatch ? jsonMatch[2] : text
    
    case 'code':
      // "password = 'xxx'" → "xxx"
      const codeMatch = text.match(/^[^=]+=\s*['"]?([^'"]+)['"]?$/)
      return codeMatch ? codeMatch[1].trim() : text
    
    case 'log':
      // 日志中的值通常在冒号后面
      const logMatch = text.match(/^[^:]+:\s*(.+)$/)
      return logMatch ? logMatch[1].trim() : text
    
    default:
      return text
  }
}

// 清理值（去除引号和空白）
export const cleanValue = (value: string): string => {
  return value
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+$/, '')
}
