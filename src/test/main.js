import { createApp } from 'vue'
import '../styles/index.css'
import App from './App.vue'

// 性能监控
const startTime = performance.now()

// 错误日志收集
window.errorLog = []
window.addEventListener('error', (event) => {
  window.errorLog.push({
    message: event.error.message,
    stack: event.error.stack,
    timestamp: Date.now(),
  })
})

async function initializeTestApp() {
  try {
    console.log('🚀 初始化Chrome AI翻译器测试页面...')

    // 1. 检查Chrome Translator API支持
    if (!('Translator' in self)) {
      throw new Error('当前浏览器版本不支持AI翻译功能，请升级到Chrome 138或更高版本')
    }

    // 2. 创建Vue应用
    const app = createApp(App)

    // 3. 全局错误处理
    app.config.errorHandler = (err, instance, info) => {
      console.error('Vue应用错误:', err, info)
      window.errorLog.push({
        type: 'vue-error',
        message: err.message,
        info,
        timestamp: Date.now(),
      })
    }

    // 4. 挂载应用
    const vueApp = app.mount('#app')

    // 5. 等待Vue应用完全渲染
    await new Promise((resolve) => {
      vueApp.$nextTick(() => {
        requestAnimationFrame(resolve)
      })
    })

    // 6. 标记应用就绪
    const appElement = document.querySelector('.extension-popup')
    if (appElement) {
      appElement.classList.add('app-ready')
    }

    // 7. 应用就绪回调
    const loadTime = performance.now() - startTime
    console.log(`✅ 测试应用加载完成 (${loadTime.toFixed(2)}ms)`)

  } catch (error) {
    console.error('❌ 测试应用初始化失败:', error)

    // 显示浏览器不支持的提示
    document.body.innerHTML = `
      <div style="
        display: flex; 
        justify-content: center; 
        align-items: center; 
        min-height: 100vh; 
        text-align: center; 
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          background: #fff3cd; 
          border: 1px solid #ffeaa7; 
          border-radius: 8px; 
          padding: 30px; 
          color: #856404;
          max-width: 500px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        ">
          <h2 style="margin: 0 0 16px 0; color: #856404;">浏览器不支持</h2>
          <p style="margin: 0 0 16px 0; line-height: 1.5;">
            ${error.message}
          </p>
          <p style="margin: 0; line-height: 1.5;">
            请使用 <strong>Chrome 138或更高版本</strong> 来测试翻译功能。
          </p>
          <div style="margin-top: 20px;">
            <button onclick="location.reload()" style="
              background: #409eff;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            ">重新加载</button>
          </div>
        </div>
      </div>
    `

    // 记录错误
    window.errorLog.push({
      type: 'init-error',
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
    })
  }
}

// 启动测试应用
initializeTestApp()