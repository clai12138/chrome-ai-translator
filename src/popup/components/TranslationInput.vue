<template>
  <div class="translation-input">
    <label class="text-secondary mb-2">输入文本</label>
    <textarea 
      v-model="inputText" 
      class="input textarea w-full" 
      placeholder="请输入要翻译的文本..."
      @input="onInputChange"
    ></textarea>
    <div class="flex justify-between items-center mt-2">
      <span class="text-secondary">{{ inputText.length }} 字符</span>
      <div class="flex gap-2">
        <button 
          @click="clearInput" 
          class="btn"
          v-if="inputText.length > 0"
        >
          清除
        </button>
        <button 
          @click="translate" 
          :disabled="!inputText.trim() || isTranslating"
          class="btn btn--primary"
          :class="{ loading: isTranslating }"
        >
          {{ isTranslating ? '翻译中...' : '翻译' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

// Props
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  isTranslating: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'translate', 'clear'])

// 响应式数据
const inputText = ref(props.modelValue)

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
  inputText.value = newValue
})

// 监听内部值变化
watch(inputText, (newValue) => {
  emit('update:modelValue', newValue)
})

// 输入变化处理
const onInputChange = () => {
  // 输入变化时的处理逻辑
}

// 翻译
const translate = () => {
  if (inputText.value.trim()) {
    emit('translate')
  }
}

// 清除输入
const clearInput = () => {
  inputText.value = ''
  emit('clear')
}
</script>

<style scoped>
.translation-input {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.textarea {
  height: 80px;
  resize: vertical;
}

label {
  display: block;
  font-size: 12px;
  font-weight: 500;
}
</style>