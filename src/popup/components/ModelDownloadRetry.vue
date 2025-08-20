<template>
  <div class="model-download-retry">
    <div class="retry-header">
      <div class="retry-icon">
        <svg v-if="!isDownloading" viewBox="0 0 24 24" width="32" height="32">
          <path fill="#e6a23c" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <div v-else class="loading-spinner"></div>
      </div>
      <h3>{{ title }}</h3>
    </div>
    
    <div class="retry-content">
      <p class="retry-message">{{ message }}</p>
      
      <!-- 下载进度 -->
      <div v-if="isDownloading && progress !== null" class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
        <span class="progress-text">{{ Math.round(progress) }}%</span>
      </div>
      
      <!-- 重试信息 -->
      <div v-if="retryInfo.currentRetry > 0" class="retry-info">
        <p>重试次数: {{ retryInfo.currentRetry }} / {{ retryInfo.maxRetries }}</p>
      </div>
      
      <!-- 错误详情 -->
      <div v-if="error" class="error-details">
        <details>
          <summary>错误详情</summary>
          <p class="error-message">{{ error.userMessage }}</p>
          <p class="error-suggestion">{{ error.suggestion }}</p>
        </details>
      </div>
    </div>  
  
    <div class="retry-actions">
      <button 
        v-if="!isDownloading && retryInfo.canRetry"
        class="btn btn--primary"
        @click="handleRetry"
        :disabled="isDownloading"
      >
        {{ retryInfo.currentRetry > 0 ? '重新尝试' : '开始下载' }}
      </button>
      
      <button 
        v-if="isDownloading"
        class="btn btn--secondary"
        @click="handleCancel"
      >
        取消下载
      </button>
      
      <button 
        v-if="!retryInfo.canRetry"
        class="btn btn--secondary"
        @click="$emit('close')"
      >
        关闭
      </button>
      
      <button 
        class="btn btn--text"
        @click="$emit('showAlternatives')"
      >
        查看其他语言
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ErrorHandler from '../../shared/error-handler.js'

const props = defineProps({
  sourceLanguage: {
    type: String,
    required: true
  },
  targetLanguage: {
    type: String,
    required: true
  },
  error: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'retry', 'cancel', 'showAlternatives', 'success'])

// 响应式数据
const isDownloading = ref(false)
const progress = ref(null)
const retryManager = ref(null)

// 计算属性
const title = computed(() => {
  if (isDownloading.value) {
    return '正在下载翻译模型...'
  }
  if (props.error) {
    return '模型下载失败'
  }
  return '需要下载翻译模型'
})

const message = computed(() => {
  if (isDownloading.value) {
    return `正在为 ${ErrorHandler.getLanguageName(props.sourceLanguage)} → ${ErrorHandler.getLanguageName(props.targetLanguage)} 下载翻译模型，请稍候...`
  }
  if (props.error) {
    return props.error.userMessage || '下载过程中出现问题'
  }
  return `${ErrorHandler.getLanguageName(props.sourceLanguage)} → ${ErrorHandler.getLanguageName(props.targetLanguage)} 的翻译模型需要下载到本地才能使用。`
})

const retryInfo = computed(() => {
  return retryManager.value?.getRetryInfo() || {
    currentRetry: 0,
    maxRetries: 3,
    isRetrying: false,
    canRetry: true
  }
})

// 初始化重试管理器
onMounted(() => {
  retryManager.value = ErrorHandler.createModelDownloadRetryManager(
    props.sourceLanguage,
    props.targetLanguage,
    3
  )
})

// 处理重试
const handleRetry = async () => {
  if (!retryManager.value) return
  
  isDownloading.value = true
  progress.value = 0
  
  try {
    const result = await retryManager.value.attemptDownload(
      // 下载函数
      async (onProgress) => {
        // 这里应该调用实际的 Translator.create 方法
        // 模拟下载过程
        return new Promise((resolve, reject) => {
          let currentProgress = 0
          const interval = setInterval(() => {
            currentProgress += Math.random() * 10
            if (currentProgress >= 100) {
              currentProgress = 100
              clearInterval(interval)
              resolve({ success: true })
            }
            progress.value = currentProgress
            if (onProgress) onProgress(currentProgress)
          }, 200)
        })
      },
      // 进度回调
      (progressValue) => {
        progress.value = progressValue
      },
      // 重试回调
      (retryCount, maxRetries) => {
        console.log(`重试 ${retryCount}/${maxRetries}`)
      }
    )
    
    if (result.success) {
      emit('success', result.result)
    } else {
      // 处理失败情况
      console.error('下载失败:', result.error)
    }
    
  } catch (error) {
    console.error('下载过程出错:', error)
  } finally {
    isDownloading.value = false
  }
}

// 处理取消
const handleCancel = () => {
  isDownloading.value = false
  progress.value = null
  emit('cancel')
}

// 清理
onUnmounted(() => {
  if (retryManager.value) {
    retryManager.value.reset()
  }
})
</script>

<style scoped>
.model-download-retry {
  padding: 24px;
  background: var(--bg-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  width: 400px;
  margin: 0 auto;
}

.retry-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}

.retry-icon {
  margin-bottom: 12px;
}

.retry-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  text-align: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-lighter);
  border-top: 3px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-content {
  margin-bottom: 24px;
}

.retry-message {
  font-size: 14px;
  color: var(--text-regular);
  line-height: 1.5;
  text-align: center;
  margin: 0 0 16px 0;
}

.progress-section {
  margin-bottom: 16px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--border-lighter);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  display: block;
}

.retry-info {
  padding: 12px;
  background: var(--bg-page);
  border-radius: 6px;
  margin-bottom: 16px;
}

.retry-info p {
  margin: 0;
  font-size: 13px;
  color: var(--text-regular);
  text-align: center;
}

.error-details {
  margin-bottom: 16px;
}

.error-details details {
  background: var(--bg-page);
  border-radius: 6px;
  padding: 12px;
}

.error-details summary {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  margin-bottom: 8px;
}

.error-message {
  font-size: 13px;
  color: var(--error-color);
  margin: 0 0 8px 0;
}

.error-suggestion {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

.retry-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn {
  padding: 10px 16px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--primary-color);
  color: white;
}

.btn--primary:hover:not(:disabled) {
  background: var(--primary-dark);
}

.btn--secondary {
  background: transparent;
  color: var(--text-regular);
  border: 1px solid var(--border-base);
}

.btn--secondary:hover {
  background: var(--bg-page);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.btn--text {
  background: transparent;
  color: var(--text-secondary);
  border: none;
  font-size: 13px;
}

.btn--text:hover {
  color: var(--primary-color);
}
</style>