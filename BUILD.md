# Chrome AI翻译扩展 - 构建配置文档

## 概述

本文档描述了Chrome AI翻译扩展的完整构建配置和打包优化策略。

## 构建架构

### 技术栈
- **构建工具**: Vite 5.x
- **前端框架**: Vue 3 (Composition API + `<script setup>`)
- **扩展规范**: Chrome Extension Manifest V3
- **样式**: CSS3 + CSS变量主题系统
- **模块系统**: ES Modules

### 构建目标
- **主要目标**: Chrome 88+
- **推荐版本**: Chrome 138+ (支持内置AI翻译)
- **兼容性**: Manifest V3规范

## 构建配置

### 1. Vite配置 (`vite.config.js`)

#### 入口点配置
```javascript
input: {
  popup: 'src/popup/index.html',           // 弹窗界面
  'content-script': 'src/content/content-script.js',  // 内容脚本
  'service-worker': 'src/background/service-worker.js' // 后台脚本
}
```

#### 代码分割策略
- **Vue框架**: 单独分包 (`vue-vendor`)
- **第三方库**: 通用vendor包 (`vendor`)
- **核心共享模块**: 翻译器和存储 (`core-shared`)
- **工具模块**: 懒加载和自动更新 (`utils-shared`)
- **UI组件**: 按功能分组 (`translation-components`, `ui-components`)

#### 输出配置
```javascript
entryFileNames: (chunkInfo) => {
  // Chrome扩展脚本不使用hash
  if (chunkInfo.name === 'content-script' || chunkInfo.name === 'service-worker') {
    return '[name].js';
  }
  return isProduction ? 'assets/[name]-[hash].js' : 'assets/[name].js';
}
```

### 2. 生产环境优化

#### 代码压缩
- **JavaScript**: Terser压缩
  - 移除console.log和debugger
  - 变量名混淆
  - 死代码消除
- **CSS**: 内置CSS压缩
- **JSON**: 字符串化优化

#### 资源优化
- **内联阈值**: 4KB以下资源内联
- **图片优化**: 自动复制和验证图标文件
- **字体优化**: 按需加载字体文件

### 3. Chrome扩展特定优化

#### 文件结构适配
```
dist/
├── manifest.json          # 扩展清单
├── popup.html            # 弹窗页面
├── content-script.js     # 内容脚本
├── service-worker.js     # 后台脚本
├── icons/               # 图标文件
├── _locales/           # 本地化文件
└── assets/             # 静态资源
```

#### CSP兼容性
- 移除内联样式和脚本
- 使用外部CSS文件
- 避免eval和动态代码执行

## 构建脚本

### 1. 开发构建
```bash
npm run dev                  # 开发服务器
npm run build:extension:dev  # 开发环境扩展构建
```

### 2. 生产构建
```bash
npm run build:extension      # 标准扩展构建
npm run build:complete       # 一键完整构建（推荐）
npm run build:full          # 完整构建流程（优化+构建+验证+分析）
```

### 3. 质量检查
```bash
npm run validate     # 构建验证
npm run analyze      # 构建分析
npm run optimize     # 资源优化
```

## 自动化流程

### 1. 一键构建流程 (`scripts/build-extension.js`) - 新增

1. **环境清理**: 清理旧的构建文件和临时目录
2. **Vite构建**: 执行Chrome扩展构建
3. **文件验证**: 验证所有必需文件存在
4. **扩展打包**: 创建extension-build目录并复制文件
5. **版本同步**: 自动更新manifest.json版本号
6. **构建验证**: 运行扩展验证脚本
7. **构建报告**: 生成详细的构建报告和大小统计

### 2. 传统构建流程 (`scripts/build-production.js`)

1. **Vite构建**: 执行基础构建
2. **产物优化**: 压缩JSON、优化manifest
3. **资源映射**: 生成文件映射表
4. **更新配置**: 生成自动更新配置
5. **构建验证**: 验证构建完整性
6. **构建报告**: 生成详细报告

### 2. 资源优化 (`scripts/optimize-resources.js`)

1. **图标检查**: 验证图标文件存在和大小
2. **本地化优化**: 压缩和验证翻译文件
3. **资源清单**: 生成资源映射文件
4. **配置验证**: 检查扩展配置完整性

### 3. 构建分析 (`scripts/analyze-bundle.js`)

1. **文件大小分析**: 统计各类文件大小
2. **代码分割分析**: 分析chunk分布
3. **依赖关系分析**: 检查重复依赖
4. **性能建议**: 生成优化建议

