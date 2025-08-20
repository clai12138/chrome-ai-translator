/**
 * Chrome 扩展存储管理器 - 简化版本
 */
class StorageManager {
  constructor() {
    this.STORAGE_KEYS = {
      LANGUAGE_PREFERENCES: 'languagePreferences',
      TRANSLATION_HISTORY: 'translationHistory',
      EXTENSION_SETTINGS: 'extensionSettings'
    }
    
    // 默认设置
    this.DEFAULT_PREFERENCES = {
      sourceLanguage: 'en',
      targetLanguage: 'zh'
    }
    
    this.DEFAULT_SETTINGS = {
      enableStreaming: true,
      historyLimit: 50,
      activeTab: 'translate'
    }
  }

  /**
   * 检查存储API可用性
   */
  isStorageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage
  }

  /**
   * 获取语言偏好设置
   */
  async getLanguagePreferences() {
    try {
      if (!this.isStorageAvailable()) {
        // 浏览器环境，使用localStorage
        const stored = localStorage.getItem(this.STORAGE_KEYS.LANGUAGE_PREFERENCES)
        return stored ? JSON.parse(stored) : this.DEFAULT_PREFERENCES
      }
      
      const result = await chrome.storage.sync.get(this.STORAGE_KEYS.LANGUAGE_PREFERENCES)
      return result[this.STORAGE_KEYS.LANGUAGE_PREFERENCES] || this.DEFAULT_PREFERENCES
    } catch (error) {
      console.error('获取语言偏好失败:', error)
      return this.DEFAULT_PREFERENCES
    }
  }

  /**
   * 设置语言偏好
   */
  async setLanguagePreferences(sourceLanguage, targetLanguage) {
    try {
      const preferences = { sourceLanguage, targetLanguage }
      
      if (!this.isStorageAvailable()) {
        localStorage.setItem(this.STORAGE_KEYS.LANGUAGE_PREFERENCES, JSON.stringify(preferences))
        return
      }
      
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.LANGUAGE_PREFERENCES]: preferences
      })
    } catch (error) {
      console.error('保存语言偏好失败:', error)
      throw error
    }
  }

  /**
   * 获取翻译历史
   */
  async getTranslationHistory() {
    try {
      if (!this.isStorageAvailable()) {
        const stored = localStorage.getItem(this.STORAGE_KEYS.TRANSLATION_HISTORY)
        return stored ? JSON.parse(stored) : []
      }
      
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.TRANSLATION_HISTORY)
      return result[this.STORAGE_KEYS.TRANSLATION_HISTORY] || []
    } catch (error) {
      console.error('获取翻译历史失败:', error)
      return []
    }
  }

  /**
   * 添加翻译历史记录
   */
  async addTranslationHistory(item) {
    try {
      const history = await this.getTranslationHistory()
      
      // 添加到历史记录开头
      history.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...item
      })
      
      // 限制历史记录数量
      const settings = await this.getSettings()
      const maxHistory = settings.historyLimit || 50
      if (history.length > maxHistory) {
        history.splice(maxHistory)
      }
      
      if (!this.isStorageAvailable()) {
        localStorage.setItem(this.STORAGE_KEYS.TRANSLATION_HISTORY, JSON.stringify(history))
        return
      }
      
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.TRANSLATION_HISTORY]: history
      })
    } catch (error) {
      console.error('添加翻译历史失败:', error)
      throw error
    }
  }

  /**
   * 清除翻译历史
   */
  async clearHistory() {
    try {
      if (!this.isStorageAvailable()) {
        localStorage.removeItem(this.STORAGE_KEYS.TRANSLATION_HISTORY)
        return
      }
      
      await chrome.storage.local.remove(this.STORAGE_KEYS.TRANSLATION_HISTORY)
    } catch (error) {
      console.error('清除翻译历史失败:', error)
      throw error
    }
  }

  /**
   * 获取扩展设置
   */
  async getSettings() {
    try {
      if (!this.isStorageAvailable()) {
        const stored = localStorage.getItem(this.STORAGE_KEYS.EXTENSION_SETTINGS)
        return stored ? JSON.parse(stored) : this.DEFAULT_SETTINGS
      }
      
      const result = await chrome.storage.sync.get(this.STORAGE_KEYS.EXTENSION_SETTINGS)
      return result[this.STORAGE_KEYS.EXTENSION_SETTINGS] || this.DEFAULT_SETTINGS
    } catch (error) {
      console.error('获取扩展设置失败:', error)
      return this.DEFAULT_SETTINGS
    }
  }

  /**
   * 更新扩展设置
   */
  async updateSettings(settings) {
    try {
      if (!this.isStorageAvailable()) {
        localStorage.setItem(this.STORAGE_KEYS.EXTENSION_SETTINGS, JSON.stringify(settings))
        return
      }
      
      await chrome.storage.sync.set({
        [this.STORAGE_KEYS.EXTENSION_SETTINGS]: settings
      })
    } catch (error) {
      console.error('更新扩展设置失败:', error)
      throw error
    }
  }

  // ==================== 翻译缓存相关方法 ====================

  /**
   * 生成缓存键
   */
  generateCacheKey(sourceText, sourceLanguage, targetLanguage) {
    // 标准化文本（去除首尾空格，转换为小写）
    const normalizedText = sourceText.trim().toLowerCase()
    
    // 组合键字符串
    const keyString = `${normalizedText}|${sourceLanguage}|${targetLanguage}`
    
    // 使用简单哈希算法生成键
    let hash = 0
    for (let i = 0; i < keyString.length; i++) {
      const char = keyString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    
    return Math.abs(hash).toString(36)
  }

  /**
   * 获取翻译缓存
   */
  async getTranslationCache() {
    try {
      if (!this.isStorageAvailable()) {
        const stored = localStorage.getItem(this.STORAGE_KEYS.TRANSLATION_CACHE)
        return stored ? JSON.parse(stored) : {}
      }
      
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.TRANSLATION_CACHE)
      return result[this.STORAGE_KEYS.TRANSLATION_CACHE] || {}
    } catch (error) {
      console.error('获取翻译缓存失败:', error)
      return {}
    }
  }

  /**
   * 保存翻译缓存
   */
  async saveTranslationCache(cache) {
    try {
      if (!this.isStorageAvailable()) {
        localStorage.setItem(this.STORAGE_KEYS.TRANSLATION_CACHE, JSON.stringify(cache))
        return
      }
      
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.TRANSLATION_CACHE]: cache
      })
    } catch (error) {
      console.error('保存翻译缓存失败:', error)
    }
  }

  /**
   * 从缓存获取翻译结果
   */
  async getCachedTranslation(sourceText, sourceLanguage, targetLanguage) {
    try {
      // 检查是否启用缓存
      const settings = await this.getSettings()
      if (!settings.enableCache) {
        return null
      }

      const cache = await this.getTranslationCache()
      const cacheKey = this.generateCacheKey(sourceText, sourceLanguage, targetLanguage)
      const cachedResult = cache[cacheKey]

      if (cachedResult) {
        // 检查缓存是否过期
        const now = Date.now()
        const cacheAge = now - cachedResult.timestamp
        const maxAge = settings.cacheExpireDays * 24 * 60 * 60 * 1000

        if (cacheAge < maxAge) {
          console.log('使用缓存的翻译结果:', cacheKey)
          return cachedResult.result
        } else {
          // 缓存过期，删除该条目
          delete cache[cacheKey]
          await this.saveTranslationCache(cache)
        }
      }

      return null
    } catch (error) {
      console.error('获取缓存翻译失败:', error)
      return null
    }
  }

  /**
   * 缓存翻译结果
   */
  async cacheTranslation(sourceText, sourceLanguage, targetLanguage, result) {
    try {
      // 检查是否启用缓存
      const settings = await this.getSettings()
      if (!settings.enableCache) {
        return
      }

      const cache = await this.getTranslationCache()
      const cacheKey = this.generateCacheKey(sourceText, sourceLanguage, targetLanguage)

      // 添加新的缓存条目
      cache[cacheKey] = {
        sourceText,
        sourceLanguage,
        targetLanguage,
        result,
        timestamp: Date.now()
      }

      // 限制缓存大小，保留最近的条目
      const cacheEntries = Object.entries(cache)
      if (cacheEntries.length > settings.cacheLimit) {
        // 按时间戳排序，删除最旧的条目
        cacheEntries.sort((a, b) => b[1].timestamp - a[1].timestamp)
        const newCache = {}
        cacheEntries.slice(0, settings.cacheLimit).forEach(([key, value]) => {
          newCache[key] = value
        })
        await this.saveTranslationCache(newCache)
        console.log(`缓存大小超限，已清理旧条目，保留最近${settings.cacheLimit}条`)
      } else {
        await this.saveTranslationCache(cache)
      }

      console.log('翻译结果已缓存:', cacheKey)
    } catch (error) {
      console.error('缓存翻译结果失败:', error)
    }
  }

  /**
   * 清空翻译缓存
   */
  async clearTranslationCache() {
    try {
      if (!this.isStorageAvailable()) {
        localStorage.removeItem(this.STORAGE_KEYS.TRANSLATION_CACHE)
        return
      }
      
      await chrome.storage.local.remove(this.STORAGE_KEYS.TRANSLATION_CACHE)
      console.log('翻译缓存已清空')
    } catch (error) {
      console.error('清空翻译缓存失败:', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats() {
    try {
      const cache = await this.getTranslationCache()
      const entries = Object.entries(cache)
      const count = entries.length
      
      // 计算缓存大小（粗略估算）
      const sizeInBytes = JSON.stringify(cache).length * 2 // UTF-16编码，每字符2字节
      
      return {
        count,
        sizeInBytes,
        sizeFormatted: this.formatSize(sizeInBytes)
      }
    } catch (error) {
      console.error('获取缓存统计失败:', error)
      return { count: 0, sizeInBytes: 0, sizeFormatted: '0 B' }
    }
  }

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// 导出单例实例
export default new StorageManager()