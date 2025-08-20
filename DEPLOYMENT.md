# Chrome AI 翻译器 - 部署指南

## 版本 1.1.0 更新说明

### 主要变更
- 简化UI设计，采用简约朴素风格
- 固定420px宽度，优化布局
- 新增测试目录用于Web端调试
- 简化翻译服务，专注Translator API
- 构建优化，自动排除测试目录

## 开发流程

### 1. Web开发测试阶段
```bash
# 启动Web开发服务器
npm run dev
```

在Chrome浏览器中打开 `http://localhost:3000` 进行UI和功能测试。

**开发流程说明：**
1. 在 `src/test/` 目录中开发和测试UI组件
   - `src/test/main.js` - Web开发入口
   - `src/test/App.vue` - 测试应用组件
2. 整个 `src/test/` 目录在扩展构建时会被自动排除

### 2. 扩展构建阶段
```bash
# 完整构建和验证
npm run build:full
```

这将执行：
- 资源优化
- Chrome扩展构建
- 构建验证
- 扩展构建验证（确保test目录被排除）
- 包分析

### 3. 扩展安装
1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `dist` 目录

## 构建验证

构建完成后会自动验证：
- ✅ 测试目录已排除
- ✅ 必要文件存在
- ✅ 文件大小合理
- ✅ 代码压缩正常

## 浏览器要求

- Chrome 138+ (支持Translator API)
- 需要启用实验性功能：`chrome://flags/#enable-experimental-web-platform-features`

## 文件结构

构建后的 `dist` 目录结构：
```
dist/
├── manifest.json           # 扩展配置
├── popup.html             # 弹窗页面
├── service-worker.js      # 后台服务
├── content-script.js      # 内容脚本
├── assets/               # 静态资源
│   ├── popup-[hash].js   # 弹窗脚本
│   └── popup-[hash].css  # 样式文件
├── icons/                # 扩展图标
└── _locales/            # 本地化文件
```

## 注意事项

1. **测试目录排除**: `src/test/` 目录在扩展构建时会被自动排除
2. **双模式开发**: 支持Web开发模式和扩展构建模式
3. **API支持**: 确保目标Chrome版本支持Translator API
4. **权限配置**: 扩展只请求必要的权限
5. **离线工作**: 所有翻译功能完全离线运行

## 故障排除

### 构建失败
- 检查Node.js版本 (推荐16+)
- 清理依赖: `rm -rf node_modules && npm install`
- 清理构建: `npm run clean && npm run build`

### 扩展加载失败
- 检查manifest.json语法
- 确认所有必要文件存在
- 查看Chrome扩展页面的错误信息

### 翻译功能不工作
- 确认Chrome版本138+
- 启用实验性Web平台功能
- 检查浏览器控制台错误信息