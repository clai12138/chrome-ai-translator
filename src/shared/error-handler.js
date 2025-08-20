/**
 * 翻译服务错误处理器
 * 提供统一的错误处理和用户友好的错误消息
 * 需求: 6.3, 6.4 - 离线翻译错误处理和用户体验优化
 */
class ErrorHandler {
  /**
   * 处理 Translator API 相关错误
   * 需求: 6.3, 6.4 - 错误处理和用户体验
   * @param {Error} error - 原始错误对象
   * @returns {Object} 格式化的错误信息
   */
  static handleTranslatorError(error) {
    const errorMessage = error.message || error.toString()
    
    // 流式翻译相关错误
    if (errorMessage.includes('流式翻译超时') || errorMessage.includes('streaming timeout')) {
      return {
        type: 'STREAMING_TIMEOUT',
        message: '流式翻译超时',
        userMessage: '流式翻译处理时间过长，已自动切换到普通翻译模式。',
        suggestion: '对于超长文本，建议分段翻译以获得更好的体验。'
      }
    }
    
    if (errorMessage.includes('流式翻译执行失败') || errorMessage.includes('streaming failed')) {
      return {
        type: 'STREAMING_EXECUTION_ERROR',
        message: '流式翻译执行失败',
        userMessage: '流式翻译过程中出现错误，正在尝试普通翻译。',
        suggestion: '如果问题持续存在，请尝试刷新页面或使用较短的文本。'
      }
    }
    
    if (errorMessage.includes('chunk') || errorMessage.includes('片段')) {
      return {
        type: 'CHUNK_PROCESSING_ERROR',
        message: 'chunk数据处理错误',
        userMessage: '翻译数据处理过程中出现问题。',
        suggestion: '请重试翻译，如果问题持续存在，请联系技术支持。'
      }
    }
    
    // 原有错误类型
    if (errorMessage.includes('not supported') || errorMessage.includes('不支持')) {
      return {
        type: 'LANGUAGE_NOT_SUPPORTED',
        message: '不支持的语言对，请选择其他语言组合',
        userMessage: '当前选择的语言对暂不支持翻译，请尝试其他语言组合。',
        suggestion: '建议选择常用语言对，如英语-中文、中文-英语等。'
      }
    }
    
    if (errorMessage.includes('model') || errorMessage.includes('模型')) {
      return {
        type: 'MODEL_NOT_AVAILABLE',
        message: '翻译模型不可用',
        userMessage: '翻译模型暂时不可用，可能需要下载或更新。',
        suggestion: '请稍后再试，或检查网络连接后重新尝试。'
      }
    }
    
    if (errorMessage.includes('storage') || errorMessage.includes('存储')) {
      return {
        type: 'STORAGE_INSUFFICIENT',
        message: '存储空间不足',
        userMessage: '设备存储空间不足，无法下载翻译模型。',
        suggestion: '请清理设备存储空间后重试，或选择已下载的语言对。'
      }
    }
    
    if (errorMessage.includes('Chrome') || errorMessage.includes('浏览器') || errorMessage.includes('版本')) {
      return {
        type: 'API_NOT_SUPPORTED',
        message: '浏览器版本不支持',
        userMessage: '当前浏览器版本不支持AI翻译功能。',
        suggestion: '请升级到Chrome 138或更高版本以使用此功能。'
      }
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('网络')) {
      return {
        type: 'NETWORK_ERROR',
        message: '网络连接错误',
        userMessage: '网络连接出现问题，无法完成翻译。',
        suggestion: '请检查网络连接后重试。'
      }
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('权限')) {
      return {
        type: 'PERMISSION_ERROR',
        message: '权限不足',
        userMessage: '缺少必要的权限来执行翻译操作。',
        suggestion: '请检查扩展权限设置，确保已授予必要的权限。'
      }
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
      return {
        type: 'TRANSLATION_TIMEOUT',
        message: '翻译超时',
        userMessage: '翻译请求超时，可能是由于文本过长或网络问题。',
        suggestion: '请尝试分段翻译较长的文本，或检查网络连接。'
      }
    }
    
    // 默认错误处理
    return {
      type: 'UNKNOWN_ERROR',
      message: '翻译失败',
      userMessage: '翻译过程中出现未知错误，请重试。',
      suggestion: '如果问题持续存在，请尝试刷新页面或重启浏览器。',
      originalError: errorMessage
    }
  }

