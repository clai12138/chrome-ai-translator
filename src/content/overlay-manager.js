// Vue 覆盖层管理器 - 在 Content Script 中使用 Vue 组件
// 需求: 1.1, 1.3, 1.4 - 网页翻译覆盖层组件

import { createApp } from 'vue';
import OverlayPopup from '../popup/components/OverlayPopup.vue';
import { DEFAULT_LANGUAGE_PREFERENCES, MESSAGE_TYPES, STORAGE_KEYS } from '../shared/constants.json';

/**
 * Vue 覆盖层管理器类
 * 负责在 Content Script 环境中管理 Vue 覆盖层组件
 */
export class OverlayManager {
  constructor() {
    this.app = null;
    this.overlayContainer = null;
    this.isVisible = false;
    this.languagePreferences = DEFAULT_LANGUAGE_PREFERENCES;
    this.currentTranslation = {
      sourceText: '',
      translatedText: '',
      isTranslating: false,
      isStreaming: false,
      partialResult: '',
      translationMethod: '',
      errorMessage: '',
    };

    this.init();
  }

  /**
   * 初始化覆盖层管理器
   */
  async init() {
    try {
      // 加载用户语言偏好
      await this.loadLanguagePreferences();

      // 创建覆盖层容器
      this.createOverlayContainer();

      console.log('Vue 覆盖层管理器初始化完成');
    } catch (error) {
      console.error('Vue 覆盖层管理器初始化失败:', error);
    }
  }

