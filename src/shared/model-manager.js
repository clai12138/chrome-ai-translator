import { ERROR_TYPES, SUPPORTED_LANGUAGES, TRANSLATOR_CONFIG } from './constants.json'
import ErrorHandler from './error-handler.js'

/**
 * Chrome 内置模型管理器
 * 负责管理 Chrome Translator API 的模型下载、可用性检查和状态监控
 * 需求: 6.1, 6.2 - Chrome 内置模型管理功能
 */
class ModelManager {
  constructor() {
    this.downloadProgress = new Map() // 存储下载进度信息
    this.modelStatus = new Map() // 存储模型状态信息
    this.downloadRetryCount = new Map() // 存储重试次数
    this.eventListeners = new Map() // 存储事件监听器
    this.maxRetryAttempts = 3
    this.retryDelay = 2000 // 2秒重试延迟
  }

  /**
   * 检查 Chrome Translator API 的模型可用性
   * 需求: 6.1 - 模型可用性检查
   * @param {string} sourceLanguage - 源语言代码
   * @param {string} targetLanguage - 目标语言代码
   * @returns {Promise<Object>} 模型可用性信息
   */
  async checkModelAvailability(sourceLanguage, targetLanguage) {
    const languagePair = `${sourceLanguage}-${targetLanguage}`
    
    try {
      // 检查浏览器支持
      const browserSupport = ErrorHandler.checkBrowserSupport()
      if (!browserSupport.isSupported) {
        return {
          languagePair,
          available: false,
          downloadable: false,
          downloading: false,
          error: browserSupport.message,
          browserSupported: false
        }
      }

      // 使用 Chrome Translator API 检查可用性
      const availability = await Translator.availability({
        sourceLanguage,
        targetLanguage
      })

      const modelInfo = {
        languagePair,
        sourceLanguage,
        targetLanguage,
        availability,
        available: availability === 'available',
        downloadable: availability === 'downloadable',
        downloading: availability === 'downloading',
        browserSupported: true,
        lastChecked: Date.now()
      }

      // 更新模型状态缓存
      this.modelStatus.set(languagePair, modelInfo)

      // 如果正在下载，获取下载进度
      if (availability === 'downloading') {
        const progressInfo = this.downloadProgress.get(languagePair)
        if (progressInfo) {
          modelInfo.downloadProgress = progressInfo.progress
          modelInfo.downloadStartTime = progressInfo.startTime
          modelInfo.estimatedTimeRemaining = progressInfo.estimatedTimeRemaining
        }
      }

      return modelInfo

    } catch (error) {
      ErrorHandler.logError('模型可用性检查', error)
      
      const errorInfo = {
        languagePair,
        sourceLanguage,
        targetLanguage,
        available: false,
        downloadable: false,
        downloading: false,
        error: error.message,
        browserSupported: true,
        lastChecked: Date.now()
      }

      this.modelStatus.set(languagePair, errorInfo)
      return errorInfo
    }
  }