  /**
   * 检查浏览器支持情况
   * @returns {Object} 浏览器支持检查结果
   */
  static checkBrowserSupport() {
    const result = {
      isSupported: false,
      version: null,
      message: '',
      suggestion: ''
    }

    try {
      // 检查是否存在 Translator API
      if (!('Translator' in self)) {
        result.message = '当前浏览器不支持Chrome内置AI翻译功能'
        result.suggestion = '请升级到Chrome 138或更高版本'
        return result
      }

      // 检查 API 方法是否完整
      if (!Translator.availability || !Translator.create) {
        result.message = 'Translator API不完整'
        result.suggestion = '请确保使用最新版本的Chrome浏览器'
        return result
      }

      // 获取浏览器版本信息（如果可用）
      const userAgent = navigator.userAgent
      const chromeMatch = userAgent.match(/Chrome\/(\d+)/)
      if (chromeMatch) {
        result.version = parseInt(chromeMatch[1])
        if (result.version < 138) {
          result.message = `Chrome版本过低 (当前: ${result.version})`
          result.suggestion = '请升级到Chrome 138或更高版本'
          return result
        }
      }

      result.isSupported = true
      result.message = '浏览器支持AI翻译功能'
      return result

    } catch (error) {
      result.message = '检查浏览器支持时出错'
      result.suggestion = '请确保使用支持的浏览器版本'
      result.originalError = error.message
      return result
    }
  }

  /**
   * 格式化错误消息供UI显示
   * @param {Object} errorInfo - 错误信息对象
   * @returns {string} 格式化的错误消息
   */
  static formatErrorForUI(errorInfo) {
    let message = errorInfo.userMessage || errorInfo.message

    if (errorInfo.suggestion) {
      message += `\n\n建议: ${errorInfo.suggestion}`
    }

    return message
  }

  /**
   * 获取语言对不支持时的替代建议
   * 需求: 6.4 - 提供替代语言建议
   * @param {string} sourceLanguage - 源语言
   * @param {string} targetLanguage - 目标语言
   * @returns {Object} 替代建议信息
   */
  static getLanguageAlternatives(sourceLanguage, targetLanguage) {
    // 常用语言对映射
    const popularLanguagePairs = {
      'zh': ['en', 'ja', 'ko', 'fr', 'de', 'es'],
      'en': ['zh', 'ja', 'ko', 'fr', 'de', 'es', 'ru'],
      'ja': ['zh', 'en', 'ko'],
      'ko': ['zh', 'en', 'ja'],
      'fr': ['en', 'zh', 'de', 'es'],
      'de': ['en', 'zh', 'fr'],
      'es': ['en', 'zh', 'fr'],
      'ru': ['en', 'zh']
    }

    const alternatives = []
    
    // 为源语言推荐替代目标语言
    if (popularLanguagePairs[sourceLanguage]) {
      const targetAlternatives = popularLanguagePairs[sourceLanguage]
        .filter(lang => lang !== targetLanguage)
        .slice(0, 3)
      
      alternatives.push({
        type: 'target_alternatives',
        message: `尝试将${this.getLanguageName(sourceLanguage)}翻译为其他语言`,
        suggestions: targetAlternatives.map(lang => ({
          code: lang,
          name: this.getLanguageName(lang),
          pair: `${sourceLanguage}-${lang}`
        }))
      })
    }

    // 为目标语言推荐替代源语言
    if (popularLanguagePairs[targetLanguage]) {
      const sourceAlternatives = popularLanguagePairs[targetLanguage]
        .filter(lang => lang !== sourceLanguage)
        .slice(0, 3)
      
      alternatives.push({
        type: 'source_alternatives',
        message: `尝试从其他语言翻译为${this.getLanguageName(targetLanguage)}`,
        suggestions: sourceAlternatives.map(lang => ({
          code: lang,
          name: this.getLanguageName(lang),
          pair: `${lang}-${targetLanguage}`
        }))
      })
    }

    // 推荐最常用的语言对
    const mostPopularPairs = [
      { source: 'en', target: 'zh', name: '英语 → 中文' },
      { source: 'zh', target: 'en', name: '中文 → 英语' },
      { source: 'ja', target: 'zh', name: '日语 → 中文' },
      { source: 'ko', target: 'zh', name: '韩语 → 中文' }
    ]

    alternatives.push({
      type: 'popular_pairs',
      message: '推荐使用以下常用语言对',
      suggestions: mostPopularPairs.map(pair => ({
        code: `${pair.source}-${pair.target}`,
        name: pair.name,
        pair: `${pair.source}-${pair.target}`
      }))
    })

    return {
      sourceLanguage,
      targetLanguage,
      alternatives,
      message: '当前语言对暂不支持，请尝试以下替代方案'
    }
  }

