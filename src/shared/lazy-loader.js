/**
 * 懒加载管理器
 * 实现组件和模块的懒加载，优化初始加载性能
 */

class LazyLoader {
  constructor() {
    this.loadedModules = new Map();
    this.loadingPromises = new Map();
    this.preloadQueue = [];
    this.loadingStats = {
      totalLoaded: 0,
      totalSize: 0,
      loadTimes: []
    };
  }

  /**
   * 懒加载Vue组件
   */
  loadComponent(componentName, importFunction) {
    return () => {
      const startTime = performance.now();
      
      // 如果已经加载过，直接返回
      if (this.loadedModules.has(componentName)) {
        return Promise.resolve(this.loadedModules.get(componentName));
      }
      
      // 如果正在加载，返回现有的Promise
      if (this.loadingPromises.has(componentName)) {
        return this.loadingPromises.get(componentName);
      }
      
      console.log(`🔄 懒加载组件: ${componentName}`);
      
      const loadPromise = importFunction()
        .then(module => {
          const loadTime = performance.now() - startTime;
          
          // 记录加载统计
          this.loadingStats.totalLoaded++;
          this.loadingStats.loadTimes.push(loadTime);
          
          // 缓存模块
          this.loadedModules.set(componentName, module);
          this.loadingPromises.delete(componentName);
          
          console.log(`✅ 组件加载完成: ${componentName} (${loadTime.toFixed(2)}ms)`);
          
          return module;
        })
        .catch(error => {
          console.error(`❌ 组件加载失败: ${componentName}`, error);
          this.loadingPromises.delete(componentName);
          throw error;
        });
      
      this.loadingPromises.set(componentName, loadPromise);
      return loadPromise;
    };
  }

