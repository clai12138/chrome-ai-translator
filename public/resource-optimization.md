# 资源文件优化配置

## 资源加载优化策略

### 1. 图标资源优化

#### 图标压缩
- 使用PNG格式，启用无损压缩
- 16x16图标优化到2KB以下
- 48x48图标优化到8KB以下  
- 128x128图标优化到20KB以下

#### 图标缓存策略
```javascript
// 在service-worker.js中实现图标预加载
const ICON_CACHE_NAME = 'translator-icons-v1';
const ICON_URLS = [
  '/icons/icon-16.png',
  '/icons/icon-48.png', 
  '/icons/icon-128.png'
];

// 预缓存图标资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ICON_CACHE_NAME)
      .then(cache => cache.addAll(ICON_URLS))
  );
});
```

### 2. 本地化文件优化

#### 按需加载策略
```javascript
// 在shared/i18n.js中实现
class I18nManager {
  constructor() {
    this.currentLocale = this.detectLocale();
    this.messages = null;
  }
  
  detectLocale() {
    const browserLang = chrome.i18n.getUILanguage();
    // 仅支持中英文，默认中文
    return browserLang.startsWith('en') ? 'en' : 'zh_CN';
  }
  
  async loadMessages() {
    if (!this.messages) {
      // 使用Chrome内置的i18n API
      this.messages = chrome.i18n.getMessage;
    }
    return this.messages;
  }
}
```

#### 消息缓存
- 使用Chrome内置的i18n缓存机制
- 避免重复加载相同语言文件
- 实现语言切换时的动态加载

### 3. CSS资源优化

#### 样式文件分割
```css
/* 核心样式 - 立即加载 */
@import url('./core.css');

/* 组件样式 - 按需加载 */
@import url('./components.css') layer(components);

/* 动画样式 - 延迟加载 */
@import url('./animations.css') layer(animations);
```

#### CSS变量优化
```css
:root {
  /* 减少CSS变量数量，仅保留核心主题色 */
  --primary: #409eff;
  --primary-dark: #337ecc;
  --text: #303133;
  --border: #dcdfe6;
  --bg: #ffffff;
}
```

### 4. JavaScript资源优化

#### 代码分割配置
```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 核心翻译功能
          'translator': ['src/shared/translator.js'],
          // 存储管理
          'storage': ['src/shared/storage.js'],
          // UI组件
          'components': [
            'src/popup/components/LanguageSelector.vue',
            'src/popup/components/TranslationInput.vue'
          ]
        }
      }
    },
    // 启用压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

#### 懒加载实现
```javascript
// 组件懒加载
const TranslationHistory = defineAsyncComponent(() => 
  import('./components/TranslationHistory.vue')
);

const StreamingIndicator = defineAsyncComponent(() =>
  import('./components/StreamingIndicator.vue')
);
```

### 5. 缓存策略配置

#### Service Worker缓存
```javascript
// background/service-worker.js
const CACHE_NAME = 'translator-cache-v1';
const STATIC_RESOURCES = [
  '/popup.html',
  '/popup.js',
  '/styles/index.css',
  '/icons/icon-16.png',
  '/icons/icon-48.png',
  '/icons/icon-128.png'
];

// 安装时预缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_RESOURCES))
  );
});

// 网络优先策略
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
```

#### Chrome Storage缓存
```javascript
// shared/storage.js
class StorageManager {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
  }
  
  async getWithCache(key) {
    // 检查内存缓存
    if (this.cache.has(key)) {
      const { data, timestamp } = this.cache.get(key);
      if (Date.now() - timestamp < this.cacheTimeout) {
        return data;
      }
    }
    
    // 从Chrome Storage读取
    const result = await chrome.storage.local.get(key);
    const data = result[key];
    
    // 更新缓存
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }
}
```

### 6. 性能监控

#### 资源加载监控
```javascript
// shared/performance.js
class PerformanceMonitor {
  static measureResourceLoad(resourceName, loadFunction) {
    const startTime = performance.now();
    
    return loadFunction().then(result => {
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      console.log(`${resourceName} loaded in ${loadTime.toFixed(2)}ms`);
      
      // 记录到Chrome Storage用于分析
      this.recordMetric(resourceName, loadTime);
      
      return result;
    });
  }
  
  static recordMetric(name, value) {
    chrome.storage.local.get('performance_metrics').then(result => {
      const metrics = result.performance_metrics || {};
      metrics[name] = {
        value,
        timestamp: Date.now()
      };
      chrome.storage.local.set({ performance_metrics: metrics });
    });
  }
}
```

### 7. 构建优化配置

#### Vite构建配置
```javascript
// vite.config.js
export default defineConfig({
  build: {
    // 目标浏览器
    target: 'chrome88',
    
    // 输出配置
    outDir: 'dist',
    assetsDir: 'assets',
    
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log']
      }
    },
    
    // 代码分割
    rollupOptions: {
      output: {
        // 文件命名
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        
        // 手动分块
        manualChunks: {
          'vendor': ['vue'],
          'translator': ['src/shared/translator.js'],
          'ui': ['src/popup/components/index.js']
        }
      }
    }
  },
  
  // 开发服务器配置
  server: {
    port: 3000,
    open: false
  }
});
```

### 8. 资源预加载策略

#### 关键资源预加载
```html
<!-- popup.html -->
<head>
  <!-- 预加载关键CSS -->
  <link rel="preload" href="styles/index.css" as="style">
  
  <!-- 预加载核心JavaScript -->
  <link rel="preload" href="popup.js" as="script">
  
  <!-- 预连接到Chrome内置API -->
  <link rel="dns-prefetch" href="chrome-extension://">
</head>
```

#### 组件预加载
```javascript
// popup/main.js
import { createApp } from 'vue';
import App from './App.vue';

// 预加载常用组件
const preloadComponents = [
  () => import('./components/LanguageSelector.vue'),
  () => import('./components/TranslationInput.vue'),
  () => import('./components/TranslationResult.vue')
];

// 在空闲时预加载
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    preloadComponents.forEach(loader => loader());
  });
}

const app = createApp(App);
app.mount('#app');
```

## 优化效果预期

### 加载性能
- 扩展启动时间 < 100ms
- 弹窗打开时间 < 50ms
- 翻译响应时间 < 200ms

### 资源大小
- 总扩展包大小 < 500KB
- 核心JavaScript < 100KB
- CSS文件 < 20KB
- 图标文件总计 < 30KB

### 缓存效率
- 静态资源缓存命中率 > 95%
- 翻译结果缓存命中率 > 80%
- 语言配置缓存命中率 > 90%

### 内存使用
- 扩展内存占用 < 10MB
- 缓存数据 < 5MB
- 翻译历史 < 2MB