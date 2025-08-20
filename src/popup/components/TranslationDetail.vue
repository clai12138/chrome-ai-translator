<template>
  <div v-if="visible" class="detail-overlay" @click="handleOverlayClick">
    <div class="detail-dialog" @click.stop>
      <!-- 顶部按钮区域 -->
      <div class="detail-header">
        <div class="detail-actions">
          <button @click="copyOriginal" class="btn btn-secondary">
            复制原文
          </button>
          <button @click="copyTranslation" class="btn btn-secondary">
            复制译文
          </button>
        </div>
        <button @click="close" class="close-btn">
          ×
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="detail-content">
        <!-- 原文 -->
        <div class="text-section">
          <div class="text-label">原文 ({{ item?.sourceLanguage }})</div>
          <div class="text-content">{{ item?.sourceText }}</div>
        </div>

        <!-- 分隔线 -->
        <div class="divider"></div>

        <!-- 译文 -->
        <div class="text-section">
          <div class="text-label">译文 ({{ item?.targetLanguage }})</div>
          <div class="text-content translated-text">{{ item?.translatedText }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineEmits, defineProps } from 'vue'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  item: {
    type: Object,
    default: null
  }
})

// Emits
const emit = defineEmits(['close'])

// 关闭弹窗
const close = () => {
  emit('close')
}

// 点击遮罩层关闭
const handleOverlayClick = () => {
  close()
}

// 复制原文
const copyOriginal = async () => {
  if (props.item?.sourceText) {
    try {
      await navigator.clipboard.writeText(props.item.sourceText)
      console.log('原文已复制')
    } catch (error) {
      console.error('复制原文失败:', error)
    }
  }
}

// 复制译文
const copyTranslation = async () => {
  if (props.item?.translatedText) {
    try {
      await navigator.clipboard.writeText(props.item.translatedText)
      console.log('译文已复制')
    } catch (error) {
      console.error('复制译文失败:', error)
    }
  }
}
</script>

<style scoped>
.detail-overlay {
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
  animation: fadeIn 0.2s ease;
}

.detail-dialog {
  background: var(--bg-color);
  border-radius: 12px;
  width: 500px;
  height: 400px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s ease;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-lighter);
  background: var(--bg-page);
}

.detail-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-base);
  background: var(--bg-color);
  color: var(--text-regular);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.btn-secondary {
  background: var(--bg-page);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: var(--border-lighter);
  color: var(--text-primary);
}

.detail-content {
  padding: 20px;
  height: 300px;
  overflow-y: auto;
}

.text-section {
  margin-bottom: 16px;
}

.text-section:last-child {
  margin-bottom: 0;
}

.text-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.text-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-page);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-lighter);
  word-wrap: break-word;
  white-space: pre-wrap;
}

.text-content.translated-text {
  color: #d650dc !important;
}

.divider {
  height: 1px;
  background: var(--border-base);
  margin: 20px 0;
  border: none;
  border-top: 2px dashed var(--border-base);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>