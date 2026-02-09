/**
 * 实时更新引擎集成模块
 * 将实时引擎集成到现有系统中
 * 
 * @class RealtimeIntegration
 */
class RealtimeIntegration {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
        this.options = {
            enableRealtime: options.enableRealtime !== false,
            enableDemo: options.enableDemo || false,
            pollingInterval: options.pollingInterval || 30000,
            dataPath: options.dataPath || 'data/daily/{date}.json',
            enableNotifications: options.enableNotifications !== false,
            enablePerformance: options.enablePerformance !== false
        };

        this.engine = null;
        this.demo = null;
        this.currentDate = this.getCurrentDate();
        
        this.init();
    }

    /**
     * 初始化集成
     */
    async init() {
        console.log('初始化实时更新集成...');

        // 启用实时更新
        if (this.options.enableRealtime) {
            await this.initEngine();
        }

        // 启用演示界面
        if (this.options.enableDemo) {
            await this.initDemo();
        }

        // 设置事件监听
        this.setupEventListeners();

        console.log('实时更新集成初始化完成');
    }

    /**
     * 初始化引擎
     * @returns {Promise} 引擎初始化完成的Promise
     */
    async initEngine() {
        try {
            console.log('正在初始化实时更新引擎...');

            // 创建引擎实例
            this.engine = new RealTimeEngine({
                apiEndpoint: this.getApiEndpoint(),
                pollingConfig: {
                    normalInterval: this.options.pollingInterval,
                    activeInterval: 10000,
                    backgroundInterval: 60000,
                    retryDelay: 5000,
                    maxRetries: 3
                },
                onDataUpdate: (changes, newData) => {
                    this.handleEngineUpdate(changes, newData);
                },
                enableCache: true,
                enablePerformanceMonitor: this.options.enablePerformance
            });

            // 等待引擎初始化
            await this.waitForEngineInit();
            
            // 启动引擎
            this.engine.start();

            console.log('实时更新引擎已启动');
            return true;
        } catch (error) {
            console.error('实时更新引擎初始化失败:', error);
            return false;
        }
    }

    /**
     * 初始化演示
     * @returns {Promise} 演示初始化完成的Promise
     */
    async initDemo() {
        try {
            console.log('正在初始化实时更新演示...');

            // 创建演示实例
            this.demo = new RealTimeDemo({
                containerSelector: '#realtime-demo-panel',
                apiEndpoint: this.getApiEndpoint(),
                enableUI: true
            });

            console.log('实时更新演示已启动');
            return true;
        } catch (error) {
            console.error('实时更新演示初始化失败:', error);
            return false;
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听引擎事件
        if (this.engine) {
            document.addEventListener('realtime-update', (event) => {
                this.handleRealtimeEvent(event.detail);
            });

            document.addEventListener('realtime-error', (event) => {
                this.handleRealtimeError(event.detail);
            });
        }

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange(!document.hidden);
        });

        // 监听离线状态
        window.addEventListener('offline', () => {
            this.handleOfflineStatusChange(false);
        });

        window.addEventListener('online', () => {
            this.handleOfflineStatusChange(true);
        });

        // 监听自定义消息
        document.addEventListener('realtime-message', (event) => {
            this.handleCustomMessage(event.detail);
        });
    }

    /**
     * 处理引擎更新
     * @param {Object} changes - 变化数据
     * @param {Object} newData - 新数据
     */
    handleEngineUpdate(changes, newData) {
        console.log('实时更新引擎检测到数据变化:', changes);

        // 触发全局事件
        this.dispatchEvent('realtime-update-detected', {
            changes,
            newData,
            timestamp: Date.now()
        });

        // 如果有新增或更新，显示通知
        if ((changes.added.length > 0 || changes.updated.length > 0) && 
            this.options.enableNotifications) {
            this.showUpdateNotification(changes);
        }

        // 更新UI
        this.updateUIForChanges(changes, newData);
    }

    /**
     * 处理实时事件
     * @param {Object} eventDetail - 事件详情
     */
    handleRealtimeEvent(eventDetail) {
        // 根据事件类型处理
        switch (eventDetail.type) {
            case 'data-update':
                this.handleDataUpdate(eventDetail.changes, eventDetail.data);
                break;
            case 'polling-started':
                this.updatePollingStatus(true);
                break;
            case 'polling-stopped':
                this.updatePollingStatus(false);
                break;
            default:
                console.log('未知实时事件:', eventDetail);
        }
    }

    /**
     * 处理实时错误
     * @param {Object} errorDetail - 错误详情
     */
    handleRealtimeError(errorDetail) {
        console.error('实时更新错误:', errorDetail);

        // 显示错误通知
        this.showErrorNotification(errorDetail.error, errorDetail.reason);

        // 记录错误统计
        this.logError(errorDetail);
    }

    /**
     * 处理可见性变化
     * @param {boolean} isVisible - 是否可见
     */
    handleVisibilityChange(isVisible) {
        if (this.engine) {
            if (isVisible) {
                console.log('页面可见，恢复轮询');
                this.engine.resumePolling();
            } else {
                console.log('页面隐藏，暂停轮询');
                this.engine.pausePolling();
            }
        }
    }

    /**
     * 处理离线状态变化
     * @param {boolean} isOnline - 是否在线
     */
    handleOfflineStatusChange(isOnline) {
        console.log(`网络状态: ${isOnline ? '在线' : '离线'}`);

        if (this.engine) {
            const state = this.engine.getState();
            console.log('当前引擎状态:', state);
        }

        // 更新UI状态
        this.updateNetworkStatus(isOnline);
    }

    /**
     * 处理自定义消息
     * @param {Object} messageDetail - 消息详情
     */
    handleCustomMessage(messageDetail) {
        console.log('收到自定义消息:', messageDetail);
        // 处理自定义消息逻辑
    }

    /**
     * 等待引擎初始化
     * @returns {Promise} 初始化完成的Promise
     */
    waitForEngineInit() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 30; // 30 * 100ms = 3秒超时

            const checkInit = () => {
                attempts++;
                
                if (this.engine && this.engine.getState().isInitialized) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('引擎初始化超时'));
                } else {
                    setTimeout(checkInit, 100);
                }
            };

            checkInit();
        });
    }

    /**
     * 获取当前日期
     * @returns {string} 当前日期字符串
     */
    getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 获取API端点
     * @returns {string} API端点URL
     */
    getApiEndpoint() {
        const currentDate = this.getCurrentDate();
        return this.options.dataPath.replace('{date}', currentDate);
    }

    /**
     * 显示更新通知
     * @param {Object} changes - 变化数据
     */
    showUpdateNotification(changes) {
        const notificationData = {
            title: '金融洞察更新',
            body: '',
            icon: '/assets/logo.png'
        };

        if (changes.added.length > 0) {
            notificationData.body = `新增${changes.added.length}条金融洞察`;
        } else if (changes.updated.length > 0) {
            notificationData.body = `更新${changes.updated.length}条金融洞察`;
        }

        if (notificationData.body) {
            // 检查浏览器是否支持通知
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notificationData.title, notificationData);
            } else if ('Notification' in window && Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(notificationData.title, notificationData);
                    }
                });
            }
        }
    }

    /**
     * 显示错误通知
     * @param {string} error - 错误消息
     * @param {string} reason - 错误原因
     */
    showErrorNotification(error, reason) {
        // 在控制台显示
        console.error(`实时更新错误 [${reason}]:`, error);

        // 如果启用了通知，可以在这里添加UI通知
        // 例如：显示一个临时错误提示框
        const errorElement = document.getElementById('realtime-error-indicator');
        if (errorElement) {
            errorElement.textContent = `连接错误: ${reason}`;
            errorElement.style.display = 'block';
            
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * 更新UI
     * @param {Object} changes - 变化数据
     * @param {Object} newData - 新数据
     */
    updateUIForChanges(changes, newData) {
        // 更新UI组件
        this.updateCounter(changes);
        this.updateTimestamp();
        this.updateStatusIndicator();

        // 如果有新增项目，滚动到最新
        if (changes.added.length > 0) {
            this.scrollToLatest();
        }

        // 触发UI更新事件
        this.dispatchEvent('ui-updated', {
            changes,
            newData,
            timestamp: Date.now()
        });
    }

    /**
     * 更新计数器
     * @param {Object} changes - 变化数据
     */
    updateCounter(changes) {
        // 更新页面上的计数器
        const counterElement = document.getElementById('update-counter');
        if (counterElement) {
            const currentCount = parseInt(counterElement.textContent) || 0;
            const newCount = currentCount + changes.added.length + changes.updated.length;
            counterElement.textContent = newCount;
        }
    }

    /**
     * 更新时间戳
     */
    updateTimestamp() {
        const timestampElement = document.getElementById('last-update-time');
        if (timestampElement) {
            const now = new Date();
            timestampElement.textContent = now.toLocaleTimeString();
        }
    }

    /**
     * 更新状态指示器
     */
    updateStatusIndicator() {
        const indicator = document.getElementById('realtime-status');
        if (indicator) {
            indicator.textContent = '在线';
            indicator.className = 'status-indicator active';
        }
    }

    /**
     * 更新网络状态
     * @param {boolean} isOnline - 是否在线
     */
    updateNetworkStatus(isOnline) {
        const statusElement = document.getElementById('network-status');
        if (statusElement) {
            statusElement.textContent = isOnline ? '在线' : '离线';
            statusElement.className = `network-status ${isOnline ? 'online' : 'offline'}`;
        }
    }

    /**
     * 滚动到最新内容
     */
    scrollToLatest() {
        // 滚动到最新添加的洞察
        const latestInsight = document.querySelector('.insight-item:last-child');
        if (latestInsight) {
            latestInsight.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            });
        }
    }

    /**
     * 分发事件
     * @param {string} eventName - 事件名称
     * @param {Object} detail - 事件详情
     */
    dispatchEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    /**
     * 记录错误
     * @param {Object} errorDetail - 错误详情
     */
    logError(errorDetail) {
        // 将错误记录到存储或发送到监控服务
        const errorLog = {
            timestamp: Date.now(),
            error: errorDetail.error,
            reason: errorDetail.reason,
            engineState: errorDetail.engineState
        };

        console.log('记录错误:', errorLog);
        
        // 可以在这里添加错误报告逻辑
        // 例如：发送到错误监控服务或保存到本地存储
    }

    /**
     * 获取引擎状态
     * @returns {Object} 引擎状态
     */
    getEngineState() {
        return this.engine ? this.engine.getState() : null;
    }

    /**
     * 获取引擎实例
     * @returns {RealTimeEngine|null} 引擎实例
     */
    getEngine() {
        return this.engine;
    }

    /**
     * 获取演示实例
     * @returns {RealTimeDemo|null} 演示实例
     */
    getDemo() {
        return this.demo;
    }

    /**
     * 手动触发刷新
     * @returns {Promise} 刷新完成的Promise
     */
    async manualRefresh() {
        if (this.engine) {
            return this.engine.manualRefresh();
        }
        return Promise.reject(new Error('引擎未初始化'));
    }

    /**
     * 启用实时更新
     * @returns {Promise} 启用完成的Promise
     */
    async enableRealtime() {
        this.options.enableRealtime = true;
        return this.initEngine();
    }

    /**
     * 禁用实时更新
     */
    disableRealtime() {
        if (this.engine) {
            this.engine.stop();
        }
        this.options.enableRealtime = false;
    }

    /**
     * 启用演示
     * @returns {Promise} 启用完成的Promise
     */
    async enableDemo() {
        this.options.enableDemo = true;
        return this.initDemo();
    }

    /**
     * 禁用演示
     */
    disableDemo() {
        if (this.demo) {
            this.demo.destroy();
        }
        this.options.enableDemo = false;
    }

    /**
     * 销毁集成
     */
    destroy() {
        console.log('销毁实时更新集成...');

        // 停止引擎
        if (this.engine) {
            this.engine.destroy();
            this.engine = null;
        }

        // 销毁演示
        if (this.demo) {
            this.demo.destroy();
            this.demo = null;
        }

        // 清理事件监听器
        this.cleanupEventListeners();

        console.log('实时更新集成已销毁');
    }

    /**
     * 清理事件监听器
     */
    cleanupEventListeners() {
        // 这里可以清理全局事件监听器
        // 注意：使用addEventListener添加的事件需要使用removeEventListener清理
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealtimeIntegration;
} else {
    window.RealtimeIntegration = RealtimeIntegration;
}