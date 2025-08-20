# 开发指南

## 项目结构说明

这个项目支持两种开发模式：

### 1. Web开发模式
用于快速开发和测试UI组件，无需构建Chrome扩展。

**入口文件：** `src/test/main.js`  
**主组件：** `src/test/App.vue`  
**启动命令：** `npm run dev`  
**访问地址：** `http://localhost:3000`

### 2. Chrome扩展模式
构建实际的Chrome扩展。

**入口文件：** `src/popup/main.js`  
**主组件：** `src/popup/App.vue`  
**构建命令：** `npm run build:extension`  
**输出目录：** `dist/`

## 开发流程

### 步骤1：Web开发测试
```bash
# 启动开发服务器
npm run dev

# 在Chrome浏览器中打开 http://localhost:3000
# 测试UI和翻译功能（需要Chrome 138+）
```

### 步骤2：扩展构建
```bash
# 构建Chrome扩展
npm run build:extension

# 或者完整构建和验证
npm run build:full
```

### 步骤3：扩展安装测试
1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `dist` 目录

## 目录说明

```
src/
├── test/                    # Web开发测试目录
│   ├── main.js             # Web开发入口
│   ├── App.vue             # 测试应用组件
│   └── README.md           # 测试目录说明
├── popup/                  # Chrome扩展弹窗
│   ├── main.js             # 扩展弹窗入口
│   ├── App.vue             # 扩展弹窗组件
│   ├── index.html          # 弹窗HTML
│   └── components/         # Vue组件
├── shared/                 # 共享模块
│   ├── translator.js       # 翻译服务
│   └── storage.js          # 存储管理
└── styles/                 # 样式文件
    └── index.css           # 主样式文件
```

## 重要说明

1. **测试目录排除**：`src/test/` 目录在扩展构建时会被自动排除
2. **路径引用**：test目录中的文件使用相对路径引用其他模块
3. **API支持**：需要Chrome 138+版本才能使用Translator API
4. **样式系统**：使用简约的CSS变量系统，420px固定宽度

## 常用命令

```bash
# 安装依赖
npm install

# Web开发模式
npm run dev

# 构建Chrome扩展
npm run build:extension

# 开发版扩展构建
npm run build:extension:dev

# 完整构建和验证
npm run build:full

# 预览Web版本
npm run preview

# 清理构建文件
npm run clean
```

## 故障排除

### 浏览器不支持
- 确保使用Chrome 138或更高版本
- 启用实验性Web平台功能：`chrome://flags/#enable-experimental-web-platform-features`

### 构建失败
- 检查Node.js版本（推荐16+）
- 清理依赖：`rm -rf node_modules && npm install`
- 清理构建：`npm run clean && npm run build:extension`

### 翻译功能不工作
- 检查浏览器控制台错误信息
- 确认Translator API可用性
- 验证语言对支持情况