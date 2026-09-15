// 五步检测管线

import type { DetectionItem, DetectionResult, DetectionType, Confidence } from '../types'
import { detectScene, type SceneResult, isSceneModelReady } from './sceneDetector'
import { detectContent, categorizeEntity, type ContentEntity, isContentModelReady } from './contentDetector'
import { scanRegexRules, regexRules } from './regexRules'

// 检测引擎配置
interface DetectorConfig {
  enableSceneDetection: boolean
  enableContentDetection: boolean
  enableRegexFallback: boolean
}

const defaultConfig: DetectorConfig = {
  enableSceneDetection: true,
  enableContentDetection: true,
  enableRegexFallback: true
}

// 生成唯一 ID
let idCounter = 0
const generateId = (): string => `det_${++idCounter}`

// GLiNER 实体类型到 DetectionType 的映射
const entityTypeMap: Record<string, DetectionType> = {
  'password': 'ENV_PASSWORD',
  'secret': 'ENV_PASSWORD',
  'api_key': 'API_KEY',
  'access_token': 'API_KEY',
  'connection_string': 'DB_PASSWORD',
  'database_credentials': 'DB_PASSWORD',
  'private_key': 'PRIVATE_KEY',
  'jwt_token': 'JWT',
  'credential': 'ENV_PASSWORD',
  'token': 'API_KEY'
}

// 将 ContentEntity 转换为 DetectionItem
const toDetectionItem = (entity: ContentEntity): DetectionItem => {
  const type = entityTypeMap[entity.entityType] || 'HIGH_ENTROPY'
  const confidence: Confidence = entity.confidence > 0.8 ? 'high' : entity.confidence > 0.5 ? 'medium' : 'low'
  
  return {
    id: generateId(),
    type,
    original: entity.text,
    placeholder: `<<${type}:0>>`,
    startIndex: entity.startIndex,
    endIndex: entity.endIndex,
    confidence,
    context: entity.text,
    detectionTypes: [type],
    source: 'model'
  }
}

