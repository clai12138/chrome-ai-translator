#!/usr/bin/env node

/**
 * 构建验证脚本
 * 验证构建产物的完整性和正确性
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const rootDir = resolve(__dirname, '..');
const distDir = join(rootDir, 'dist');

class BuildValidator {
  constructor() {
    this.distDir = distDir;
    this.errors = [];
    this.warnings = [];
    this.validationResults = {
      manifest: false,
      scripts: false,
      assets: false,
      locales: false,
      permissions: false,
      structure: false,
    };
  }

  /**
   * 执行完整的构建验证
   */
  async validate() {
    console.log('🔍 开始构建验证...');
    
    if (!existsSync(this.distDir)) {
      this.addError('构建目录不存在，请先运行构建命令');
      this.printResults();
      process.exit(1);
    }

    try {
      // 1. 验证manifest.json
      await this.validateManifest();
      
      // 2. 验证脚本文件
      await this.validateScripts();
      
      // 3. 验证资源文件
      await this.validateAssets();
      
      // 4. 验证本地化文件
      await this.validateLocales();
      
      // 5. 验证权限配置
      await this.validatePermissions();
      
      // 6. 验证目录结构
      await this.validateStructure();
      
      // 7. 输出验证结果
      this.printResults();
      
      // 8. 检查是否有错误
      if (this.errors.length > 0) {
        console.error('❌ 构建验证失败');
        process.exit(1);
      } else {
        console.log('✅ 构建验证通过');
      }
      
    } catch (error) {
      console.error('❌ 构建验证过程中发生错误:', error);
      process.exit(1);
    }
  }

  /**
   * 验证manifest.json
   */
  async validateManifest() {
    console.log('📋 验证 manifest.json...');
    
    const manifestPath = join(this.distDir, 'manifest.json');
    
    if (!existsSync(manifestPath)) {
      this.addError('manifest.json 文件不存在');
      return;
    }

    try {
      const manifestContent = readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);
      
      // 检查必需字段
      const requiredFields = [
        'manifest_version',
        'name',
        'version',
        'description',
        'permissions',
        'background',
        'action',
        'icons'
      ];
      
      requiredFields.forEach(field => {
        if (!manifest[field]) {
          this.addError(`manifest.json 缺少必需字段: ${field}`);
        }
      });
      
      // 检查manifest版本
      if (manifest.manifest_version !== 3) {
        this.addError('必须使用 Manifest V3');
      }
      
      // 检查权限配置
      if (manifest.permissions && manifest.permissions.length > 0) {
        const allowedPermissions = ['storage', 'activeTab', 'contextMenus', 'scripting'];
        const invalidPermissions = manifest.permissions.filter(p => !allowedPermissions.includes(p));
        
        if (invalidPermissions.length > 0) {
          this.addWarning(`可能不必要的权限: ${invalidPermissions.join(', ')}`);
        }
      }
      
      // 检查图标配置
      if (manifest.icons) {
        Object.entries(manifest.icons).forEach(([size, iconPath]) => {
          const fullIconPath = join(this.distDir, iconPath);
          if (!existsSync(fullIconPath)) {
            this.addError(`图标文件不存在: ${iconPath}`);
          }
        });
      }
      
      // 检查background script
      if (manifest.background && manifest.background.service_worker) {
        const swPath = join(this.distDir, manifest.background.service_worker);
        if (!existsSync(swPath)) {
          this.addError(`Service Worker 文件不存在: ${manifest.background.service_worker}`);
        }
      }
      
      this.validationResults.manifest = this.errors.length === 0;
      console.log('✅ manifest.json 验证完成');
      
    } catch (error) {
      this.addError(`manifest.json 解析失败: ${error.message}`);
    }
  }

  /**
   * 验证脚本文件
   */
  async validateScripts() {
    console.log('📜 验证脚本文件...');
    
    const requiredScripts = [
      'content-script.js',
      'service-worker.js'
    ];
    
    const optionalScripts = [
      'popup.html'
    ];
    
    // 检查必需脚本
    requiredScripts.forEach(script => {
      const scriptPath = join(this.distDir, script);
      if (!existsSync(scriptPath)) {
        this.addError(`必需脚本文件不存在: ${script}`);
      } else {
        // 检查文件大小
        const stats = statSync(scriptPath);
        const sizeKB = stats.size / 1024;
        
        if (sizeKB > 100) {
          this.addWarning(`${script} 文件较大 (${sizeKB.toFixed(2)}KB)，建议优化`);
        }
        
        // 检查文件内容
        const content = readFileSync(scriptPath, 'utf8');
        if (content.includes('console.log') || content.includes('debugger')) {
          this.addWarning(`${script} 包含调试代码，建议在生产环境中移除`);
        }
      }
    });
    
    // 检查可选脚本
    optionalScripts.forEach(script => {
      const scriptPath = join(this.distDir, script);
      if (!existsSync(scriptPath)) {
        this.addWarning(`可选文件不存在: ${script}`);
      }
    });
    
    this.validationResults.scripts = true;
    console.log('✅ 脚本文件验证完成');
  }

  /**
   * 验证资源文件
   */
  async validateAssets() {
    console.log('🖼️  验证资源文件...');
    
    // 检查图标文件
    const iconSizes = [16, 48, 128];
    iconSizes.forEach(size => {
      const iconPath = join(this.distDir, 'icons', `icon-${size}.png`);
      if (!existsSync(iconPath)) {
        this.addError(`图标文件不存在: icons/icon-${size}.png`);
      } else {
        const stats = statSync(iconPath);
        const maxSizes = { 16: 2048, 48: 8192, 128: 20480 }; // bytes
        
        if (stats.size > maxSizes[size]) {
          this.addWarning(`icon-${size}.png 文件过大 (${(stats.size/1024).toFixed(2)}KB)`);
        }
      }
    });
    
    // 检查CSS文件
    const assetsDir = join(this.distDir, 'assets');
    if (existsSync(assetsDir)) {
      const assetFiles = readdirSync(assetsDir);
      const cssFiles = assetFiles.filter(file => file.endsWith('.css'));
      
      if (cssFiles.length === 0) {
        this.addWarning('没有找到CSS文件');
      }
    }
    
    this.validationResults.assets = true;
    console.log('✅ 资源文件验证完成');
  }

  /**
   * 验证本地化文件
   */
  async validateLocales() {
    console.log('🌍 验证本地化文件...');
    
    const localesDir = join(this.distDir, '_locales');
    
    if (!existsSync(localesDir)) {
      this.addError('_locales 目录不存在');
      return;
    }

    const requiredLocales = ['zh_CN', 'en'];
    const requiredMessages = [
      'extensionName',
      'extensionDescription',
      'actionTitle'
    ];
    
    requiredLocales.forEach(locale => {
      const localeDir = join(localesDir, locale);
      const messagesFile = join(localeDir, 'messages.json');
      
      if (!existsSync(messagesFile)) {
        this.addError(`本地化文件不存在: _locales/${locale}/messages.json`);
        return;
      }
      
      try {
        const messages = JSON.parse(readFileSync(messagesFile, 'utf8'));
        
        requiredMessages.forEach(key => {
          if (!messages[key]) {
            this.addError(`${locale} 缺少必需消息: ${key}`);
          }
        });
        
      } catch (error) {
        this.addError(`${locale}/messages.json 解析失败: ${error.message}`);
      }
    });
    
    this.validationResults.locales = true;
    console.log('✅ 本地化文件验证完成');
  }

  /**
   * 验证权限配置
   */
  async validatePermissions() {
    console.log('🔐 验证权限配置...');
    
    const manifestPath = join(this.distDir, 'manifest.json');
    
    if (!existsSync(manifestPath)) {
      return;
    }

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      
      // 检查权限最小化原则
      const permissions = manifest.permissions || [];
      const hostPermissions = manifest.host_permissions || [];
      
      // 危险权限检查
      const dangerousPermissions = ['tabs', 'history', 'bookmarks', 'cookies'];
      const foundDangerous = permissions.filter(p => dangerousPermissions.includes(p));
      
      if (foundDangerous.length > 0) {
        this.addWarning(`使用了敏感权限: ${foundDangerous.join(', ')}`);
      }
      
      // 检查host权限
      if (hostPermissions.includes('<all_urls>')) {
        this.addWarning('使用了 <all_urls> 权限，确保这是必需的');
      }
      
      this.validationResults.permissions = true;
      console.log('✅ 权限配置验证完成');
      
    } catch (error) {
      this.addError(`权限验证失败: ${error.message}`);
    }
  }

  /**
   * 验证目录结构
   */
  async validateStructure() {
    console.log('📁 验证目录结构...');
    
    const expectedStructure = {
      'manifest.json': 'file',
      'popup.html': 'file',
      'content-script.js': 'file',
      'service-worker.js': 'file',
      'icons': 'directory',
      '_locales': 'directory',
      'assets': 'directory'
    };
    
    Object.entries(expectedStructure).forEach(([path, type]) => {
      const fullPath = join(this.distDir, path);
      
      if (!existsSync(fullPath)) {
        if (type === 'file') {
          this.addError(`必需文件不存在: ${path}`);
        } else {
          this.addWarning(`目录不存在: ${path}`);
        }
      } else {
        const stats = statSync(fullPath);
        const actualType = stats.isDirectory() ? 'directory' : 'file';
        
        if (actualType !== type) {
          this.addError(`${path} 类型错误，期望 ${type}，实际 ${actualType}`);
        }
      }
    });
    
    this.validationResults.structure = true;
    console.log('✅ 目录结构验证完成');
  }

  /**
   * 添加错误
   */
  addError(message) {
    this.errors.push(message);
    console.error(`❌ ${message}`);
  }

  /**
   * 添加警告
   */
  addWarning(message) {
    this.warnings.push(message);
    console.warn(`⚠️  ${message}`);
  }

  /**
   * 输出验证结果
   */
  printResults() {
    console.log('\n📊 构建验证结果');
    console.log('='.repeat(50));
    
    // 验证项目状态
    Object.entries(this.validationResults).forEach(([item, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${item}: ${passed ? '通过' : '失败'}`);
    });
    
    // 统计信息
    console.log(`\n📈 统计信息:`);
    console.log(`  错误: ${this.errors.length}`);
    console.log(`  警告: ${this.warnings.length}`);
    
    // 详细错误
    if (this.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    // 详细警告
    if (this.warnings.length > 0) {
      console.log('\n⚠️  警告详情:');
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }
    
    // 总结
    if (this.errors.length === 0) {
      console.log('\n🎉 构建验证通过！扩展已准备好发布。');
    } else {
      console.log('\n🔧 请修复上述错误后重新构建。');
    }
  }
}

// 运行验证
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  const validator = new BuildValidator();
  validator.validate().catch(console.error);
}

export default BuildValidator;