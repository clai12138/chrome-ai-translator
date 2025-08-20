<template>
  <div class="model-manager">
    <div class="model-manager__header">
      <h3 class="model-manager__title">模型管理</h3>
      <button 
        class="btn btn--small btn--secondary"
        @click="refreshAllModels"
        :disabled="isRefreshing"
      >
        <span v-if="isRefreshing">刷新中...</span>
        <span v-else>刷新状态</span>
      </button>
    </div>

    <!-- 模型列表 -->
    <div class="model-list">
      <div 
        v-for="model in modelList" 
        :key="model.languagePair"
        class="model-item"
        :class="{
          'model-item--available': model.available,
          'model-item--downloading': model.downloading,
          'model-item--error': model.error
        }"
      >
        <div class="model-item__info">
          <div class="model-item__languages">
            <span class="language-tag">{{ getLanguageName(model.sourceLanguage) }}</span>
            <span class="arrow">→</span>
            <span class="language-tag">{{ getLanguageName(model.targetLanguage) }}</span>
          </div>
          
          <div class="model-item__status">
            <span 
              class="status-badge"
              :class="`status-badge--${getStatusType(model)}`"
            >
              {{ getStatusText(model) }}
            </span>
            
            <span v-if="model.lastChecked" class="last-checked">
              {{ formatLastChecked(model.lastChecked) }}
            </span>
          </div>
        </div>

        <!-- 下载进度 -->
        <div v-if="model.downloading" class="model-item__progress">
          <div class="progress-bar">
            <div 
              class="progress-bar__fill"
              :style="{ width: `${model.downloadProgress || 0}%` }"
            ></div>
          </div>
          
          <div class="progress-info">
            <span class="progress-text">
              {{ model.downloadProgress || 0 }}%
            </span>
            
            <span v-if="model.downloadSpeed" class="download-speed">
              {{ formatDownloadSpeed(model.downloadSpeed) }}
            </span>
            
            <span v-if="model.estimatedTimeRemaining" class="time-remaining">
              剩余 {{ formatTimeRemaining(model.estimatedTimeRemaining) }}
            </span>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="model.error" class="model-item__error">
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            <span class="error-text">{{ model.error }}</span>
          </div>
          
          <!-- 错误处理建议 -->
          <div v-if="model.errorPrompt" class="error-suggestions">
            <div class="suggestions-title">建议解决方案：</div>
            <ul class="suggestions-list">
              <li v-for="suggestion in model.errorPrompt.suggestions" :key="suggestion">
                {{ suggestion }}
              </li>
            </ul>
            
            <!-- 错误处理动作 -->
            <div class="error-actions">
              <button
                v-for="action in model.errorPrompt.actions"
                :key="action.type"
                class="btn btn--small"
                :class="action.primary ? 'btn--primary' : 'btn--secondary'"
                @click="handleErrorAction(action, model)"
                :disabled="isProcessing"
              >
                {{ action.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="model-item__actions">
          <button
            v-if="model.downloadable && !model.downloading"
            class="btn btn--small btn--primary"
            @click="downloadModel(model)"
            :disabled="isProcessing"
          >
            下载模型
          </button>
          
          <button
            v-if="model.downloading"
            class="btn btn--small btn--secondary"
            @click="cancelDownload(model)"
            :disabled="isProcessing"
          >
            取消下载
          </button>
          
          <button
            v-if="model.available"
            class="btn btn--small btn--success"
            disabled
          >
            已可用
          </button>
          
          <button
            class="btn btn--small btn--secondary"
            @click="checkModelStatus(model)"
            :disabled="isProcessing"
          >
            检查状态
          </button>
        </div>
      </div>
    </div>

    <!-- 添加新语言对 -->
    <div class="add-model-section">
      <h4 class="add-model__title">添加新语言对</h4>
      <div class="add-model__form">
        <select v-model="newModel.sourceLanguage" class="select">
          <option value="">选择源语言</option>
          <option 
            v-for="lang in availableLanguages" 
            :key="lang.code" 
            :value="lang.code"
          >
            {{ lang.name }}
          </option>
        </select>
        
        <span class="arrow">→</span>
        
        <select v-model="newModel.targetLanguage" class="select">
          <option value="">选择目标语言</option>
          <option 
            v-for="lang in availableLanguages" 
            :key="lang.code" 
            :value="lang.code"
            :disabled="lang.code === newModel.sourceLanguage"
          >
            {{ lang.name }}
          </option>
        </select>
        
        <button
          class="btn btn--primary"
          @click="addLanguagePair"
          :disabled="!canAddLanguagePair || isProcessing"
        >
          添加
        </button>
      </div>
    </div>

    <!-- 批量操作 -->
    <div class="batch-operations">
      <h4 class="batch-operations__title">批量操作</h4>
      <div class="batch-operations__buttons">
        <button
          class="btn btn--secondary"
          @click="downloadAllAvailable"
          :disabled="!hasDownloadableModels || isProcessing"
        >
          下载所有可用模型
        </button>
        
        <button
          class="btn btn--secondary"
          @click="cancelAllDownloads"
          :disabled="!hasDownloadingModels || isProcessing"
        >
          取消所有下载
        </button>
        
        <button
          class="btn btn--secondary"
          @click="clearModelCache"
          :disabled="isProcessing"
        >
          清理缓存
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ModelManager from '../../shared/model-manager.js'
import { SUPPORTED_LANGUAGES } from '../../shared/constants.json'

// 响应式数据
const modelList = ref([])
const isRefreshing = ref(false)
const isProcessing = ref(false)
const newModel = ref({
  sourceLanguage: '',
  targetLanguage: ''
})

// 可用语言列表
const availableLanguages = computed(() => {
  return Object.entries(SUPPORTED_LANGUAGES)
    .filter(([code]) => code !== 'auto')
    .map(([code, name]) => ({ code, name }))
})

// 计算属性
const canAddLanguagePair = computed(() => {
  return newModel.value.sourceLanguage && 
         newModel.value.targetLanguage && 
         newModel.value.sourceLanguage !== newModel.value.targetLanguage
})

const hasDownloadableModels = computed(() => {
  return modelList.value.some(model => model.downloadable && !model.downloading)
})

const hasDownloadingModels = computed(() => {
  return modelList.value.some(model => model.downloading)
})

// 生命周期
onMounted(async () => {
  await loadInitialModels()
})

onUnmounted(() => {
  // 清理资源
  ModelManager.cleanup()
})

// 方法
async function loadInitialModels() {
  // 加载常用语言对
  const commonPairs = [
    { source: 'en', target: 'zh' },
    { source: 'zh', target: 'en' },
    { source: 'ja', target: 'zh' },
    { source: 'ko', target: 'zh' },
    { source: 'fr', target: 'zh' },
    { source: 'de', target: 'zh' }
  ]
  
  await checkLanguagePairs(commonPairs)
}

async function checkLanguagePairs(pairs) {
  isRefreshing.value = true
  
  try {
    const results = await ModelManager.checkLanguagePairSupport(pairs)
    modelList.value = results
  } catch (error) {
    console.error('检查语言对支持失败:', error)
  } finally {
    isRefreshing.value = false
  }
}

async function refreshAllModels() {
  const currentPairs = modelList.value.map(model => ({
    source: model.sourceLanguage,
    target: model.targetLanguage
  }))
  
  await checkLanguagePairs(currentPairs)
}

async function downloadModel(model) {
  isProcessing.value = true
  
  try {
    await ModelManager.downloadModelWithProgress(
      model.sourceLanguage,
      model.targetLanguage,
      (progress) => {
        // 更新下载进度
        const modelIndex = modelList.value.findIndex(m => m.languagePair === model.languagePair)
        if (modelIndex !== -1) {
          modelList.value[modelIndex] = {
            ...modelList.value[modelIndex],
            downloading: true,
            downloadProgress: progress.progress,
            downloadSpeed: progress.downloadSpeed,
            estimatedTimeRemaining: progress.estimatedTimeRemaining
          }
        }
      },
      (result) => {
        // 下载完成
        const modelIndex = modelList.value.findIndex(m => m.languagePair === model.languagePair)
        if (modelIndex !== -1) {
          modelList.value[modelIndex] = {
            ...modelList.value[modelIndex],
            available: true,
            downloading: false,
            downloadProgress: 100,
            error: null
          }
        }
      },
      (error) => {
        // 下载失败
        const errorPrompt = ModelManager.generateDownloadFailurePrompt(
          model.sourceLanguage,
          model.targetLanguage,
          error
        )
        
        const modelIndex = modelList.value.findIndex(m => m.languagePair === model.languagePair)
        if (modelIndex !== -1) {
          modelList.value[modelIndex] = {
            ...modelList.value[modelIndex],
            downloading: false,
            error: error.message,
            errorPrompt
          }
        }
      }
    )
  } catch (error) {
    console.error('下载模型失败:', error)
  } finally {
    isProcessing.value = false
  }
}

async function cancelDownload(model) {
  ModelManager.cancelDownload(model.languagePair)
  
  const modelIndex = modelList.value.findIndex(m => m.languagePair === model.languagePair)
  if (modelIndex !== -1) {
    modelList.value[modelIndex] = {
      ...modelList.value[modelIndex],
      downloading: false,
      downloadProgress: 0,
      error: null
    }
  }
}

async function checkModelStatus(model) {
  isProcessing.value = true
  
  try {
    const status = await ModelManager.checkModelAvailability(
      model.sourceLanguage,
      model.targetLanguage
    )
    
    const modelIndex = modelList.value.findIndex(m => m.languagePair === model.languagePair)
    if (modelIndex !== -1) {
      modelList.value[modelIndex] = {
        ...modelList.value[modelIndex],
        ...status
      }
    }
  } catch (error) {
    console.error('检查模型状态失败:', error)
  } finally {
    isProcessing.value = false
  }
}

async function addLanguagePair() {
  if (!canAddLanguagePair.value) return
  
  const newPair = {
    source: newModel.value.sourceLanguage,
    target: newModel.value.targetLanguage
  }
  
  // 检查是否已存在
  const exists = modelList.value.some(model => 
    model.sourceLanguage === newPair.source && 
    model.targetLanguage === newPair.target
  )
  
  if (exists) {
    alert('该语言对已存在')
    return
  }
  
  await checkLanguagePairs([...modelList.value.map(m => ({
    source: m.sourceLanguage,
    target: m.targetLanguage
  })), newPair])
  
  // 重置表单
  newModel.value = {
    sourceLanguage: '',
    targetLanguage: ''
  }
}

async function downloadAllAvailable() {
  const downloadableModels = modelList.value.filter(model => 
    model.downloadable && !model.downloading
  )
  
  for (const model of downloadableModels) {
    await downloadModel(model)
  }
}

function cancelAllDownloads() {
  const downloadingModels = modelList.value.filter(model => model.downloading)
  
  downloadingModels.forEach(model => {
    cancelDownload(model)
  })
}

function clearModelCache() {
  ModelManager.cleanup()
  alert('模型缓存已清理')
}

function handleErrorAction(action, model) {
  if (typeof action.handler === 'function') {
    action.handler()
  }
}

// 辅助方法
function getLanguageName(code) {
  return SUPPORTED_LANGUAGES[code] || code
}

function getStatusType(model) {
  if (model.error) return 'error'
  if (model.downloading) return 'downloading'
  if (model.available) return 'available'
  if (model.downloadable) return 'downloadable'
  return 'unavailable'
}

function getStatusText(model) {
  if (model.error) return '错误'
  if (model.downloading) return '下载中'
  if (model.available) return '已可用'
  if (model.downloadable) return '可下载'
  return '不可用'
}

function formatLastChecked(timestamp) {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '刚刚检查'
  if (minutes < 60) return `${minutes}分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

function formatDownloadSpeed(bytesPerSecond) {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
}

function formatTimeRemaining(seconds) {
  if (seconds < 60) return `${seconds}秒`
  
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟`
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}小时${remainingMinutes}分钟`
}
</script>

<style scoped>
.model-manager {
  padding: 16px;
  background: var(--bg-color);
}

.model-manager__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.model-manager__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.model-list {
  margin-bottom: 24px;
}

.model-item {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  background: var(--bg-color);
  transition: all 0.3s;
}

.model-item--available {
  border-color: var(--success-color);
  background: var(--success-light-bg, #f0f9ff);
}

.model-item--downloading {
  border-color: var(--primary-color);
  background: var(--primary-light-bg, #f0f9ff);
}

.model-item--error {
  border-color: var(--error-color);
  background: var(--error-light-bg, #fef2f2);
}

.model-item__info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.model-item__languages {
  display: flex;
  align-items: center;
  gap: 8px;
}

.language-tag {
  background: var(--bg-page);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.arrow {
  color: var(--text-secondary);
  font-weight: bold;
}

.model-item__status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge--available {
  background: var(--success-color);
  color: white;
}

.status-badge--downloading {
  background: var(--primary-color);
  color: white;
}

.status-badge--downloadable {
  background: var(--warning-color);
  color: white;
}

.status-badge--error {
  background: var(--error-color);
  color: white;
}

.status-badge--unavailable {
  background: var(--text-placeholder);
  color: white;
}

.last-checked {
  font-size: 12px;
  color: var(--text-secondary);
}

.model-item__progress {
  margin-bottom: 12px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--border-lighter);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar__fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.model-item__error {
  margin-bottom: 12px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.error-text {
  color: var(--error-color);
  font-size: 14px;
}

.error-suggestions {
  background: var(--bg-page);
  padding: 12px;
  border-radius: 6px;
  margin-top: 8px;
}

.suggestions-title {
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.suggestions-list {
  margin: 8px 0;
  padding-left: 16px;
  font-size: 13px;
  color: var(--text-regular);
}

.error-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.model-item__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.add-model-section {
  border-top: 1px solid var(--border-lighter);
  padding-top: 16px;
  margin-bottom: 24px;
}

.add-model__title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.add-model__form {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-operations {
  border-top: 1px solid var(--border-lighter);
  padding-top: 16px;
}

.batch-operations__title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.batch-operations__buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>