// 正则验证敏感实体
const validateSensitiveEntity = (entity: ContentEntity): boolean => {
  const value = entity.text
  
  // API Key 格式验证
  if (entity.entityType === 'api_key') {
    if (/^(sk-|AKIA|ghp_|xox[baprs]-)/.test(value)) return true
    if (/^[A-Za-z0-9]{20,}$/.test(value)) return true
    return false
  }
  
  // 连接串格式验证
  if (entity.entityType === 'connection_string') {
    if (/^[a-z]+:\/\/[^\s]+/.test(value)) return true
    return false
  }
  
  // JWT 格式验证
  if (entity.entityType === 'jwt_token') {
    if (/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return true
    return false
  }
  
  // 通用值质量校验（模型结果也需要）
  if (value.length < 4) return false
  if (/^\d+$/.test(value)) return false
  const weakPasswords = ['password', 'admin', 'secret', '123456', 'root', 'test', 'changeme', 'default']
  if (weakPasswords.includes(value.toLowerCase())) return false
  
  // 其他类型保持原判断
  return true
}

// 去重（位置去重 + 值去重）
const deduplicate = (items: DetectionItem[]): DetectionItem[] => {
  // 第一轮：按位置去重
  const positionSeen = new Map<string, DetectionItem>()
  
  for (const item of items) {
    const key = `${item.startIndex}-${item.endIndex}`
    const existing = positionSeen.get(key)
    
    if (existing) {
      // 合并类型
      const existingTypes = existing.detectionTypes || [existing.type]
      const newTypes = item.detectionTypes || [item.type]
      const allTypes = new Set([...existingTypes, ...newTypes])
      existing.detectionTypes = Array.from(allTypes)
      
      // 更新置信度（取最高）
      const confidenceOrder = { 'high': 3, 'medium': 2, 'low': 1 }
      const existingScore = confidenceOrder[existing.confidence] || 0
      const newScore = confidenceOrder[item.confidence] || 0
      if (newScore > existingScore) {
        existing.confidence = item.confidence
      }

      // 保留有 source 的版本
      if (item.source && !existing.source) {
        existing.source = item.source
      }
    } else {
      positionSeen.set(key, { ...item })
    }
  }
  
  const positionDeduped = Array.from(positionSeen.values())
  
  // 第二轮：按值去重（相同 original 值只保留第一条）
  const valueSeen = new Map<string, DetectionItem>()
  const valueDeduped: DetectionItem[] = []
  
  for (const item of positionDeduped) {
    const existing = valueSeen.get(item.original)
    if (existing) {
      // 合并类型到保留项
      const existingTypes = existing.detectionTypes || [existing.type]
      const newTypes = item.detectionTypes || [item.type]
      const allTypes = new Set([...existingTypes, ...newTypes])
      existing.detectionTypes = Array.from(allTypes)
      
      // 更新置信度（取最高）
      const confidenceOrder = { 'high': 3, 'medium': 2, 'low': 1 }
      const existingScore = confidenceOrder[existing.confidence] || 0
      const newScore = confidenceOrder[item.confidence] || 0
      if (newScore > existingScore) {
        existing.confidence = item.confidence
      }
    } else {
      valueSeen.set(item.original, item)
      valueDeduped.push(item)
    }
  }
  
  return valueDeduped
}

// 重新生成占位符
const regeneratePlaceholders = (items: DetectionItem[]): DetectionItem[] => {
  const typeCounters: Record<string, number> = {}
  
  return items.map(item => {
    typeCounters[item.type] = (typeCounters[item.type] || 0) + 1
    return {
      ...item,
      placeholder: `<<${item.type}:${typeCounters[item.type]}>>`
    }
  })
}

// 主检测函数
export const detect = async (
  text: string,
  config: Partial<DetectorConfig> = {}
): Promise<DetectionResult> => {
  const mergedConfig = { ...defaultConfig, ...config }
  let items: DetectionItem[] = []

  console.log('[PasteGuard] Pipeline started. Text length:', text.length)

  // 始终运行正则规则（作为基础检测和回退）
  console.log('[PasteGuard] Running regex rules...')
  const regexItems = scanRegexRules(text, regexRules)
  console.log('[PasteGuard] Regex found', regexItems.length, 'items')
  
  // 为正则结果添加 source 标记
  for (const item of regexItems) {
    items.push({
      ...item,
      source: 'regex'
    })
  }

  // Step 1: 场景识别（如果模型可用）
  let scene: SceneResult = { type: 'plain', confidence: 0, scores: {} as any }
  if (mergedConfig.enableSceneDetection && isSceneModelReady()) {
    try {
      scene = await detectScene(text)
      console.log('[PasteGuard] Scene:', scene.type, `(${(scene.confidence * 100).toFixed(1)}%)`)
    } catch (error) {
      console.warn('[PasteGuard] Scene detection failed, using default:', error)
    }
  }

  // Step 2-4: 内容检测（如果模型可用）
  if (mergedConfig.enableContentDetection && isContentModelReady()) {
    try {
      const entities = await detectContent(text, scene.type)
      console.log('[PasteGuard] Found', entities.length, 'entities from model')

      // 分类实体
      const sensitive = entities.filter(e => categorizeEntity(e) === 'sensitive')
      const uncertain = entities.filter(e => categorizeEntity(e) === 'uncertain')
      
      console.log(`[PasteGuard] Model categories: ${sensitive.length} sensitive, ${uncertain.length} uncertain`)

      // Step 5a: 验证并添加高置信度模型结果
      const validatedSensitive = sensitive.filter(e => validateSensitiveEntity(e))
      for (const entity of validatedSensitive) {
        const item = toDetectionItem(entity)
        // 检查是否已被正则覆盖
        const coveredByRegex = items.some(existing => 
          existing.startIndex <= item.startIndex && 
          existing.endIndex >= item.endIndex
        )
        if (!coveredByRegex) {
          items.push(item)
        }
      }
    } catch (error) {
      console.warn('[PasteGuard] Content detection failed, using regex only:', error)
    }
  } else {
    console.log('[PasteGuard] Model not ready, using regex only')
  }

  // 去重 + 排序
  items = deduplicate(items)
  items.sort((a, b) => a.startIndex - b.startIndex)

  // 生成占位符
  items = regeneratePlaceholders(items)

  console.log('[PasteGuard] Pipeline completed. Total items:', items.length)

  return { items, text }
}

// 预加载所有模型
export const preloadModels = async (): Promise<void> => {
  const { preloadSceneModel } = await import('./sceneDetector')
  const { preloadContentModel } = await import('./contentDetector')
  
  await Promise.all([
    preloadSceneModel().catch(e => console.warn('[PasteGuard] Scene model preload failed:', e)),
    preloadContentModel().catch(e => console.warn('[PasteGuard] Content model preload failed:', e))
  ])
}
