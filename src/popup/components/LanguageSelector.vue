<template>
  <div class="language-selector">
    <div class="flex">
      <div class="flex-1">
        <label class="text-secondary">源语言</label>
        <select v-model="sourceLanguage" class="select w-full" @change="onLanguageChange">
          <option value="auto">自动检测</option>
          <option 
            v-for="language in supportedLanguages" 
            :key="language.code"
            :value="language.code"
          >
            {{ language.name }}
          </option>
        </select>
      </div>
      
      <div class="items-center">
        <button 
          @click="swapLanguages" 
          class="btn"
          :disabled="sourceLanguage === 'auto'"
          title="交换语言"
        >
          ⇄
        </button>
      </div>
      
      <div class="flex-1">
        <label class="text-secondary">目标语言</label>
        <select v-model="targetLanguage" class="select w-full" @change="onLanguageChange">
          <option 
            v-for="language in supportedLanguages" 
            :key="language.code"
            :value="language.code"
          >
            {{ language.name }}
          </option>
        </select>
      </div>
    </div>
    
    <!-- 语言对状态 -->
    <div v-if="availabilityStatus" class="mt-2 text-center">
      <span 
        class="text-secondary"
        :class="getStatusClass(availabilityStatus)"
      >
        {{ getStatusText(availabilityStatus) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import translationCore from '../../shared/translation-core.js'

// Props
const props = defineProps({
  source: {
    type: String,
    default: 'en'
  },
  target: {
    type: String,
    default: 'zh'
  }
})

// Emits
const emit = defineEmits(['language-changed', 'update:source', 'update:target'])

// 响应式数据
const sourceLanguage = ref(props.source)
const targetLanguage = ref(props.target)
const availabilityStatus = ref(null)
const supportedLanguages = ref([])

// 计算属性
const currentLanguagePair = computed(() => ({
  sourceLanguage: sourceLanguage.value,
  targetLanguage: targetLanguage.value
}))

// 初始化
onMounted(async () => {
  try {
    supportedLanguages.value = translationCore.getSupportedLanguages()
    await checkAvailability()
  } catch (error) {
    console.error('初始化语言选择器失败:', error)
  }
})

// 监听语言变化
watch(currentLanguagePair, async () => {
  await checkAvailability()
}, { deep: true })

// 检查语言对可用性
const checkAvailability = async () => {
  // 检查翻译器可用性
  if (!translationCore.isTranslatorAvailable()) {
    availabilityStatus.value = 'translator-unavailable'
    return
  }

  if (sourceLanguage.value === 'auto') {
    // 检查语言检测器可用性
    if (!translationCore.isLanguageDetectorAvailable()) {
      availabilityStatus.value = 'detector-unavailable'
      return
    }
    availabilityStatus.value = 'auto'
    return
  }

  // 如果源语言和目标语言相同，直接标记为可用
  if (sourceLanguage.value === targetLanguage.value) {
    availabilityStatus.value = 'same-language'
    return
  }

  try {
    const status = await Translator.availability({
      sourceLanguage: sourceLanguage.value,
      targetLanguage: targetLanguage.value
    })
    availabilityStatus.value = status
  } catch (error) {
    console.error('检查语言对可用性失败:', error)
    availabilityStatus.value = 'error'
  }
}

// 语言变化处理
const onLanguageChange = () => {
  emit('update:source', sourceLanguage.value)
  emit('update:target', targetLanguage.value)
  emit('language-changed', {
    sourceLanguage: sourceLanguage.value,
    targetLanguage: targetLanguage.value
  })
}

// 交换语言
const swapLanguages = () => {
  if (sourceLanguage.value === 'auto') return
  
  const temp = sourceLanguage.value
  sourceLanguage.value = targetLanguage.value
  targetLanguage.value = temp
  
  onLanguageChange()
}

// 获取状态样式类
const getStatusClass = (status) => {
  switch (status) {
    case 'available':
      return 'success'
    case 'same-language':
      return 'success'
    case 'downloadable':
      return 'text-warning'
    case 'downloading':
      return 'text-primary'
    case 'auto':
      return 'text-secondary'
    case 'translator-unavailable':
    case 'detector-unavailable':
      return 'error'
    default:
      return 'error'
  }
}

// 获取状态文本
const getStatusText = (status) => {
  switch (status) {
    case 'available':
      return '✓ 可用'
    case 'same-language':
      return '✓ 可用'
    case 'downloadable':
      return '⬇ 需要下载'
    case 'downloading':
      return '⏳ 下载中'
    case 'auto':
      return '自动检测'
    case 'translator-unavailable':
      return '✗ 翻译器不可用，请升级浏览器'
    case 'detector-unavailable':
      return '✗ 语言检测不可用，请升级浏览器'
    default:
      return '✗ 不可用'
  }
}
</script>

<style scoped>
.language-selector {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.text-warning {
  color: var(--warning-color);
}
</style>