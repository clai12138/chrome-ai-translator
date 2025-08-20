<template>
  <div 
    v-if="visible" 
    class="overlay-popup"
    :class="{ 'overlay-popup--visible': isVisible }"
    :style="overlayStyle"
    @click.stop
  >
    <div class="overlay-popup__content">
      <!-- 头部区域 -->
      <div class="overlay-popup__header">
        <div class="overlay-popup__title">
          <span class="overlay-popup__icon">🌐</span>
          AI 翻译
        </div>
        <button 
          class="overlay-popup__close" 
          @click="handleClose"
          title="关闭"
        >
          ×
        </button>
      </div>

      <!-- 主体区域 -->
      <div class="overlay-popup__body">
        <!-- 原文显示 -->
        <div class="overlay-popup__source">
          <div class="overlay-popup__label">原文:</div>
          <div class="overlay-popup__text">
            {{ displayText }}
          </div>
        </div>

        <!-- 翻译结果显示 -->
        <div class="overlay-popup__result">
          <div class="overlay-popup__label">译文:</div>
          <div class="overlay-popup__translation">
            <!-- 加载状态 -->
            <div v-if="isTranslating" class="overlay-popup__loading">
              <div class="loading loading--small"></div>
              <span class="loading-text">{{ translationStatus }}</span>
            </div>
            
            <!-- 流式翻译实时结果 -->
            <div v-else-if="isStreaming && partialResult" class="overlay-popup__streaming">
              <div class="streaming-content">
                {{ partialResult }}
              </div>
              <div class="streaming-indicator">
                <div class="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
            
            <!-- 翻译结果 -->
            <div v-else-if="translatedText" class="overlay-popup__result-text">
              {{ translatedText }}
            </div>
            
            <!-- 错误信息 -->
            <div v-else-if="errorMessage" class="overlay-popup__error">
              {{ errorMessage }}
            </div>
            
            <!-- 默认状态 -->
            <div v-else class="overlay-popup__placeholder">
              点击翻译按钮开始翻译
            </div>
          </div>
        </div>

        <!-- 操作按钮区域 -->
        <div class="overlay-popup__actions">
          <button 
            class="btn btn--primary btn--small"
            @click="handleTranslate"
            :disabled="isTranslating || !sourceText"
          >
            {{ translateButtonText }}
          </button>
          <button 
            class="btn btn--small"
            @click="handleCopy"
            :disabled="!translatedText || isTranslating"
            :title="copyButtonTitle"
          >
            {{ copyButtonText }}
          </button>
        </div>

        <!-- 语言信息 -->
        <div v-if="showLanguageInfo" class="overlay-popup__language-info">
          <div class="language-pair">
            <span class="source-lang">{{ getLanguageName(sourceLanguage) }}</span>
            <svg class="arrow-icon" viewBox="0 0 24 24" width="12" height="12">
              <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
            <span class="target-lang">{{ getLanguageName(targetLanguage) }}</span>
          </div>
          <div v-if="translationMethod" class="method-info">
            <span class="method-tag tag tag--small" :class="methodTagClass">
              {{ translationMethodText }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 复制成功提示 -->
    <div v-if="showCopySuccess" class="copy-success-toast">
      <svg class="success-icon" viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
      <span>已复制</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { SUPPORTED_LANGUAGES, TRANSLATION_STATUS } from '../../shared/constants.json'

// Props
const props = defineProps({
  // 显示控制
  visible: {
    type: Boolean,
    default: false
  },
  
  // 位置信息
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0, width: 0, height: 0 })
  },
  
  // 文本内容
  sourceText: {
    type: String,
    default: ''
  },
  
  translatedText: {
    type: String,
    default: ''
  },
  
  // 语言设置
  sourceLanguage: {
    type: String,
    default: 'auto'
  },
  
  targetLanguage: {
    type: String,
    default: 'zh'
  },
  
  // 翻译状态
  isTranslating: {
    type: Boolean,
    default: false
  },
  
  translationStatus: {
    type: String,
    default: '正在翻译...'
  },
  
  // 流式翻译
  isStreaming: {
    type: Boolean,
    default: false
  },
  
  partialResult: {
    type: String,
    default: ''
  },
  
  translationMethod: {
    type: String,
    default: '' // 'streaming' | 'regular'
  },
  
  // 错误信息
  errorMessage: {
    type: String,
    default: ''
  },
  
  // 显示选项
  showLanguageInfo: {
    type: Boolean,
    default: true
  },
  
  // 自动隐藏
  autoHide: {
    type: Boolean,
    default: true
  },
  
  autoHideDelay: {
    type: Number,
    default: 5000
  }
})

// Emits
const emit = defineEmits([
  'close',
  'translate',
  'copy',
  'position-update'
])

// 响应式数据
const isVisible = ref(false)
const showCopySuccess = ref(false)
const autoHideTimer = ref(null)

// 计算属性
const displayText = computed(() => {
  const maxLength = 100
  if (props.sourceText.length > maxLength) {
    return props.sourceText.substring(0, maxLength) + '...'
  }
  return props.sourceText
})

