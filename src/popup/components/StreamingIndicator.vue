<template>
  <div v-if="isActive" class="streaming-indicator card">
    <div class="flex items-center gap-2">
      <div class="loading-dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
      <span class="text-primary">{{ statusText }}</span>
    </div>
    <div v-if="currentText" class="streaming-text mt-2 text-secondary">
      {{ currentText }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Props
const props = defineProps({
  isActive: {
    type: Boolean,
    default: false
  },
  progress: {
    type: Number,
    default: 0
  },
  currentText: {
    type: String,
    default: ''
  }
})

// 计算属性
const statusText = computed(() => {
  if (props.progress > 0) {
    return `流式翻译中... ${props.progress}%`
  }
  return '流式翻译中...'
})
</script>

<style scoped>
.streaming-indicator {
  background: rgba(64, 158, 255, 0.1);
  border-color: var(--primary-color);
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 6px;
  height: 6px;
  background: var(--primary-color);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

.streaming-text {
  font-size: 12px;
  line-height: 1.4;
  height: 60px;
  overflow: hidden;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
</style>