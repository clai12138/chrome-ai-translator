// Content Script - 处理网页文本选择和翻译覆盖层
// 需求: 1.1, 1.2, 1.3 - 网页文本选择翻译功能

// 异步加载常量配置
let CONSTANTS = null;

async function loadConstants() {
  if (CONSTANTS) return CONSTANTS;
  
  try {
    const response = await fetch(chrome.runtime.getURL('assets/constants.json'));
    CONSTANTS = await response.json();
    return CONSTANTS;
  } catch (error) {
    console.error('加载常量配置失败:', error);
    // 提供默认配置作为后备
    CONSTANTS = {
      DEFAULT_LANGUAGE_PREFERENCES: {
        sourceLanguage: 'auto',
        targetLanguage: 'zh-CN'
      },
      MESSAGE_TYPES: {
        TRANSLATE_TEXT: 'TRANSLATE_TEXT'
      },
      STORAGE_KEYS: {
        LANGUAGE_PREFERENCES: 'languagePreferences'
      }
    };
    return CONSTANTS;
  }
}

console.log('Chrome AI翻译扩展 Content Script 已加载')

/**
 * Content Script 翻译器类
 * 负责处理网页文本选择、翻译覆盖层显示和翻译功能
 */
class ContentTranslator {
  constructor() {
    this.selectedText = ''
    this.selectionRange = null
    this.overlayManager = null
    this.languagePreferences = null
    this.isPageTranslated = false // 跟踪页面翻译状态
    
    this.init()
  }

  /**
   * 初始化 Content Script
   * 需求: 1.1 - 文本选择事件监听
   */
  async init() {
    try {
      // 加载常量配置
      const constants = await loadConstants()
      
      // 设置默认语言偏好
      this.languagePreferences = constants.DEFAULT_LANGUAGE_PREFERENCES
      
      // 加载用户语言偏好
      await this.loadLanguagePreferences(constants)
      
      // 监听文本选择事件
      this.setupEventListeners()
      
      // 监听来自 background script 的消息
      this.setupMessageListeners(constants)
      
      console.log('Content Script 初始化完成')
    } catch (error) {
      console.error('Content Script 初始化失败:', error)
    }
  }

  /**
   * 设置事件监听器
   * 需求: 1.1 - 实现文本选择事件监听
   */
  setupEventListeners() {
    // 监听鼠标抬起事件（文本选择完成）
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
    
    // 监听键盘事件（键盘选择文本）
    document.addEventListener('keyup', this.handleKeyboardSelection.bind(this));
    
    // 监听选择变化事件
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
    
    // 监听点击事件（隐藏覆盖层）
    document.addEventListener('click', this.handleDocumentClick.bind(this));
    
    // 监听滚动事件（隐藏覆盖层）
    document.addEventListener('scroll', this.handleDocumentScroll.bind(this));
    
    // 监听窗口大小变化（重新定位覆盖层）
    window.addEventListener('resize', this.handleWindowResize.bind(this));
  }

  /**
   * 设置消息监听器
   * 监听来自 background script 和 popup 的消息
   */
  setupMessageListeners(constants) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case constants.MESSAGE_TYPES.TRANSLATE_TEXT:
          this.handleTranslateMessage(message, sendResponse);
          return true; // 保持消息通道开放以进行异步响应
          
        case 'UPDATE_LANGUAGE_PREFERENCES':
          this.handleLanguagePreferencesUpdate(message.preferences);
          break;
          
        case 'HIDE_OVERLAY':
          this.hideOverlay();
          break;

        case 'SHOW_TRANSLATION_OVERLAY':
          this.handleShowTranslationOverlay(message);
          break;

        case 'TRANSLATE_PAGE':
          this.handleTranslatePage(message);
          sendResponse({ success: true });
          break;

        case 'CANCEL_TRANSLATE_PAGE':
          this.handleCancelTranslatePage();
          sendResponse({ success: true });
          break;

        case 'SHOW_QUICK_TRANSLATION':
          this.handleShowQuickTranslation(message);
          break;

        case 'SHOW_TRANSLATOR_PANEL':
          this.handleShowTranslatorPanel();
          break;

        case 'GET_TRANSLATION_STATUS':
          sendResponse({ isTranslated: this.isPageTranslated });
          break;

        case 'GET_SELECTED_TEXT':
          this.handleGetSelectedText(sendResponse);
          break;

        case 'PING':
          sendResponse({ success: true, message: 'Content script is ready' });
          break;
          