const translateButtonText = computed(() => {
  if (props.isTranslating) {
    return '翻译中...'
  }
  return '翻译'
})

const copyButtonText = computed(() => {
  return showCopySuccess.value ? '已复制' : '复制'
})

const copyButtonTitle = computed(() => {
  if (!props.translatedText) {
    return '暂无翻译结果'
  }
  return showCopySuccess.value ? '翻译结果已复制到剪贴板' : '复制翻译结果到剪贴板'
})

const translationMethodText = computed(() => {
  switch (props.translationMethod) {
    case 'streaming':
      return '流式翻译'
    case 'regular':
      return '普通翻译'
    default:
      return ''
  }
})

const methodTagClass = computed(() => {
  switch (props.translationMethod) {
    case 'streaming':
      return 'tag--primary'
    case 'regular':
      return 'tag--success'
    default:
      return ''
  }
})

const overlayStyle = computed(() => {
  const { x, y, width, height } = props.position
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft
  const scrollY = window.pageYOffset || document.documentElement.scrollTop
  
  // 覆盖层的预估尺寸
  const overlayWidth = 320
  const overlayHeight = 250
  const margin = 10
  
  let left = x - overlayWidth / 2
  let top = y - overlayHeight - margin
  
  // 水平位置调整
  if (left < margin) {
    left = margin
  } else if (left + overlayWidth > viewportWidth - margin) {
    left = viewportWidth - overlayWidth - margin
  }
  
  // 垂直位置调整
  if (top < scrollY + margin) {
    // 如果上方空间不够，显示在选择区域下方
    top = y + height + margin
  }
  
  // 确保不超出视口底部
  if (top + overlayHeight > scrollY + viewportHeight - margin) {
    top = scrollY + viewportHeight - overlayHeight - margin
  }
  
  return {
    left: `${left + scrollX}px`,
    top: `${top}px`,
    zIndex: 2147483647
  }
})

// 方法
const getLanguageName = (languageCode) => {
  return SUPPORTED_LANGUAGES[languageCode] || languageCode
}

const handleClose = () => {
  hide()
  emit('close')
}

const handleTranslate = () => {
  if (!props.sourceText || props.isTranslating) {
    return
  }
  
  emit('translate', {
    text: props.sourceText,
    sourceLanguage: props.sourceLanguage,
    targetLanguage: props.targetLanguage
  })
}

const handleCopy = async () => {
  if (!props.translatedText || props.isTranslating) {
    return
  }
  
  try {
    await navigator.clipboard.writeText(props.translatedText)
    
    showCopySuccess.value = true
    
    emit('copy', {
      originalText: props.sourceText,
      translatedText: props.translatedText,
      sourceLanguage: props.sourceLanguage,
      targetLanguage: props.targetLanguage
    })
    
    // 自动隐藏成功提示
    setTimeout(() => {
      showCopySuccess.value = false
    }, 2000)
    
  } catch (error) {
    console.error('复制失败:', error)
    // 可以发出错误事件
    emit('error', '复制失败，请手动选择文本复制')
  }
}

const show = () => {
  isVisible.value = true
  
  // 设置自动隐藏
  if (props.autoHide && props.autoHideDelay > 0) {
    clearTimeout(autoHideTimer.value)
    autoHideTimer.value = setTimeout(() => {
      hide()
    }, props.autoHideDelay)
  }
}

const hide = () => {
  isVisible.value = false
  clearTimeout(autoHideTimer.value)
}

const resetAutoHideTimer = () => {
  if (props.autoHide && props.autoHideDelay > 0 && isVisible.value) {
    clearTimeout(autoHideTimer.value)
    autoHideTimer.value = setTimeout(() => {
      hide()
    }, props.autoHideDelay)
  }
}

// 监听器
watch(() => props.visible, (newValue) => {
  if (newValue) {
    nextTick(() => {
      show()
    })
  } else {
    hide()
  }
}, { immediate: true })

// 监听翻译状态变化，重置自动隐藏计时器
watch([() => props.isTranslating, () => props.translatedText], () => {
  resetAutoHideTimer()
})

// 生命周期
onMounted(() => {
  // 监听文档点击事件，点击外部时隐藏覆盖层
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('scroll', handleDocumentScroll)
  window.addEventListener('resize', handleWindowResize)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('scroll', handleDocumentScroll)
  window.removeEventListener('resize', handleWindowResize)
  clearTimeout(autoHideTimer.value)
})

// 事件处理器
const handleDocumentClick = (event) => {
  // 如果点击的不是覆盖层内部，则隐藏覆盖层
  if (isVisible.value && !event.target.closest('.overlay-popup')) {
    handleClose()
  }
}

const handleDocumentScroll = () => {
  if (isVisible.value) {
    handleClose()
  }
}

const handleWindowResize = () => {
  if (isVisible.value) {
    // 发出位置更新事件，让父组件重新计算位置
    emit('position-update')
  }
}

// 暴露方法给父组件
defineExpose({
  show,
  hide,
  isVisible: () => isVisible.value
})
</script>