  /**
   * 添加模型下载进度监控
   * 需求: 6.2 - 模型下载进度监控
   * @param {string} sourceLanguage - 源语言代码
   * @param {string} targetLanguage - 目标语言代码
   * @param {Function} onProgress - 进度回调函数
   * @param {Function} onComplete - 完成回调函数
   * @param {Function} onError - 错误回调函数
   * @returns {Promise<Object>} 翻译器实例或错误信息
   */
  async downloadModelWithProgress(sourceLanguage, targetLanguage, onProgress, onComplete, onError) {
    const languagePair = `${sourceLanguage}-${targetLanguage}`
    
    try {
      // 首先检查模型可用性
      const availability = await this.checkModelAvailability(sourceLanguage, targetLanguage)
      
      if (availability.available) {
        // 模型已可用，直接返回
        if (onComplete) {
          onComplete({
            languagePair,
            status: 'already_available',
            message: '模型已可用'
          })
        }
        return await this._createTranslatorInstance(sourceLanguage, targetLanguage)
      }

      if (!availability.downloadable) {
        // 模型不可下载
        const error = new Error(`语言对 ${languagePair} 不支持下载`)
        if (onError) {
          onError(error, languagePair)
        }
        throw error
      }

      // 初始化下载进度信息
      const downloadInfo = {
        languagePair,
        progress: 0,
        startTime: Date.now(),
        status: 'initializing',
        estimatedTimeRemaining: null,
        downloadSpeed: 0,
        totalSize: null,
        downloadedSize: 0
      }

      this.downloadProgress.set(languagePair, downloadInfo)

      // 创建进度监控函数
      const progressHandler = (event) => {
        this._handleDownloadProgress(event, languagePair, onProgress)
      }

      // 创建翻译器实例并监控下载进度
      const translator = await Translator.create({
        sourceLanguage,
        targetLanguage,
        monitor: (m) => {
          // 添加下载进度事件监听器
          m.addEventListener('downloadprogress', progressHandler)
          
          // 存储监听器引用以便后续清理
          this.eventListeners.set(languagePair, {
            monitor: m,
            handler: progressHandler
          })
        }
      })

      // 下载完成
      downloadInfo.status = 'completed'
      downloadInfo.progress = 100
      downloadInfo.completedTime = Date.now()
      downloadInfo.totalTime = downloadInfo.completedTime - downloadInfo.startTime

      // 更新模型状态
      const modelInfo = await this.checkModelAvailability(sourceLanguage, targetLanguage)
      
      if (onComplete) {
        onComplete({
          languagePair,
          status: 'completed',
          totalTime: downloadInfo.totalTime,
          translator,
          modelInfo
        })
      }

      // 清理下载进度信息
      this.downloadProgress.delete(languagePair)
      this._cleanupEventListeners(languagePair)

      return translator

    } catch (error) {
      ErrorHandler.logError('模型下载', error)
      
      // 更新下载状态为失败
      const downloadInfo = this.downloadProgress.get(languagePair)
      if (downloadInfo) {
        downloadInfo.status = 'failed'
        downloadInfo.error = error.message
        downloadInfo.failedTime = Date.now()
      }

      if (onError) {
        onError(error, languagePair)
      }

      // 清理资源
      this._cleanupEventListeners(languagePair)
      
      throw error
    }
  }

  /**
   * 处理下载进度事件
   * @param {Event} event - 下载进度事件
   * @param {string} languagePair - 语言对标识
   * @param {Function} onProgress - 进度回调函数
   */
  _handleDownloadProgress(event, languagePair, onProgress) {
    const downloadInfo = this.downloadProgress.get(languagePair)
    if (!downloadInfo) return

    // 更新进度信息
    if (event.loaded !== undefined && event.total !== undefined) {
      downloadInfo.progress = Math.round((event.loaded / event.total) * 100)
      downloadInfo.downloadedSize = event.loaded
      downloadInfo.totalSize = event.total
      downloadInfo.status = 'downloading'

      // 计算下载速度
      const currentTime = Date.now()
      const elapsedTime = (currentTime - downloadInfo.startTime) / 1000 // 秒
      if (elapsedTime > 0) {
        downloadInfo.downloadSpeed = event.loaded / elapsedTime // 字节/秒
        
        // 估算剩余时间
        const remainingBytes = event.total - event.loaded
        if (downloadInfo.downloadSpeed > 0) {
          downloadInfo.estimatedTimeRemaining = Math.round(remainingBytes / downloadInfo.downloadSpeed)
        }
      }
    }

    // 调用进度回调
    if (onProgress && typeof onProgress === 'function') {
      onProgress({
        languagePair,
        progress: downloadInfo.progress,
        downloadedSize: downloadInfo.downloadedSize,
        totalSize: downloadInfo.totalSize,
        downloadSpeed: downloadInfo.downloadSpeed,
        estimatedTimeRemaining: downloadInfo.estimatedTimeRemaining,
        elapsedTime: Math.round((Date.now() - downloadInfo.startTime) / 1000),
        status: downloadInfo.status
      })
    }
  }

