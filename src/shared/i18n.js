/**
 * 国际化管理器 - 处理多语言支持
 */
class I18nManager {
  constructor() {
    this.currentLocale = this.detectLocale();
    this.messages = new Map();
    this.fallbackLocale = 'zh_CN';
  }

  /**
   * 检测当前语言环境
   */
  detectLocale() {
    try {
      const browserLang = chrome.i18n.getUILanguage();
      
      // 仅支持中英文，默认中文
      if (browserLang.startsWith('en')) {
        return 'en';
      } else {
        return 'zh_CN';
      }
    } catch (error) {
      console.warn('Failed to detect locale, using fallback:', error);
      return this.fallbackLocale;
    }
  }

  /**
   * 获取本地化消息
   */
  getMessage(key, substitutions = []) {
    try {
      // 使用Chrome内置的i18n API
      const message = chrome.i18n.getMessage(key, substitutions);
      
      if (message) {
        return message;
      }
      
      // 如果没有找到消息，返回key作为fallback
      console.warn(`Missing translation for key: ${key}`);
      return key;
    } catch (error) {
      console.error(`Error getting message for key ${key}:`, error);
      return key;
    }
  }

  /**
   * 获取语言名称
   */
  getLanguageName(langCode) {
    const languageMap = {
      'zh': this.getMessage('lang_zh'),
      'zh_CN': this.getMessage('lang_zh'),
      'zh-CN': this.getMessage('lang_zh'),
      'en': this.getMessage('lang_en'),
      'en_US': this.getMessage('lang_en'),
      'en-US': this.getMessage('lang_en')
    };

    return languageMap[langCode] || langCode;
  }

  /**
   * 格式化带参数的消息
   */
  formatMessage(key, params = {}) {
    let message = this.getMessage(key);
    
    // 替换参数占位符
    Object.keys(params).forEach(param => {
      const placeholder = `$${param}$`;
      message = message.replace(new RegExp(placeholder, 'g'), params[param]);
    });
    
    return message;
  }

  /**
   * 获取当前语言环境
   */
  getCurrentLocale() {
    return this.currentLocale;
  }

  /**
   * 检查是否为中文环境
   */
  isChinese() {
    return this.currentLocale === 'zh_CN';
  }

  /**
   * 检查是否为英文环境
   */
  isEnglish() {
    return this.currentLocale === 'en';
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages() {
    return [
      {
        code: 'zh',
        name: this.getMessage('lang_zh'),
        nativeName: '中文'
      },
      {
        code: 'en', 
        name: this.getMessage('lang_en'),
        nativeName: 'English'
      }
    ];
  }

  /**
   * 获取翻译方向配置
   */
  getTranslationDirections() {
    return [
      {
        source: 'zh',
        target: 'en',
        label: `${this.getMessage('lang_zh')} → ${this.getMessage('lang_en')}`
      },
      {
        source: 'en',
        target: 'zh', 
        label: `${this.getMessage('lang_en')} → ${this.getMessage('lang_zh')}`
      }
    ];
  }

  /**
   * 获取常用UI文本
   */
  getUITexts() {
    return {
      // 基础操作
      translate: this.getMessage('translateButton'),
      translating: this.getMessage('translating'),
      copy: this.getMessage('copyResult'),
      copied: this.getMessage('copied'),
      cancel: this.getMessage('cancel'),
      confirm: this.getMessage('confirm'),
      retry: this.getMessage('retry'),

      // 语言选择
      sourceLanguage: this.getMessage('sourceLanguage'),
      targetLanguage: this.getMessage('targetLanguage'),
      autoDetect: this.getMessage('autoDetect'),

      // 历史记录
      history: this.getMessage('translationHistory'),
      clearHistory: this.getMessage('clearHistory'),
      noHistory: this.getMessage('noHistory'),
      confirmClearHistory: this.getMessage('confirmClearHistory'),

      // 设置
      settings: this.getMessage('settings'),
      theme: this.getMessage('theme'),
      lightTheme: this.getMessage('lightTheme'),
      darkTheme: this.getMessage('darkTheme'),
      autoTheme: this.getMessage('autoTheme'),

      // 错误消息
      errorTitle: this.getMessage('errorTitle'),
      errorGeneral: this.getMessage('errorGeneral'),
      errorLanguageNotSupported: this.getMessage('errorLanguageNotSupported'),
      errorModelNotAvailable: this.getMessage('errorModelNotAvailable'),
      errorApiNotSupported: this.getMessage('errorApiNotSupported'),

      // 占位符
      inputPlaceholder: this.getMessage('inputPlaceholder')
    };
  }

  /**
   * 获取字符计数文本
   */
  getCharacterCountText(count) {
    return this.formatMessage('characterCount', { count });
  }

  /**
   * 获取流式翻译进度文本
   */
  getStreamingProgressText(progress) {
    return this.formatMessage('streamingProgress', { progress });
  }

  /**
   * 获取错误消息
   */
  getErrorMessage(errorType) {
    const errorMessages = {
      'LANGUAGE_NOT_SUPPORTED': this.getMessage('errorLanguageNotSupported'),
      'MODEL_NOT_AVAILABLE': this.getMessage('errorModelNotAvailable'),
      'STORAGE_INSUFFICIENT': this.getMessage('errorStorageInsufficient'),
      'API_NOT_SUPPORTED': this.getMessage('errorApiNotSupported')
    };

    return errorMessages[errorType] || this.getMessage('errorGeneral');
  }

  /**
   * 初始化国际化
   */
  async initialize() {
    try {
      // 检测并设置当前语言环境
      this.currentLocale = this.detectLocale();
      
      console.log(`I18n initialized with locale: ${this.currentLocale}`);
      return true;
    } catch (error) {
      console.error('I18n initialization failed:', error);
      return false;
    }
  }
}

// 创建全局实例
const i18n = new I18nManager();

// 导出
export default i18n;
export { I18nManager };
