<template>
  <div class="browser-upgrade-prompt">
    <div class="upgrade-icon">
      <svg viewBox="0 0 24 24" width="48" height="48">
        <path fill="#f56c6c" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    </div>
    
    <div class="upgrade-content">
      <h3 class="upgrade-title">{{ upgradeInfo.title }}</h3>
      <p class="upgrade-message">{{ upgradeInfo.message }}</p>
      
      <div class="upgrade-tips" v-if="upgradeInfo.tips">
        <h4>升级后您将享受：</h4>
        <ul>
          <li v-for="tip in upgradeInfo.tips" :key="tip">{{ tip }}</li>
        </ul>
      </div>
      
      <div class="upgrade-actions">
        <button 
          v-for="action in upgradeInfo.actions" 
          :key="action.type"
          :class="['btn', `btn--${action.type}`]"
          @click="handleAction(action)"
        >
          {{ action.text }}
        </button>
      </div>
      
      <div class="version-info" v-if="upgradeInfo.currentVersion">
        <small>
          当前版本: Chrome {{ upgradeInfo.currentVersion }} | 
          需要版本: Chrome {{ upgradeInfo.requiredVersion }}+
        </small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ErrorHandler from '../../shared/error-handler.js'

const props = defineProps({
  currentVersion: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['close'])

// 获取升级信息
const upgradeInfo = computed(() => {
  return ErrorHandler.getBrowserUpgradeInfo(props.currentVersion)
})

// 处理操作按钮点击
const handleAction = (action) => {
  if (action.url) {
    window.open(action.url, '_blank')
  }
  
  if (action.type === 'secondary') {
    // 关闭提示框
    emit('close')
  }
}
</script>

<style scoped>
.browser-upgrade-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  text-align: center;
  background: var(--bg-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  width: 400px;
  margin: 0 auto;
}

.upgrade-icon {
  margin-bottom: 16px;
}

.upgrade-icon svg {
  display: block;
}

.upgrade-content {
  width: 100%;
}

.upgrade-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}

.upgrade-message {
  font-size: 14px;
  color: var(--text-regular);
  line-height: 1.5;
  margin: 0 0 20px 0;
}

.upgrade-tips {
  text-align: left;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-page);
  border-radius: 6px;
}

.upgrade-tips h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.upgrade-tips ul {
  margin: 0;
  padding-left: 16px;
}

.upgrade-tips li {
  font-size: 13px;
  color: var(--text-regular);
  line-height: 1.4;
  margin-bottom: 4px;
}

.upgrade-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 16px;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn--primary {
  background: var(--primary-color);
  color: white;
}

.btn--primary:hover {
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

.version-info {
  color: var(--text-secondary);
  font-size: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-lighter);
}
</style>