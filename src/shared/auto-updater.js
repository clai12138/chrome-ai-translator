/**
 * 自动更新管理器
 * 处理Chrome扩展的自动更新检查和通知
 */

class AutoUpdater {
  constructor() {
    this.currentVersion = chrome.runtime.getManifest().version;
    this.updateCheckInterval = 24 * 60 * 60 * 1000; // 24小时
    this.lastCheckTime = null;
    this.updateAvailable = false;
    this.newVersion = null;
  }

  /**
   * 初始化自动更新器
   */
  async initialize() {
    console.log('🔄 初始化自动更新器...');
    
    try {
      // 从存储中恢复上次检查时间
      const result = await chrome.storage.local.get(['lastUpdateCheck']);
      this.lastCheckTime = result.lastUpdateCheck || 0;
      
      // 监听扩展更新事件
      this.setupUpdateListeners();
      
      // 检查是否需要立即检查更新
      if (this.shouldCheckForUpdates()) {
        await this.checkForUpdates();
      }
      
      // 设置定期检查
      this.scheduleUpdateCheck();
      
      console.log('✅ 自动更新器初始化完成');
      
    } catch (error) {
      console.error('❌ 自动更新器初始化失败:', error);
    }
  }

  /**
   * 设置更新监听器
   */
  setupUpdateListeners() {
    // 监听Chrome扩展更新事件
    if (chrome.runtime.onUpdateAvailable) {
      chrome.runtime.onUpdateAvailable.addListener((details) => {
        console.log('🆕 发现新版本:', details.version);
        this.handleUpdateAvailable(details);
      });
    }

    // 监听扩展安装/更新事件
    if (chrome.runtime.onInstalled) {
      chrome.runtime.onInstalled.addListener((details) => {
        if (details.reason === 'update') {
          console.log('✅ 扩展已更新到版本:', this.currentVersion);
          this.handleUpdateInstalled(details);
        }
      });
    }
  }

  /**
   * 检查是否需要检查更新
   */
  shouldCheckForUpdates() {
    const now = Date.now();
    return (now - this.lastCheckTime) > this.updateCheckInterval;
  }

  /**
   * 检查更新
   */
  async checkForUpdates() {
    console.log('🔍 检查扩展更新...');
    
    try {
      // 更新最后检查时间
      this.lastCheckTime = Date.now();
      await chrome.storage.local.set({ lastUpdateCheck: this.lastCheckTime });
      
      // Chrome会自动处理扩展更新检查
      // 这里我们主要是记录检查时间和处理更新通知
      
      // 检查是否有待安装的更新
      if (chrome.runtime.requestUpdateCheck) {
        const result = await chrome.runtime.requestUpdateCheck();
        
        switch (result.status) {
          case 'update_available':
            console.log('🆕 发现可用更新:', result.version);
            this.updateAvailable = true;
            this.newVersion = result.version;
            await this.notifyUpdateAvailable(result.version);
            break;
            
          case 'no_update':
            console.log('✅ 当前版本是最新的');
            break;
            
          case 'throttled':
            console.log('⏳ 更新检查被限制，稍后重试');
            break;
        }
      }
      
    } catch (error) {
      console.error('❌ 检查更新失败:', error);
    }
  }

  /**
   * 处理更新可用事件
   */
  async handleUpdateAvailable(details) {
    this.updateAvailable = true;
    this.newVersion = details.version;
    
    // 保存更新信息
    await chrome.storage.local.set({
      updateAvailable: true,
      newVersion: details.version,
      updateTime: Date.now()
    });
    
    // 通知用户
    await this.notifyUpdateAvailable(details.version);
    
    // 根据设置决定是否自动重启
    const settings = await this.getUpdateSettings();
    if (settings.autoRestart) {
      // 延迟重启，给用户时间保存工作
      setTimeout(() => {
        this.restartExtension();
      }, settings.restartDelay || 30000); // 默认30秒
    }
  }

  /**
   * 处理更新安装事件
   */
  async handleUpdateInstalled(details) {
    // 清除更新状态
    await chrome.storage.local.remove(['updateAvailable', 'newVersion', 'updateTime']);
    
    // 显示更新完成通知
    await this.showUpdateCompletedNotification(details.previousVersion);
    
    // 记录更新历史
    await this.recordUpdateHistory(details.previousVersion, this.currentVersion);
  }

  /**
   * 通知更新可用
   */
  async notifyUpdateAvailable(newVersion) {
    console.log('📢 通知用户更新可用:', newVersion);
    
    try {
      // 创建通知
      if (chrome.notifications) {
        await chrome.notifications.create('update-available', {
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: '扩展更新可用',
          message: `新版本 ${newVersion} 已可用，点击重启应用更新`,
          buttons: [
            { title: '立即更新' },
            { title: '稍后提醒' }
          ]
        });
        
        // 监听通知点击
        chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
          if (notificationId === 'update-available') {
            if (buttonIndex === 0) {
              this.restartExtension();
            } else {
              this.scheduleUpdateReminder();
            }
            chrome.notifications.clear(notificationId);
          }
        });
      }
      