  /**
   * 获取语言名称
   * @param {string} languageCode - 语言代码
   * @returns {string} 语言名称
   */
  static getLanguageName(languageCode) {
    const languageNames = {
      'zh': '中文',
      'en': '英语',
      'ja': '日语',
      'ko': '韩语',
      'fr': '法语',
      'de': '德语',
      'es': '西班牙语',
      'ru': '俄语',
      'it': '意大利语',
      'pt': '葡萄牙语',
      'ar': '阿拉伯语',
      'hi': '印地语'
    }
    return languageNames[languageCode] || languageCode.toUpperCase()
  }

  /**
   * 生成浏览器升级提示信息
   * 需求: 6.4 - 浏览器版本不支持时的升级提示
   * @param {number|null} currentVersion - 当前Chrome版本
   * @returns {Object} 升级提示信息
   */
  static getBrowserUpgradeInfo(currentVersion = null) {
    const minRequiredVersion = 138
    
    return {
      isSupported: currentVersion >= minRequiredVersion,
      currentVersion,
      requiredVersion: minRequiredVersion,
      title: 'Chrome AI翻译功能不可用',
      message: currentVersion 
        ? `您当前使用的Chrome版本为 ${currentVersion}，需要升级到版本 ${minRequiredVersion} 或更高版本才能使用AI翻译功能。`
        : `您的浏览器不支持Chrome内置AI翻译功能，请升级到Chrome ${minRequiredVersion} 或更高版本。`,
      actions: [
        {
          type: 'primary',
          text: '立即升级Chrome',
          url: 'https://www.google.com/chrome/update/'
        },
        {
          type: 'secondary',
          text: '了解更多',
          url: 'https://developer.chrome.com/docs/ai/translator-api'
        }
      ],
      tips: [
        '升级后您将享受完全离线的AI翻译服务',
        '翻译速度更快，隐私更安全',
        '支持多种语言对的实时翻译'
      ]
    }
  }

