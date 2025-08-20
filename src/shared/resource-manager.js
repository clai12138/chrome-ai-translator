/**
 * 资源管理器 - 负责优化资源加载和缓存
 */
class ResourceManager {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
    this.performanceMetrics = new Map();
  }

  /**
   * 预加载关键资源
   */
  async preloadCriticalResources() {
    const criticalResources = [
      '/icons/icon-16.png',
      '/icons/icon-48.png',
      '/popup.html'
    ];

    const preloadPromises = criticalResources.map(url => 
      this.preloadResource(url)
    );

    try {
      await Promise.all(preloadPromises);
      console.log('Critical resources preloaded successfully');
    } catch (error) {
      console.warn('Some critical resources failed to preload:', error);
    }
  }

  /**
   * 预加载单个资源
   */
  async preloadResource(url) {
    const startTime = performance.now();
    
    try {
      const response = await fetch(chrome.runtime.getURL(url));
      if (!response.ok) {
        throw new Error(`Failed to preload ${url}: ${response.status}`);
      }
      
      const endTime = performance.now();
      this.recordMetric(`preload_${url}`, endTime - startTime);
      
      return response;
    } catch (error) {
      console.warn(`Failed to preload resource ${url}:`, error);
      throw error;
    }
  }

  /**
   * 带缓存的资源获取
   */
  async getResourceWithCache(key, fetchFunction) {
    // 检查内存缓存
    if (this.cache.has(key)) {
      const { data, timestamp } = this.cache.get(key);
      if (Date.now() - timestamp < this.cacheTimeout) {
        return data;
      }
    }

    // 获取新数据
    const startTime = performance.now();
    try {
      const data = await fetchFunction();
      
      // 更新缓存
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });

      const endTime = performance.now();
      this.recordMetric(`fetch_${key}`, endTime - startTime);

      return data;
    } catch (error) {
      console.error(`Failed to fetch resource ${key}:`, error);
      throw error;
    }
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, { timestamp }] of this.cache.entries()) {
      if (now - timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 记录性能指标
   */
  recordMetric(name, value) {
    this.performanceMetrics.set(name, {
      value,
      timestamp: Date.now()
    });

    // 异步保存到Chrome Storage
    this.saveMetricsToStorage();
  }

  /**
   * 保存性能指标到存储
   */
  async saveMetricsToStorage() {
    try {
      const metrics = Object.fromEntries(this.performanceMetrics);
      await chrome.storage.local.set({ 
        performance_metrics: metrics 
      });
    } catch (error) {
      console.warn('Failed to save performance metrics:', error);
    }
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport() {
    const report = {
      cacheSize: this.cache.size,
      metricsCount: this.performanceMetrics.size,
      metrics: Object.fromEntries(this.performanceMetrics)
    };

    return report;
  }

  /**
   * 优化图标加载
   */
  async optimizeIconLoading() {
    const iconSizes = [16, 48, 128];
    const iconPromises = iconSizes.map(size => 
      this.preloadResource(`/icons/icon-${size}.png`)
    );

    try {
      await Promise.all(iconPromises);
      console.log('All icons preloaded successfully');
    } catch (error) {
      console.warn('Some icons failed to preload:', error);
    }
  }

  /**
   * 懒加载组件
   */
  async lazyLoadComponent(componentPath) {
    const cacheKey = `component_${componentPath}`;
    
    return this.getResourceWithCache(cacheKey, async () => {
      const module = await import(componentPath);
      return module.default || module;
    });
  }

  /**
   * 批量预加载组件
   */
  async preloadComponents(componentPaths) {
    if ('requestIdleCallback' in window) {
      return new Promise(resolve => {
        requestIdleCallback(async () => {
          const promises = componentPaths.map(path => 
            this.lazyLoadComponent(path)
          );
          
          try {
            await Promise.all(promises);
            console.log('Components preloaded successfully');
            resolve();
          } catch (error) {
            console.warn('Some components failed to preload:', error);
            resolve();
          }
        });
      });
    } else {
      // 降级到setTimeout
      return new Promise(resolve => {
        setTimeout(async () => {
          const promises = componentPaths.map(path => 
            this.lazyLoadComponent(path)
          );
          
          try {
            await Promise.all(promises);
            resolve();
          } catch (error) {
            console.warn('Components preload failed:', error);
            resolve();
          }
        }, 100);
      });
    }
  }

  /**
   * 内存清理
   */
  cleanup() {
    this.cleanExpiredCache();
    
    // 限制性能指标数量
    if (this.performanceMetrics.size > 100) {
      const entries = Array.from(this.performanceMetrics.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      
      this.performanceMetrics.clear();
      entries.slice(0, 50).forEach(([key, value]) => {
        this.performanceMetrics.set(key, value);
      });
    }
  }

  /**
   * 初始化资源管理器
   */
  async initialize() {
    try {
      // 预加载关键资源
      await this.preloadCriticalResources();
      
      // 优化图标加载
      await this.optimizeIconLoading();
      
      // 设置定期清理
      setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000); // 每5分钟清理一次
      
      console.log('ResourceManager initialized successfully');
    } catch (error) {
      console.error('ResourceManager initialization failed:', error);
    }
  }
}

// 创建全局实例
const resourceManager = new ResourceManager();

// 导出
export default resourceManager;
export { ResourceManager };