      // 更新扩展图标（添加更新标识）
      if (chrome.action) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
      }
      
    } catch (error) {
      console.error('❌ 显示更新通知失败:', error);
    }
  }

  /**
   * 显示更新完成通知
   */
  async showUpdateCompletedNotification(previousVersion) {
    try {
      if (chrome.notifications) {
        await chrome.notifications.create('update-completed', {
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: '扩展更新完成',
          message: `已从版本 ${previousVersion} 更新到 ${this.currentVersion}`
        });
        
        // 3秒后自动清除通知
        setTimeout(() => {
          chrome.notifications.clear('update-completed');
        }, 3000);
      }
      
      // 清除图标标识
      if (chrome.action) {
        chrome.action.setBadgeText({ text: '' });
      }
      
    } catch (error) {
      console.error('❌ 显示更新完成通知失败:', error);
    }
  }

  /**
   * 重启扩展以应用更新
   */
  restartExtension() {
    console.log('🔄 重启扩展以应用更新...');
    
    try {
      if (chrome.runtime.reload) {
        chrome.runtime.reload();
      } else {
        // 备用方法：通知用户手动重启
        console.log('请手动重启扩展以应用更新');
      }
    } catch (error) {
      console.error('❌ 重启扩展失败:', error);
    }
  }

  /**
   * 安排更新提醒
   */
  async scheduleUpdateReminder() {
    const reminderTime = Date.now() + (2 * 60 * 60 * 1000); // 2小时后提醒
    
    await chrome.storage.local.set({
      updateReminderTime: reminderTime
    });
    
    console.log('⏰ 已安排2小时后提醒更新');
  }

  /**
   * 安排定期更新检查
   */
  scheduleUpdateCheck() {
    // 使用chrome.alarms API进行定期检查
    if (chrome.alarms) {
      chrome.alarms.create('updateCheck', {
        delayInMinutes: 60, // 1小时后开始
        periodInMinutes: 60 * 24 // 每24小时检查一次
      });
      
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'updateCheck') {
          this.checkForUpdates();
        }
      });
    }
  }

  /**
   * 获取更新设置
   */
  async getUpdateSettings() {
    const result = await chrome.storage.sync.get({
      autoUpdate: true,
      autoRestart: false,
      restartDelay: 30000,
      updateNotifications: true
    });
    
    return result;
  }

  /**
   * 更新设置
   */
  async updateSettings(settings) {
    await chrome.storage.sync.set(settings);
    console.log('✅ 更新设置已保存:', settings);
  }

  /**
   * 记录更新历史
   */
  async recordUpdateHistory(fromVersion, toVersion) {
    try {
      const result = await chrome.storage.local.get({ updateHistory: [] });
      const history = result.updateHistory;
      
      history.unshift({
        fromVersion,
        toVersion,
        updateTime: Date.now(),
        timestamp: new Date().toISOString()
      });
      
      // 只保留最近10次更新记录
      if (history.length > 10) {
        history.splice(10);
      }
      
      await chrome.storage.local.set({ updateHistory: history });
      
    } catch (error) {
      console.error('❌ 记录更新历史失败:', error);
    }
  }

  /**
   * 获取更新历史
   */
  async getUpdateHistory() {
    const result = await chrome.storage.local.get({ updateHistory: [] });
    return result.updateHistory;
  }

  /**
   * 获取当前更新状态
   */
  async getUpdateStatus() {
    const result = await chrome.storage.local.get([
      'updateAvailable',
      'newVersion',
      'updateTime',
      'updateReminderTime'
    ]);
    
    return {
      currentVersion: this.currentVersion,
      updateAvailable: result.updateAvailable || false,
      newVersion: result.newVersion || null,
      updateTime: result.updateTime || null,
      reminderTime: result.updateReminderTime || null,
      lastCheckTime: this.lastCheckTime
    };
  }

  /**
   * 手动检查更新
   */
  async manualUpdateCheck() {
    console.log('🔄 手动检查更新...');
    await this.checkForUpdates();
    return await this.getUpdateStatus();
  }

  /**
   * 清除更新状态
   */
  async clearUpdateStatus() {
    await chrome.storage.local.remove([
      'updateAvailable',
      'newVersion',
      'updateTime',
      'updateReminderTime'
    ]);
    
    this.updateAvailable = false;
    this.newVersion = null;
    
    // 清除图标标识
    if (chrome.action) {
      chrome.action.setBadgeText({ text: '' });
    }
  }
}

export default AutoUpdater;