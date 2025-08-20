import { createApp } from 'vue';

import AutoUpdater from '../shared/auto-updater.js';
import lazyLoader from '../shared/lazy-loader.js';
import '../styles/index.css';
import App from './App.vue';

// 性能监控
const startTime = performance.now();

// 错误日志收集
window.errorLog = [];
window.addEventListener('error', (event) => {
  window.errorLog.push({
    message: event.error.message,
    stack: event.error.stack,
    timestamp: Date.now(),
  });
});

async function initializeApp() {
  try {
    console.log('🚀 初始化Chrome AI翻译扩展...');

    // 1. 检查Chrome Translator API支持
    if (!('Translator' in self)) {
      throw new Error('当前浏览器版本不支持AI翻译功能，请升级到Chrome 138或更高版本');
    }

    // 2. 初始化自动更新器
    const autoUpdater = new AutoUpdater();
    await autoUpdater.initialize();

    // 3. 预加载核心组件
    await lazyLoader.preloadComponents([
      {
        name: 'TranslationInput',
        importFunction: () => import('./components/TranslationInput.vue'),
        priority: 'high',
      },
      {
        name: 'LanguageSelector',
        importFunction: () => import('./components/LanguageSelector.vue'),
        priority: 'high',
      },
      {
        name: 'TranslationResult',
        importFunction: () => import('./components/TranslationResult.vue'),
        priority: 'medium',
      },
    ]);

    // 4. 创建Vue应用
    const app = createApp(App);

    // 5. 全局属性注入
    app.config.globalProperties.$lazyLoader = lazyLoader;
    app.config.globalProperties.$autoUpdater = autoUpdater;

    // 6. 全局错误处理
    app.config.errorHandler = (err, _instance, info) => {
      console.error('Vue应用错误:', err, info);
      window.errorLog.push({
        type: 'vue-error',
        message: err.message,
        info,
        timestamp: Date.now(),
      });
    };

    // 7. 挂载应用
    const vueApp = app.mount('#app');

    // 8. 等待Vue应用完全渲染
    await new Promise((resolve) => {
      vueApp.$nextTick(() => {
        requestAnimationFrame(resolve);
      });
    });

    // 8.5. 标记应用就绪
    document.body.classList.add('app-ready');

    // 隐藏加载指示器
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = 'none';
    }

    // 9. 应用就绪回调
    const loadTime = performance.now() - startTime;
    console.log(`✅ 应用加载完成 (${loadTime.toFixed(2)}ms)`);

    // 通知页面应用已就绪
    if (window.onAppReady) {
      window.onAppReady();
    }

    // 9. 智能预加载（基于用户行为）
    setTimeout(async () => {
      try {
        // 获取用户使用习惯
        const result = await chrome.storage.local.get({
          userBehavior: {
            mostUsedFeatures: [],
            recentActions: [],
            timeOfDay: new Date().getHours(),
          },
        });

        await lazyLoader.smartPreload(result.userBehavior);
      } catch (error) {
        console.warn('智能预加载失败:', error);
      }
    }, 1000);

    // 10. 性能监控
    setTimeout(() => {
      const performanceReport = lazyLoader.exportPerformanceReport();
      console.log('📊 性能报告:', performanceReport);
    }, 5000);
  } catch (error) {
    console.error('❌ 应用初始化失败:', error);

    // 显示错误信息
    const errorContainer = document.getElementById('error');
    const errorMessage = document.getElementById('error-message');
    const loading = document.getElementById('loading');

    if (errorContainer && errorMessage && loading) {
      loading.style.display = 'none';
      errorContainer.style.display = 'block';
      errorMessage.textContent = error.message;
    }

    // 记录错误
    window.errorLog.push({
      type: 'init-error',
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
    });
  }
}

// 启动应用
initializeApp();
