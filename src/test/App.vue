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
          <!-- 自动检测不可用提示 -->
          <div v-if="!isLanguageDetectorAvailable" class="auto-detect-warning">
            自动检测功能不可用，请升级浏览器到Chrome 138或更高版本
          </div>
          
          <LanguageSelector 
            v-model:source="sourceLanguage"
            v-model:target="targetLanguage"
            @language-changed="onLanguageChanged"
          />
          <div class="row" style="margin-top: 8px;">
            <label style="font-size: 12px; color: var(--text-secondary); user-select: none;">
              <input 
                type="checkbox" 
                v-model="autoDetectSource" 
                :disabled="!isLanguageDetectorAvailable"
                style="vertical-align: middle; margin-right: 6px;" 
              />
              自动检测源语言（LanguageDetector）
            </label>
          </div>
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
            <div class="full-translate-hint">点击按钮翻译当前页面的所有文本内容</div>
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
import LanguageSelector from '../popup/components/LanguageSelector.vue'
import StreamingIndicator from '../popup/components/StreamingIndicator.vue'
import TranslationDetail from '../popup/components/TranslationDetail.vue'
import TranslationHistory from '../popup/components/TranslationHistory.vue'
import TranslationInput from '../popup/components/TranslationInput.vue'
import TranslationResult from '../popup/components/TranslationResult.vue'
import storageManager from '../shared/storage.js'
import translationCore from '../shared/translation-core.js'