### 4. 构建验证 (`scripts/validate-build.js`)

1. **文件完整性**: 检查必需文件存在
2. **Manifest验证**: 验证扩展清单正确性
3. **权限检查**: 验证权限配置合理性
4. **本地化验证**: 检查翻译文件完整性

## 性能优化

### 1. 代码分割
- **按需加载**: 使用动态import
- **组件懒加载**: 非关键组件延迟加载
- **路由分割**: 按功能模块分割代码

### 2. 懒加载系统 (`src/shared/lazy-loader.js`)

#### 功能特性
- **智能预加载**: 基于用户行为预测
- **缓存管理**: 自动清理未使用模块
- **性能监控**: 加载时间和成功率统计
- **网络感知**: 根据网络状况调整策略

#### 使用示例
```javascript
// 懒加载组件
const LazyComponent = lazyLoader.loadComponent(
  'ComponentName',
  () => import('./Component.vue')
);

// 预加载模块
await lazyLoader.preloadModule(
  'ModuleName',
  () => import('./module.js'),
  'high' // 优先级
);
```

### 3. 自动更新系统 (`src/shared/auto-updater.js`)

#### 功能特性
- **自动检查**: 定期检查扩展更新
- **用户通知**: 更新可用时通知用户
- **智能重启**: 可配置的自动重启策略
- **更新历史**: 记录更新历史和统计

#### 配置选项
```javascript
{
  autoUpdate: true,        // 自动检查更新
  autoRestart: false,      // 自动重启应用更新
  restartDelay: 30000,     // 重启延迟时间
  updateNotifications: true // 显示更新通知
}
```

## 构建优化建议

### 1. 文件大小控制
- **Content Script**: < 100KB
- **Service Worker**: < 50KB
- **Popup HTML**: < 20KB
- **图标文件**: 16px<2KB, 48px<8KB, 128px<20KB

### 2. 性能最佳实践
- 使用代码分割减少初始加载
- 启用懒加载提升响应速度
- 压缩和优化所有资源文件
- 移除开发环境代码和调试信息

### 3. Chrome扩展优化
- 最小化权限请求
- 使用Manifest V3最新特性
- 优化后台脚本性能
- 实现高效的消息传递

## 部署配置

### 1. 环境变量
```bash
NODE_ENV=production      # 生产环境标识
UPDATE_URL=https://...   # 自动更新URL
CHROME_EXTENSION_ID=...  # 扩展ID
```

### 2. 构建产物
```
dist/
├── manifest.json        # 扩展清单文件
├── popup.html          # 弹窗页面
├── *.js               # 脚本文件
├── assets/            # 静态资源
├── icons/             # 图标文件
├── _locales/          # 本地化文件
├── update-config.json # 更新配置
├── asset-map.json     # 资源映射
└── build-report.json  # 构建报告
```

### 3. 发布检查清单
- [ ] 构建验证通过
- [ ] 文件大小符合要求
- [ ] 权限配置最小化
- [ ] 本地化文件完整
- [ ] 图标文件正确
- [ ] 更新配置生成
- [ ] 性能测试通过

## 故障排除

### 1. 常见构建问题
- **模块解析失败**: 检查路径别名配置
- **CSS加载错误**: 验证CSS文件路径
- **权限错误**: 检查manifest.json权限配置

### 2. 性能问题
- **加载缓慢**: 启用代码分割和懒加载
- **内存占用高**: 清理未使用的模块缓存
- **包体积过大**: 分析依赖关系，移除重复代码

### 3. 调试工具
```bash
npm run analyze      # 分析构建产物
npm run validate     # 验证构建结果
node scripts/analyze-bundle.js  # 详细分析
```

## 版本管理

### 1. 版本号规则
- 遵循语义化版本 (Semantic Versioning)
- 主版本.次版本.修订版本 (1.0.0)
- 自动同步package.json和manifest.json

### 2. 更新策略
- **补丁更新**: 错误修复，自动应用
- **次版本更新**: 新功能，用户确认
- **主版本更新**: 重大变更，手动更新

### 3. 回滚机制
- 保留更新历史记录
- 支持版本回滚
- 错误恢复策略

---

## 总结

本构建配置实现了：
- ✅ 完整的代码分割和懒加载
- ✅ 生产环境代码压缩和优化
- ✅ Chrome扩展特定的构建适配
- ✅ 自动更新机制和配置
- ✅ 全面的构建验证和分析
- ✅ 性能监控和优化建议

通过这套构建配置，Chrome AI翻译扩展能够实现最佳的性能表现和用户体验。