        default:
          console.log('未知消息类型:', message.type);
      }
    })
  }

  /**
   * 处理文本选择事件
   * 需求: 1.1 - 当用户在网页上选择文本时，扩展应在选中文本附近显示翻译弹窗
   */
  handleTextSelection(event) {
    // 延迟处理，确保选择操作完成
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText.length > 0 && selectedText.length <= 5000) {
        this.selectedText = selectedText;
        this.selectionRange = selection.getRangeAt(0).cloneRange();
        
        // 获取选择区域的位置信息
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        const position = {
          x: rect.left + rect.width / 2,
          y: rect.top,
          width: rect.width,
          height: rect.height
        };
        
        console.log('检测到文本选择:', selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''));
        
        // 显示翻译覆盖层
        this.showTranslationOverlay(selectedText, position);
      } else if (selectedText.length === 0) {
        // 没有选择文本时仅在不存在翻译弹窗时才隐藏，避免点击图标后弹窗被误关
        const hasPopup = !!document.getElementById('chrome-ai-translator-popup');
        if (!hasPopup) {
          this.hideOverlay();
        }
      } else if (selectedText.length > 5000) {
        console.warn('选择的文本过长，超过5000字符限制');
        this.showErrorMessage('选择的文本过长，请选择较短的文本进行翻译');
      }
    }, 100);
  }

  /**
   * 处理键盘选择事件
   * 支持通过键盘选择文本后的翻译
   */
  handleKeyboardSelection(event) {
    // 只处理特定的键盘事件
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || 
        event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
        event.shiftKey) {
      this.handleTextSelection(event)
    }
  }

  /**
   * 处理选择变化事件
   */
  handleSelectionChange() {
    // 防抖处理，避免频繁触发
    clearTimeout(this.selectionChangeTimeout);
    this.selectionChangeTimeout = setTimeout(() => {
      const selection = window.getSelection();
      const isEmpty = selection.toString().trim().length === 0;
      const hasPopup = !!document.getElementById('chrome-ai-translator-popup');
      // 当选区为空时，仅在没有翻译弹窗的情况下才隐藏覆盖层，避免弹窗被误关
      if (isEmpty && !hasPopup) {
        this.hideOverlay();
      }
    }, 200);
  }

  /**
   * 处理文档点击事件
   * 点击其他区域时隐藏覆盖层
   */
  handleDocumentClick(event) {
    // 检查是否点击了翻译相关元素
    const isTranslationElement = event.target.closest('#chrome-ai-translator-icon') ||
                                event.target.closest('#chrome-ai-translator-popup');
    
    if (!isTranslationElement) {
      // 只有点击空白处才隐藏覆盖层
      this.hideOverlay();
    }
  }

  /**
   * 处理文档滚动事件
   * 滚动时隐藏覆盖层
   */
  handleDocumentScroll() {
    // 若翻译弹窗存在，则不自动关闭，避免滚动导致弹窗消失
    const hasPopup = !!document.getElementById('chrome-ai-translator-popup');
    if (hasPopup) return;

    if (this.overlayManager && this.overlayManager.isOverlayVisible()) {
      this.hideOverlay();
    }
  }

  /**
   * 处理窗口大小变化事件
   * 重新定位覆盖层
   */
  handleWindowResize() {
    if (this.overlayManager && this.overlayManager.isOverlayVisible() && this.selectionRange) {
      // 重新计算位置并更新覆盖层
      const rect = this.selectionRange.getBoundingClientRect();
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
      this.overlayManager.updateOverlayPosition(position);
    }
  }

  /**
   * 显示翻译覆盖层
   * 需求: 1.1 - 创建翻译覆盖层 UI 注入功能
   * @param {string} selectedText - 选中的文本
   * @param {Object} position - 位置信息
   */
  showTranslationOverlay(selectedText, position) {
    // 显示简单的翻译图标
    this.showTranslationIcon(selectedText, position);
  }

  /**
   * 显示翻译图标
   */
  showTranslationIcon(selectedText, position) {
    // 移除现有图标
    this.hideOverlay();
    
    // 创建翻译图标
    const icon = document.createElement('div');
    icon.id = 'chrome-ai-translator-icon';
    icon.innerHTML = '🌐';
    icon.title = '点击翻译选中文本';
    
    // 计算图标位置，确保在可视区域内
    const iconSize = 32;
    const margin = 10;
    
    // 计算水平位置
    let left = position.x - iconSize / 2;
    if (left < margin) {
      left = margin;
    } else if (left + iconSize > window.innerWidth - margin) {
      left = window.innerWidth - iconSize - margin;
    }
    
    // 计算垂直位置
    let top = position.y - 40;
    if (top < margin) {
      // 如果上方空间不够，显示在选择区域下方
      top = position.y + position.height + 10;
      if (top + iconSize > window.innerHeight - margin) {
        // 如果下方也不够，显示在可视区域内
        top = Math.max(margin, window.innerHeight - iconSize - margin);
      }
    }
    
    // 设置样式
    Object.assign(icon.style, {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: '2147483647',
      width: `${iconSize}px`,
      height: `${iconSize}px`,
      backgroundColor: '#409eff',
      color: 'white',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      fontSize: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      transition: 'all 0.2s ease',
      opacity: '0',
      transform: 'scale(0.8)'
    })
    
    document.body.appendChild(icon);
    
    // 显示动画
    setTimeout(() => {
      icon.style.opacity = '1';
      icon.style.transform = 'scale(1)';
    }, 10);
    
    // 点击事件
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      // 使用图标的位置作为弹窗位置参考
      const iconRect = icon.getBoundingClientRect();
      const iconPosition = {
        x: iconRect.left + iconRect.width / 2,
        y: iconRect.top,
        width: iconRect.width,
        height: iconRect.height
      };
      this.showTranslationPopup(selectedText, iconPosition);
    });
    
    // 鼠标悬停效果
    icon.addEventListener('mouseenter', () => {
      icon.style.transform = 'scale(1.1)';
    });
    
    icon.addEventListener('mouseleave', () => {
      icon.style.transform = 'scale(1)';
    });
    
    // 图标在5秒后自动隐藏，但点击后会显示弹窗
    setTimeout(() => {
      if (icon.parentNode && !document.getElementById('chrome-ai-translator-popup')) {
        icon.style.opacity = '0';
        icon.style.transform = 'scale(0.8)';
        setTimeout(() => {
          if (icon.parentNode) {
            icon.remove();
          }
        }, 200);
      }
    }, 5000);
  }

  /**
   * 显示翻译弹窗
   */
  async showTranslationPopup(selectedText, position) {
    // 隐藏图标
    this.hideOverlay();

    // 延迟弹出：先完成翻译，再创建弹窗显示结果
    console.log('开始翻译选中文本:', selectedText);

    try {
      // 通过 service worker 进行翻译
      const result = await this.translateText(
        selectedText,
        'auto', // 划词翻译总是使用自动检测
        this.languagePreferences.targetLanguage
      );

      console.log('翻译结果:', result);

      // 翻译完成后再创建弹窗并填充结果
      const popup = this.createTranslationPopup(selectedText, position, false);
      this.updateTranslationPopup(popup, { success: true, result: result.result });
    } catch (error) {
      console.error('翻译请求失败:', error);
      const popup = this.createTranslationPopup(selectedText, position, false);
      
      // 根据错误类型提供不同的错误信息
      let errorMessage = '翻译失败';
      if (error.message.includes('LanguageDetector')) {
        errorMessage = '语言检测失败，请升级浏览器';
      } else if (error.message.includes('Translator')) {
        errorMessage = '翻译功能不可用，请升级浏览器';
      } else {
        errorMessage = `翻译失败: ${error.message}`;
      }
      
      this.updateTranslationPopup(popup, { success: false, error: errorMessage });
    }
  }

  /**
   * 创建翻译弹窗
   */
  createTranslationPopup(selectedText, position, isLoading = false) {
    const popup = document.createElement('div')
    popup.id = 'chrome-ai-translator-popup'
    popup.innerHTML = `
      <div class="popup-header">
        <span>AI翻译</span>
        <button class="close-btn">×</button>
      </div>
      <div class="popup-content">
        <div class="original-text">${this.escapeHtml(selectedText)}</div>
        <div class="translation-loading" style="display: ${isLoading ? 'block' : 'none'};">正在翻译...</div>
        <div class="translated-text" style="display: none;"></div>
        <div class="translation-error" style="display: none; color: #f56c6c;"></div>
      </div>
    `
    
    // 计算弹窗位置，确保在可视区域内
    const popupWidth = 320
    const popupHeight = 150 // 估算高度
    const margin = 10
    
    // 计算水平位置
    let left = position.x - popupWidth / 2
    if (left < margin) {
      left = margin
    } else if (left + popupWidth > window.innerWidth - margin) {
      left = window.innerWidth - popupWidth - margin
    }
    
    // 计算垂直位置
    let top = position.y - popupHeight - 10
    if (top < margin) {
      // 如果上方空间不够，显示在下方
      top = position.y + position.height + 10
      if (top + popupHeight > window.innerHeight - margin) {
        // 如果下方也不够，显示在可视区域内
        top = Math.max(margin, window.innerHeight - popupHeight - margin)
      }
    }
    
    // 设置样式
    Object.assign(popup.style, {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: '2147483647',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      maxWidth: `${popupWidth}px`,
      minWidth: '280px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      opacity: '0',
      transform: 'scale(0.9)',
      transition: 'all 0.2s ease'
    })
    
    // 添加内部样式（如果还没有）
    if (!document.getElementById('chrome-ai-translator-popup-style')) {
      const style = document.createElement('style')
      style.id = 'chrome-ai-translator-popup-style'
      style.textContent = `
        #chrome-ai-translator-popup .popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f5f5f5;
          border-bottom: 1px solid #eee;
          border-radius: 8px 8px 0 0;
          font-weight: 500;
        }
        #chrome-ai-translator-popup .close-btn {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #999;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        #chrome-ai-translator-popup .close-btn:hover {
          background: #eee;
          color: #333;
        }
        #chrome-ai-translator-popup .popup-content {
          padding: 12px;
        }
        #chrome-ai-translator-popup .original-text {
          color: #333;
          margin-bottom: 8px;
          line-height: 1.4;
          max-height: 100px;
          overflow-y: auto;
          word-wrap: break-word;
        }
        #chrome-ai-translator-popup .translation-loading {
          color: #409eff;
          font-style: italic;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #chrome-ai-translator-popup .translation-loading::after {
          content: '';
          width: 16px;
          height: 16px;
          border: 2px solid #409eff;
          border-top: 2px solid transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        #chrome-ai-translator-popup .translated-text {
          color: #d650dc;
          font-weight: 500;
          line-height: 1.4;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #eee;
          word-wrap: break-word;
        }
      `
      document.head.appendChild(style)
    }
    
    document.body.appendChild(popup)
    
    // 设置事件监听器
    this.setupPopupEventListeners(popup)
    
    // 显示动画
    setTimeout(() => {
      popup.style.opacity = '1'
      popup.style.transform = 'scale(1)'
    }, 10)
    
    return popup
  }

  /**
   * 更新翻译弹窗内容
   */
  updateTranslationPopup(popup, result) {
    if (!popup || !popup.parentNode) return
    
    const loadingElement = popup.querySelector('.translation-loading')
    const translatedElement = popup.querySelector('.translated-text')
    const errorElement = popup.querySelector('.translation-error')
    
    // 隐藏加载状态
    if (loadingElement) {
      loadingElement.style.display = 'none'
    }
    
    if (result && result.success && result.result) {
      // 显示翻译结果
      if (translatedElement) {
        translatedElement.textContent = result.result
        translatedElement.style.display = 'block'
      }
      if (errorElement) {
        errorElement.style.display = 'none'
      }
    } else {
      // 显示错误信息
      if (errorElement) {
        errorElement.textContent = result ? (result.error || '翻译失败') : '翻译失败'
        errorElement.style.display = 'block'
      }
      if (translatedElement) {
        translatedElement.style.display = 'none'
      }
    }
  }

  /**
   * 设置弹窗事件监听器
   */
  setupPopupEventListeners(popup) {
    const closeBtn = popup.querySelector('.close-btn')
    const closePopup = () => {
      if (popup.parentNode) {
        popup.style.opacity = '0'
        popup.style.transform = 'scale(0.9)'
        setTimeout(() => {
          if (popup.parentNode) {
            popup.remove()
          }
        }, 200)
      }
    }
    
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      closePopup()
    })
    
    // 阻止弹窗内部点击事件冒泡
    popup.addEventListener('click', (e) => {
      e.stopPropagation()
    })
    
    // 阻止弹窗内部的鼠标事件冒泡，防止意外关闭
    popup.addEventListener('mousedown', (e) => {
      e.stopPropagation()
    })
    
    popup.addEventListener('mouseup', (e) => {
      e.stopPropagation()
    })
    
    // 点击弹窗外部关闭 - 延迟添加，避免立即触发
    setTimeout(() => {
      const handleOutsideClick = (event) => {
        if (!popup.contains(event.target)) {
          closePopup()
          document.removeEventListener('click', handleOutsideClick)
        }
      }
      document.addEventListener('click', handleOutsideClick)
    }, 800) // 延迟外部点击监听，避免误触关闭
  }

  /**
   * HTML转义函数
   */
  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * 隐藏覆盖层
   * 需求: 1.4 - 实现覆盖层的自动隐藏功能
   */
  hideOverlay() {
    const icon = document.getElementById('chrome-ai-translator-icon')
    if (icon) {
      icon.remove()
    }
    
    const popup = document.getElementById('chrome-ai-translator-popup')
    if (popup) {
      popup.remove()
    }
  }

  /**
   * 加载用户语言偏好
   * 需求: 2.2 - 使用保存的语言偏好
   */
  async loadLanguagePreferences(constants) {
    try {
      const result = await chrome.storage.sync.get(constants.STORAGE_KEYS.LANGUAGE_PREFERENCES)
      if (result[constants.STORAGE_KEYS.LANGUAGE_PREFERENCES]) {
        this.languagePreferences = {
          ...constants.DEFAULT_LANGUAGE_PREFERENCES,
          ...result[constants.STORAGE_KEYS.LANGUAGE_PREFERENCES]
        }
      }
    } catch (error) {
      console.error('加载语言偏好失败:', error)
    }
  }

  /**
   * 处理语言偏好更新
   */
  handleLanguagePreferencesUpdate(preferences) {
    this.languagePreferences = { ...this.languagePreferences, ...preferences }
    
    // 更新覆盖层管理器的语言偏好
    if (this.overlayManager) {
      this.overlayManager.updateLanguagePreferences(preferences)
    }
  }

  /**
   * 处理获取选中文本消息
   */
  handleGetSelectedText(sendResponse) {
    try {
      const selection = window.getSelection()
      const selectedText = selection.toString().trim()
      
      if (selectedText.length > 0) {
        // 保存选中文本和位置信息
        this.selectedText = selectedText
        if (selection.rangeCount > 0) {
          this.selectionRange = selection.getRangeAt(0).cloneRange()
        }
        
        sendResponse({ 
          success: true, 
          text: selectedText,
          hasSelection: true
        })
      } else {
        sendResponse({ 
          success: true, 
          text: '',
          hasSelection: false
        })
      }
    } catch (error) {
      console.error('获取选中文本失败:', error)
      sendResponse({ success: false, error: error.message })
    }
  }

  /**
   * 通过 background script 进行翻译
   */
  async translateText(text, sourceLanguage, targetLanguage) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'TRANSLATE_TEXT',
        text: text,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        
        if (response && response.success) {
          resolve({
            result: response.result,
            sourceLanguage: response.sourceLanguage,
            targetLanguage: response.targetLanguage
          })
        } else {
          reject(new Error(response ? response.error : '翻译失败'))
        }
      })
    })
  }

  /**
   * 处理翻译消息
   */
  async handleTranslateMessage(message, sendResponse) {
    try {
      // 这里可以处理来自其他组件的翻译请求
      sendResponse({ success: true, message: '翻译请求已接收' })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  }

  /**
   * 显示错误消息
   */
  showErrorMessage(message) {
    // 创建临时错误提示
    const errorElement = document.createElement('div')
    errorElement.className = 'chrome-ai-translator-error-toast'
    errorElement.textContent = message
    
    // 应用错误提示样式
    Object.assign(errorElement.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#f56c6c',
      color: '#ffffff',
      padding: '12px 16px',
      borderRadius: '4px',
      fontSize: '14px',
      zIndex: '2147483647',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      opacity: '0',
      transform: 'translateX(100%)',
      transition: 'all 0.3s ease'
    })
    
    document.body.appendChild(errorElement)
    
    // 显示动画
    setTimeout(() => {
      errorElement.style.opacity = '1'
      errorElement.style.transform = 'translateX(0)'
    }, 10)
    
    // 自动隐藏
    setTimeout(() => {
      errorElement.style.opacity = '0'
      errorElement.style.transform = 'translateX(100%)'
      setTimeout(() => {
        if (errorElement.parentNode) {
          errorElement.parentNode.removeChild(errorElement)
        }
      }, 300)
    }, 3000)
  }

  /**
   * 处理显示翻译覆盖层消息（来自右键菜单）
   */
  handleShowTranslationOverlay(message) {
    const { text, position } = message
    this.selectedText = text
    this.showTranslationOverlay(text, position)
  }

  /**
   * 处理翻译页面消息（来自右键菜单）
   */
  async handleTranslatePage(message = {}) {
    console.log('开始翻译整个页面', message)
    
    try {
      // 使用传入的语言设置或默认设置
      let sourceLanguage = message.sourceLanguage || this.languagePreferences.sourceLanguage
      const targetLanguage = message.targetLanguage || this.languagePreferences.targetLanguage
      
      console.log(`翻译语言对: ${sourceLanguage} → ${targetLanguage}`)
      
      // 获取可视区域内的文本节点
      const visibleTextNodes = this.getVisibleTextNodes()
      
      console.log(`找到 ${visibleTextNodes.length} 个可视区域内的文本节点`)
      
      if (visibleTextNodes.length === 0) {
        this.showErrorMessage('可视区域内没有找到可翻译的文本内容')
        return { success: false, error: '没有找到可翻译的文本' }
      }
      
      // 显示翻译进度提示
      this.showTranslationProgress(`正在翻译可视区域内容 (${sourceLanguage} → ${targetLanguage})...`)
      
      // 提取文本内容
      const texts = visibleTextNodes.map(node => node.textContent.trim()).filter(text => text.length > 0 && text.length <= 500)
      
      if (texts.length === 0) {
        this.hideTranslationProgress()
        this.showErrorMessage('没有找到符合翻译条件的文本内容')
        return { success: false, error: '没有找到符合翻译条件的文本' }
      }
      
      let translatedCount = 0
      
      // 逐个翻译文本片段，提供更好的错误处理
      for (let i = 0; i < visibleTextNodes.length; i++) {
        const node = visibleTextNodes[i]
        const originalText = node.textContent.trim()
        
        if (originalText.length > 0 && originalText.length <= 500) {
          try {
            this.updateTranslationProgress(`正在翻译第 ${i + 1}/${visibleTextNodes.length} 个文本片段...`)
            
            // 通过 service worker 进行翻译
            try {
              const result = await this.translateText(originalText, sourceLanguage, targetLanguage)
              if (result && result.result && result.result !== originalText) {
                this.appendTranslationToNode(node, result.result)
                translatedCount++
              } else {
                this.appendTranslationToNode(node, '', true)
              }
            } catch (error) {
              console.error('翻译失败:', error)
              this.appendTranslationToNode(node, '', true)
            }
          } catch (error) {
            console.error(`翻译文本片段失败: "${originalText.substring(0, 30)}..."`, error)
            // 翻译失败，显示失败提示
            this.appendTranslationToNode(node, '', true)
          }
          
          // 添加延迟避免请求过于频繁
          if (i < visibleTextNodes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }
      }

      this.hideTranslationProgress()
      
      if (translatedCount > 0) {
        this.showSuccessMessage(`可视区域翻译完成，共翻译了 ${translatedCount} 个文本片段`)
        
        // 设置滚动监听器，当新内容进入可视区域时自动翻译
        this.setupScrollTranslation(sourceLanguage, targetLanguage)
      } else {
        this.showErrorMessage('没有成功翻译任何文本，请检查网络连接或稍后重试')
      }
      
      // 更新翻译状态
      this.isPageTranslated = translatedCount > 0
      
      return { success: translatedCount > 0, translatedCount }
      
    } catch (error) {
      console.error('页面翻译失败:', error)
      this.hideTranslationProgress()
      this.showErrorMessage(`页面翻译失败: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  /**
   * 处理取消翻译页面消息
   */
  handleCancelTranslatePage() {
    console.log('取消页面翻译')
    
    // 移除所有翻译标记
    const translationElements = document.querySelectorAll('.translation-append')
    translationElements.forEach(element => {
      element.remove()
    })
    
    // 移除滚动翻译监听器
    if (this.scrollTranslationHandler) {
      window.removeEventListener('scroll', this.scrollTranslationHandler)
      clearTimeout(this.scrollTranslationTimeout)
      this.scrollTranslationHandler = null
      console.log('已移除滚动翻译监听器')
    }
    
    // 隐藏进度提示
    this.hideTranslationProgress()
    
    // 更新翻译状态
    this.isPageTranslated = false
    
    this.showSuccessMessage('已取消页面翻译')
  }

  /**
   * 处理显示快速翻译结果消息
   */
  handleShowQuickTranslation(message) {
    const { originalText, translatedText, position } = message
    
    // 创建快速翻译弹窗
    this.showQuickTranslationPopup(originalText, translatedText, position)
  }

  /**
   * 处理显示翻译面板消息
   */
  handleShowTranslatorPanel() {
    // 显示翻译面板（可以是一个更大的翻译界面）
    if (this.overlayManager) {
      this.overlayManager.showTranslatorPanel()
    }
  }

  /**
   * 获取页面文本节点
   */
  getPageTextNodes() {
    const textNodes = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // 过滤掉空白文本和脚本/样式标签中的文本
          const parent = node.parentElement
          if (!parent) return NodeFilter.FILTER_REJECT
          
          const tagName = parent.tagName.toLowerCase()
          if (['script', 'style', 'noscript', 'meta', 'title', 'head'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT
          }
          
          // 跳过扩展自身的元素
          if (parent.closest('#chrome-ai-translator-icon') || 
              parent.closest('#chrome-ai-translator-popup') ||
              parent.closest('#translation-progress') ||
              parent.closest('.translation-append') ||
              parent.classList.contains('translation-append')) {
            return NodeFilter.FILTER_REJECT
          }
          
          const text = node.textContent.trim()
          if (text.length === 0 || text.length > 500) {
            return NodeFilter.FILTER_REJECT
          }
          
          // 检查文本是否有意义（不是纯数字、符号等）
          if (!/[a-zA-Z\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
            return NodeFilter.FILTER_REJECT
          }
          
          // 检查是否已经有翻译
          if (parent.querySelector('.translation-append')) {
            return NodeFilter.FILTER_REJECT
          }
          
          return NodeFilter.FILTER_ACCEPT
        }
      }
    )
    
    let node
    while (node = walker.nextNode()) {
      textNodes.push(node)
    }
    
    console.log(`找到 ${textNodes.length} 个可翻译的文本节点`)
    return textNodes
  }

  /**
   * 获取可视区域内的文本节点
   */
  getVisibleTextNodes() {
    const allTextNodes = this.getPageTextNodes()
    const visibleNodes = []
    
    for (const node of allTextNodes) {
      if (this.isElementInViewport(node.parentElement)) {
        visibleNodes.push(node)
      }
    }
    
    console.log(`在 ${allTextNodes.length} 个文本节点中，找到 ${visibleNodes.length} 个可视区域内的节点`)
    return visibleNodes
  }

  /**
   * 检查元素是否在可视区域内
   */
  isElementInViewport(element) {
    if (!element) return false
    
    const rect = element.getBoundingClientRect()
    const windowHeight = window.innerHeight || document.documentElement.clientHeight
    const windowWidth = window.innerWidth || document.documentElement.clientWidth
    
    // 检查元素是否在可视区域内（至少部分可见）
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < windowHeight &&
      rect.left < windowWidth &&
      rect.width > 0 &&
      rect.height > 0
    )
  }

  /**
   * 设置滚动翻译监听器
   */
  setupScrollTranslation(sourceLanguage, targetLanguage) {
    // 移除现有的滚动监听器
    if (this.scrollTranslationHandler) {
      window.removeEventListener('scroll', this.scrollTranslationHandler)
      clearTimeout(this.scrollTranslationTimeout)
    }
    
    // 防抖处理的滚动翻译
    this.scrollTranslationHandler = () => {
      clearTimeout(this.scrollTranslationTimeout)
      this.scrollTranslationTimeout = setTimeout(() => {
        this.translateNewlyVisibleContent(sourceLanguage, targetLanguage)
      }, 500) // 滚动停止500ms后执行翻译
    }
    
    window.addEventListener('scroll', this.scrollTranslationHandler, { passive: true })
    console.log('已设置滚动翻译监听器')
  }

  /**
   * 翻译新进入可视区域的内容
   */
  async translateNewlyVisibleContent(sourceLanguage, targetLanguage) {
    if (!this.isPageTranslated) return
    
    console.log('检查新进入可视区域的内容...')
    
    // 获取当前可视区域内未翻译的文本节点
    const allTextNodes = this.getPageTextNodes()
    const newlyVisibleNodes = []
    
    for (const node of allTextNodes) {
      const parent = node.parentElement
      if (parent && this.isElementInViewport(parent) && !parent.querySelector('.translation-append')) {
        newlyVisibleNodes.push(node)
      }
    }
    
    if (newlyVisibleNodes.length === 0) {
      console.log('没有发现新的可翻译内容')
      return
    }
    
    console.log(`发现 ${newlyVisibleNodes.length} 个新的可翻译文本节点`)
    
    // 提取文本内容
    const texts = newlyVisibleNodes.map(node => node.textContent.trim()).filter(text => text.length > 0 && text.length <= 500)
    
    if (texts.length === 0) {
      console.log('没有找到符合翻译条件的新内容')
      return
    }
    
    try {
      // 通过 service worker 逐个翻译
      const results = []
      for (const text of texts) {
        try {
          const result = await this.translateText(text, sourceLanguage, targetLanguage)
          results.push({
            original: text,
            translated: result.result || text
          })
        } catch (error) {
          console.error('翻译失败:', error)
          results.push({
            original: text,
            translated: text
          })
        }
      }
      
      // 将翻译结果应用到页面
      let resultIndex = 0
      let translatedCount = 0
      
      for (let i = 0; i < newlyVisibleNodes.length; i++) {
        const node = newlyVisibleNodes[i]
        const originalText = node.textContent.trim()
        
        if (originalText.length > 0 && originalText.length <= 500) {
          const result = results[resultIndex]
          if (result && result.translated !== result.original) {
            this.appendTranslationToNode(node, result.translated)
            translatedCount++
          }
          resultIndex++
        }
      }
      
      if (translatedCount > 0) {
        console.log(`新内容翻译完成，共翻译了 ${translatedCount} 个文本片段`)
      }
    } catch (error) {
      console.error('翻译新内容失败:', error)
    }
  }

  /**
   * 在文本节点右侧添加译文
   */
  appendTranslationToNode(textNode, translatedText, isError = false) {
    const parent = textNode.parentElement;
    if (!parent) return;
    
    // 检查是否已经有翻译结果
    const existingTranslation = parent.querySelector('.translation-append');
    if (existingTranslation) {
      existingTranslation.remove();
    }
    
    // 创建翻译元素
    const translationElement = document.createElement('span');
    translationElement.className = 'translation-append translated-text';
    
    if (isError) {
      // 显示翻译失败提示
      translationElement.textContent = ' [翻译失败]';
      translationElement.style.color = '#f56c6c';
      translationElement.style.fontSize = '12px';
    } else {
      translationElement.textContent = ` [${translatedText}]`;
    }
    
    // 在文本节点后插入翻译
    if (textNode.nextSibling) {
      parent.insertBefore(translationElement, textNode.nextSibling);
    } else {
      parent.appendChild(translationElement);
    }
  }

  /**
   * 显示翻译进度
   */
  showTranslationProgress(message) {
    // 移除现有进度提示
    const existingProgress = document.getElementById('translation-progress')
    if (existingProgress) {
      existingProgress.remove()
    }
    
    const progressElement = document.createElement('div')
    progressElement.id = 'translation-progress'
    progressElement.innerHTML = `
      <div class="progress-text">${message}</div>
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
    `
    
    Object.assign(progressElement.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#409eff',
      color: '#ffffff',
      padding: '16px 24px',
      borderRadius: '8px',
      fontSize: '14px',
      zIndex: '2147483647',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      minWidth: '280px',
      textAlign: 'center'
    })
    
    // 添加进度条样式
    const style = document.createElement('style')
    style.id = 'translation-progress-style'
    style.textContent = `
      #translation-progress .progress-text {
        margin-bottom: 8px;
        font-weight: 500;
      }
      #translation-progress .progress-bar {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        overflow: hidden;
      }
      #translation-progress .progress-fill {
        height: 100%;
        background: white;
        border-radius: 2px;
        width: 0%;
        transition: width 0.3s ease;
        animation: progress-pulse 1.5s ease-in-out infinite;
      }
      @keyframes progress-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `
    
    document.head.appendChild(style)
    document.body.appendChild(progressElement)
  }

  /**
   * 更新翻译进度
   */
  updateTranslationProgress(message, progress = null) {
    const progressElement = document.getElementById('translation-progress')
    if (progressElement) {
      const textElement = progressElement.querySelector('.progress-text')
      const fillElement = progressElement.querySelector('.progress-fill')
      
      if (textElement) {
        textElement.textContent = message
      }
      
      if (fillElement && progress !== null) {
        fillElement.style.width = `${Math.min(progress, 100)}%`
      }
    }
  }

  /**
   * 隐藏翻译进度
   */
  hideTranslationProgress() {
    const progressElement = document.getElementById('translation-progress')
    if (progressElement) {
      progressElement.remove()
    }
    
    const progressStyle = document.getElementById('translation-progress-style')
    if (progressStyle) {
      progressStyle.remove()
    }
  }

  /**
   * 显示成功消息
   */
  showSuccessMessage(message) {
    this.showToast(message, '#67c23a')
  }

  /**
   * 显示Toast消息
   */
  showToast(message, backgroundColor = '#f56c6c') {
    const toastElement = document.createElement('div')
    toastElement.className = 'chrome-ai-translator-toast'
    toastElement.textContent = message
    
    Object.assign(toastElement.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: backgroundColor,
      color: '#ffffff',
      padding: '12px 16px',
      borderRadius: '4px',
      fontSize: '14px',
      zIndex: '2147483647',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      opacity: '0',
      transform: 'translateX(100%)',
      transition: 'all 0.3s ease',
      maxWidth: '300px',
      wordWrap: 'break-word',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    })
    
    document.body.appendChild(toastElement)
    
    // 显示动画
    setTimeout(() => {
      toastElement.style.opacity = '1'
      toastElement.style.transform = 'translateX(0)'
    }, 10)
    
    // 自动隐藏
    setTimeout(() => {
      toastElement.style.opacity = '0'
      toastElement.style.transform = 'translateX(100%)'
      setTimeout(() => {
        if (toastElement.parentNode) {
          toastElement.parentNode.removeChild(toastElement)
        }
      }, 300)
    }, 3000)
  }

  /**
   * 销毁 Content Script
   */
  destroy() {
    // 隐藏覆盖层
    this.hideOverlay()
    
    // 移除事件监听器
    document.removeEventListener('mouseup', this.handleTextSelection)
    document.removeEventListener('keyup', this.handleKeyboardSelection)
    document.removeEventListener('selectionchange', this.handleSelectionChange)
    document.removeEventListener('click', this.handleDocumentClick)
    document.removeEventListener('scroll', this.handleDocumentScroll)
    window.removeEventListener('resize', this.handleWindowResize)
    
    console.log('Content Script 已销毁')
  }
}

// 初始化内容脚本
const contentTranslator = new ContentTranslator()

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  contentTranslator.destroy()
})
