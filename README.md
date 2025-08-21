# Chrome AI翻译扩展

基于Chrome内置Translator API的简约翻译浏览器扩展，使用Vite + Vue 3构建。

## 功能特性

- 🚀 使用Chrome内置Translator API，完全离线工作
- 🎯 网页文本选择翻译，支持划词翻译弹窗（点击图标后，等待翻译完成再显示结果弹窗）
- 🧠 划词自动检测源语言（LanguageDetector），目标语言与面板一致
- 🔁 源语言与目标语言一致时，直接返回原文，跳过翻译调用
- 🌐 全文翻译功能，在原文右侧追加译文
- 👀 可视区域翻译（IntersectionObserver）：仅在元素进入可视区域时触发翻译，结合 MutationObserver 处理新增节点，并发受控，性能更优
- 🖱️ 右键菜单集成，快速翻译选中文本或整个页面
- 📝 流式翻译支持，实时显示翻译进度
- 💾 翻译历史记录管理，支持详情查看
- 🎛️ 独立翻译面板，提供完整翻译界面
- 🎨 简约朴素的UI设计，420px固定宽度
- ⚙️ 语言偏好配置
- 🔒 隐私保护，所有翻译在本地完成

## 技术栈

- **构建工具**: Vite 5.x
- **前端框架**: Vue 3 (Composition API + `<script setup>`)
- **UI设计**: 自定义组件库（Element Plus风格）
- **翻译API**: Chrome内置Translator API
- **扩展规范**: Chrome Extension Manifest V3

## 项目结构

```
chrome-ai-translator/
├── index.html                   # Web开发入口页面
├── manifest.json                # Chrome扩展配置文件
├── src/
│   ├── test/                   # 测试目录 (扩展构建时排除)
│   │   ├── main.js             # Web开发主入口
│   │   └── App.vue             # 测试应用组件 (420px宽度)
│   ├── popup/                  # 扩展弹窗UI
│   │   ├── index.html
│   │   ├── main.js
│   │   ├── App.vue
│   │   └── components/         # Vue组件
│   ├── content/                # 内容脚本
│   │   └── content-script.js
│   ├── background/             # 后台服务
│   │   └── service-worker.js
│   ├── shared/                 # 共享模块
│   │   ├── translator.js       # 简化的翻译服务
│   │   └── storage.js
│   └── styles/                 # 简约样式系统
│       └── index.css
├── public/
│   └── icons/                  # 扩展图标
└── dist/                       # 构建输出目录
```

## 开发命令

```bash
# 安装依赖
npm install

# Web开发模式 (测试UI和功能)
npm run dev

# 预览Web版本
npm run preview

# 构建Chrome扩展
npm run build:extension

# 开发版扩展构建
npm run build:extension:dev

# 一键完整构建扩展包 (推荐)
npm run build:complete

# 完整构建和验证
npm run build:full
```

## 安装扩展

### 方式一：一键构建安装（推荐）
1. 运行 `npm run build:complete` 一键构建扩展包
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `extension-build` 目录

### 方式二：传统构建
1. 运行 `npm run build:extension` 构建扩展
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `dist` 目录

## 浏览器要求

- Chrome 138或更高版本（支持内置Translator API）
- 需要启用实验性Web平台功能（chrome://flags/#enable-experimental-web-platform-features）

### 开发流程
1. 在 `src/test/` 目录中开发和测试UI组件
2. 使用 `npm run dev` 启动Web开发服务器（端口3000）
3. 在Chrome浏览器中访问 `http://localhost:3000` 验证功能
4. **UI完全对齐**：测试页面的显示效果与扩展popup完全一致
5. 使用 `npm run validate:ui` 验证UI对齐状态
6. 使用 `npm run build:extension` 构建Chrome扩展
7. 测试目录在扩展构建时会被自动排除

## 开发进度

- [x] 项目初始化和基础配置
- [x] 核心翻译服务实现 (简化版)
- [x] 流式翻译功能
- [x] 存储管理器
- [x] UI组件开发 (简约风格)
- [x] 测试环境搭建
- [x] 构建配置优化

## 性能策略（可视区域翻译）
- IO + MutationObserver：在元素进入或即将进入视区时才触发翻译，动态节点通过 MutationObserver 入队
- 分帧/分批：优先 requestIdleCallback，回退 requestAnimationFrame；每帧时间预算约 6ms；每批最多处理约 200 个元素，避免主线程长任务
- 先粗后细：预筛采用 textContent.length、offsetWidth/offsetHeight 等廉价检查；仅对预筛通过的候选再做 innerText/getComputedStyle 严格检查
- 局部扫描：初次与 DOM 变更均将“子树根”入队，按帧在局部范围内 querySelectorAll，避免全页一次性扫描
- 并发与限流：翻译并发默认 2；候选数量大时按帧逐步消化，降低瞬时压力
- 可调参数：threshold、rootMargin、minLen/maxLen、timeBudgetMs、maxPerSlice 可按站点类型与设备性能微调

## 许可证

MIT License
