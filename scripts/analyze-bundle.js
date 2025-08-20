#!/usr/bin/env node

/**
 * 构建分析脚本
 * 分析构建产物的大小、依赖关系和优化建议
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const rootDir = resolve(__dirname, '..');
const distDir = join(rootDir, 'dist');

class BundleAnalyzer {
  constructor() {
    this.distDir = distDir;
    this.analysis = {
      files: {},
      chunks: {},
      assets: {},
      dependencies: {},
      recommendations: [],
    };
  }

  /**
   * 执行完整的构建分析
   */
  async analyze() {
    console.log('📊 开始构建分析...');
    
    if (!existsSync(this.distDir)) {
      console.error('❌ 构建目录不存在，请先运行构建命令');
      process.exit(1);
    }

    try {
      // 1. 分析文件大小
      await this.analyzeFileSizes();
      
      // 2. 分析代码分割
      await this.analyzeCodeSplitting();
      
      // 3. 分析资源文件
      await this.analyzeAssets();
      
      // 4. 分析依赖关系
      await this.analyzeDependencies();
      
      // 5. 生成优化建议
      await this.generateRecommendations();
      
      // 6. 输出分析报告
      this.printAnalysisReport();
      
      console.log('✅ 构建分析完成');
      
    } catch (error) {
      console.error('❌ 构建分析失败:', error);
      process.exit(1);
    }
  }

  /**
   * 分析文件大小
   */
  async analyzeFileSizes() {
    console.log('📏 分析文件大小...');
    
    const files = this.getAllFiles(this.distDir);
    let totalSize = 0;
    
    files.forEach(filePath => {
      const relativePath = filePath.replace(this.distDir + '/', '');
      const stats = statSync(filePath);
      const ext = extname(filePath).toLowerCase();
      
      this.analysis.files[relativePath] = {
        size: stats.size,
        sizeKB: (stats.size / 1024).toFixed(2),
        sizeMB: (stats.size / 1024 / 1024).toFixed(3),
        type: this.getFileType(ext),
        extension: ext,
      };
      
      totalSize += stats.size;
    });

    this.analysis.totalSize = totalSize;
    this.analysis.totalSizeKB = (totalSize / 1024).toFixed(2);
    this.analysis.totalSizeMB = (totalSize / 1024 / 1024).toFixed(3);
    
    console.log(`  总大小: ${this.analysis.totalSizeKB}KB`);
  }

  /**
   * 分析代码分割
   */
  async analyzeCodeSplitting() {
    console.log('🔀 分析代码分割...');
    
    const jsFiles = Object.entries(this.analysis.files)
      .filter(([path, info]) => info.extension === '.js')
      .sort(([, a], [, b]) => b.size - a.size);

    jsFiles.forEach(([path, info]) => {
      const chunkType = this.identifyChunkType(path);
      
      if (!this.analysis.chunks[chunkType]) {
        this.analysis.chunks[chunkType] = {
          files: [],
          totalSize: 0,
          count: 0,
        };
      }
      
      this.analysis.chunks[chunkType].files.push({
        path,
        size: info.size,
        sizeKB: info.sizeKB,
      });
      
      this.analysis.chunks[chunkType].totalSize += info.size;
      this.analysis.chunks[chunkType].count++;
    });

    // 计算每个chunk类型的百分比
    Object.values(this.analysis.chunks).forEach(chunk => {
      chunk.percentage = ((chunk.totalSize / this.analysis.totalSize) * 100).toFixed(1);
      chunk.totalSizeKB = (chunk.totalSize / 1024).toFixed(2);
    });
  }

  /**
   * 分析资源文件
   */
  async analyzeAssets() {
    console.log('🖼️  分析资源文件...');
    
    const assetTypes = ['image', 'font', 'css', 'json', 'html'];
    
    assetTypes.forEach(type => {
      const files = Object.entries(this.analysis.files)
        .filter(([, info]) => info.type === type);
      
      if (files.length > 0) {
        const totalSize = files.reduce((sum, [, info]) => sum + info.size, 0);
        
        this.analysis.assets[type] = {
          count: files.length,
          totalSize,
          totalSizeKB: (totalSize / 1024).toFixed(2),
          percentage: ((totalSize / this.analysis.totalSize) * 100).toFixed(1),
          files: files.map(([path, info]) => ({
            path,
            size: info.size,
            sizeKB: info.sizeKB,
          })).sort((a, b) => b.size - a.size),
        };
      }
    });
  }

  /**
   * 分析依赖关系
   */
  async analyzeDependencies() {
    console.log('🔗 分析依赖关系...');
    
    try {
      const packageJsonPath = join(rootDir, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      this.analysis.dependencies = {
        production: packageJson.dependencies || {},
        development: packageJson.devDependencies || {},
        productionCount: Object.keys(packageJson.dependencies || {}).length,
        developmentCount: Object.keys(packageJson.devDependencies || {}).length,
      };
      
      // 分析可能的重复依赖
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      
      this.analysis.dependencies.duplicates = this.findPotentialDuplicates(allDeps);
      
    } catch (error) {
      console.warn('⚠️  无法分析依赖关系:', error.message);
    }
  }

  /**
   * 生成优化建议
   */
  async generateRecommendations() {
    console.log('💡 生成优化建议...');
    
    const recommendations = [];
    
    // 检查大文件
    const largeFiles = Object.entries(this.analysis.files)
      .filter(([, info]) => info.size > 100 * 1024) // 大于100KB
      .sort(([, a], [, b]) => b.size - a.size);
    
    if (largeFiles.length > 0) {
      recommendations.push({
        type: 'size',
        priority: 'high',
        title: '大文件优化',
        description: `发现 ${largeFiles.length} 个大于100KB的文件`,
        files: largeFiles.slice(0, 5).map(([path, info]) => `${path} (${info.sizeKB}KB)`),
        suggestion: '考虑代码分割、懒加载或压缩优化',
      });
    }

    // 检查未使用的chunk
    const smallChunks = Object.entries(this.analysis.chunks)
      .filter(([, chunk]) => chunk.totalSize < 10 * 1024 && chunk.count > 1); // 小于10KB但有多个文件
    
    if (smallChunks.length > 0) {
      recommendations.push({
        type: 'chunking',
        priority: 'medium',
        title: '代码分割优化',
        description: '发现过度分割的小chunk文件',
        suggestion: '考虑合并小的chunk文件以减少HTTP请求',
      });
    }

    // 检查图片优化
    const imageAssets = this.analysis.assets.image;
    if (imageAssets && imageAssets.totalSize > 50 * 1024) {
      recommendations.push({
        type: 'assets',
        priority: 'medium',
        title: '图片优化',
        description: `图片文件总大小: ${imageAssets.totalSizeKB}KB`,
        suggestion: '考虑使用WebP格式或压缩图片',
      });
    }

    // 检查CSS优化
    const cssAssets = this.analysis.assets.css;
    if (cssAssets && cssAssets.count > 3) {
      recommendations.push({
        type: 'css',
        priority: 'low',
        title: 'CSS优化',
        description: `发现 ${cssAssets.count} 个CSS文件`,
        suggestion: '考虑合并CSS文件或使用CSS-in-JS',
      });
    }

    // 检查依赖优化
    if (this.analysis.dependencies.duplicates.length > 0) {
      recommendations.push({
        type: 'dependencies',
        priority: 'medium',
        title: '依赖优化',
        description: '发现可能的重复依赖',
        files: this.analysis.dependencies.duplicates,
        suggestion: '检查并移除重复或未使用的依赖',
      });
    }

    this.analysis.recommendations = recommendations;
  }

  /**
   * 输出分析报告
   */
  printAnalysisReport() {
    console.log('\n📊 构建分析报告');
    console.log('='.repeat(60));
    
    // 总体统计
    console.log('\n📈 总体统计:');
    console.log(`  总文件数: ${Object.keys(this.analysis.files).length}`);
    console.log(`  总大小: ${this.analysis.totalSizeKB}KB (${this.analysis.totalSizeMB}MB)`);
    
    // 文件类型分布
    console.log('\n📁 文件类型分布:');
    const typeStats = this.getTypeStatistics();
    Object.entries(typeStats).forEach(([type, stats]) => {
      console.log(`  ${type}: ${stats.count} 个文件, ${stats.sizeKB}KB (${stats.percentage}%)`);
    });
    
    // 代码分割分析
    console.log('\n🔀 代码分割分析:');
    Object.entries(this.analysis.chunks).forEach(([type, chunk]) => {
      console.log(`  ${type}: ${chunk.count} 个文件, ${chunk.totalSizeKB}KB (${chunk.percentage}%)`);
    });
    
    // 最大的文件
    console.log('\n📏 最大的文件 (前5个):');
    const largestFiles = Object.entries(this.analysis.files)
      .sort(([, a], [, b]) => b.size - a.size)
      .slice(0, 5);
    
    largestFiles.forEach(([path, info]) => {
      console.log(`  ${path}: ${info.sizeKB}KB`);
    });
    
    // 优化建议
    if (this.analysis.recommendations.length > 0) {
      console.log('\n💡 优化建议:');
      this.analysis.recommendations.forEach((rec, index) => {
        console.log(`\n  ${index + 1}. ${rec.title} (${rec.priority})`);
        console.log(`     ${rec.description}`);
        console.log(`     建议: ${rec.suggestion}`);
        
        if (rec.files && rec.files.length > 0) {
          console.log(`     相关文件: ${rec.files.slice(0, 3).join(', ')}`);
        }
      });
    } else {
      console.log('\n✅ 构建已经很好地优化了！');
    }
    
    // Chrome扩展特定建议
    console.log('\n🔧 Chrome扩展优化建议:');
    console.log('  1. 确保content-script.js和service-worker.js尽可能小');
    console.log('  2. 使用懒加载减少初始加载时间');
    console.log('  3. 压缩图标和资源文件');
    console.log('  4. 移除未使用的权限和依赖');
  }

  /**
   * 获取所有文件
   */
  getAllFiles(dir) {
    const files = [];
    
    const scan = (currentDir) => {
      const items = readdirSync(currentDir);
      
      items.forEach(item => {
        const fullPath = join(currentDir, item);
        const stats = statSync(fullPath);
        
        if (stats.isDirectory()) {
          scan(fullPath);
        } else {
          files.push(fullPath);
        }
      });
    };
    
    scan(dir);
    return files;
  }

  /**
   * 获取文件类型
   */
  getFileType(ext) {
    const typeMap = {
      '.js': 'javascript',
      '.css': 'css',
      '.html': 'html',
      '.json': 'json',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.svg': 'image',
      '.ico': 'image',
      '.woff': 'font',
      '.woff2': 'font',
      '.ttf': 'font',
      '.eot': 'font',
    };
    
    return typeMap[ext] || 'other';
  }

  /**
   * 识别chunk类型
   */
  identifyChunkType(path) {
    if (path.includes('vendor')) return 'vendor';
    if (path.includes('vue')) return 'framework';
    if (path.includes('shared')) return 'shared';
    if (path.includes('content-script')) return 'content-script';
    if (path.includes('service-worker')) return 'service-worker';
    if (path.includes('chunk-')) return 'dynamic-chunk';
    return 'main';
  }

  /**
   * 获取类型统计
   */
  getTypeStatistics() {
    const stats = {};
    
    Object.values(this.analysis.files).forEach(file => {
      if (!stats[file.type]) {
        stats[file.type] = {
          count: 0,
          totalSize: 0,
        };
      }
      
      stats[file.type].count++;
      stats[file.type].totalSize += file.size;
    });
    
    Object.values(stats).forEach(stat => {
      stat.sizeKB = (stat.totalSize / 1024).toFixed(2);
      stat.percentage = ((stat.totalSize / this.analysis.totalSize) * 100).toFixed(1);
    });
    
    return stats;
  }

  /**
   * 查找可能的重复依赖
   */
  findPotentialDuplicates(dependencies) {
    const duplicates = [];
    const depNames = Object.keys(dependencies);
    
    // 简单的名称相似性检查
    for (let i = 0; i < depNames.length; i++) {
      for (let j = i + 1; j < depNames.length; j++) {
        const name1 = depNames[i];
        const name2 = depNames[j];
        
        // 检查是否有相似的包名
        if (name1.includes(name2) || name2.includes(name1)) {
          duplicates.push(`${name1} 和 ${name2} 可能重复`);
        }
      }
    }
    
    return duplicates;
  }
}

// 运行分析
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  const analyzer = new BundleAnalyzer();
  analyzer.analyze().catch(console.error);
}

export default BundleAnalyzer;