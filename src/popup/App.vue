<template>
  <div class="app" :class="{ 'app-ready': isAppReady }">
    <!-- 加载状态 -->
    <div v-if="!isAppReady" class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载翻译扩展...</div>
    </div>
    
    <!-- 主应用内容 -->
    <div v-else class="extension-popup">
    <!-- 标签页导航 -->
    <div class="tab-navigation">
      <div 
        class="tab-item"
        :class="{ active: activeTab === 'translate' }"
        @click="switchTab('translate')"
      >
        翻译
      </div>
      <div 
        class="tab-item"
        :class="{ active: activeTab === 'history' }"
        @click="switchTab('history')"
      >
        历史
      </div>
    </div>

    <div class="extension-body">
      <!-- 翻译标签页内容 -->
      <div v-if="activeTab === 'translate'" class="tab-content">
        <!-- 语言选择器 -->
        <div class="section">
          <LanguageSelector 
            v-model:source="sourceLanguage"
            v-model:target="targetLanguage"
            @language-changed="onLanguageChanged"
          />
        </div>

        <!-- 翻译输入 -->
        <div class="section">
          <TranslationInput 
            v-model="inputText"
            :is-translating="isTranslating"
            @translate="handleTranslate"
            @clear="handleClear"
          />
        </div>

        <!-- 全文翻译功能 -->
        <div class="section">
          <div class="full-page-translation">
            <button 
              @click="toggleFullPageTranslation" 
              :disabled="isTranslating"
              class="full-translate-btn"
            >
              {{ isFullPageTranslating ? `取消全文翻译` : `全文翻译 (${getTargetLanguageName()})` }}
            </button>
            <div class="full-translate-hint">点击按钮翻译当前标签页的所有文本内容</div>
          </div>
        </div>

        <!-- 流式翻译指示器 -->
        <div v-if="isStreaming" class="section">
          <StreamingIndicator 
            :is-active="isStreaming"
            :progress="streamingProgress"
            :current-text="streamingText"
          />
        </div>

        <!-- 翻译结果 -->
        <div v-if="translationResult" class="section">
          <TranslationResult 
            :result="translationResult"
            :source-language="sourceLanguage"
            :target-language="targetLanguage"
            @copy="handleCopy"
            @save="handleSave"
          />
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="section">
          <div class="card error">
            {{ errorMessage }}
          </div>
        </div>
      </div>

      <!-- 历史标签页内容 -->
      <div v-if="activeTab === 'history'" class="tab-content">
        <TranslationHistory 
          :history="translationHistory"
          :show-clear-button="true"
          @select="handleHistorySelect"
          @clear="handleClearHistory"
          @show-detail="handleShowDetail"
        />
      </div>
    </div>

    <!-- 翻译详情弹窗 -->
    <TranslationDetail 
      :visible="showDetailDialog"
      :item="selectedDetailItem"
      @close="handleCloseDetail"
    />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import storageManager from '../shared/storage.js'
import translationCore from '../shared/translation-core.js'
import { SUPPORTED_LANGUAGES } from '../shared/constants.json'
import LanguageSelector from './components/LanguageSelector.vue'
import StreamingIndicator from './components/StreamingIndicator.vue'
import TranslationDetail from './components/TranslationDetail.vue'
import TranslationHistory from './components/TranslationHistory.vue'
import TranslationInput from './components/TranslationInput.vue'
import TranslationResult from './components/TranslationResult.vue'

// 响应式数据
const isAppReady = ref(false)
const activeTab = ref('translate')
const sourceLanguage = ref('en')
const targetLanguage = ref('zh')
const inputText = ref('')
const translationResult = ref('')
const streamingText = ref('')
const streamingProgress = ref(0)
const isTranslating = ref(false)
const isStreaming = ref(false)
const isFullPageTranslating = ref(false)
const errorMessage = ref('')
const translationHistory = ref([])

// 选中文本状态
const selectedText = ref('')
const hasSelectedText = ref(false)

// 浏览器API可用性检查
const isLanguageDetectorAvailable = ref(false)

// 翻译缓存
const translationCache = ref(new Map())

// 详情弹窗
const showDetailDialog = ref(false)
const selectedDetailItem = ref(null)

// 生成缓存键
const generateCacheKey = (text, sourceLang, targetLang) => {
  return `${text.trim()}|${sourceLang}|${targetLang}`
}

// 检查缓存
const cachedTranslation = computed(() => {
  if (!inputText.value || !sourceLanguage.value || !targetLanguage.value) {
    return null
  }
  
  const key = generateCacheKey(inputText.value, sourceLanguage.value, targetLanguage.value)
  return translationCache.value.get(key) || null
})

