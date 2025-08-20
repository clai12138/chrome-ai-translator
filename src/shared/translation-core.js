import { SUPPORTED_LANGUAGES } from './constants.json'

/**
 * 翻译核心类 - 统一处理语言检测和翻译功能
 * 用于右键菜单、扩展面板、划词翻译等场景
 */
class TranslationCore {
  constructor() {
    this.translator = null
    this.detector = null
  }

  /**
   * 智能翻译 - 自动检测语言并翻译
   * @param {string} text - 要翻译的文本
   * @param {string} sourceLanguage - 源语言，'auto'表示自动检测
   * @param {string} targetLanguage - 目标语言
   * @returns {Promise<{result: string, sourceLanguage: string, targetLanguage: string}>}
   */
  async smartTranslate(text, sourceLanguage, targetLanguage) {
    if (!text || !text.trim()) {
      throw new Error('翻译文本不能为空')
    }

    let actualSourceLanguage = sourceLanguage

    // 如果源语言是auto，先检测语言
    if (sourceLanguage === 'auto') {
      actualSourceLanguage = await this.detectLanguage(text)
    }

    // 检查源语言与目标语言是否相同
    if (this.normalizeLanguage(actualSourceLanguage) === this.normalizeLanguage(targetLanguage)) {
      return {
        result: text,
        sourceLanguage: actualSourceLanguage,
        targetLanguage: targetLanguage
      }
    }

    // 执行翻译
    const translatedText = await this.translate(text, actualSourceLanguage, targetLanguage)

    return {
      result: translatedText,
      sourceLanguage: actualSourceLanguage,
      targetLanguage: targetLanguage
    }
  }

  /**
   * 检测文本语言
   * @param {string} text - 要检测的文本
   * @returns {Promise<string>} 检测到的语言代码
   */
  async detectLanguage(text) {
    try {
      if (!('LanguageDetector' in self)) {
        console.warn('LanguageDetector API 不可用，使用默认语言 en')
        return 'en'
      }

      if (!this.detector) {
        this.detector = await LanguageDetector.create()
      }

      const results = await this.detector.detect(text)
      if (results && results.length > 0) {
        const detectedLanguage = results[0].detectedLanguage
        if (detectedLanguage) {
          console.log(`检测到语言: ${detectedLanguage}`)
          return detectedLanguage
        }
      }

      console.warn('语言检测失败，使用默认语言 en')
      return 'en'
    } catch (error) {
      console.warn('语言检测出错，使用默认语言 en:', error.message)
      return 'en'
    }
  }

  /**
   * 翻译文本
   * @param {string} text - 要翻译的文本
   * @param {string} sourceLanguage - 源语言
   * @param {string} targetLanguage - 目标语言
   * @returns {Promise<string>} 翻译结果
   */
  async translate(text, sourceLanguage, targetLanguage) {
    try {
      if (!('Translator' in self)) {
        throw new Error('Translator API 不可用')
      }

      // 创建新的翻译器实例
      this.translator = await Translator.create({
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      })

      const result = await this.translator.translate(text)
      return result || text
    } catch (error) {
      console.error('翻译失败:', error)
      throw new Error(`翻译失败: ${error.message}`)
    }
  }

  /**
   * 批量翻译文本片段
   * @param {Array<string>} texts - 文本数组
   * @param {string} sourceLanguage - 源语言，'auto'表示自动检测
   * @param {string} targetLanguage - 目标语言
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<Array<{original: string, translated: string, sourceLanguage: string}>>}
   */
  async batchTranslate(texts, sourceLanguage, targetLanguage, onProgress = null) {
    const results = []
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i]
      
      try {
        const result = await this.smartTranslate(text, sourceLanguage, targetLanguage)
        results.push({
          original: text,
          translated: result.result,
          sourceLanguage: result.sourceLanguage
        })

        if (onProgress) {
          onProgress(i + 1, texts.length, result)
        }

        // 添加延迟避免请求过于频繁
        if (i < texts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      } catch (error) {
        console.error(`翻译第 ${i + 1} 个文本失败:`, error)
        results.push({
          original: text,
          translated: text, // 翻译失败时返回原文
          sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage
        })
      }
    }

    return results
  }

  /**
   * 归一化语言代码
   * @param {string} language - 语言代码
   * @returns {string} 归一化后的语言代码
   */
  normalizeLanguage(language) {
    if (!language) return ''
    return language.toLowerCase().replace('_', '-').split('-')[0]
  }

  /**
   * 检查翻译器API是否可用
   * @returns {boolean}
   */
  isTranslatorAvailable() {
    return 'Translator' in self
  }

  /**
  /**
   * 检查语言检测API是否可用
   * @returns {boolean}
   */
  isLanguageDetectorAvailable() {
    return 'LanguageDetector' in self
  }

  /**
   * 获取支持的语言列表
   * @returns {Array<{code: string, name: string}>}
   */
  getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.translator = null
    this.detector = null
  }
}

// 创建单例实例
const translationCore = new TranslationCore()

export default translationCore