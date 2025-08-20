#!/usr/bin/env node

/**
 * 生产环境构建脚本
 * 包含代码压缩、资源优化、自动更新配置等功能
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const rootDir = resolve(__dirname, '..');

class ProductionBuilder {
  constructor() {
    this.distDir = join(rootDir, 'dist');
    this.packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
    this.buildStats = {
      startTime: Date.now(),
      files: {},
      totalSize: 0,
      compressionRatio: 0,
    };
  }

  /**
   * 执行完整的生产构建流程
   */
  async build() {
    console.log('🚀 开始生产环境构建后处理...');
    console.log(`📦 版本: ${this.packageJson.version}`);
    
    try {
      // 检查构建目录是否存在
      if (!existsSync(this.distDir)) {
        console.error('❌ 构建目录不存在，请先运行 npm run build');
        process.exit(1);
      }
      
      // 1. 优化构建产物
      await this.optimizeBuild();
      
      // 2. 生成自动更新配置
      await this.generateUpdateConfig();
      
      // 3. 验证构建结果
      await this.validateBuild();
      
      // 4. 生成构建报告
      await this.generateBuildReport();
      
      console.log('✅ 生产环境构建后处理完成！');
      this.printBuildStats();
      
    } catch (error) {
      console.error('❌ 构建后处理失败:', error);
      process.exit(1);
    }
  }

  /**
   * 运行Vite构建
   */
  async runViteBuild() {
    console.log('🔨 执行Vite构建...');
    
    try {
      execSync('npm run build', { 
        stdio: 'inherit',
        cwd: rootDir,
        env: { ...process.env, NODE_ENV: 'production' }
      });
      console.log('✅ Vite构建完成');
    } catch (error) {
      throw new Error(`Vite构建失败: ${error.message}`);
    }
  }

  /**
   * 优化构建产物
   */
  async optimizeBuild() {
    console.log('⚡ 优化构建产物...');
    
    // 1. 压缩JSON文件
    await this.compressJsonFiles();
    
    // 2. 优化manifest.json
    await this.optimizeManifest();
    
    // 3. 生成资源映射
    await this.generateAssetMap();
    
    // 4. 检查文件大小
    await this.checkFileSizes();
    
    console.log('✅ 构建产物优化完成');
  }

  /**
   * 压缩JSON文件
   */
  async compressJsonFiles() {
    const jsonFiles = this.findFiles(this.distDir, '.json');
    
    jsonFiles.forEach(filePath => {
      try {
        const content = readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(content);
        const compressed = JSON.stringify(parsed);
        
        const originalSize = Buffer.byteLength(content, 'utf8');
        const compressedSize = Buffer.byteLength(compressed, 'utf8');
        const savings = originalSize - compressedSize;
        
        if (savings > 0) {
          writeFileSync(filePath, compressed);
          console.log(`  📄 ${filePath.replace(this.distDir, '')}: 节省 ${savings} 字节`);
        }
      } catch (error) {
        console.warn(`⚠️  无法压缩 ${filePath}: ${error.message}`);
      }
    });
  }

  /**
   * 优化manifest.json
   */
  async optimizeManifest() {
    const manifestPath = join(this.distDir, 'manifest.json');
    
    if (!existsSync(manifestPath)) {
      throw new Error('manifest.json 不存在');
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    
    // 添加更新URL（如果配置了）
    if (process.env.UPDATE_URL) {
      manifest.update_url = process.env.UPDATE_URL;
    }
    
    // 确保版本号正确
    manifest.version = this.packageJson.version;
    
    // 移除开发环境的配置
    delete manifest.key;
    delete manifest.oauth2;
    
    // 优化权限（移除不必要的权限）
    if (manifest.permissions) {
      manifest.permissions = manifest.permissions.filter(permission => {
        // 保留必要权限
        const requiredPermissions = ['storage', 'activeTab', 'contextMenus', 'scripting'];
        return requiredPermissions.includes(permission);
      });
    }

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('✅ manifest.json 已优化');
  }

  /**
   * 生成资源映射
   */
  async generateAssetMap() {
    const assetMap = {
      version: this.packageJson.version,
      buildTime: new Date().toISOString(),
      files: {},
      chunks: {},
    };

    // 扫描所有文件
    const allFiles = this.findFiles(this.distDir, null);
    
    allFiles.forEach(filePath => {
      const relativePath = filePath.replace(this.distDir + '/', '');
      const stats = statSync(filePath);
      
      assetMap.files[relativePath] = {
        size: stats.size,
        modified: stats.mtime.toISOString(),
      };

      // 识别chunk文件
      if (relativePath.includes('chunk-') || relativePath.includes('vendor')) {
        assetMap.chunks[relativePath] = {
          size: stats.size,
          type: this.getChunkType(relativePath),
        };
      }
    });

    writeFileSync(
      join(this.distDir, 'asset-map.json'),
      JSON.stringify(assetMap, null, 2)
    );
    
    console.log('✅ 资源映射已生成');
  }

  /**
   * 检查文件大小
   */
  async checkFileSizes() {
    const sizeWarnings = [];
    const maxSizes = {
      'content-script.js': 100 * 1024, // 100KB
      'service-worker.js': 50 * 1024,  // 50KB
      'popup.html': 20 * 1024,         // 20KB
    };

    Object.entries(maxSizes).forEach(([filename, maxSize]) => {
      const filePath = join(this.distDir, filename);
      if (existsSync(filePath)) {
        const stats = statSync(filePath);
        if (stats.size > maxSize) {
          sizeWarnings.push({
            file: filename,
            size: stats.size,
            maxSize,
            ratio: (stats.size / maxSize).toFixed(2),
          });
        }
      }
    });

    if (sizeWarnings.length > 0) {
      console.warn('⚠️  文件大小警告:');
      sizeWarnings.forEach(warning => {
        console.warn(`  ${warning.file}: ${(warning.size/1024).toFixed(1)}KB (超出 ${warning.ratio}x)`);
      });
    }
  }

  /**
   * 生成自动更新配置
   */
  async generateUpdateConfig() {
    console.log('🔄 生成自动更新配置...');
    
    const updateConfig = {
      version: this.packageJson.version,
      updateUrl: process.env.UPDATE_URL || '',
      releaseNotes: {
        zh_CN: '性能优化和错误修复',
        en: 'Performance improvements and bug fixes',
      },
      minimumChromeVersion: '138',
      features: [
        'Chrome内置AI翻译',
        '流式翻译支持',
        '离线翻译能力',
        '多语言界面',
        '代码分割优化',
        '懒加载支持',
        '自动更新机制',
      ],
      changelog: this.generateChangelog(),
      buildInfo: {
        buildTime: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      performance: {
        bundleSize: await this.calculateBundleSize(),
        chunkCount: await this.countChunks(),
        compressionRatio: await this.calculateCompressionRatio(),
      },
    };

    writeFileSync(
      join(this.distDir, 'update-config.json'),
      JSON.stringify(updateConfig, null, 2)
    );
    
    console.log('✅ 自动更新配置已生成');
  }

  /**
   * 生成更新日志
   */
  generateChangelog() {
    // 这里可以从git提交或CHANGELOG.md文件读取
    return {
      [this.packageJson.version]: {
        date: new Date().toISOString().split('T')[0],
        changes: [
          '优化构建配置和打包流程',
          '改进代码分割和懒加载',
          '增强生产环境性能',
          '完善自动更新机制',
        ],
      },
    };
  }

  /**
   * 验证构建结果
   */
  async validateBuild() {
    console.log('🔍 验证构建结果...');
    
    const requiredFiles = [
      'manifest.json',
      'popup.html',
      'content-script.js',
      'service-worker.js',
    ];

    const missingFiles = requiredFiles.filter(file => 
      !existsSync(join(this.distDir, file))
    );

    if (missingFiles.length > 0) {
      throw new Error(`缺少必需文件: ${missingFiles.join(', ')}`);
    }

    // 验证manifest.json
    const manifest = JSON.parse(readFileSync(join(this.distDir, 'manifest.json'), 'utf8'));
    if (manifest.version !== this.packageJson.version) {
      throw new Error('manifest.json版本号不匹配');
    }

    console.log('✅ 构建结果验证通过');
  }

  /**
   * 生成构建报告
   */
  async generateBuildReport() {
    const buildTime = Date.now() - this.buildStats.startTime;
    
    const report = {
      version: this.packageJson.version,
      buildTime: `${(buildTime / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString(),
      files: {},
      summary: {
        totalFiles: 0,
        totalSize: 0,
        jsFiles: 0,
        cssFiles: 0,
        htmlFiles: 0,
        jsonFiles: 0,
        imageFiles: 0,
      },
    };

    // 统计文件信息
    const allFiles = this.findFiles(this.distDir, null);
    
    allFiles.forEach(filePath => {
      const relativePath = filePath.replace(this.distDir + '/', '');
      const stats = statSync(filePath);
      const ext = filePath.split('.').pop().toLowerCase();
      
      report.files[relativePath] = {
        size: stats.size,
        sizeKB: (stats.size / 1024).toFixed(2),
        type: ext,
      };

      report.summary.totalFiles++;
      report.summary.totalSize += stats.size;

      // 按类型统计
      if (ext === 'js') report.summary.jsFiles++;
      else if (ext === 'css') report.summary.cssFiles++;
      else if (ext === 'html') report.summary.htmlFiles++;
      else if (ext === 'json') report.summary.jsonFiles++;
      else if (['png', 'jpg', 'svg', 'ico'].includes(ext)) report.summary.imageFiles++;
    });

    report.summary.totalSizeKB = (report.summary.totalSize / 1024).toFixed(2);
    report.summary.totalSizeMB = (report.summary.totalSize / 1024 / 1024).toFixed(2);

    writeFileSync(
      join(this.distDir, 'build-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('✅ 构建报告已生成');
  }

  /**
   * 打印构建统计
   */
  printBuildStats() {
    const buildTime = Date.now() - this.buildStats.startTime;
    const allFiles = this.findFiles(this.distDir, null);
    const totalSize = allFiles.reduce((sum, file) => sum + statSync(file).size, 0);
    
    console.log('\n📊 构建统计');
    console.log('='.repeat(50));
    console.log(`⏱️  构建时间: ${(buildTime / 1000).toFixed(2)}s`);
    console.log(`📁 文件数量: ${allFiles.length}`);
    console.log(`📦 总大小: ${(totalSize / 1024).toFixed(2)}KB`);
    console.log(`🎯 版本: ${this.packageJson.version}`);
    console.log(`📍 输出目录: ${this.distDir}`);
    
    // 显示主要文件大小
    const mainFiles = ['content-script.js', 'service-worker.js', 'popup.html'];
    console.log('\n📋 主要文件:');
    mainFiles.forEach(file => {
      const filePath = join(this.distDir, file);
      if (existsSync(filePath)) {
        const size = statSync(filePath).size;
        console.log(`  ${file}: ${(size / 1024).toFixed(2)}KB`);
      }
    });
  }

  /**
   * 查找指定扩展名的文件
   */
  findFiles(dir, ext) {
    const files = [];
    
    const scan = (currentDir) => {
      const items = readdirSync(currentDir);
      
      items.forEach(item => {
        const fullPath = join(currentDir, item);
        const stats = statSync(fullPath);
        
        if (stats.isDirectory()) {
          scan(fullPath);
        } else if (!ext || fullPath.endsWith(ext)) {
          files.push(fullPath);
        }
      });
    };
    
    scan(dir);
    return files;
  }

  /**
   * 获取chunk类型
   */
  getChunkType(filename) {
    if (filename.includes('vendor')) return 'vendor';
    if (filename.includes('vue')) return 'framework';
    if (filename.includes('shared')) return 'shared';
    return 'chunk';
  }

  /**
   * 计算bundle总大小
   */
  async calculateBundleSize() {
    const files = this.findFiles(this.distDir, null);
    const totalSize = files.reduce((sum, file) => {
      return sum + statSync(file).size;
    }, 0);
    
    return {
      bytes: totalSize,
      kb: (totalSize / 1024).toFixed(2),
      mb: (totalSize / 1024 / 1024).toFixed(2),
    };
  }

  /**
   * 统计chunk数量
   */
  async countChunks() {
    const jsFiles = this.findFiles(this.distDir, '.js');
    const cssFiles = this.findFiles(this.distDir, '.css');
    
    return {
      total: jsFiles.length + cssFiles.length,
      js: jsFiles.length,
      css: cssFiles.length,
    };
  }

  /**
   * 计算压缩比率
   */
  async calculateCompressionRatio() {
    // 这里可以实现gzip压缩比率计算
    // 简化版本，返回估算值
    return {
      estimated: '65%',
      note: 'Estimated compression ratio for gzip',
    };
  }
}

// 运行构建
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  const builder = new ProductionBuilder();
  builder.build().catch(console.error);
}

export default ProductionBuilder;