<template>
  <transition name="notification" appear>
    <div 
      v-if="visible"
      :class="['error-notification', `notification--${notification.type}`]"
    >
      <div class="notification-icon">
        <svg v-if="notification.type === 'error'" viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <svg v-else-if="notification.type === 'warning'" viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
        <svg v-else-if="notification.type === 'info'" viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
      </div>
      
      <div class="notification-content">
        <h4 v-if="notification.title" class="notification-title">
          {{ notification.title }}
        </h4>
        <p class="notification-message">{{ notification.message }}</p>
        
        <div v-if="notification.actions" class="notification-actions">
          <button
            v-for="action in notification.actions"
            :key="action.text"
            class="action-btn"
            @click="handleAction(action)"
          >
            {{ action.text }}
          </button>
        </div>
      </div>
      
      <button 
        v-if="notification.showClose"
        class="close-btn"
        @click="close"
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  </transition>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  notification: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const visible = ref(true)
let autoCloseTimer = null

// 自动关闭定时器
onMounted(() => {
  if (props.notification.duration > 0) {
    autoCloseTimer = setTimeout(() => {
      close()
    }, props.notification.duration)
  }
})

// 清理定时器
onUnmounted(() => {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
  }
})

// 关闭通知
const close = () => {
  visible.value = false
  setTimeout(() => {
    emit('close')
  }, 300) // 等待动画完成
}

// 处理操作按钮
const handleAction = (action) => {
  if (action.handler) {
    action.handler()
  }
  
  // 执行操作后关闭通知
  close()
}
</script>

<style scoped>
.error-notification {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  background: var(--bg-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-left: 4px solid;
  margin-bottom: 12px;
  position: relative;
  width: 400px;
}

.notification--error {
  border-left-color: var(--error-color);
}

.notification--warning {
  border-left-color: var(--warning-color);
}

.notification--info {
  border-left-color: var(--primary-color);
}

.notification-icon {
  flex-shrink: 0;
  margin-right: 12px;
  margin-top: 2px;
}

.notification--error .notification-icon {
  color: var(--error-color);
}

.notification--warning .notification-icon {
  color: var(--warning-color);
}

.notification--info .notification-icon {
  color: var(--primary-color);
}

.notification-content {
  flex: 1;
  width: 0;
}

.notification-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.notification-message {
  font-size: 13px;
  color: var(--text-regular);
  line-height: 1.4;
  margin: 0;
  word-wrap: break-word;
}

.notification-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--border-base);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-regular);
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn:hover {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.close-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.3s;
  margin-left: 8px;
}

.close-btn:hover {
  background: var(--bg-page);
  color: var(--text-primary);
}

/* 动画效果 */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>