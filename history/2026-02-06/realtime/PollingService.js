/**
 * 可配置轮询服务
 * 实现前端智能轮询逻辑，支持配置轮询间隔、重试机制和网络状态检测
 * 
 * @class PollingService
 */
class PollingService {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Function} options.fetchFunction - 数据获取函数，返回Promise
     * @param {Function} options.onSuccess - 成功回调
     * @param {Function} options.onError - 错误回调
     * @param {Object} pollingConfig - 轮询配置
     * @param {number} pollingConfig.normalInterval - 正常轮询间隔（默认30秒）
     * @param {number} pollingConfig.activeInterval - 用户活跃时轮询间隔（默认10秒）
     * @param {number} pollingConfig.backgroundInterval - 后台标签页轮询间隔（默认60秒）
     * @param {number} pollingConfig.retryDelay - 重试延迟（默认5秒）
     * @param {number} pollingConfig.maxRetries - 最大重试次数（默认3次）
     */
    constructor(options = {}) {
        this.options = {
            fetchFunction: options.fetchFunction || null,
            onSuccess: options.onSuccess || null,
            onError: options.onError || null,
            pollingConfig: {
                normalInterval: options.pollingConfig?.normalInterval || 30000,
                activeInterval: options.pollingConfig?.activeInterval || 10000,
                backgroundInterval: options.pollingConfig?.backgroundInterval || 60000,
                retryDelay: options.pollingConfig?.retryDelay || 5000,
                maxRetries: options.pollingConfig?.maxRetries || 3
            }
        };

        this.state = {
            isActive: false,
            currentInterval: this.options.pollingConfig.normalInterval,
            retryCount: 0,
            isOnline: navigator.onLine,
            isVisible: !document.hidden,
            isUserActive: true,
            timerId: null,
            lastFetchTime: null,
            lastSuccessTime: null,
            lastError: null
        };

        this.init();
    }

    /**
     * 初始化服务
     */
    init() {
        this.setupEventListeners();
        this.adjustPollingInterval();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 网络状态变化
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            this.resume();
        });

        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            this.pause();
        });

        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            this.state.isVisible = !document.hidden;
            this.adjustPollingInterval();
        });

        // 用户活动检测
        this.setupUserActivityDetection();
    }

    /**
     * 设置用户活动检测
     */
    setupUserActivityDetection() {
        const activityEvents = ['mousemove', 'keydown', 'scroll', 'touchstart'];
        let activityTimeout = null;

        const handleUserActive = () => {
            this.state.isUserActive = true;
            this.adjustPollingInterval();

            if (activityTimeout) clearTimeout(activityTimeout);
            activityTimeout = setTimeout(() => {
                this.state.isUserActive = false;
                this.adjustPollingInterval();
            }, 60000);
        };

        activityEvents.forEach(event => {
            document.addEventListener(event, handleUserActive, { passive: true });
        });

        handleUserActive(); // 初始触发
    }

    /**
     * 调整轮询间隔
     */
    adjustPollingInterval() {
        let newInterval = this.options.pollingConfig.normalInterval;

        if (!this.state.isOnline) {
            // 离线状态，延长轮询间隔
            newInterval = this.options.pollingConfig.backgroundInterval * 2;
        } else if (!this.state.isVisible) {
            // 后台标签页
            newInterval = this.options.pollingConfig.backgroundInterval;
        } else if (this.state.isUserActive) {
            // 用户活跃时
            newInterval = this.options.pollingConfig.activeInterval;
        }

        if (newInterval !== this.state.currentInterval) {
            this.state.currentInterval = newInterval;
            
            if (this.state.isActive) {
                this.restart();
            }
        }
    }

    /**
     * 开始轮询
     */
    start() {
        if (this.state.isActive) return;
        
        this.state.isActive = true;
        this.executePollingCycle();
    }

    /**
     * 暂停轮询
     */
    pause() {
        this.state.isActive = false;
        
        if (this.state.timerId) {
            clearTimeout(this.state.timerId);
            this.state.timerId = null;
        }
    }

    /**
     * 恢复轮询
     */
    resume() {
        if (!this.state.isActive) {
            this.state.isActive = true;
            this.executePollingCycle();
        }
    }

    /**
     * 重启轮询
     */
    restart() {
        this.pause();
        this.resume();
    }

    /**
     * 停止轮询（完全停止）
     */
    stop() {
        this.pause();
        this.state.retryCount = 0;
        this.state.lastError = null;
    }

    /**
     * 执行轮询周期
     */
    async executePollingCycle() {
        if (!this.state.isActive) return;

        try {
            this.state.lastFetchTime = new Date();
            
            if (!this.options.fetchFunction) {
                throw new Error('fetchFunction未配置');
            }

            const data = await this.options.fetchFunction();
            
            this.state.retryCount = 0;
            this.state.lastSuccessTime = new Date();
            this.state.lastError = null;

            if (this.options.onSuccess) {
                this.options.onSuccess(data);
            }
        } catch (error) {
            console.error('轮询失败:', error);
            await this.handleError(error);
        } finally {
            if (this.state.isActive) {
                this.state.timerId = setTimeout(() => {
                    this.executePollingCycle();
                }, this.state.currentInterval);
            }
        }
    }

    /**
     * 处理错误
     * @param {Error} error - 错误对象
     */
    async handleError(error) {
        this.state.lastError = error;
        this.state.retryCount++;

        if (this.state.retryCount >= this.options.pollingConfig.maxRetries) {
            this.pause();
            
            if (this.options.onError) {
                this.options.onError(error, 'max_retries_exceeded');
            }
        } else {
            await this.delay(this.options.pollingConfig.retryDelay);
        }
    }

    /**
     * 手动触发数据获取
     */
    async manualFetch() {
        try {
            if (!this.options.fetchFunction) {
                throw new Error('fetchFunction未配置');
            }

            const data = await this.options.fetchFunction();
            
            if (this.options.onSuccess) {
                this.options.onSuccess(data);
            }
            
            return data;
        } catch (error) {
            if (this.options.onError) {
                this.options.onError(error, 'manual_fetch_failed');
            }
            throw error;
        }
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        if (newConfig.pollingConfig) {
            Object.assign(this.options.pollingConfig, newConfig.pollingConfig);
            this.adjustPollingInterval();
        }
    }

    /**
     * 获取当前状态
     * @returns {Object} 状态对象
     */
    getState() {
        return {
            isActive: this.state.isActive,
            currentInterval: this.state.currentInterval,
            retryCount: this.state.retryCount,
            isOnline: this.state.isOnline,
            isVisible: this.state.isVisible,
            isUserActive: this.state.isUserActive,
            lastFetchTime: this.state.lastFetchTime,
            lastSuccessTime: this.state.lastSuccessTime,
            lastError: this.state.lastError
        };
    }

    /**
     * 延迟函数
     * @param {number} ms - 毫秒数
     * @returns {Promise} Promise对象
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 销毁服务
     */
    destroy() {
        this.stop();
        
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PollingService;
} else {
    window.PollingService = PollingService;
}