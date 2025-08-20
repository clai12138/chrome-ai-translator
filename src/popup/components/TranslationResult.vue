<template>
  <div v-if="result" class="translation-result card">
    <label class="text-secondary mb-2">翻译结果</label>
    <div class="result-text text-primary mb-3">
      {{ result }}
    </div>
    <div class="result-actions flex gap-2">
      <button @click="copyResult" class="btn">
        复制结果
      </button>
    </div>
  </div>
</template>

<script setup>
// Props
const props = defineProps({
  result: {
    type: String,
    default: ''
  },
  sourceLanguage: {
    type: String,
    default: ''
  },
  targetLanguage: {
    type: String,
    default: ''
  }
})

// Emits
const emit = defineEmits(['copy', 'save'])

// 复制结果
const copyResult = async () => {
  try {
    await navigator.clipboard.writeText(props.result)
    emit('copy', props.result)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// 保存结果功能已移除，翻译会自动保存到历史记录
</script>

<style scoped>
.translation-result {
  margin-bottom: 16px;
}

.result-text {
  line-height: 1.5;
  word-wrap: break-word;
  font-style: normal;
  color: #d650dc !important;
}

label {
  display: block;
  font-size: 12px;
  font-weight: 500;
}
</style>