  /**
   * 创建模型下载重试机制
   * 需求: 6.3 - Chrome内置模型下载失败的重试机制
   * @param {string} sourceLanguage - 源语言
   * @param {string} targetLanguage - 目标语言
   * @param {number} maxRetries - 最大重试次数
   * @returns {Object} 重试管理器
   */
  static createModelDownloadRetryManager(sourceLanguage, targetLanguage, maxRetries = 3) {
    let retryCount = 0
    let isRetrying = false
    
    return {
      async attemptDownload(downloadFunction, onProgress = null, onRetry = null) {
        while (retryCount < maxRetries) {
          try {
            isRetrying = retryCount > 0
            
            if (isRetrying && onRetry) {
              onRetry(retryCount, maxRetries)
            }
            
            const result = await downloadFunction(onProgress)
            
            // 下载成功，重置重试计数
            retryCount = 0
            isRetrying = false
            
            return {
              success: true,
              result,
              retryCount: retryCount
            }
            
          } catch (error) {
            retryCount++
            
            if (retryCount >= maxRetries) {
              return {
                success: false,
                error: this.handleModelDownloadError(error, retryCount),
                retryCount,
                canRetry: false
              }
            }
            
            // 等待一段时间后重试（指数退避）
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      },
      
      getRetryInfo() {
        return {
          currentRetry: retryCount,
          maxRetries,
          isRetrying,
          canRetry: retryCount < maxRetries
        }
      },
      
      reset() {
        retryCount = 0
        isRetrying = false
      }
    }
  }

  /**
   * 处理模型下载错误
   * @param {Error} error - 下载错误
   * @param {number} retryCount - 重试次数
   * @returns {Object} 格式化的错误信息
   */
  static handleModelDownloadError(error, retryCount) {
    const errorMessage = error.message || error.toString()
    
    if (errorMessage.includes('network') || errorMessage.includes('网络')) {
      return {
        type: 'NETWORK_ERROR',
        message: '网络连接问题导致模型下载失败',
        userMessage: `模型下载失败（已重试${retryCount}次）：网络连接不稳定。`,
        suggestion: '请检查网络连接后重试，或稍后再试。',
        canRetry: true
      }
    }
    
    if (errorMessage.includes('storage') || errorMessage.includes('存储')) {
      return {
        type: 'STORAGE_ERROR',
        message: '存储空间不足',
        userMessage: `模型下载失败：设备存储空间不足。`,
        suggestion: '请清理设备存储空间后重试。',
        canRetry: false
      }
    }
    
    if (errorMessage.includes('permission') || errorMessage.includes('权限')) {
      return {
        type: 'PERMISSION_ERROR',
        message: '权限不足',
        userMessage: `模型下载失败：缺少必要权限。`,
        suggestion: '请检查浏览器权限设置。',
        canRetry: false
      }
    }
    
    return {
      type: 'DOWNLOAD_ERROR',
      message: '模型下载失败',
      userMessage: `模型下载失败（已重试${retryCount}次）：${errorMessage}`,
      suggestion: '请稍后重试，或联系技术支持。',
      canRetry: true
    }
  }

  /**
   * 检查离线翻译可用性
   * 需求: 6.3 - 离线翻译不可用时的用户提示
   * @param {string} sourceLanguage - 源语言
   * @param {string} targetLanguage - 目标语言
   * @returns {Promise<Object>} 可用性检查结果
   */
  static async checkOfflineAvailability(sourceLanguage, targetLanguage) {
    try {
      if (!('Translator' in self)) {
        return {
          available: false,
          reason: 'API_NOT_SUPPORTED',
          message: '浏览器不支持离线翻译功能',
          suggestion: '请升级到Chrome 138或更高版本'
        }
      }

      const availability = await Translator.availability({
        sourceLanguage,
        targetLanguage
      })

      switch (availability) {
        case 'available':
          return {
            available: true,
            status: 'ready',
            message: '离线翻译模型已就绪'
          }
          
        case 'downloadable':
          return {
            available: false,
            status: 'downloadable',
            reason: 'MODEL_NOT_DOWNLOADED',
            message: '翻译模型需要下载',
            suggestion: '点击下载按钮获取离线翻译模型',
            canDownload: true
          }
          
        case 'downloading':
          return {
            available: false,
            status: 'downloading',
            reason: 'MODEL_DOWNLOADING',
            message: '翻译模型正在下载中',
            suggestion: '请等待下载完成'
          }
          
        default:
          return {
            available: false,
            status: 'unavailable',
            reason: 'LANGUAGE_NOT_SUPPORTED',
            message: '该语言对不支持离线翻译',
            suggestion: '请尝试其他语言组合',
            alternatives: this.getLanguageAlternatives(sourceLanguage, targetLanguage)
          }
      }
      
    } catch (error) {
      return {
        available: false,
        reason: 'CHECK_FAILED',
        message: '检查离线翻译可用性时出错',
        suggestion: '请重试或检查浏览器设置',
        error: error.message
      }
    }
  }

  /**
   * 创建用户友好的错误通知
   * @param {Object} errorInfo - 错误信息
   * @returns {Object} 通知配置
   */
  static createErrorNotification(errorInfo) {
    const baseConfig = {
      type: 'error',
      duration: 5000,
      showClose: true
    }

    switch (errorInfo.type) {
      case 'API_NOT_SUPPORTED':
        return {
          ...baseConfig,
          title: '浏览器不支持',
          message: errorInfo.userMessage,
          type: 'warning',
          duration: 0, // 不自动关闭
          actions: [
            {
              text: '升级浏览器',
              handler: () => window.open('https://www.google.com/chrome/update/', '_blank')
            }
          ]
        }

      case 'LANGUAGE_NOT_SUPPORTED':
        return {
          ...baseConfig,
          title: '语言对不支持',
          message: errorInfo.userMessage,
          type: 'warning',
          actions: [
            {
              text: '查看替代方案',
              handler: () => this.showLanguageAlternatives(errorInfo)
            }
          ]
        }

      case 'MODEL_NOT_AVAILABLE':
        return {
          ...baseConfig,
          title: '模型不可用',
          message: errorInfo.userMessage,
          type: 'info',
          actions: [
            {
              text: '重试下载',
              handler: () => this.retryModelDownload()
            }
          ]
        }

      case 'STREAMING_TIMEOUT':
      case 'STREAMING_EXECUTION_ERROR':
        return {
          ...baseConfig,
          title: '流式翻译问题',
          message: errorInfo.userMessage,
          type: 'warning',
          duration: 3000
        }

      default:
        return {
          ...baseConfig,
          title: '翻译错误',
          message: errorInfo.userMessage || '翻译过程中出现问题'
        }
    }
  }

  /**
   * 记录错误到控制台（开发环境）
   * @param {string} context - 错误上下文
   * @param {Error|Object} error - 错误对象
   */
  static logError(context, error) {
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 翻译服务错误 - ${context}`)
      console.error('错误详情:', error)
      if (error.stack) {
        console.error('错误堆栈:', error.stack)
      }
      console.groupEnd()
    }
  }
}

export default ErrorHandler