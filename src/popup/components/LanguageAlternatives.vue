<template>
  <div class="language-alternatives">
    <div class="alternatives-header">
      <h3>{{ alternatives.message }}</h3>
      <p class="current-pair">
        当前选择: {{ getLanguageName(alternatives.sourceLanguage) }} → {{ getLanguageName(alternatives.targetLanguage) }}
      </p>
    </div>
    
    <div class="alternatives-content">
      <div 
        v-for="group in alternatives.alternatives" 
        :key="group.type"
        class="alternative-group"
      >
        <h4 class="group-title">{{ group.message }}</h4>
        <div class="suggestions-grid">
          <button
            v-for="suggestion in group.suggestions"
            :key="suggestion.pair"
            class="suggestion-item"
            @click="selectLanguagePair(suggestion)"
          >
            <span class="suggestion-name">{{ suggestion.name }}</span>
            <span class="suggestion-code">{{ suggestion.pair }}</span>
          </button>
        </div>
      </div>
    </div>
    
    <div class="alternatives-actions">
      <button class="btn btn--secondary" @click="$emit('close')">
        取消
      </button>
      <button class="btn btn--primary" @click="checkOtherLanguages">
        查看更多语言
      </button>
    </div>
  </div>
</template>

<script setup>
import ErrorHandler from '../../shared/error-handler.js'

const props = defineProps({
  alternatives: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'selectLanguagePair'])

// 获取语言名称
const getLanguageName = (languageCode) => {
  return ErrorHandler.getLanguageName(languageCode)
}

// 选择语言对
const selectLanguagePair = (suggestion) => {
  const [sourceLanguage, targetLanguage] = suggestion.pair.split('-')
  emit('selectLanguagePair', {
    sourceLanguage,
    targetLanguage,
    suggestion
  })
}

// 查看更多语言选项
const checkOtherLanguages = () => {
  // 触发打开语言选择器
  emit('close')
  // 可以添加额外的逻辑来突出显示语言选择器
}
</script>

<style scoped>
.language-alternatives {
  padding: 20px;
  background: var(--bg-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  width: 500px;
  margin: 0 auto;
}

.alternatives-header {
  text-align: center;
  margin-bottom: 24px;
}

.alternatives-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.current-pair {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  padding: 8px 12px;
  background: var(--bg-page);
  border-radius: 4px;
  display: inline-block;
}

.alternatives-content {
  margin-bottom: 24px;
}

.alternative-group {
  margin-bottom: 20px;
}

.alternative-group:last-child {
  margin-bottom: 0;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}

.suggestions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  background: var(--bg-page);
  border: 1px solid var(--border-lighter);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.suggestion-item:hover {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.suggestion-item:hover .suggestion-name,
.suggestion-item:hover .suggestion-code {
  color: white;
}

.suggestion-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.suggestion-code {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 3px;
}

.alternatives-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid var(--border-lighter);
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
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
</style>