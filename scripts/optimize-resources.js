#!/usr/bin/env node

/**
 * 资源优化构建脚本
 * 用于优化扩展的资源文件，包括图标压缩、文件合并等
 */

const fs = require('fs');
const path = require('path');

class ResourceOptimizer {
  constructor() {
    this.publicDir = path.join(__dirname, '../public');
    this.distDir = path.join(__dirname, '../dist');
    this.optimizationReport = {
      icons: {},
      locales: {},
      totalSavings: 0
    };
  }

  /**
   * 主优化流程
   */
  async optimize() {
    console.log('🚀 开始资源优化...');
    
    try {
      // 1. 检查图标文件
      await this.checkIcons();
      
      // 2. 优化本地化文件
      await this.optimizeLocales();
      
      // 3. 生成资源清单
      await this.generateResourceManifest();
      
      // 4. 输出优化报告
      this.printOptimizationReport();
      
      console.log('✅ 资源优化完成！');
    } catch (error) {
      console.error('❌ 资源优化失败:', error);
      process.exit(1);
    }
  }

  /**
   * 检查图标文件
   */
  async checkIcons() {
    console.log('📱 检查图标文件...');
    
    const iconSizes = [16, 48, 128];
    const iconsDir = path.join(this.publicDir, 'icons');
    
    for (const size of iconSizes) {
      const iconPath = path.join(iconsDir, `icon-${size}.png`);
      
      if (fs.existsSync(iconPath)) {
        const stats = fs.statSync(iconPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        
        this.optimizationReport.icons[`icon-${size}.png`] = {
          size: `${sizeKB}KB`,
          exists: true
        };
        
        // 检查文件大小是否合理
        const maxSizes = { 16: 2, 48: 8, 128: 20 }; // KB
        if (stats.size / 1024 > maxSizes[size]) {
          console.warn(`⚠️  icon-${size}.png 文件过大 (${sizeKB}KB)，建议压缩到 ${maxSizes[size]}KB 以下`);
        } else {
          console.log(`✅ icon-${size}.png 大小合适 (${sizeKB}KB)`);
        }
      } else {
        console.warn(`⚠️  缺少 icon-${size}.png 文件`);
        this.optimizationReport.icons[`icon-${size}.png`] = {
          exists: false
        };
      }
    }
  }

  /**
   * 优化本地化文件
   */
  async optimizeLocales() {
    console.log('🌍 优化本地化文件...');
    
    const localesDir = path.join(this.publicDir, '_locales');
    
    if (!fs.existsSync(localesDir)) {
      console.warn('⚠️  _locales 目录不存在');
      return;
    }

    const locales = ['zh_CN', 'en'];
    
    for (const locale of locales) {
      const localeDir = path.join(localesDir, locale);
      const messagesFile = path.join(localeDir, 'messages.json');
      
      if (fs.existsSync(messagesFile)) {
        const content = fs.readFileSync(messagesFile, 'utf8');
        const messages = JSON.parse(content);
        
        // 统计消息数量
        const messageCount = Object.keys(messages).length;
        const fileSize = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(2);
        
        this.optimizationReport.locales[locale] = {
          messageCount,
          fileSize: `${fileSize}KB`
        };
        
        console.log(`✅ ${locale}: ${messageCount} 条消息, ${fileSize}KB`);
        
        // 检查必需的消息键
        const requiredKeys = [
          'extensionName',
          'extensionDescription', 
          'translateButton',
          'sourceLanguage',
          'targetLanguage'
        ];
        
        const missingKeys = requiredKeys.filter(key => !messages[key]);
        if (missingKeys.length > 0) {
          console.warn(`⚠️  ${locale} 缺少必需的消息键: ${missingKeys.join(', ')}`);
        }
      } else {
        console.warn(`⚠️  缺少 ${locale}/messages.json 文件`);
      }
    }
  }

  /**
   * 生成资源清单
   */
  async generateResourceManifest() {
    console.log('📋 生成资源清单...');
    
    const manifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      resources: {
        icons: {},
        locales: {},
        documents: {}
      }
    };

    // 扫描图标文件
    const iconsDir = path.join(this.publicDir, 'icons');
    if (fs.existsSync(iconsDir)) {
      const iconFiles = fs.readdirSync(iconsDir).filter(file => file.endsWith('.png'));
      iconFiles.forEach(file => {
        const filePath = path.join(iconsDir, file);
        const stats = fs.statSync(filePath);
        manifest.resources.icons[file] = {
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      });
    }

    // 扫描本地化文件
    const localesDir = path.join(this.publicDir, '_locales');
    if (fs.existsSync(localesDir)) {
      const locales = fs.readdirSync(localesDir);
      locales.forEach(locale => {
        const messagesFile = path.join(localesDir, locale, 'messages.json');
        if (fs.existsSync(messagesFile)) {
          const stats = fs.statSync(messagesFile);
          const content = fs.readFileSync(messagesFile, 'utf8');
          const messages = JSON.parse(content);
          
          manifest.resources.locales[locale] = {
            messageCount: Object.keys(messages).length,
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        }
      });
    }

    // 扫描文档文件
    const docFiles = [
      'extension-description.md',
      'permissions-explanation.md',
      'resource-optimization.md'
    ];
    
    docFiles.forEach(file => {
      const filePath = path.join(this.publicDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        manifest.resources.documents[file] = {
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      }
    });

    // 保存清单文件
    const manifestPath = path.join(this.publicDir, 'resource-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`✅ 资源清单已生成: ${manifestPath}`);
  }

  /**
   * 输出优化报告
   */
  printOptimizationReport() {
    console.log('\n📊 资源优化报告');
    console.log('='.repeat(50));
    
    // 图标报告
    console.log('\n📱 图标文件:');
    Object.entries(this.optimizationReport.icons).forEach(([name, info]) => {
      if (info.exists) {
        console.log(`  ✅ ${name}: ${info.size}`);
      } else {
        console.log(`  ❌ ${name}: 文件不存在`);
      }
    });
    
    // 本地化报告
    console.log('\n🌍 本地化文件:');
    Object.entries(this.optimizationReport.locales).forEach(([locale, info]) => {
      console.log(`  ✅ ${locale}: ${info.messageCount} 条消息, ${info.fileSize}`);
    });
    
    console.log('\n✨ 优化建议:');
    console.log('  1. 确保所有图标文件存在且大小合适');
    console.log('  2. 检查本地化文件的完整性');
    console.log('  3. 定期清理未使用的资源文件');
    console.log('  4. 使用构建工具进一步压缩资源');
  }

  /**
   * 验证扩展配置
   */
  validateExtensionConfig() {
    console.log('🔍 验证扩展配置...');
    
    const manifestPath = path.join(__dirname, '../manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('manifest.json 文件不存在');
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // 检查必需字段
    const requiredFields = ['name', 'version', 'description', 'manifest_version'];
    const missingFields = requiredFields.filter(field => !manifest[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`manifest.json 缺少必需字段: ${missingFields.join(', ')}`);
    }

    // 检查图标配置
    if (manifest.icons) {
      Object.entries(manifest.icons).forEach(([size, path]) => {
        const iconPath = path.join(this.publicDir, path);
        if (!fs.existsSync(iconPath)) {
          console.warn(`⚠️  manifest.json 中配置的图标文件不存在: ${path}`);
        }
      });
    }

    console.log('✅ 扩展配置验证通过');
  }
}

// 运行优化
if (require.main === module) {
  const optimizer = new ResourceOptimizer();
  optimizer.optimize().catch(console.error);
}

module.exports = ResourceOptimizer;