<style scoped>
.overlay-popup {
  position: fixed;
  background: #ffffff;
  border: 1px solid var(--border-base);
  border-radius: var(--border-radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: var(--font-size-base);
  line-height: 1.4;
  width: 300px;
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  pointer-events: auto;
}

.overlay-popup--visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.overlay-popup__content {
  padding: 0;
  border-radius: var(--border-radius-lg);
  overflow: hidden;
}

/* ========== 头部样式 ========== */
.overlay-popup__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 1px solid var(--border-lighter);
}

.overlay-popup__title {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--font-size-base);
}

.overlay-popup__icon {
  margin-right: var(--spacing-xs);
  font-size: var(--font-size-medium);
}

.overlay-popup__close {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-small);
  transition: all 0.2s;
}

.overlay-popup__close:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary);
}

/* ========== 主体样式 ========== */
.overlay-popup__body {
  padding: var(--spacing-lg);
}

.overlay-popup__source,
.overlay-popup__result {
  margin-bottom: var(--spacing-md);
}

.overlay-popup__result:last-of-type {
  margin-bottom: var(--spacing-lg);
}

.overlay-popup__label {
  font-size: var(--font-size-small);
  color: var(--text-regular);
  margin-bottom: var(--spacing-xs);
  font-weight: 600;
}

.overlay-popup__text {
  color: var(--text-primary);
  line-height: 1.5;
  word-break: break-word;
  background: var(--bg-page);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-base);
  font-size: var(--font-size-small);
  border: 1px solid var(--border-lighter);
}

.overlay-popup__translation {
  height: 40px;
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-base);
  border-radius: var(--border-radius-base);
  background: #ffffff;
  position: relative;
}

/* ========== 加载状态样式 ========== */
.overlay-popup__loading {
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  width: 100%;
}

.loading-text {
  margin-left: var(--spacing-sm);
  font-style: italic;
}

/* ========== 流式翻译样式 ========== */
.overlay-popup__streaming {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
}

.streaming-content {
  flex: 1;
  color: #d650dc;
  line-height: 1.5;
  word-break: break-word;
}

.streaming-indicator {
  margin-left: var(--spacing-sm);
  display: flex;
  align-items: center;
}

.typing-dots {
  display: flex;
  gap: 2px;
}

.typing-dots span {
  width: 4px;
  height: 4px;
  background-color: var(--primary-color);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* ========== 结果和错误样式 ========== */
.overlay-popup__result-text {
  color: #d650dc;
  line-height: 1.5;
  word-break: break-word;
  width: 100%;
}

.overlay-popup__error {
  color: var(--error-color);
  font-size: var(--font-size-small);
  width: 100%;
}

.overlay-popup__placeholder {
  color: var(--text-placeholder);
  font-style: italic;
  font-size: var(--font-size-small);
  width: 100%;
}

/* ========== 操作按钮样式 ========== */
.overlay-popup__actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.btn--small {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-small);
  height: 32px;
  flex: 1;
}

/* ========== 语言信息样式 ========== */
.overlay-popup__language-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-lighter);
  font-size: var(--font-size-small);
}

.language-pair {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.source-lang {
  color: var(--text-regular);
  font-weight: 500;
}

.arrow-icon {
  color: var(--text-placeholder);
}

.target-lang {
  color: var(--primary-color);
  font-weight: 600;
}

.method-info {
  display: flex;
  align-items: center;
}

.method-tag {
  font-size: var(--font-size-extra-small);
  padding: 2px var(--spacing-xs);
}

/* ========== 复制成功提示 ========== */
.copy-success-toast {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--success-color);
  color: white;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-base);
  font-size: var(--font-size-small);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: slideDown 0.3s ease-out;
}

.success-icon {
  width: 16px;
  height: 16px;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* ========== 响应式设计 ========== */
@media (max-width: 480px) {
  .overlay-popup {
    width: 260px;
  }
  
  .overlay-popup__header {
    padding: var(--spacing-sm) var(--spacing-md);
  }
  
  .overlay-popup__body {
    padding: var(--spacing-md);
  }
  
  .overlay-popup__language-info {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }
}

/* ========== 深色模式支持 ========== */
@media (prefers-color-scheme: dark) {
  .overlay-popup {
    background: var(--bg-color);
    border-color: var(--border-base);
  }
  
  .overlay-popup__header {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
    border-bottom-color: var(--border-lighter);
  }
  
  .overlay-popup__text {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--border-lighter);
  }
  
  .overlay-popup__translation {
    background: rgba(255, 255, 255, 0.02);
  }
  
  .overlay-popup__close:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

/* ========== 动画效果 ========== */
.overlay-popup {
  animation: popupEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes popupEnter {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ========== 高对比度模式支持 ========== */
@media (prefers-contrast: high) {
  .overlay-popup {
    border-width: 2px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .overlay-popup__close:hover {
    background: rgba(0, 0, 0, 0.1);
  }
}

/* ========== 减少动画模式支持 ========== */
@media (prefers-reduced-motion: reduce) {
  .overlay-popup {
    transition: opacity 0.2s;
    animation: none;
  }
  
  .overlay-popup--visible {
    transform: none;
  }
  
  .typing-dots span {
    animation: none;
  }
  
  .copy-success-toast {
    animation: none;
  }
}
</style>