// 缓存翻译结果
const cacheTranslation = (text, sourceLang, targetLang, result) => {
  const key = generateCacheKey(text, sourceLang, targetLang)
  translationCache.value.set(key, result)
  console.log('翻译结果已缓存:', key)
}

// 初始化
onMounted(async () => {
  try {
    // 检查浏览器API可用性
    isLanguageDetectorAvailable.value = translationCore.isLanguageDetectorAvailable()
    
    // 检查翻译器可用性
    if (!translationCore.isTranslatorAvailable()) {
      errorMessage.value = '当前浏览器版本不支持AI翻译功能，请升级到Chrome 138或更高版本'
    }
    
    // 加载语言偏好
    const preferences = await storageManager.getLanguagePreferences()
    if (preferences) {
      sourceLanguage.value = preferences.sourceLanguage
      targetLanguage.value = preferences.targetLanguage
    }
    
    // 加载翻译历史
    const history = await storageManager.getTranslationHistory()
    translationHistory.value = history || []
    
    // 恢复标签页状态
    const settings = await storageManager.getSettings()
    if (settings && settings.activeTab) {
      activeTab.value = settings.activeTab
    }

    // 监听来自background的翻译状态变化消息
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'TRANSLATION_STATUS_CHANGED') {
          console.log('收到翻译状态变化通知:', message.isTranslated)
          isFullPageTranslating.value = message.isTranslated
        }
      })
    }

    // 检查当前页面的翻译状态
    await checkCurrentPageTranslationStatus()
    
    // 刷新页面后，确保右键菜单状态正确
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        chrome.runtime.sendMessage({
          type: 'UPDATE_CONTEXT_MENU',
          isTranslated: isFullPageTranslating.value
        }).catch(() => {
          // 忽略没有监听器的错误
        })
      } catch (error) {
        console.log('更新右键菜单状态失败:', error.message)
      }
    }
    
    // 检查是否有选中的文本需要翻译
    await checkSelectedText()
    
    // 标记应用就绪
    isAppReady.value = true
  } catch (error) {
    console.error('初始化失败:', error)
    // 即使初始化失败也要显示应用
    isAppReady.value = true
  }
})

// 语言变化处理
const onLanguageChanged = async (languages) => {
  sourceLanguage.value = languages.sourceLanguage
  targetLanguage.value = languages.targetLanguage
  
  // 保存语言偏好
  try {
    await storageManager.setLanguagePreferences(languages.sourceLanguage, languages.targetLanguage)
  } catch (error) {
    console.error('保存语言偏好失败:', error)
  }
}

// 翻译函数
const handleTranslate = async () => {
  if (!inputText.value.trim()) return

  isTranslating.value = true
  errorMessage.value = ''
  translationResult.value = ''
  streamingText.value = ''
  streamingProgress.value = 0

  try {
    // 检查源语言和目标语言是否相同（忽略大小写）
    if (translationCore.normalizeLanguage(sourceLanguage.value) === translationCore.normalizeLanguage(targetLanguage.value)) {
      // 相同语言直接返回原文
      translationResult.value = inputText.value
    } else {
      // 首先检查缓存
      const cached = cachedTranslation.value
      if (cached) {
        console.log('使用缓存的翻译结果')
        translationResult.value = cached
        // 缓存命中时不保存到历史记录，直接返回
        return
      } else {
        // 缓存未命中，进行实时翻译
        let actualSourceLanguage = sourceLanguage.value

        // 检查翻译器可用性
        if (!translationCore.isTranslatorAvailable()) {
          errorMessage.value = '翻译功能不可用，请升级到Chrome 138或更高版本'
          return
        }

        // 如果源语言为auto，需要检测语言
        if (sourceLanguage.value === 'auto') {
          if (!isLanguageDetectorAvailable.value) {
            errorMessage.value = '自动检测功能不可用，请手动选择源语言或升级浏览器'
            return
          }
          
          try {
            actualSourceLanguage = await translationCore.detectLanguage(inputText.value)
            if (!actualSourceLanguage) {
              errorMessage.value = '语言检测失败，请手动选择源语言'
              return
            }
            console.log('检测到语言:', actualSourceLanguage)
          } catch (error) {
            console.error('语言检测错误:', error)
            errorMessage.value = '语言检测失败，请手动选择源语言'
            return
          }
        }

        // 使用translationCore进行翻译
        const result = await translationCore.smartTranslate(
          inputText.value,
          actualSourceLanguage,
          targetLanguage.value
        )
        
        translationResult.value = result.result
        
        // 更新实际使用的源语言
        if (sourceLanguage.value === 'auto') {
          sourceLanguage.value = result.sourceLanguage
        }

        // 缓存翻译结果
        cacheTranslation(inputText.value, result.sourceLanguage, targetLanguage.value, result.result)
      }
    }

    // 添加到历史记录
    await addToHistory({
      sourceText: inputText.value,
      translatedText: translationResult.value,
      sourceLanguage: sourceLanguage.value,
      targetLanguage: targetLanguage.value
    })

  } catch (error) {
    console.error('翻译失败:', error)
    errorMessage.value = `翻译失败: ${error.message}`
  } finally {
    isTranslating.value = false
    isStreaming.value = false
  }
}

