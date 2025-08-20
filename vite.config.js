import vue from '@vitejs/plugin-vue';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { defineConfig } from 'vite';

// 自定义插件：Chrome扩展构建优化
const chromeExtensionPlugin = () => {
  return {
    name: 'chrome-extension-build',
    async writeBundle() {
      // 静默构建日志（仅扩展生产构建）：暂时关闭 console.log/console.warn，保留致命错误
      const __origLog = console.log, __origWarn = console.warn;
      const __shouldSilence = process.env.BUILD_TARGET === 'extension' && process.env.NODE_ENV !== 'development';
      if (__shouldSilence) {
        console.log = () => {};
        console.warn = () => {};
      }
      console.log('🔧 开始Chrome扩展构建优化...');

      // 确保输出目录存在
      if (!existsSync('dist')) {
        mkdirSync('dist', { recursive: true });
      }

      // 复制 manifest.json
      copyFileSync('manifest.json', 'dist/manifest.json');
      console.log('✓ 已复制 manifest.json');

      // 复制 constants.json 到 assets 目录
      const constantsSource = 'src/shared/constants.json';
      const constantsTarget = 'dist/assets/constants.json';
      if (existsSync(constantsSource)) {
        if (!existsSync('dist/assets')) {
          mkdirSync('dist/assets', { recursive: true });
        }
        copyFileSync(constantsSource, constantsTarget);
        console.log('✓ 已复制 constants.json');
      }

      // 处理 popup.html
      if (existsSync('dist/src/popup/index.html')) {
        let htmlContent = readFileSync('dist/src/popup/index.html', 'utf8');
        // 修复资源路径为相对路径
        htmlContent = htmlContent.replace(/src="\/assets\//g, 'src="./assets/');
        htmlContent = htmlContent.replace(/href="\/assets\//g, 'href="./assets/');
        writeFileSync('dist/popup.html', htmlContent);
        console.log('✓ 已优化 popup.html');
        
        // 删除临时的src目录
        try {
          const { rmSync } = await import('fs');
          rmSync('dist/src', { recursive: true, force: true });
          console.log('✓ 已清理临时文件');
        } catch (error) {
          console.warn('⚠️ 清理临时文件失败:', error.message);
        }
      }

      // 复制图标文件
      const publicIconsDir = 'public/icons';
      const distIconsDir = 'dist/icons';

      if (!existsSync(distIconsDir)) {
        mkdirSync(distIconsDir, { recursive: true });
      }

      if (existsSync(publicIconsDir)) {
        const iconFiles = readdirSync(publicIconsDir).filter(
          (file) => file.endsWith('.png') || file.endsWith('.svg')
        );

        iconFiles.forEach((file) => {
          copyFileSync(join(publicIconsDir, file), join(distIconsDir, file));
        });
        console.log(`✓ 已复制 ${iconFiles.length} 个图标文件`);
      }

      // 复制本地化文件
      const publicLocalesDir = 'public/_locales';
      const distLocalesDir = 'dist/_locales';

      if (existsSync(publicLocalesDir)) {
        if (!existsSync(distLocalesDir)) {
          mkdirSync(distLocalesDir, { recursive: true });
        }

        const locales = readdirSync(publicLocalesDir);
        locales.forEach((locale) => {
          const localeDir = join(distLocalesDir, locale);
          if (!existsSync(localeDir)) {
            mkdirSync(localeDir, { recursive: true });
          }

          const messagesFile = join(publicLocalesDir, locale, 'messages.json');
          if (existsSync(messagesFile)) {
            copyFileSync(messagesFile, join(localeDir, 'messages.json'));
          }
        });
        console.log(`✓ 已复制 ${locales.length} 个本地化文件`);
      }

      console.log('✅ Chrome扩展构建优化完成 (测试目录已排除)');

      console.log('✅ Chrome扩展构建优化完成');
      // 恢复日志
      if (__shouldSilence) {
        console.log = __origLog;
        console.warn = __origWarn;
      }
    },
  };
};

export default defineConfig(({ mode, command }) => {
  const isProduction = mode === 'production';
  const isExtensionBuild = process.env.BUILD_TARGET === 'extension';
  const isWebDev = command === 'serve' || !isExtensionBuild;

  const plugins = [vue()];
  
  // 只在扩展构建时添加Chrome扩展插件
  if (isExtensionBuild) {
    plugins.push(chromeExtensionPlugin());
  }

  return {
    plugins,
    build: {
      // 生产环境优化配置 - 使用esbuild压缩
      minify: isProduction ? 'esbuild' : false,

      // esbuild压缩选项
      esbuild: isProduction
        ? {
            drop: ['console', 'debugger'],
            legalComments: 'none',
            minifyIdentifiers: true,
            minifySyntax: true,
            minifyWhitespace: true,
            treeShaking: true,
          }
        : {
            // 开发环境保留调试信息
            drop: [],
          },

      // 代码分割配置
      rollupOptions: {
        input: isWebDev ? {
          main: resolve(__dirname, 'index.html')
        } : {
          popup: resolve(__dirname, 'src/popup/index.html'),
          'content-script': resolve(__dirname, 'src/content/content-script.js'),
          'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            // Chrome扩展脚本文件不能使用hash
            if (chunkInfo.name === 'content-script' || chunkInfo.name === 'service-worker') {
              return '[name].js';
            }
            return isProduction ? 'assets/[name]-[hash].js' : 'assets/[name].js';
          },

          chunkFileNames: (chunkInfo) => {
            // 为共享模块创建单独的chunk
            if (chunkInfo.name.includes('shared') || chunkInfo.name.includes('vendor')) {
              return isProduction ? 'assets/[name]-[hash].js' : 'assets/[name].js';
            }
            return isProduction ? 'assets/chunk-[hash].js' : 'assets/chunk-[name].js';
          },
          assetFileNames: (assetInfo) => {
            // HTML文件直接输出到根目录
            if (assetInfo.names && assetInfo.names.some((name) => name.endsWith('.html'))) {
              return '[name].[ext]';
            }
            // CSS和其他资源文件
            const extType = assetInfo.names?.[0]?.split('.').pop();
            if (extType === 'css') {
              return isProduction ? 'assets/[name]-[hash].[ext]' : 'assets/[name].[ext]';
            }
            return isProduction ? 'assets/[name]-[hash].[ext]' : 'assets/[name].[ext]';
          },
          // 手动分割vendor和shared代码
          manualChunks: isExtensionBuild ? (id) => {
            // 扩展构建时排除test目录
            if (id.includes('src/test')) {
              return undefined;
            }
            
            // Vue框架单独分包
            if (id.includes('node_modules')) {
              if (id.includes('vue')) {
                return 'vue-vendor';
              }
              // 其他第三方库
              return 'vendor';
            }

            // 共享模块分包
            if (id.includes('src/shared')) {
              // 核心功能模块
              if (id.includes('translator.js') || id.includes('storage.js')) {
                return 'core-shared';
              }
              // 工具模块
              if (id.includes('lazy-loader.js') || id.includes('auto-updater.js')) {
                return 'utils-shared';
              }
              return 'shared';
            }

            // 组件按功能分包
            if (id.includes('src/popup/components')) {
              if (id.includes('Translation')) {
                return 'translation-components';
              }
              if (id.includes('Language') || id.includes('History')) {
                return 'ui-components';
              }
            }
          } : undefined,
        },
      },

      // 构建优化
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: !isProduction,

      // 资源内联阈值（小于4KB的资源内联）
      assetsInlineLimit: 4096,

      // CSS代码分割
      cssCodeSplit: true,

      // 启用gzip压缩
      reportCompressedSize: isProduction,

      // 构建目标
      target: 'chrome138', // Chrome扩展最低支持版本

      // 优化选项
      chunkSizeWarningLimit: 500, // chunk大小警告阈值(KB)
    },

    // 开发服务器配置
    server: {
      port: 3000,
      open: false,
    },

    // 路径别名
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'src/shared'),
        '@components': resolve(__dirname, 'src/popup/components'),
        '@styles': resolve(__dirname, 'src/styles'),
      },
      extensions: ['.js', '.json', '.vue'],
    },

    // 环境变量
    define: {
      __DEV__: !isProduction,
      __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    },

    // 优化依赖预构建
    optimizeDeps: {
      include: ['vue'],
      exclude: [],
      // 强制预构建
      force: false,
    },

    // 实验性功能
    experimental: {
      // 启用构建优化
      renderBuiltUrl: (filename, { hostType }) => {
        if (hostType === 'js') {
          return { js: `chrome-extension://__MSG_@@extension_id__/${filename}` };
        }
        return { relative: true };
      },
    },

    // CSS预处理器选项
    css: {
      // CSS模块配置
      modules: {
        localsConvention: 'camelCase',
      },
      // PostCSS配置
      postcss: {
        plugins: isProduction
          ? [
              // 生产环境CSS优化插件可以在这里添加
            ]
          : [],
      },
    },
  };
});