# 扩展图标

此目录包含Chrome扩展所需的图标文件：

- `icon-16.png` - 16x16像素，用于扩展管理页面和工具栏
- `icon-48.png` - 48x48像素，用于扩展管理页面
- `icon-128.png` - 128x128像素，用于Chrome Web Store和应用详情页
- `icon-design.svg` - 矢量图标设计源文件

## 图标设计说明

### 设计理念
- **主色调**: 使用Element Plus风格的主蓝色 (#409eff)
- **核心元素**: 双文档 + 箭头 + AI标识
- **视觉隐喻**: 左右两个文档代表源语言和目标语言，中间箭头表示翻译转换，底部AI标识突出智能翻译特性

### 设计元素
1. **背景圆形**: 蓝色渐变圆形背景，提供良好的视觉识别度
2. **文档图标**: 左右两个白色文档，内含文本线条
3. **转换箭头**: 白色箭头指向右侧，表示翻译方向
4. **AI标识**: 底部圆形内的"AI"文字，突出AI翻译特性
5. **装饰元素**: 小圆点装饰，增加视觉层次

### 颜色规范
- **主色**: #409eff (Element Plus主蓝色)
- **深色**: #337ecc (边框和强调色)
- **白色**: #ffffff (文档和箭头)
- **透明度**: 使用不同透明度营造层次感

## 图标生成指南

### 从SVG生成PNG图标

使用以下方法将SVG转换为所需尺寸的PNG文件：

#### 方法1: 使用在线工具
1. 访问 https://convertio.co/svg-png/ 或类似在线转换工具
2. 上传 `icon-design.svg` 文件
3. 设置输出尺寸：128x128, 48x48, 16x16
4. 下载生成的PNG文件

#### 方法2: 使用命令行工具 (需要安装ImageMagick)
```bash
# 生成128x128图标
magick icon-design.svg -resize 128x128 icon-128.png

# 生成48x48图标  
magick icon-design.svg -resize 48x48 icon-48.png

# 生成16x16图标
magick icon-design.svg -resize 16x16 icon-16.png
```

#### 方法3: 使用Node.js脚本
```javascript
const sharp = require('sharp');
const fs = require('fs');

const sizes = [16, 48, 128];
const svgBuffer = fs.readFileSync('icon-design.svg');

sizes.forEach(size => {
  sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(`icon-${size}.png`)
    .then(() => console.log(`Generated icon-${size}.png`));
});
```

## 图标使用规范

### Chrome扩展中的使用
- **16x16**: 扩展工具栏图标，需要在小尺寸下保持清晰
- **48x48**: 扩展管理页面，中等尺寸显示
- **128x128**: Chrome Web Store展示，需要精美细致

### 设计原则
- **简洁性**: 在16x16像素下仍能清晰识别
- **一致性**: 与应用整体设计风格保持一致
- **识别性**: 独特的视觉特征，易于用户识别
- **适配性**: 在不同背景下都有良好的对比度

## 更新记录

- 2024-01-XX: 创建SVG设计源文件
- 2024-01-XX: 完善图标设计说明和生成指南