  /**
   * 实现语言对支持状态检查
   * 需求: 6.1 - 语言对支持状态检查
   * @param {Array<Object>} languagePairs - 语言对数组 [{source, target}, ...]
   * @returns {Promise<Array<Object>>} 语言对支持状态数组
   */
  async checkLanguagePairSupport(languagePairs) {
    if (!Array.isArray(languagePairs)) {
      throw new Error('languagePairs 必须是数组')
    }

    const results = []
    
    // 并发检查所有语言对
    const checkPromises = languagePairs.map(async (pair) => {
      if (!pair.source || !pair.target) {
        return {
          ...pair,
          supported: false,
          error: '无效的语言对配置'
        }
      }

      try {
        const availability = await this.checkModelAvailability(pair.source, pair.target)
        return {
          ...pair,
          ...availability,
          supported: availability.available || availability.downloadable
        }
      } catch (error) {
        return {
          ...pair,
          supported: false,
          error: error.message
        }
      }
    })

    const checkResults = await Promise.allSettled(checkPromises)
    
    checkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        results.push({
          ...languagePairs[index],
          supported: false,
          error: result.reason?.message || '检查失败'
        })
      }
    })

    return results
  }

  /**
   * 添加模型下载失败时的用户提示
   * 需求: 6.2 - 模型下载失败时的用户提示
   * @param {string} sourceLanguage - 源语言代码
   * @param {string} targetLanguage - 目标语言代码
   * @param {Error} error - 错误对象
   * @returns {Object} 用户提示信息
   */
  generateDownloadFailurePrompt(sourceLanguage, targetLanguage, error) {
    const languagePair = `${sourceLanguage}-${targetLanguage}`
    const retryCount = this.downloadRetryCount.get(languagePair) || 0
    
    // 分析错误类型
    const errorAnalysis = this._analyzeDownloadError(error)
    
    const prompt = {
      languagePair,
      sourceLanguage,
      targetLanguage,
      error: error.message,
      errorType: errorAnalysis.type,
      severity: errorAnalysis.severity,
      retryCount,
      canRetry: retryCount < this.maxRetryAttempts && errorAnalysis.retryable,
      suggestions: this._generateErrorSuggestions(errorAnalysis, retryCount),
      actions: this._generateErrorActions(errorAnalysis, retryCount, languagePair)
    }

    return prompt
  }

  /**
   * 分析下载错误类型
   * @param {Error} error - 错误对象
   * @returns {Object} 错误分析结果
   */
  _analyzeDownloadError(error) {
    const errorMessage = error.message.toLowerCase()
    
    if (errorMessage.includes('network') || errorMessage.includes('连接')) {
      return {
        type: 'network',
        severity: 'medium',
        retryable: true,
        category: '网络错误'
      }
    }
    
    if (errorMessage.includes('storage') || errorMessage.includes('空间') || errorMessage.includes('disk')) {
      return {
        type: 'storage',
        severity: 'high',
        retryable: false,
        category: '存储空间不足'
      }
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('权限')) {
      return {
        type: 'permission',
        severity: 'high',
        retryable: false,
        category: '权限错误'
      }
    }
    
    if (errorMessage.includes('not supported') || errorMessage.includes('不支持')) {
      return {
        type: 'unsupported',
        severity: 'high',
        retryable: false,
        category: '不支持的语言对'
      }
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
      return {
        type: 'timeout',
        severity: 'medium',
        retryable: true,
        category: '下载超时'
      }
    }
    
    return {
      type: 'unknown',
      severity: 'medium',
      retryable: true,
      category: '未知错误'
    }
  }

  /**
   * 生成错误建议
   * @param {Object} errorAnalysis - 错误分析结果
   * @param {number} retryCount - 重试次数
   * @returns {Array<string>} 建议列表
   */
  _generateErrorSuggestions(errorAnalysis, retryCount) {
    const suggestions = []
    
    switch (errorAnalysis.type) {
      case 'network':
        suggestions.push('检查网络连接是否正常')
        suggestions.push('尝试切换到更稳定的网络环境')
        if (retryCount > 0) {
          suggestions.push('稍后再试，网络可能暂时不稳定')
        }
        break
        
      case 'storage':
        suggestions.push('清理设备存储空间')
        suggestions.push('删除不需要的文件或应用')
        suggestions.push('考虑使用存储空间更小的语言对')
        break
        
      case 'permission':
        suggestions.push('检查浏览器权限设置')
        suggestions.push('确保允许扩展访问必要的功能')
        suggestions.push('尝试重新安装扩展')
        break
        
      case 'unsupported':
        suggestions.push('该语言对暂不支持离线翻译')
        suggestions.push('尝试使用其他支持的语言对')
        suggestions.push('等待后续版本支持')
        break
        
      case 'timeout':
        suggestions.push('网络速度可能较慢，请耐心等待')
        suggestions.push('尝试在网络较好的时间段下载')
        if (retryCount > 0) {
          suggestions.push('考虑分多次下载')
        }
        break
        
      default:
        suggestions.push('尝试重新启动浏览器')
        suggestions.push('检查Chrome版本是否为最新')
        suggestions.push('联系技术支持获取帮助')
    }
    
    return suggestions
  }

  /**
   * 生成错误处理动作
   * @param {Object} errorAnalysis - 错误分析结果
   * @param {number} retryCount - 重试次数
   * @param {string} languagePair - 语言对标识
   * @returns {Array<Object>} 动作列表
   */
  _generateErrorActions(errorAnalysis, retryCount, languagePair) {
    const actions = []
    
    // 重试动作
    if (errorAnalysis.retryable && retryCount < this.maxRetryAttempts) {
      actions.push({
        type: 'retry',
        label: `重试下载 (${retryCount + 1}/${this.maxRetryAttempts})`,
        primary: true,
        handler: () => this.retryDownload(languagePair)
      })
    }
    
    // 取消动作
    actions.push({
      type: 'cancel',
      label: '取消下载',
      primary: false,
      handler: () => this.cancelDownload(languagePair)
    })
    
    // 特定错误类型的动作
    switch (errorAnalysis.type) {
      case 'unsupported':
        actions.push({
          type: 'alternatives',
          label: '查看替代方案',
          primary: false,
          handler: () => this.showLanguageAlternatives(languagePair)
        })
        break
        
      case 'storage':
        actions.push({
          type: 'cleanup',
          label: '清理存储空间',
          primary: false,
          handler: () => this.showStorageCleanup()
        })
        break
        
      case 'permission':
        actions.push({
          type: 'settings',
          label: '检查权限设置',
          primary: false,
          handler: () => this.openPermissionSettings()
        })
        break
    }
    
    return actions
  }

  /**
   * 重试下载模型
   * @param {string} languagePair - 语言对标识
   * @returns {Promise<void>}
   */
  async retryDownload(languagePair) {
    const [sourceLanguage, targetLanguage] = languagePair.split('-')
    const currentRetryCount = this.downloadRetryCount.get(languagePair) || 0
    
    if (currentRetryCount >= this.maxRetryAttempts) {
      throw new Error('已达到最大重试次数')
    }
    
    // 增加重试次数
    this.downloadRetryCount.set(languagePair, currentRetryCount + 1)
    
    // 等待重试延迟
    await new Promise(resolve => setTimeout(resolve, this.retryDelay * (currentRetryCount + 1)))
    
    // 重新尝试下载
    return this.downloadModelWithProgress(
      sourceLanguage,
      targetLanguage,
      null, // 进度回调由调用方提供
      null, // 完成回调由调用方提供
      null  // 错误回调由调用方提供
    )
  }

  /**
   * 取消下载
   * @param {string} languagePair - 语言对标识
   */
  cancelDownload(languagePair) {
    // 清理下载进度信息
    this.downloadProgress.delete(languagePair)
    this.downloadRetryCount.delete(languagePair)
    
    // 清理事件监听器
    this._cleanupEventListeners(languagePair)
    
    console.log(`已取消 ${languagePair} 的模型下载`)
  }

  /**
   * 显示语言替代方案
   * @param {string} languagePair - 不支持的语言对
   * @returns {Array<Object>} 替代语言对建议
   */
  showLanguageAlternatives(languagePair) {
    const [sourceLanguage, targetLanguage] = languagePair.split('-')
    const alternatives = []
    
    // 基于源语言的替代方案
    const commonTargets = ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es']
    commonTargets.forEach(target => {
      if (target !== targetLanguage && target !== sourceLanguage) {
        alternatives.push({
          sourceLanguage,
          targetLanguage: target,
          reason: `${sourceLanguage} -> ${target} 可能支持`
        })
      }
    })
    
    // 基于目标语言的替代方案
    const commonSources = ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es']
    commonSources.forEach(source => {
      if (source !== sourceLanguage && source !== targetLanguage) {
        alternatives.push({
          sourceLanguage: source,
          targetLanguage,
          reason: `${source} -> ${targetLanguage} 可能支持`
        })
      }
    })
    
    return alternatives.slice(0, 5) // 返回前5个建议
  }

  /**
   * 显示存储清理建议
   * @returns {Object} 存储清理信息
   */
  showStorageCleanup() {
    return {
      message: '存储空间不足，请清理设备存储空间',
      suggestions: [
        '删除不需要的文件和应用',
        '清理浏览器缓存',
        '移动文件到外部存储',
        '卸载不常用的扩展'
      ],
      estimatedSpaceNeeded: '50-200MB（根据语言对而定）'
    }
  }

  /**
   * 打开权限设置
   */
  openPermissionSettings() {
    // 在实际实现中，这里会打开Chrome的权限设置页面
    console.log('打开权限设置页面')
    // chrome.tabs.create({ url: 'chrome://settings/content' })
  }

  /**
   * 创建翻译器实例
   * @param {string} sourceLanguage - 源语言代码
   * @param {string} targetLanguage - 目标语言代码
   * @returns {Promise<Object>} 翻译器实例
   */
  async _createTranslatorInstance(sourceLanguage, targetLanguage) {
    return await Translator.create({
      sourceLanguage,
      targetLanguage
    })
  }

  /**
   * 清理事件监听器
   * @param {string} languagePair - 语言对标识
   */
  _cleanupEventListeners(languagePair) {
    const listenerInfo = this.eventListeners.get(languagePair)
    if (listenerInfo) {
      try {
        listenerInfo.monitor.removeEventListener('downloadprogress', listenerInfo.handler)
      } catch (error) {
        console.warn('清理事件监听器失败:', error)
      }
      this.eventListeners.delete(languagePair)
    }
  }

  /**
   * 获取所有模型状态
   * @returns {Array<Object>} 模型状态列表
   */
  getAllModelStatus() {
    return Array.from(this.modelStatus.values())
  }

  /**
   * 获取下载进度信息
   * @param {string} languagePair - 语言对标识
   * @returns {Object|null} 下载进度信息
   */
  getDownloadProgress(languagePair) {
    return this.downloadProgress.get(languagePair) || null
  }

  /**
   * 清理所有缓存和监听器
   */
  cleanup() {
    // 清理所有事件监听器
    for (const languagePair of this.eventListeners.keys()) {
      this._cleanupEventListeners(languagePair)
    }
    
    // 清理所有缓存
    this.downloadProgress.clear()
    this.modelStatus.clear()
    this.downloadRetryCount.clear()
    this.eventListeners.clear()
  }
}

// 导出单例实例
export default new ModelManager()