  /**
   * 创建覆盖层容器
   */
  createOverlayContainer() {
    // 创建容器元素
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'chrome-ai-translator-overlay-container';
    this.overlayContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      z-index: 2147483647;
      pointer-events: none;
    `;

    // 添加到页面
    document.body.appendChild(this.overlayContainer);
  }

  /**
   * 显示翻译覆盖层
   * 需求: 1.1 - 在选中文本附近显示翻译弹窗
   * @param {string} selectedText - 选中的文本
   * @param {Object} position - 位置信息
   */
  showOverlay(selectedText, position) {
    if (!this.overlayContainer) {
      console.error('覆盖层容器未初始化');
      return;
    }

    // 更新翻译状态
    this.currentTranslation = {
      sourceText: selectedText,
      translatedText: '',
      isTranslating: false,
      isStreaming: false,
      partialResult: '',
      translationMethod: '',
      errorMessage: '',
    };

    // 如果已有 Vue 应用，先销毁
    if (this.app) {
      this.app.unmount();
      this.app = null;
    }

    // 创建 Vue 应用
    this.app = createApp({
      components: {
        OverlayPopup,
      },
      data() {
        return {
          visible: true,
          position: position,
          sourceText: selectedText,
          translatedText: '',
          sourceLanguage: this.languagePreferences.sourceLanguage,
          targetLanguage: this.languagePreferences.targetLanguage,
          isTranslating: false,
          translationStatus: '正在翻译...',
          isStreaming: false,
          partialResult: '',
          translationMethod: '',
          errorMessage: '',
          showLanguageInfo: true,
          autoHide: false, // 在 content script 中手动控制隐藏
        };
      },
      methods: {
        handleClose() {
          this.$parent.hideOverlay();
        },

        async handleTranslate(data) {
          console.log('翻译请求:', data);
          this.$parent.performTranslation(data.text);
        },

        handleCopy(data) {
          console.log('复制内容:', data);
          this.$parent.saveToHistory(data.originalText, data.translatedText);
        },

        handlePositionUpdate() {
          // 重新计算位置
          this.$parent.updateOverlayPosition();
        },
      },
      template: `
        <OverlayPopup
          :visible="visible"
          :position="position"
          :source-text="sourceText"
          :translated-text="translatedText"
          :source-language="sourceLanguage"
          :target-language="targetLanguage"
          :is-translating="isTranslating"
          :translation-status="translationStatus"
          :is-streaming="isStreaming"
          :partial-result="partialResult"
          :translation-method="translationMethod"
          :error-message="errorMessage"
          :show-language-info="showLanguageInfo"
          :auto-hide="autoHide"
          @close="handleClose"
          @translate="handleTranslate"
          @copy="handleCopy"
          @position-update="handlePositionUpdate"
        />
      `,
    });

    // 设置父组件引用
    this.app.config.globalProperties.$parent = this;

    // 挂载到容器
    this.app.mount(this.overlayContainer);
    this.isVisible = true;

    console.log('Vue 覆盖层已显示:', selectedText.substring(0, 50));
  }

  /**
   * 隐藏覆盖层
   * 需求: 1.4 - 实现覆盖层的自动隐藏功能
   */
  hideOverlay() {
    if (this.app) {
      this.app.unmount();
      this.app = null;
    }

    this.isVisible = false;
    console.log('Vue 覆盖层已隐藏');
  }

  /**
   * 更新覆盖层位置
   */
  updateOverlayPosition(newPosition) {
    if (this.app && this.app._instance) {
      const vm = this.app._instance.ctx;
      if (newPosition) {
        vm.position = newPosition;
      }
    }
  }

  /**
   * 执行翻译
   * 需求: 1.2 - 当用户点击翻译按钮时，系统应使用Chrome的Translator API翻译选中的文本
   * @param {string} text - 要翻译的文本
   */
  async performTranslation(text) {
    if (!this.app || !this.app._instance) {
      return;
    }

    const vm = this.app._instance.ctx;

    try {
      // 更新UI状态
      vm.isTranslating = true;
      vm.translatedText = '';
      vm.errorMessage = '';
      vm.partialResult = '';

      // 判断是否使用流式翻译
      const useStreaming = text.length > 100;
      vm.isStreaming = useStreaming;
      vm.translationMethod = useStreaming ? 'streaming' : 'regular';

      // 发送翻译请求到 background script
      const response = await this.sendTranslationRequest(text, useStreaming);

      if (response.success) {
        if (useStreaming && response.isStreaming) {
          // 处理流式翻译结果
          await this.handleStreamingTranslation(response.stream);
        } else {
          // 显示普通翻译结果
          vm.translatedText = response.result;
        }

        // 保存到翻译历史
        this.saveToHistory(text, vm.translatedText);
      } else {
        // 显示错误信息
        vm.errorMessage = response.error || '翻译失败';
      }
    } catch (error) {
      console.error('翻译失败:', error);
      vm.errorMessage = error.message || '翻译服务异常';
    } finally {
      // 恢复UI状态
      vm.isTranslating = false;
      vm.isStreaming = false;
    }
  }

  /**
   * 处理流式翻译
   * 需求: 4.2, 4.3 - 流式翻译实时显示
   * @param {AsyncIterable} stream - 翻译流
   */
  async handleStreamingTranslation(stream) {
    if (!this.app || !this.app._instance) {
      return;
    }

    const vm = this.app._instance.ctx;
    let fullResult = '';

    try {
      for await (const chunk of stream) {
        fullResult += chunk;
        vm.partialResult = fullResult;

        // 添加小延迟以提供更好的视觉效果
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // 流式翻译完成
      vm.translatedText = fullResult;
      vm.partialResult = '';
    } catch (error) {
      console.error('流式翻译处理失败:', error);
      vm.errorMessage = '流式翻译中断';
    }
  }

  /**
   * 发送翻译请求到 background script
   * @param {string} text - 要翻译的文本
   * @param {boolean} useStreaming - 是否使用流式翻译
   * @returns {Promise<Object>} 翻译响应
   */
  async sendTranslationRequest(text, useStreaming = false) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: MESSAGE_TYPES.TRANSLATE_TEXT,
          text: text,
          sourceLanguage: this.languagePreferences.sourceLanguage,
          targetLanguage: this.languagePreferences.targetLanguage,
          useStreaming: useStreaming,
        },
        (response) => {
          resolve(response || { success: false, error: '翻译服务无响应' });
        }
      );
    });
  }

  /**
   * 保存翻译到历史记录
   * 需求: 3.1 - 保存翻译历史
   * @param {string} sourceText - 源文本
   * @param {string} translatedText - 翻译文本
   */
  async saveToHistory(sourceText, translatedText) {
    if (!sourceText || !translatedText) {
      return;
    }

    try {
      const historyItem = {
        id: Date.now().toString(),
        sourceText: sourceText,
        translatedText: translatedText,
        sourceLanguage: this.languagePreferences.sourceLanguage,
        targetLanguage: this.languagePreferences.targetLanguage,
        timestamp: Date.now(),
      };

      // 发送消息到 background script 保存历史
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.ADD_HISTORY,
        item: historyItem,
      });
    } catch (error) {
      console.error('保存翻译历史失败:', error);
    }
  }

  /**
   * 加载用户语言偏好
   * 需求: 2.2 - 使用保存的语言偏好
   */
  async loadLanguagePreferences() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.LANGUAGE_PREFERENCES);
      if (result[STORAGE_KEYS.LANGUAGE_PREFERENCES]) {
        this.languagePreferences = {
          ...DEFAULT_LANGUAGE_PREFERENCES,
          ...result[STORAGE_KEYS.LANGUAGE_PREFERENCES],
        };
      }
    } catch (error) {
      console.error('加载语言偏好失败:', error);
    }
  }

  /**
   * 更新语言偏好
   * @param {Object} preferences - 新的语言偏好
   */
  updateLanguagePreferences(preferences) {
    this.languagePreferences = { ...this.languagePreferences, ...preferences };

    // 如果覆盖层可见，更新语言设置
    if (this.app && this.app._instance) {
      const vm = this.app._instance.ctx;
      vm.sourceLanguage = this.languagePreferences.sourceLanguage;
      vm.targetLanguage = this.languagePreferences.targetLanguage;
    }
  }

  /**
   * 检查覆盖层是否可见
   * @returns {boolean} 是否可见
   */
  isOverlayVisible() {
    return this.isVisible;
  }

  /**
   * 显示翻译面板
   */
  showTranslatorPanel() {
    // 创建翻译面板容器
    let panelContainer = document.getElementById('chrome-ai-translator-panel');

    if (panelContainer) {
      // 如果面板已存在，切换显示状态
      const isVisible = panelContainer.style.display !== 'none';
      panelContainer.style.display = isVisible ? 'none' : 'block';
      return;
    }

    // 创建新的翻译面板
    panelContainer = document.createElement('div');
    panelContainer.id = 'chrome-ai-translator-panel';
    panelContainer.innerHTML = `
      <div class="translator-panel-content">
        <div class="panel-header">
          <h3>AI翻译面板</h3>
          <button class="close-panel-btn" onclick="this.closest('#chrome-ai-translator-panel').style.display='none'">×</button>
        </div>
        <div class="panel-body">
          <div class="input-section">
            <textarea placeholder="输入要翻译的文本..." class="translation-input"></textarea>
            <div class="language-controls">
              <select class="source-lang">
                <option value="auto">自动检测</option>
                <option value="en">English</option>
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
              </select>
              <span class="arrow">→</span>
              <select class="target-lang">
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
              </select>
              <button class="translate-btn">翻译</button>
            </div>
          </div>
          <div class="result-section">
            <div class="translation-result" placeholder="翻译结果将显示在这里..."></div>
            <div class="result-actions">
              <button class="copy-result-btn">复制结果</button>
              <button class="clear-result-btn">清空</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 应用样式
    panelContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-width: 90vw;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // 添加内部样式
    const style = document.createElement('style');
    style.textContent = `
      #chrome-ai-translator-panel .translator-panel-content {
        padding: 0;
      }
      #chrome-ai-translator-panel .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #eee;
        background: #f8f9fa;
        border-radius: 12px 12px 0 0;
      }
      #chrome-ai-translator-panel .panel-header h3 {
        margin: 0;
        font-size: 16px;
        color: #333;
      }
      #chrome-ai-translator-panel .close-panel-btn {
        background: none;
        border: none;
        font-size: 20px;
        color: #999;
        cursor: pointer;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }
      #chrome-ai-translator-panel .close-panel-btn:hover {
        background: #e9ecef;
        color: #333;
      }
      #chrome-ai-translator-panel .panel-body {
        padding: 20px;
      }
      #chrome-ai-translator-panel .translation-input {
        width: 100%;
        height: 100px;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        resize: vertical;
        font-family: inherit;
        margin-bottom: 12px;
      }
      #chrome-ai-translator-panel .language-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      }
      #chrome-ai-translator-panel .source-lang,
      #chrome-ai-translator-panel .target-lang {
        padding: 6px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }
      #chrome-ai-translator-panel .arrow {
        color: #409eff;
        font-weight: bold;
      }
      #chrome-ai-translator-panel .translate-btn {
        padding: 6px 16px;
        background: #409eff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      #chrome-ai-translator-panel .translate-btn:hover {
        background: #337ecc;
      }
      #chrome-ai-translator-panel .translation-result {
        min-height: 80px;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #f8f9fa;
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 12px;
        white-space: pre-wrap;
      }
      #chrome-ai-translator-panel .translation-result:empty::before {
        content: "翻译结果将显示在这里...";
        color: #999;
      }
      #chrome-ai-translator-panel .result-actions {
        display: flex;
        gap: 8px;
      }
      #chrome-ai-translator-panel .copy-result-btn,
      #chrome-ai-translator-panel .clear-result-btn {
        padding: 6px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 14px;
      }
      #chrome-ai-translator-panel .copy-result-btn:hover,
      #chrome-ai-translator-panel .clear-result-btn:hover {
        background: #f5f5f5;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(panelContainer);

    // 绑定事件
    this.bindPanelEvents(panelContainer);

    console.log('翻译面板已显示');
  }

  /**
   * 绑定翻译面板事件
   */
  bindPanelEvents(panelContainer) {
    const input = panelContainer.querySelector('.translation-input');
    const sourceSelect = panelContainer.querySelector('.source-lang');
    const targetSelect = panelContainer.querySelector('.target-lang');
    const translateBtn = panelContainer.querySelector('.translate-btn');
    const resultDiv = panelContainer.querySelector('.translation-result');
    const copyBtn = panelContainer.querySelector('.copy-result-btn');
    const clearBtn = panelContainer.querySelector('.clear-result-btn');

    // 设置默认语言
    sourceSelect.value = this.languagePreferences.sourceLanguage;
    targetSelect.value = this.languagePreferences.targetLanguage;

    // 翻译按钮事件
    translateBtn.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) return;

      translateBtn.textContent = '翻译中...';
      translateBtn.disabled = true;
      resultDiv.textContent = '';

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'TRANSLATE_TEXT',
          text: text,
          sourceLanguage: sourceSelect.value,
          targetLanguage: targetSelect.value,
        });

        if (response.success) {
          resultDiv.textContent = response.result;
        } else {
          resultDiv.textContent = `翻译失败: ${response.error}`;
          resultDiv.style.color = '#f56c6c';
        }
      } catch (error) {
        resultDiv.textContent = `翻译失败: ${error.message}`;
        resultDiv.style.color = '#f56c6c';
      } finally {
        translateBtn.textContent = '翻译';
        translateBtn.disabled = false;
        resultDiv.style.color = '';
      }
    });

    // 复制结果事件
    copyBtn.addEventListener('click', async () => {
      const text = resultDiv.textContent;
      if (!text || text.includes('翻译失败')) return;

      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = '已复制';
        setTimeout(() => {
          copyBtn.textContent = '复制结果';
        }, 1000);
      } catch (error) {
        console.error('复制失败:', error);
      }
    });

    // 清空事件
    clearBtn.addEventListener('click', () => {
      input.value = '';
      resultDiv.textContent = '';
    });

    // 回车翻译
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        translateBtn.click();
      }
    });
  }

  /**
   * 销毁覆盖层管理器
   */
  destroy() {
    this.hideOverlay();

    if (this.overlayContainer && this.overlayContainer.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer);
    }

    // 移除翻译面板
    const panel = document.getElementById('chrome-ai-translator-panel');
    if (panel) {
      panel.remove();
    }

    this.overlayContainer = null;
    this.languagePreferences = null;
    this.currentTranslation = null;

    console.log('Vue 覆盖层管理器已销毁');
  }
}

export default OverlayManager;