// 添加到历史记录
const addToHistory = async (item) => {
  const historyItem = {
    id: Date.now(),
    timestamp: new Date(),
    ...item
  }
  
  translationHistory.value.unshift(historyItem)
  
  // 限制历史记录数量
  if (translationHistory.value.length > 10) {
    translationHistory.value = translationHistory.value.slice(0, 10)
  }
  
  // 保存到存储
  try {
    await storageManager.addTranslationHistory(historyItem)
  } catch (error) {
    console.error('保存历史记录失败:', error)
  }
}

// 清除输入
const handleClear = () => {
  inputText.value = ''
  translationResult.value = ''
  errorMessage.value = ''
}

// 复制结果
const handleCopy = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// 保存翻译
const handleSave = (data) => {
  // 已在翻译时自动保存到历史记录
  console.log('翻译已保存:', data)
}

// 标签页切换
const switchTab = async (tab) => {
  activeTab.value = tab
  
  // 保存标签页状态
  try {
    const settings = await storageManager.getSettings()
    await storageManager.updateSettings({
      ...settings,
      activeTab: tab
    })
  } catch (error) {
    console.error('保存标签页状态失败:', error)
  }
}

// 选择历史记录 - 已禁用，不再跳转到翻译tab
const handleHistorySelect = () => {
  // 不再执行任何操作，历史记录项不可点击
}

// 清除历史记录
const handleClearHistory = async () => {
  try {
    await storageManager.clearHistory()
    translationHistory.value = []
  } catch (error) {
    console.error('清除历史记录失败:', error)
  }
}

// 显示详情弹窗
const handleShowDetail = (item) => {
  selectedDetailItem.value = item
  showDetailDialog.value = true
}

// 关闭详情弹窗
const handleCloseDetail = () => {
  showDetailDialog.value = false
  selectedDetailItem.value = null
}

// 切换全文翻译功能
const toggleFullPageTranslation = async () => {
  if (isFullPageTranslating.value) {
    // 取消全文翻译 - 发送消息到content script
    await sendMessageToContentScript('CANCEL_TRANSLATE_PAGE')
    isFullPageTranslating.value = false

    // 通知background service更新右键菜单状态
    try {
      chrome.runtime.sendMessage({
        type: 'UPDATE_CONTEXT_MENU',
        isTranslated: false
      }).catch(() => {
        // 忽略没有监听器的错误
      })
    } catch (error) {
      console.log('通知右键菜单状态失败:', error.message)
    }
  } else {
    // 开始全文翻译
    await handleFullPageTranslation()
  }
}

// 全文翻译功能
const handleFullPageTranslation = async () => {
  isFullPageTranslating.value = true
  errorMessage.value = ''
  
  try {
    console.log('开始全文翻译，语言对:', sourceLanguage.value, '->', targetLanguage.value)
    
    // 发送消息到content script执行全文翻译，使用新的翻译核心类
    const response = await sendMessageToContentScript('TRANSLATE_PAGE', {
      sourceLanguage: sourceLanguage.value,
      targetLanguage: targetLanguage.value,
      useTranslationCore: true
    })
    
    console.log('全文翻译响应:', response)
    
    if (response && response.success) {
      console.log(`全文翻译完成，共翻译了 ${response.translatedCount || 0} 个文本片段`)
      if (response.translatedCount === 0) {
        errorMessage.value = '没有找到可翻译的文本内容'
        isFullPageTranslating.value = false
      } else {
        // 通知background service更新右键菜单状态
        try {
          chrome.runtime.sendMessage({
            type: 'UPDATE_CONTEXT_MENU',
            isTranslated: true
          }).catch(() => {
            // 忽略没有监听器的错误
          })
        } catch (error) {
          console.log('通知右键菜单状态失败:', error.message)
        }
      }
    } else {
      errorMessage.value = response?.error || '无法在当前页面执行翻译，请刷新页面后重试'
      isFullPageTranslating.value = false
    }
    
  } catch (error) {
    console.error('全文翻译失败:', error)
    errorMessage.value = `全文翻译失败: ${error.message}`
    isFullPageTranslating.value = false
  }
}

