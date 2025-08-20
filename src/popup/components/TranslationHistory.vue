<template>
  <div class="translation-history">
    <!-- 历史记录标题和清除按钮 -->
    <div class="history-header">
      <h3 class="history-title">翻译历史</h3>
      <button 
        v-if="showClearButton && history.length > 0" 
        @click="showConfirmDialog = true" 
        class="btn btn-danger"
      >
        清空历史
      </button>
    </div>

    <!-- 历史记录列表 -->
    <div v-if="history.length > 0" class="history-list">
      <div 
        v-for="item in displayHistory" 
        :key="item.id" 
        class="history-item card"
      >
        <div class="history-content">
          <div class="source-text">{{ truncateText(item.sourceText, 80) }}</div>
          <div class="translated-text">{{ truncateText(item.translatedText, 80) }}</div>
          <div class="history-meta">
            <span class="language-pair">{{ item.sourceLanguage }} → {{ item.targetLanguage }}</span>
            <span class="timestamp">{{ formatTime(item.timestamp) }}</span>
          </div>
        </div>
        <div class="history-actions">
          <button 
            @click.stop="showDetail(item)" 
            class="detail-btn"
            title="查看详情"
          >
            详情
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">📝</div>
      <div class="empty-text">暂无翻译历史</div>
      <div class="empty-hint">开始翻译后，历史记录将显示在这里</div>
    </div>

    <!-- 确认对话框 -->
    <div v-if="showConfirmDialog" class="confirm-overlay" @click="showConfirmDialog = false">
      <div class="confirm-dialog" @click.stop>
        <div class="confirm-title">确认清空历史</div>
        <div class="confirm-message">此操作将删除所有翻译历史记录，且无法恢复。确定要继续吗？</div>
        <div class="confirm-actions">
          <button @click="showConfirmDialog = false" class="btn btn-secondary">取消</button>
          <button @click="confirmClearHistory" class="btn btn-danger">确定清空</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

// Props
const props = defineProps({
  history: {
    type: Array,
    default: () => []
  },
  showClearButton: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['select', 'clear', 'show-detail'])

// 响应式数据
const showConfirmDialog = ref(false)

// 计算属性
const displayHistory = computed(() => {
  // 在历史标签页中显示所有历史记录，在翻译标签页中只显示最近5条
  return props.showClearButton ? props.history : props.history.slice(0, 5)
})

// 截断文本
const truncateText = (text, maxLength) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 选择历史项 - 已禁用
const selectItem = (item) => {
  // 不再触发选择事件
}

// 确认清除历史
const confirmClearHistory = () => {
  emit('clear')
  showConfirmDialog.value = false
}

// 显示详情
const showDetail = (item) => {
  emit('show-detail', item)
}
</script>

<style scoped>
.translation-history {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-lighter);
}

.history-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-base);
  background: var(--bg-color);
  color: var(--text-regular);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.btn-danger {
  background: var(--error-color);
  color: white;
  border-color: var(--error-color);
}

.btn-danger:hover {
  background: var(--error-dark);
  border-color: var(--error-dark);
}

.btn-secondary {
  background: var(--bg-page);
  color: var(--text-regular);
  border-color: var(--border-base);
}

.btn-secondary:hover {
  background: var(--border-lighter);
}

.history-list {
  flex: 1;
  overflow-y: auto;
  height: 400px;
}

.history-item {
  margin-bottom: 12px;
  padding: 16px;
  transition: all 0.3s ease;
  border: 1px solid var(--border-lighter);
  border-radius: 8px;
  background: var(--bg-color);
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.history-item:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
  transform: translateY(-1px);
}

.history-item:last-child {
  margin-bottom: 0;
}

.history-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.history-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.detail-btn {
  padding: 4px 8px;
  border: 1px solid var(--border-base);
  border-radius: 4px;
  background: var(--bg-page);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.detail-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(64, 158, 255, 0.05);
}

.source-text {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  line-height: 1.4;
}

.translated-text {
  font-size: 14px;
  color: var(--text-regular);
  line-height: 1.4;
}

.history-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.language-pair {
  font-weight: 500;
}

.timestamp {
  font-style: italic;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-regular);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background: var(--bg-color);
  border-radius: 12px;
  padding: 24px;
  width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.confirm-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.confirm-message {
  font-size: 14px;
  color: var(--text-regular);
  line-height: 1.5;
  margin-bottom: 20px;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.confirm-actions .btn {
  width: 80px;
}
</style>