// Background Service Worker - 处理扩展生命周期和消息传递
// 需求: 7.3, 7.4 - Background Service Worker 实现

// 导入翻译核心类和常量
import translationCore from '../shared/translation-core.js'
import { 
  DEFAULT_LANGUAGE_PREFERENCES, 
  DEFAULT_EXTENSION_SETTINGS, 
  SUPPORTED_LANGUAGES 
} from '../shared/constants.json'

console.log('Chrome AI翻译扩展 Service Worker 已启动');

/**
 * Background Service 类
 * 负责处理扩展生命周期、消息传递和翻译服务协调
 */
class BackgroundService {
  constructor() {
    this.translatorInstances = new Map(); // 缓存翻译器实例
    this.constants = null;
    this.init();
  }

  /**
   * 初始化 Background Service
   * 需求: 7.3 - 实现扩展生命周期管理
   */
  init() {
    // 监听扩展安装事件
    chrome.runtime.onInstalled.addListener(this.handleInstalled.bind(this));

    // 监听来自 Content Script 和 Popup 的消息
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // 监听扩展图标点击事件
    chrome.action.onClicked.addListener(this.handleActionClick.bind(this));

    // 监听存储变化事件
    chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));

    // 监听右键菜单点击事件
    chrome.contextMenus.onClicked.addListener(this.handleContextMenuClick.bind(this));

    // 监听标签页激活事件，更新右键菜单状态
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));

    // 监听标签页更新事件，更新右键菜单状态
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));

    console.log('Background Service 初始化完成');
  }

  /**
   * 处理扩展安装事件
   * 需求: 7.4 - 扩展初始化配置
   */
  async handleInstalled(details) {
    console.log('扩展已安装:', details.reason);

    // 设置默认配置
    const defaultConfig = {
      languagePreferences: DEFAULT_LANGUAGE_PREFERENCES,
      extensionSettings: DEFAULT_EXTENSION_SETTINGS,
      translationHistory: [],
    };

    // 使用 sync 存储用户偏好，local 存储历史记录
    chrome.storage.sync.set({
      languagePreferences: defaultConfig.languagePreferences,
      extensionSettings: defaultConfig.extensionSettings,
    });

    chrome.storage.local.set({
      translationHistory: defaultConfig.translationHistory,
    });

    // 创建右键菜单
    this.createContextMenus();

    console.log('默认配置已设置');
  }

  /**
   * 处理消息
   * 需求: 7.3 - Content Script 和 Popup 之间的消息传递
   */
  handleMessage(message, sender, sendResponse) {
    console.log(
      '收到消息:',
      message.type,
      '来自:',
      sender.tab ? `标签页 ${sender.tab.id}` : 'popup'
    );

    switch (message.type) {
      case 'TRANSLATE_TEXT':
        this.handleTranslateRequest(message, sendResponse);
        return true; // 保持消息通道开放以进行异步响应

      case 'TRANSLATE_STREAMING':
        this.handleStreamingTranslateRequest(message, sender, sendResponse);
        return true;

      case 'GET_SETTINGS':
        this.handleGetSettings(sendResponse);
        return true;

      case 'UPDATE_SETTINGS':
        this.handleUpdateSettings(message.settings, sendResponse);
        return true;

      case 'GET_HISTORY':
        this.handleGetHistory(sendResponse);
        return true;

      case 'ADD_HISTORY':
        this.handleAddHistory(message.item, sendResponse);
        return true;

      case 'CLEAR_HISTORY':
        this.handleClearHistory(sendResponse);
        return true;

      case 'CHECK_TRANSLATOR_AVAILABILITY':
        this.handleCheckAvailability(message, sendResponse);
        return true;

      case 'GET_SUPPORTED_LANGUAGES':
        this.handleGetSupportedLanguages(sendResponse);
        return true;

      case 'PRELOAD_TRANSLATOR':
        this.handlePreloadTranslator(message, sendResponse);
        return true;

      case 'CLEAR_TRANSLATOR_CACHE':
        this.clearTranslatorCache();
        sendResponse({ success: true });
        return false;

      case 'GET_CACHE_INFO':
        sendResponse({
          success: true,
          data: this.getTranslatorCacheInfo(),
        });
        return false;

      case 'UPDATE_CONTEXT_MENU':
        this.handleUpdateContextMenu(message);
        sendResponse({ success: true });
        return false;

      default:
        console.log('未知消息类型:', message.type);
        sendResponse({ success: false, error: '未知消息类型' });
    }
  }

  /**
   * 检测文本语言 - 使用translationCore
   */
  async detectLanguage(text) {
    try {
      return await translationCore.detectLanguage(text);
    } catch (error) {
      console.error('语言检测失败:', error);
      return null; // 返回null表示检测失败
    }
  }

  /**
   * 处理翻译请求
   * 需求: 1.2 - 翻译器实例的全局管理
   */
  async handleTranslateRequest(message, sendResponse) {
    try {
      const { text, sourceLanguage, targetLanguage } = message;

      if (!text || text.trim().length === 0) {
        sendResponse({ success: false, error: '翻译文本不能为空' });
        return;
      }

      if (text.length > 5000) {
        sendResponse({ success: false, error: '文本长度超过5000字符限制' });
        return;
      }

      console.log(`开始翻译: ${sourceLanguage} -> ${targetLanguage}, 文本长度: ${text.length}`);

      // 检查浏览器支持
      if (!translationCore.isTranslatorAvailable()) {
        sendResponse({
          success: false,
          error: '当前浏览器版本不支持AI翻译功能，请升级到Chrome 138或更高版本',
        });
        return;
      }

      // 使用翻译核心类进行智能翻译
      const result = await translationCore.smartTranslate(text, sourceLanguage, targetLanguage);

      console.log('翻译完成:', result.result.substring(0, 50) + (result.result.length > 50 ? '...' : ''));

      sendResponse({
        success: true,
        result: result.result,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
      });
    } catch (error) {
      console.error('翻译失败:', error);

      let errorMessage = '翻译失败，请重试';

      // 根据错误类型提供更具体的错误信息
      if (error.message.includes('not supported')) {
        errorMessage = '不支持的语言对';
      } else if (error.message.includes('model')) {
        errorMessage = '翻译模型不可用，请稍后再试';
      } else if (error.message.includes('network')) {
        errorMessage = '网络错误，请检查网络连接';
      }

      sendResponse({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * 处理获取设置请求
   */
  async handleGetSettings(sendResponse) {
    try {
      const syncResult = await chrome.storage.sync.get([
        'languagePreferences',
        'extensionSettings',
      ]);
      const localResult = await chrome.storage.local.get(['translationHistory']);

      sendResponse({
        success: true,
        data: {
          ...syncResult,
          ...localResult,
        },
      });
    } catch (error) {
      console.error('获取设置失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 处理更新设置请求
   */
  async handleUpdateSettings(settings, sendResponse) {
    try {
      // 分别存储到 sync 和 local
      const syncData = {};
      const localData = {};

      if (settings.languagePreferences) {
        syncData.languagePreferences = settings.languagePreferences;
      }

      if (settings.extensionSettings) {
        syncData.extensionSettings = settings.extensionSettings;
      }

      if (settings.translationHistory) {
        localData.translationHistory = settings.translationHistory;
      }

      if (Object.keys(syncData).length > 0) {
        await chrome.storage.sync.set(syncData);
      }

      if (Object.keys(localData).length > 0) {
        await chrome.storage.local.set(localData);
      }

      sendResponse({ success: true });
    } catch (error) {
      console.error('更新设置失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 处理获取历史记录请求
   * 需求: 3.2 - 显示翻译历史
   */
  async handleGetHistory(sendResponse) {
    try {
      const result = await chrome.storage.local.get('translationHistory');
      const history = result.translationHistory || [];

      sendResponse({
        success: true,
        data: history.slice(-100), // 只返回最近100条记录
      });
    } catch (error) {
      console.error('获取历史记录失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 处理添加历史记录请求
   * 需求: 3.1 - 保存翻译历史
   */
  async handleAddHistory(item, sendResponse) {
    try {
      const result = await chrome.storage.local.get('translationHistory');
      const history = result.translationHistory || [];

      // 添加新记录到开头
      history.unshift(item);

      // 限制历史记录数量
      if (history.length > 1000) {
        history.splice(1000);
      }

      await chrome.storage.local.set({ translationHistory: history });

      sendResponse({ success: true });
    } catch (error) {
      console.error('添加历史记录失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 处理清除历史记录请求
   * 需求: 3.4 - 清除历史记录功能
   */
  async handleClearHistory(sendResponse) {
    try {
      await chrome.storage.local.set({ translationHistory: [] });
      sendResponse({ success: true });
    } catch (error) {
      console.error('清除历史记录失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 创建右键菜单
   * 需求: 7.4 - 实现扩展图标和右键菜单功能
   */
  createContextMenus() {
    // 清除现有菜单
    chrome.contextMenus.removeAll(() => {
      // 创建菜单项，默认显示"全文翻译"
      chrome.contextMenus.create({
        id: 'toggle-translate-page',
        title: '全文翻译',
        contexts: ['page'],
        documentUrlPatterns: ['http://*/*', 'https://*/*'],
      });

      console.log('右键菜单已创建');
    });
  }

  /**
   * 更新右键菜单状态
   * 在页面加载时检查翻译状态并更新菜单文字
   */
  async updateContextMenuForTab(tabId) {
    try {
      // 检查URL是否可以翻译
      const tab = await chrome.tabs.get(tabId);
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
          tab.url.startsWith('moz-extension://') || tab.url.startsWith('about:')) {
        return;
      }

      // 尝试获取页面翻译状态
      try {
        const statusResponse = await chrome.tabs.sendMessage(tabId, {
          type: 'GET_TRANSLATION_STATUS',
        });

        if (statusResponse && statusResponse.isTranslated) {
          // 页面已翻译，显示"取消全文翻译"
          chrome.contextMenus.update('toggle-translate-page', {
            title: '取消全文翻译'
          });
        } else {
          // 页面未翻译，显示"全文翻译"
          chrome.contextMenus.update('toggle-translate-page', {
            title: '全文翻译'
          });
        }
      } catch (error) {
        // content script 未加载或无法通信，默认显示"全文翻译"
        chrome.contextMenus.update('toggle-translate-page', {
          title: '全文翻译'
        });
      }
    } catch (error) {
      console.error('更新右键菜单状态失败:', error);
    }
  }

  /**
   * 处理右键菜单点击事件
   * 需求: 7.4 - 右键菜单功能实现
   */
  async handleContextMenuClick(info, tab) {
    console.log('右键菜单被点击:', info.menuItemId, '标签页:', tab.id);

    try {
      switch (info.menuItemId) {
        case 'toggle-translate-page':
          await this.togglePageTranslation(tab);
          break;

        default:
          console.log('未知的菜单项:', info.menuItemId);
      }
    } catch (error) {
      console.error('处理右键菜单点击失败:', error);
    }
  }

  /**
   * 切换页面翻译状态
   */
  async togglePageTranslation(tab) {
    console.log('切换页面翻译状态:', tab.url);

    // 检查URL是否可以翻译
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('moz-extension://') || tab.url.startsWith('about:')) {
      console.log('无法在此页面执行翻译:', tab.url);
      return;
    }

    // 获取用户语言偏好
    let languagePreferences;
    try {
      const result = await chrome.storage.sync.get('languagePreferences');
      languagePreferences = result.languagePreferences || {
        sourceLanguage: 'auto',
        targetLanguage: 'zh'
      };
    } catch (error) {
      console.error('获取语言偏好失败:', error);
      languagePreferences = {
        sourceLanguage: 'auto',
        targetLanguage: 'zh'
      };
    }

    console.log('使用语言偏好:', languagePreferences);

    // 确保 content script 已加载
    let contentScriptReady = false;
    try {
      // 先尝试发送测试消息
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      if (pingResponse && pingResponse.success) {
        contentScriptReady = true;
      }
    } catch (error) {
      console.log('Content script 未就绪，准备注入:', error.message);
    }

    if (!contentScriptReady) {
      // content script 未加载，注入它
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-script.js'],
        });
        
        console.log('Content script 注入成功，等待初始化...');
        
        // 等待 content script 初始化
        let retries = 0;
        const maxRetries = 10;
        
        while (retries < maxRetries) {
          try {
            await new Promise(resolve => setTimeout(resolve, 200));
            const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
            if (pingResponse && pingResponse.success) {
              contentScriptReady = true;
              console.log('Content script 初始化完成');
              break;
            }
          } catch (error) {
            retries++;
            console.log(`等待 content script 初始化... (${retries}/${maxRetries})`);
          }
        }
        
        if (!contentScriptReady) {
          console.error('Content script 初始化超时');
          return;
        }
      } catch (injectError) {
        console.error('注入 content script 失败:', injectError);
        return;
      }
    }

    // 发送消息到 content script 查询当前翻译状态
    try {
      console.log('查询页面翻译状态...');
      
      const statusResponse = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_TRANSLATION_STATUS',
      });

      console.log('页面翻译状态响应:', statusResponse);

      if (statusResponse && statusResponse.isTranslated) {
        // 当前已翻译，执行取消翻译
        console.log('取消页面翻译...');
        
        const cancelResponse = await chrome.tabs.sendMessage(tab.id, {
          type: 'CANCEL_TRANSLATE_PAGE',
        });
        
        console.log('取消翻译响应:', cancelResponse);
        
        // 更新菜单文字
        chrome.contextMenus.update('toggle-translate-page', {
          title: '全文翻译'
        });

        // 通知所有popup页面更新状态
        this.notifyPopupsTranslationStatus(false);
      } else {
        // 当前未翻译，执行翻译
        console.log('开始页面翻译...', languagePreferences);
        
        const translateResponse = await chrome.tabs.sendMessage(tab.id, {
          type: 'TRANSLATE_PAGE',
          sourceLanguage: languagePreferences.sourceLanguage,
          targetLanguage: languagePreferences.targetLanguage
        });
        
        console.log('翻译响应:', translateResponse);
        
        if (translateResponse && translateResponse.success) {
          // 更新菜单文字
          chrome.contextMenus.update('toggle-translate-page', {
            title: '取消全文翻译'
          });

          // 通知所有popup页面更新状态
          this.notifyPopupsTranslationStatus(true);
          
          console.log(`页面翻译完成，共翻译了 ${translateResponse.translatedCount || 0} 个文本片段`);
        } else {
          console.error('页面翻译失败:', translateResponse?.error || '未知错误');
        }
      }
    } catch (error) {
      console.error('页面翻译操作失败:', error);
    }
  }

  /**
   * 通知所有popup页面更新翻译状态
   */
  async notifyPopupsTranslationStatus(isTranslated) {
    try {
      // 发送消息到所有扩展页面（popup等）
      chrome.runtime.sendMessage({
        type: 'TRANSLATION_STATUS_CHANGED',
        isTranslated: isTranslated
      }).catch(() => {
        // 忽略没有监听器的错误
      });
    } catch (error) {
      console.log('通知popup状态失败:', error.message);
    }
  }

  /**
   * 处理来自popup的右键菜单更新请求
   */
  handleUpdateContextMenu(message) {
    try {
      const { isTranslated } = message;
      console.log('更新右键菜单状态:', isTranslated);
      
      // 更新菜单文字
      chrome.contextMenus.update('toggle-translate-page', {
        title: isTranslated ? '取消全文翻译' : '全文翻译'
      });
    } catch (error) {
      console.error('更新右键菜单失败:', error);
    }
  }

  /**
   * 处理标签页激活事件
   */
  handleTabActivated(activeInfo) {
    console.log('标签页激活:', activeInfo.tabId);
    // 延迟更新菜单状态，确保页面已加载
    setTimeout(() => {
      this.updateContextMenuForTab(activeInfo.tabId);
    }, 500);
  }

  /**
   * 处理标签页更新事件
   */
  handleTabUpdated(tabId, changeInfo, tab) {
    // 只在页面完成加载时更新菜单状态
    if (changeInfo.status === 'complete') {
      console.log('标签页加载完成:', tabId, tab.url);
      setTimeout(() => {
        this.updateContextMenuForTab(tabId);
      }, 500);
    }
  }

  /**
   * 处理扩展图标点击事件
   * 需求: 7.4 - 扩展图标功能
   */
  handleActionClick(tab) {
    console.log('扩展图标被点击，当前标签页:', tab.id);
    // 扩展图标点击时打开弹窗，这里不需要额外处理
  }

  /**
   * 处理存储变化事件
   * 当设置发生变化时通知相关组件
   */
  handleStorageChanged(changes, areaName) {
    console.log('存储发生变化:', changes, '区域:', areaName);

    // 如果语言偏好发生变化，通知所有 content scripts
    if (changes.languagePreferences) {
      this.notifyContentScripts('UPDATE_LANGUAGE_PREFERENCES', {
        preferences: changes.languagePreferences.newValue,
      });
    }
  }

  /**
   * 通知所有 content scripts
   */
  async notifyContentScripts(type, data) {
    try {
      const tabs = await chrome.tabs.query({});

      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type, ...data });
        } catch (error) {
          // 忽略无法发送消息的标签页（比如 chrome:// 页面）
          console.log(`无法向标签页 ${tab.id} 发送消息:`, error.message);
        }
      }
    } catch (error) {
      console.error('通知 content scripts 失败:', error);
    }
  }

  /**
   * 清理翻译器实例缓存
   */
  clearTranslatorCache() {
    this.translatorInstances.clear();
    console.log('翻译器缓存已清理');
  }

  /**
   * 获取翻译器缓存信息
   */
  getTranslatorCacheInfo() {
    return Array.from(this.translatorInstances.keys());
  }

  /**
   * 处理检查翻译器可用性请求
   */
  async handleCheckAvailability(message, sendResponse) {
    try {
      const { sourceLanguage, targetLanguage } = message;

      // 使用translationCore检查可用性
      const isTranslatorAvailable = translationCore.isTranslatorAvailable();
      const isLanguageDetectorAvailable = translationCore.isLanguageDetectorAvailable();

      if (!isTranslatorAvailable) {
        sendResponse({
          success: false,
          error: '当前浏览器版本不支持AI翻译功能，请升级到Chrome 138或更高版本',
        });
        return;
      }

      // 如果需要自动检测但检测器不可用
      if (sourceLanguage === 'auto' && !isLanguageDetectorAvailable) {
        sendResponse({
          success: false,
          error: '语言检测功能不可用，请升级浏览器或手动选择源语言',
        });
        return;
      }

      let actualSourceLanguage = sourceLanguage;
      if (sourceLanguage === 'auto') {
        actualSourceLanguage = 'en'; // 检查可用性时使用默认语言
      }

      // 使用translationCore检查可用性
      let availability = 'available'; // 默认可用，具体检查由translationCore处理
      
      // 简单的语言对检查
      if (!translationCore.isTranslatorAvailable()) {
        availability = 'not-available';
      }

      sendResponse({
        success: true,
        data: {
          availability,
          sourceLanguage,
          targetLanguage,
          isTranslatorAvailable,
          isLanguageDetectorAvailable,
        },
      });
    } catch (error) {
      console.error('检查翻译器可用性失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 处理获取支持语言列表请求
   */
  async handleGetSupportedLanguages(sendResponse) {
    try {
      sendResponse({
        success: true,
        data: SUPPORTED_LANGUAGES,
      });
    } catch (error) {
      console.error('获取支持语言列表失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 处理预加载翻译器请求
   */
  async handlePreloadTranslator(message, sendResponse) {
    try {
      const { sourceLanguage, targetLanguage } = message;

      // 使用translationCore检查可用性
      if (!translationCore.isTranslatorAvailable()) {
        sendResponse({
          success: false,
          error: '当前浏览器版本不支持AI翻译功能，请升级到Chrome 138或更高版本',
        });
        return;
      }

      // 如果需要自动检测但检测器不可用
      if (sourceLanguage === 'auto' && !translationCore.isLanguageDetectorAvailable()) {
        sendResponse({
          success: false,
          error: '语言检测功能不可用，请升级浏览器或手动选择源语言',
        });
        return;
      }

      let actualSourceLanguage = sourceLanguage;
      if (sourceLanguage === 'auto') {
        actualSourceLanguage = 'en'; // 预加载时使用默认语言
      }

      // 检查可用性
      // 检查语言对可用性
      const availability = await Translator.availability({
        sourceLanguage: actualSourceLanguage,
        targetLanguage: targetLanguage,
      });

      if (availability === 'not-available') {
        sendResponse({
          success: false,
          error: `不支持的语言对: ${sourceLanguage} -> ${targetLanguage}`,
        });
        return;
      }

      // 创建翻译器实例
      const translatorKey = `${actualSourceLanguage}-${targetLanguage}`;

      if (!this.translatorInstances.has(translatorKey)) {
        const translator = await Translator.create({
          sourceLanguage: actualSourceLanguage,
          targetLanguage,
          monitor(m) {
            // 监听下载进度
            m.addEventListener('downloadprogress', (event) => {
              console.log(`模型下载进度: ${event.loaded}/${event.total}`);
            });
          },
        });

        this.translatorInstances.set(translatorKey, translator);
        console.log(`预加载翻译器成功: ${translatorKey}`);
      }

      sendResponse({
        success: true,
        data: {
          translatorKey,
          availability,
        },
      });
    } catch (error) {
      console.error('预加载翻译器失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 处理流式翻译请求
   * 需求: 4.1, 4.2, 4.3 - 流式翻译功能
   */
  async handleStreamingTranslateRequest(message, sender, sendResponse) {
    try {
      const { text, sourceLanguage, targetLanguage, requestId } = message;

      if (!text || text.trim().length === 0) {
        sendResponse({ success: false, error: '翻译文本不能为空' });
        return;
      }

      if (text.length > 5000) {
        sendResponse({ success: false, error: '文本长度超过5000字符限制' });
        return;
      }

      console.log(`开始流式翻译: ${sourceLanguage} -> ${targetLanguage}, 文本长度: ${text.length}`);

      // 检查浏览器支持
      if (!translationCore.isTranslatorAvailable()) {
        sendResponse({
          success: false,
          error: '当前浏览器版本不支持AI翻译功能，请升级到Chrome 138或更高版本',
        });
        return;
      }

      // 检查语言检测器可用性（如果需要自动检测）
      if (sourceLanguage === 'auto' && !translationCore.isLanguageDetectorAvailable()) {
        sendResponse({
          success: false,
          error: '语言检测功能不可用，请升级浏览器或手动选择源语言',
        });
        return;
      }

      // 处理自动语言检测
      let actualSourceLanguage = sourceLanguage;
      if (sourceLanguage === 'auto') {
        actualSourceLanguage = await this.detectLanguage(text);
        if (!actualSourceLanguage) {
          sendResponse({
            success: false,
            error: '语言检测失败，请手动选择源语言',
          });
          return;
        }
      }

      // 源语言与目标语言一致（忽略大小写）时，不执行流式翻译，直接返回原文
      const __norm = (s) => (s || '').toLowerCase().replace('_', '-').split('-')[0];
      if (__norm(actualSourceLanguage) === __norm(targetLanguage)) {
        sendResponse({
          success: true,
          streaming: false,
          result: text,
          sourceLanguage: actualSourceLanguage,
          targetLanguage: targetLanguage
        });
        return;
      }

      // 检查语言对可用性
      // 简单检查翻译器可用性
      if (!translationCore.isTranslatorAvailable()) {
        sendResponse({
          success: false,
          error: `翻译器不可用，请升级浏览器`,
        });
        return;
      }

      // 发送开始流式翻译的响应
      sendResponse({
        success: true,
        streaming: true,
        requestId: requestId,
      });

      // 执行流式翻译
      // 使用 translationCore 进行翻译（模拟流式效果）
      try {
        const result = await translationCore.smartTranslate(text, actualSourceLanguage, targetLanguage);
        
        // 模拟流式输出效果
        const chunks = result.result.split(' ');
        let fullResult = '';
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = (i === 0 ? '' : ' ') + chunks[i];
          fullResult += chunk;
          
          // 发送流式数据块到请求方
          if (sender.tab) {
            chrome.tabs
              .sendMessage(sender.tab.id, {
                type: 'STREAMING_CHUNK',
                requestId: requestId,
                chunk: chunk,
                fullResult: fullResult,
                isComplete: i === chunks.length - 1,
              })
              .catch((error) => {
                console.log('发送流式数据块失败:', error.message);
              });
          }
          
          // 添加小延迟模拟流式效果
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        // 发送完成信号
        if (sender.tab) {
          chrome.tabs
            .sendMessage(sender.tab.id, {
              type: 'STREAMING_COMPLETE',
              requestId: requestId,
              fullResult: fullResult,
              isComplete: true,
            })
            .catch((error) => {
              console.log('发送流式完成信号失败:', error.message);
            });
        }

        console.log('流式翻译完成:', fullResult.substring(0, 50) + (fullResult.length > 50 ? '...' : ''));
      } catch (streamError) {
        console.error('翻译失败:', streamError);

        if (sender.tab) {
          chrome.tabs
            .sendMessage(sender.tab.id, {
              type: 'STREAMING_ERROR',
              requestId: requestId,
              error: '翻译失败，请重试',
            })
            .catch((error) => {
              console.log('发送翻译错误信号失败:', error.message);
            });
        }
      }
    } catch (error) {
      console.error('流式翻译请求处理失败:', error);

      let errorMessage = '翻译失败，请重试';

      if (error.message.includes('not supported')) {
        errorMessage = '不支持的语言对';
      } else if (error.message.includes('model')) {
        errorMessage = '翻译模型不可用，请稍后再试';
      } else if (error.message.includes('network')) {
        errorMessage = '网络错误，请检查网络连接';
      }

      sendResponse({
        success: false,
        error: errorMessage,
      });
    }
  }
}

// 初始化后台服务
new BackgroundService();