// 发送消息到content script
const sendMessageToContentScript = async (messageType, additionalData = {}) => {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (!tab) {
      throw new Error('无法获取当前标签页信息')
    }
    
    console.log('发送消息到content script:', messageType, {
      sourceLanguage: sourceLanguage.value,
      targetLanguage: targetLanguage.value,
      ...additionalData
    })
    
    // 先检查content script是否已加载
    let contentScriptReady = false
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' })
      if (pingResponse && pingResponse.success) {
        contentScriptReady = true
      }
    } catch (error) {
      console.log('Content script未就绪，准备注入:', error.message)
    }
    
    if (!contentScriptReady) {
      // content script未加载，注入它
      console.log('注入content script...')
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js']
      })
      
      // 等待content script初始化
      let retries = 0
      const maxRetries = 10
      
      while (retries < maxRetries) {
        try {
          await new Promise(resolve => setTimeout(resolve, 200))
          const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' })
          if (pingResponse && pingResponse.success) {
            contentScriptReady = true
            console.log('Content script初始化完成')
            break
          }
        } catch (error) {
          retries++
          console.log(`等待content script初始化... (${retries}/${maxRetries})`)
        }
      }
      
      if (!contentScriptReady) {
        throw new Error('Content script初始化超时')
      }
    }
    
    // 发送消息到content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: messageType,
      sourceLanguage: sourceLanguage.value,
      targetLanguage: targetLanguage.value,
      ...additionalData
    })
    
    return response
  } catch (error) {
    console.error('发送消息到content script失败:', error)
    throw new Error('无法在当前页面执行操作，请刷新页面后重试')
  }
}

// 检查选中文本
const checkSelectedText = async () => {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (!tab) return
    
    console.log('检查选中文本...')
    
    // 先检查content script是否已加载
    let contentScriptReady = false
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' })
      if (pingResponse && pingResponse.success) {
        contentScriptReady = true
      }
    } catch (error) {
      console.log('Content script未就绪，跳过选中文本检查')
      return
    }
    
    if (contentScriptReady) {
      // 尝试获取选中的文本
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_SELECTED_TEXT'
      })
      
      console.log('选中文本响应:', response)
      
      if (response && response.success && response.text && response.text.trim().length > 0) {
        selectedText.value = response.text
        hasSelectedText.value = true
        inputText.value = response.text
        
        console.log('发现选中文本，自动翻译:', response.text)
        
        // 自动翻译选中的文本
        await handleTranslate()
      }
    }
  } catch (error) {
    console.log('获取选中文本失败:', error.message)
    // 这是正常情况，可能没有content script或没有选中文本
  }
}

// 检查当前页面的翻译状态
const checkCurrentPageTranslationStatus = async () => {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (!tab) return
    
    console.log('检查当前页面翻译状态...')
    
    // 先检查content script是否已加载
    let contentScriptReady = false
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' })
      if (pingResponse && pingResponse.success) {
        contentScriptReady = true
      }
    } catch (error) {
      console.log('Content script未就绪，跳过翻译状态检查')
      return
    }
    
    if (contentScriptReady) {
      // 查询当前翻译状态
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_TRANSLATION_STATUS'
      })
      
      console.log('当前页面翻译状态:', response)
      
      if (response && typeof response.isTranslated === 'boolean') {
        isFullPageTranslating.value = response.isTranslated
      }
    }
  } catch (error) {
    console.log('检查页面翻译状态失败:', error.message)
    // 这是正常情况，可能没有content script
  }
}

// 获取目标语言名称
const getTargetLanguageName = () => {
  const targetLang = SUPPORTED_LANGUAGES.find(lang => lang.code === targetLanguage.value)
  return targetLang ? targetLang.name : targetLanguage.value
}
</script>

<style scoped>
.app {
  width: 420px;
  background: var(--bg-color);
  min-height: 500px;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 500px;
  flex-direction: column;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e4e7ed;
  border-top: 3px solid #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  margin-top: 16px;
  color: #606266;
  font-size: 14px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.extension-popup {
  width: 100%;
  background: var(--bg-color);
}

.tab-navigation {
  display: flex;
  background: var(--bg-page);
  border-bottom: 1px solid var(--border-lighter);
}

.tab-item {
  flex: 1;
  padding: 12px 16px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-regular);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.tab-item:hover {
  color: var(--primary-color);
  background: rgba(64, 158, 255, 0.05);
}

.tab-item.active {
  color: var(--primary-color);
  background: var(--bg-color);
  border-bottom-color: var(--primary-color);
}

.extension-body {
  padding: 16px;
}

.tab-content {
  opacity: 1;
}

.section {
  margin-bottom: 16px;
}

.section:last-child {
  margin-bottom: 0;
}

.card.error {
  background: var(--error-color);
  color: white;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
}

.full-page-translation {
  text-align: center;
}

.full-translate-btn {
  width: 100%;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.full-translate-btn:hover:not(:disabled) {
  background: #337ecc;
  color: white;
}

.full-translate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.full-translate-hint {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}
</style>