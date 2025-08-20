#!/usr/bin/env node

import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

console.log('🚀 开始构建Chrome AI翻译扩展...\n');

// 递归复制目录的函数
function copyDirectory(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  
  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// 1. 清理旧的构建文件
console.log('🧹 清理旧的构建文件...');
if (existsSync('dist')) {
  rmSync('dist', { recursive: true, force: true });
}
if (existsSync('extension-build')) {
  rmSync('extension-build', { recursive: true, force: true });
}

// 2. 运行构建
console.log('🔨 开始构建扩展...');
try {
  execSync('npm run build:extension', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
}

// 3. 验证构建结果
console.log('\n🔍 验证构建结果...');
const requiredFiles = [
  'dist/manifest.json',
  'dist/popup.html',
  'dist/content-script.js',
  'dist/service-worker.js',
  'dist/icons/icon-16.png',
  'dist/icons/icon-48.png',
  'dist/icons/icon-128.png',
  'dist/_locales/zh_CN/messages.json',
  'dist/_locales/en/messages.json'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`❌ 缺少必需文件: ${file}`);
    allFilesExist = false;
  } else {
    console.log(`✓ ${file}`);
  }
}

if (!allFilesExist) {
  console.error('\n❌ 构建验证失败，缺少必需文件');
  process.exit(1);
}

// 4. 创建最终的扩展包目录
console.log('\n📦 创建扩展包...');
mkdirSync('extension-build', { recursive: true });

// 复制所有必需文件到extension-build目录
const filesToCopy = [
  'dist/manifest.json',
  'dist/popup.html',
  'dist/content-script.js',
  'dist/service-worker.js'
];

filesToCopy.forEach(file => {
  const fileName = file.split('/').pop();
  copyFileSync(file, `extension-build/${fileName}`);
  console.log(`✓ 复制 ${fileName}`);
});

// 复制目录
const directoriesToCopy = [
  { src: 'dist/assets', dest: 'extension-build/assets' },
  { src: 'dist/icons', dest: 'extension-build/icons' },
  { src: 'dist/_locales', dest: 'extension-build/_locales' }
];

directoriesToCopy.forEach(({ src, dest }) => {
  if (existsSync(src)) {
    copyDirectory(src, dest);
    console.log(`✓ 复制 ${src.split('/').pop()} 目录`);
  }
});

// 5. 更新版本号
console.log('\n🔢 更新版本号...');
const manifestPath = 'extension-build/manifest.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.version = packageJson.version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`✓ 版本号已更新为 ${packageJson.version}`);

// 6. 生成构建报告
console.log('\n📊 生成构建报告...');

// 计算目录大小的函数
function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  try {
    const files = readdirSync(dirPath, { withFileTypes: true });
    for (const file of files) {
      const filePath = join(dirPath, file.name);
      if (file.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        const stats = statSync(filePath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.warn(`无法计算目录大小: ${dirPath}`);
  }
  
  return totalSize;
}

const buildReport = {
  version: packageJson.version,
  buildTime: new Date().toISOString(),
  files: requiredFiles.filter(file => existsSync(file)),
  size: {
    total: 0,
    breakdown: {}
  }
};

if (existsSync('extension-build')) {
  buildReport.size.total = getDirectorySize('extension-build');
}

writeFileSync('extension-build/build-report.json', JSON.stringify(buildReport, null, 2));

// 7. 显示完成信息
console.log('\n✅ 扩展构建完成！');
console.log('\n📁 构建输出:');
console.log(`   - extension-build/ (可直接加载到Chrome的扩展目录)`);
console.log('\n🔧 加载扩展:');
console.log('   1. 打开 Chrome 浏览器');
console.log('   2. 访问 chrome://extensions/');
console.log('   3. 开启"开发者模式"');
console.log('   4. 点击"加载已解压的扩展程序"');
console.log('   5. 选择 extension-build 目录');
console.log('\n🎉 享受AI翻译功能！');

// 8. 显示扩展大小信息
const totalSizeMB = (buildReport.size.total / 1024 / 1024).toFixed(2);
console.log(`\n📊 扩展大小: ${totalSizeMB} MB`);