  /**
   * 懒加载JavaScript模块
   */
  async loadModule(moduleName, importFunction) {
    const startTime = performance.now();
    
    // 检查缓存
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName);
    }
    
    // 检查是否正在加载
    if (this.loadingPromises.has(moduleName)) {
      return this.loadingPromises.get(moduleName);
    }
    
    console.log(`🔄 懒加载模块: ${moduleName}`);
    
    const loadPromise = importFunction()
      .then(module => {
        const loadTime = performance.now() - startTime;
        
        // 记录统计
        this.loadingStats.totalLoaded++;
        this.loadingStats.loadTimes.push(loadTime);
        
        // 缓存模块
        this.loadedModules.set(moduleName, module);
        this.loadingPromises.delete(moduleName);
        
        console.log(`✅ 模块加载完成: ${moduleName} (${loadTime.toFixed(2)}ms)`);
        
        return module;
      })
      .catch(error => {
        console.error(`❌ 模块加载失败: ${moduleName}`, error);
        this.loadingPromises.delete(moduleName);
        throw error;
      });
    
    this.loadingPromises.set(moduleName, loadPromise);
    return loadPromise;
  }

  /**
   * 预加载模块
   */
  async preloadModule(moduleName, importFunction, priority = 'low') {
    // 如果已经加载或正在加载，跳过
    if (this.loadedModules.has(moduleName) || this.loadingPromises.has(moduleName)) {
      return;
    }
    
    const preloadItem = {
      moduleName,
      importFunction,
      priority,
      timestamp: Date.now()
    };
    
    // 根据优先级插入队列
    if (priority === 'high') {
      this.preloadQueue.unshift(preloadItem);
    } else {
      this.preloadQueue.push(preloadItem);
    }
    
    console.log(`📋 已添加到预加载队列: ${moduleName} (优先级: ${priority})`);
    
    // 如果是高优先级，立即开始预加载
    if (priority === 'high') {
      this.processPreloadQueue();
    }
  }

  /**
   * 处理预加载队列
   */
  async processPreloadQueue() {
    if (this.preloadQueue.length === 0) {
      return;
    }
    
    // 检查网络和性能条件
    if (!this.shouldPreload()) {
      console.log('⏸️  暂停预加载（网络或性能条件不佳）');
      return;
    }
    
    const item = this.preloadQueue.shift();
    
    try {
      console.log(`🚀 预加载模块: ${item.moduleName}`);
      await this.loadModule(item.moduleName, item.importFunction);
    } catch (error) {
      console.warn(`⚠️  预加载失败: ${item.moduleName}`, error);
    }
    
    // 继续处理队列（添加延迟避免阻塞）
    if (this.preloadQueue.length > 0) {
      setTimeout(() => this.processPreloadQueue(), 100);
    }
  }

  /**
   * 检查是否应该预加载
   */
  shouldPreload() {
    // 检查网络连接
    if (navigator.connection) {
      const connection = navigator.connection;
      
      // 慢速网络不预加载
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        return false;
      }
      
      // 数据节省模式不预加载
      if (connection.saveData) {
        return false;
      }
    }
    
    // 检查内存使用情况
    if (performance.memory) {
      const memoryUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
      
      // 内存使用超过80%不预加载
      if (memoryUsage > 0.8) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 批量预加载组件
   */
  async preloadComponents(components) {
    console.log(`📦 批量预加载 ${components.length} 个组件`);
    
    for (const component of components) {
      await this.preloadModule(
        component.name,
        component.importFunction,
        component.priority || 'low'
      );
    }
    
    // 开始处理预加载队列
    this.processPreloadQueue();
  }

  /**
   * 根据路由预加载
   */
  async preloadByRoute(routeName, routeComponents) {
    console.log(`🛣️  预加载路由组件: ${routeName}`);
    
    const components = routeComponents.map(comp => ({
      name: `${routeName}-${comp.name}`,
      importFunction: comp.importFunction,
      priority: 'high'
    }));
    
    await this.preloadComponents(components);
  }

  /**
   * 智能预加载（基于用户行为）
   */
  async smartPreload(userBehavior) {
    const { mostUsedFeatures, recentActions, timeOfDay } = userBehavior;
    
    console.log('🧠 智能预加载分析用户行为...');
    
    // 根据最常用功能预加载
    if (mostUsedFeatures.includes('translation-history')) {
      await this.preloadModule(
        'TranslationHistory',
        () => import('@components/TranslationHistory.vue'),
        'high'
      );
    }
    
    if (mostUsedFeatures.includes('language-selector')) {
      await this.preloadModule(
        'LanguageSelector',
        () => import('@components/LanguageSelector.vue'),
        'high'
      );
    }
    
    // 根据时间预加载（例如工作时间更可能使用翻译功能）
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 18) {
      await this.preloadModule(
        'TranslationInput',
        () => import('@components/TranslationInput.vue'),
        'medium'
      );
    }
    
    this.processPreloadQueue();
  }

  /**
   * 清理未使用的模块
   */
  cleanupUnusedModules() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30分钟
    
    console.log('🧹 清理未使用的模块...');
    
    for (const [moduleName, module] of this.loadedModules.entries()) {
      // 检查模块是否长时间未使用
      if (module._lastUsed && (now - module._lastUsed) > maxAge) {
        this.loadedModules.delete(moduleName);
        console.log(`🗑️  清理模块: ${moduleName}`);
      }
    }
  }

  /**
   * 标记模块为已使用
   */
  markModuleUsed(moduleName) {
    const module = this.loadedModules.get(moduleName);
    if (module) {
      module._lastUsed = Date.now();
    }
  }

  /**
   * 获取加载统计
   */
  getLoadingStats() {
    const avgLoadTime = this.loadingStats.loadTimes.length > 0
      ? this.loadingStats.loadTimes.reduce((a, b) => a + b, 0) / this.loadingStats.loadTimes.length
      : 0;
    
    return {
      totalLoaded: this.loadingStats.totalLoaded,
      totalSize: this.loadingStats.totalSize,
      averageLoadTime: avgLoadTime.toFixed(2),
      loadedModules: Array.from(this.loadedModules.keys()),
      preloadQueueSize: this.preloadQueue.length,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * 计算缓存命中率
   */
  calculateCacheHitRate() {
    // 这里可以实现更复杂的缓存命中率计算
    const totalRequests = this.loadingStats.totalLoaded + this.loadedModules.size;
    const cacheHits = this.loadedModules.size;
    
    return totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(2) : 0;
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.loadingStats = {
      totalLoaded: 0,
      totalSize: 0,
      loadTimes: []
    };
    
    console.log('📊 加载统计已重置');
  }

  /**
   * 导出性能报告
   */
  exportPerformanceReport() {
    const stats = this.getLoadingStats();
    
    const report = {
      timestamp: new Date().toISOString(),
      performance: stats,
      modules: Array.from(this.loadedModules.keys()).map(name => ({
        name,
        lastUsed: this.loadedModules.get(name)._lastUsed || null
      })),
      preloadQueue: this.preloadQueue.map(item => ({
        name: item.moduleName,
        priority: item.priority,
        queueTime: Date.now() - item.timestamp
      }))
    };
    
    console.log('📋 性能报告:', report);
    return report;
  }
}

// 创建全局实例
const lazyLoader = new LazyLoader();

// 定期清理未使用的模块
setInterval(() => {
  lazyLoader.cleanupUnusedModules();
}, 10 * 60 * 1000); // 每10分钟清理一次

export default lazyLoader;