// 响应式数据
const isAppReady = ref(false)
const activeTab = ref('translate')
const sourceLanguage = ref('en')
const targetLanguage = ref('zh')
const autoDetectSource = ref(true)
const inputText = ref('')
const translationResult = ref('')
const streamingText = ref('')
const streamingProgress = ref(0)
const isTranslating = ref(false)
const isStreaming = ref(false)
const isFullPageTranslating = ref(false)
const errorMessage = ref('')
const translationHistory = ref([])

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
    
    // 如果语言检测不可用，禁用自动检测
    if (!isLanguageDetectorAvailable.value) {
      autoDetectSource.value = false
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

    // 检查页面是否已有翻译标记
    const existingTranslations = document.querySelectorAll('.translation-append')
    if (existingTranslations.length > 0) {
      isFullPageTranslating.value = true
      console.log('检测到页面已有翻译标记，设置为已翻译状态')
    } else {
      // 刷新页面后，确保全文翻译状态为未翻译
      isFullPageTranslating.value = false
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

        // 如果启用自动检测且源语言为auto
        if (autoDetectSource.value && sourceLanguage.value === 'auto') {
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
    // 简单的成功提示
    console.log('复制成功')
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
    // 取消全文翻译 - 移除所有翻译标记
    removeAllTranslations()
    isFullPageTranslating.value = false
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
    
    // 获取可视区域内的文本节点
    const visibleTextNodes = getVisibleTextNodes()
    
    if (visibleTextNodes.length === 0) {
      errorMessage.value = '可视区域内没有找到可翻译的文本内容'
      isFullPageTranslating.value = false
      return
    }
    
    console.log(`找到 ${visibleTextNodes.length} 个可视区域内的文本节点`)
    
    // 提取文本内容
    const texts = visibleTextNodes.map(node => node.textContent.trim()).filter(text => text.length > 0 && text.length <= 500)
    
    if (texts.length === 0) {
      errorMessage.value = '没有找到符合翻译条件的文本内容'
      isFullPageTranslating.value = false
      return
    }
    
    let translatedCount = 0
    
    // 逐个翻译文本片段，提供更好的错误处理
    let resultIndex = 0
    for (let i = 0; i < visibleTextNodes.length; i++) {
      const node = visibleTextNodes[i]
      const originalText = node.textContent.trim()
      
      if (originalText.length > 0 && originalText.length <= 500) {
        try {
          // 检查是否需要语言检测
          let actualSourceLanguage = sourceLanguage.value
          if (sourceLanguage.value === 'auto') {
            if (!isLanguageDetectorAvailable.value) {
              // 语言检测不可用，跳过翻译并显示失败提示
              appendTranslationToNode(node, '', true)
              continue
            }
            
            actualSourceLanguage = await translationCore.detectLanguage(originalText)
            if (!actualSourceLanguage) {
              // 语言检测失败，显示失败提示
              appendTranslationToNode(node, '', true)
              continue
            }
          }
          
          // 执行翻译
          const result = await translationCore.smartTranslate(
            originalText,
            actualSourceLanguage,
            targetLanguage.value
          )
          
          if (result && result.result !== result.original) {
            appendTranslationToNode(node, result.result)
            translatedCount++
          }
        } catch (error) {
          console.error(`翻译文本片段失败: "${originalText.substring(0, 30)}..."`, error)
          // 翻译失败，显示失败提示
          appendTranslationToNode(node, '', true)
        }
        
        // 添加延迟避免请求过于频繁
        if (i < visibleTextNodes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
    }
    
    console.log(`可视区域翻译完成，共翻译了 ${translatedCount} 个文本片段`)
    
    if (translatedCount === 0) {
      errorMessage.value = '没有成功翻译任何文本，请检查网络连接或稍后重试'
      isFullPageTranslating.value = false
    } else {
      // 设置滚动监听器，当新内容进入可视区域时自动翻译
      setupScrollTranslation()
      
      // 通知background service更新右键菜单状态
      if (typeof chrome !== 'undefined' && chrome.runtime) {
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
    }
    
  } catch (error) {
    console.error('全文翻译失败:', error)
    errorMessage.value = `全文翻译失败: ${error.message}`
    isFullPageTranslating.value = false
  }
}

// 移除所有翻译标记
const removeAllTranslations = () => {
  const translationElements = document.querySelectorAll('.translation-append')
  translationElements.forEach(element => {
    element.remove()
  })

  // 移除滚动翻译监听器
  if (scrollTranslationHandler) {
    window.removeEventListener('scroll', scrollTranslationHandler)
    clearTimeout(scrollTranslationTimeout)
    scrollTranslationHandler = null
    console.log('已移除滚动翻译监听器')
  }

  // 通知background service更新右键菜单状态
  if (typeof chrome !== 'undefined' && chrome.runtime) {
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
  }
}

// 获取目标语言名称
const getTargetLanguageName = () => {
  const languages = [
    { code: 'en', name: '英语' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日语' },
    { code: 'ko', name: '韩语' },
    { code: 'fr', name: '法语' },
    { code: 'de', name: '德语' },
    { code: 'es', name: '西班牙语' },
    { code: 'it', name: '意大利语' },
    { code: 'pt', name: '葡萄牙语' },
    { code: 'ru', name: '俄语' }
  ]
  const targetLang = languages.find(lang => lang.code === targetLanguage.value)
  return targetLang ? targetLang.name : targetLanguage.value
}

// 获取页面文本节点
const getPageTextNodes = () => {
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

// 获取可视区域内的文本节点
const getVisibleTextNodes = () => {
  const allTextNodes = getPageTextNodes()
  const visibleNodes = []
  
  for (const node of allTextNodes) {
    if (isElementInViewport(node.parentElement)) {
      visibleNodes.push(node)
    }
  }
  
  console.log(`在 ${allTextNodes.length} 个文本节点中，找到 ${visibleNodes.length} 个可视区域内的节点`)
  return visibleNodes
}

// 检查元素是否在可视区域内
const isElementInViewport = (element) => {
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

// 滚动翻译相关变量
let scrollTranslationHandler = null
let scrollTranslationTimeout = null

// 设置滚动翻译监听器
const setupScrollTranslation = () => {
  // 移除现有的滚动监听器
  if (scrollTranslationHandler) {
    window.removeEventListener('scroll', scrollTranslationHandler)
    clearTimeout(scrollTranslationTimeout)
  }
  
  // 防抖处理的滚动翻译
  scrollTranslationHandler = () => {
    clearTimeout(scrollTranslationTimeout)
    scrollTranslationTimeout = setTimeout(() => {
      translateNewlyVisibleContent()
    }, 500) // 滚动停止500ms后执行翻译
  }
  
  window.addEventListener('scroll', scrollTranslationHandler, { passive: true })
  console.log('已设置滚动翻译监听器')
}

// 翻译新进入可视区域的内容
const translateNewlyVisibleContent = async () => {
  if (!isFullPageTranslating.value) return
  
  console.log('检查新进入可视区域的内容...')
  
  // 获取当前可视区域内未翻译的文本节点
  const allTextNodes = getPageTextNodes()
  const newlyVisibleNodes = []
  
  for (const node of allTextNodes) {
    const parent = node.parentElement
    if (parent && isElementInViewport(parent) && !parent.querySelector('.translation-append')) {
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
    // 逐个翻译新内容，提供更好的错误处理
    let translatedCount = 0
    
    for (let i = 0; i < newlyVisibleNodes.length; i++) {
      const node = newlyVisibleNodes[i]
      const originalText = node.textContent.trim()
      
      if (originalText.length > 0 && originalText.length <= 500) {
        try {
          // 检查是否需要语言检测
          let actualSourceLanguage = sourceLanguage.value
          if (sourceLanguage.value === 'auto') {
            if (!isLanguageDetectorAvailable.value) {
              // 语言检测不可用，跳过翻译并显示失败提示
              appendTranslationToNode(node, '', true)
              continue
            }
            
            actualSourceLanguage = await translationCore.detectLanguage(originalText)
            if (!actualSourceLanguage) {
              // 语言检测失败，显示失败提示
              appendTranslationToNode(node, '', true)
              continue
            }
          }
          
          // 执行翻译
          const result = await translationCore.smartTranslate(
            originalText,
            actualSourceLanguage,
            targetLanguage.value
          )
          
          if (result && result.result !== result.original) {
            appendTranslationToNode(node, result.result)
            translatedCount++
          }
        } catch (error) {
          console.error(`翻译新内容片段失败: "${originalText.substring(0, 30)}..."`, error)
          // 翻译失败，显示失败提示
          appendTranslationToNode(node, '', true)
        }
        
        // 添加延迟避免请求过于频繁
        if (i < newlyVisibleNodes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
    }
    
    if (translatedCount > 0) {
      console.log(`新内容翻译完成，共翻译了 ${translatedCount} 个文本片段`)
    }
  } catch (error) {
    console.error('翻译新内容失败:', error)
  }
}

// 在文本节点右侧添加译文或失败提示
const appendTranslationToNode = (textNode, translatedText, isFailed = false) => {
  const parent = textNode.parentElement
  if (!parent) return
  
  // 创建翻译元素
  const translationElement = document.createElement('span')
  
  if (isFailed) {
    translationElement.className = 'translation-append translation-failed'
    translationElement.textContent = ' [翻译失败]'
    translationElement.style.color = '#ff4757'
    translationElement.style.fontSize = '12px'
  } else {
    translationElement.className = 'translation-append translated-text'
    translationElement.textContent = ` [${translatedText}]`
  }
  
  // 在文本节点后插入翻译
  if (textNode.nextSibling) {
    parent.insertBefore(translationElement, textNode.nextSibling)
  } else {
    parent.appendChild(translationElement)
  }
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

.auto-detect-warning {
  font-size: 12px;
  color: #ff4757;
  background: rgba(255, 71, 87, 0.1);
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  border-left: 3px solid #ff4757;
}
</style>