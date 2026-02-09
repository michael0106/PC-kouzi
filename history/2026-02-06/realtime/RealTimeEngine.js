/**
 * 实时更新引擎主类
 * 整合轮询服务、变化检测、增量渲染、缓存管理和性能监控
 * 
 * @class RealTimeEngine
 */
class RealTimeEngine {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.apiEndpoint - API端点URL
     * @param {Function} options.onDataUpdate - 数据更新回调
     * @param {Object} options.pollingConfig - 轮询配置
     * @param {boolean} options.enableCache - 是否启用缓存（默认true）
     * @param {boolean} options.enablePerformanceMonitor - 是否启用性能监控（默认true）
     * @param {Function} options.renderFunction - 自定义渲染函数
     */
    constructor(options = {}) {
        this.options = {
            apiEndpoint: options.apiEndpoint || '/api/insights/latest',
            onDataUpdate: options.onDataUpdate || null,
            pollingConfig: {
                normalInterval: options.pollingConfig?.normalInterval || 30000,
                activeInterval: options.pollingConfig?.activeInterval || 10000,
                backgroundInterval: options.pollingConfig?.backgroundInterval || 60000,
                retryDelay: options.pollingConfig?.retryDelay || 5000,
                maxRetries: options.pollingConfig?.maxRetries || 3
            },
            enableCache: options.enableCache !== false,
            enablePerformanceMonitor: options.enablePerformanceMonitor !== false,
            renderFunction: options.renderFunction || null,
            enablePullToRefresh: options.enablePullToRefresh !== false,
            changeDetection: {
                deepCompare: options.changeDetection?.deepCompare !== false,
                keyFields: options.changeDetection?.keyFields || ['id'],
                ignoreFields: options.changeDetection?.ignoreFields || ['generated_at', 'last_updated']
            }
        };

        this.state = {
            isInitialized: false,
            isActive: false,
            currentData: null,
            lastUpdateId: null,
            lastUpdateTime: null,
            error: null,
            stats: {
                totalUpdates: 0,
                successfulUpdates: 0,
                failedUpdates: 0,
                averageUpdateTime: 0,
                lastUpdateTime: 0
            }
        };

        // 初始化模块
        this.modules = {
            polling: null,
            changeDetector: null,
            renderer: null,
            cache: null,
            stateManager: null,
            performance: null
        };

        this.init();
    }

    /**
     * 初始化引擎
     * @returns {Promise} 初始化完成的Promise
     */
    async init() {
        try {
            console.log('正在初始化实时更新引擎...');

            // 1. 初始化状态管理器
            this.modules.stateManager = new RealTimeState({
                initialState: {
                    engine: this.state,
                    polling: {
                        isActive: false,
                        interval: this.options.pollingConfig.normalInterval,
                        lastPollTime: null
                    },
                    data: {
                        currentDate: null,
                        lastUpdateId: null,
                        lastUpdateTime: null,
                        hasUpdates: false,
                        isLoading: false,
                        error: null
                    }
                },
                enableDevTools: false
            });

            // 2. 初始化缓存管理器
            if (this.options.enableCache) {
                this.modules.cache = new CacheManager({
                    cacheName: 'financial-insights-realtime',
                    maxSizeMB: 50,
                    defaultTTL: 5 * 60 * 1000 // 5分钟
                });
            }

            // 3. 初始化变化检测器
            this.modules.changeDetector = new ChangeDetector({
                keyFields: this.options.changeDetection.keyFields,
                deepCompare: this.options.changeDetection.deepCompare,
                ignoreFields: this.options.changeDetection.ignoreFields
            });

            // 4. 初始化增量渲染器
            this.modules.renderer = new IncrementalRenderer({
                containerSelector: '#insights-container',
                enableAnimation: true,
                animation: {
                    duration: 300,
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
                },
                cardTemplate: this.options.renderFunction || null
            });

            // 5. 初始化轮询服务
            this.modules.polling = new PollingService({
                fetchFunction: () => this.fetchData(),
                onSuccess: (data) => this.handleDataUpdate(data),
                onError: (error, reason) => this.handlePollingError(error, reason),
                pollingConfig: this.options.pollingConfig
            });

            // 6. 初始化性能监控器
            if (this.options.enablePerformanceMonitor) {
                this.modules.performance = new PerformanceMonitor({
                    metrics: {
                        polling: true,
                        rendering: true,
                        network: true,
                        userInteraction: true
                    },
                    enableRealTimeStats: true,
                    statsInterval: 60000,
                    onReport: (report) => this.handlePerformanceReport(report)
                });
            }

            // 7. 设置事件监听
            this.setupEventListeners();

            // 8. 加载初始数据
            await this.loadInitialData();

            this.state.isInitialized = true;
            console.log('实时更新引擎初始化完成');

            return true;
        } catch (error) {
            console.error('实时更新引擎初始化失败:', error);
            this.state.error = error.message;
            return false;
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听性能指标
        if (this.modules.performance) {
            document.addEventListener('performance-metric', (event) => {
                this.handlePerformanceMetric(event.detail);
            });
        }

        // 监听网络状态变化
        window.addEventListener('online', () => {
            this.handleNetworkStatusChange(true);
        });

        window.addEventListener('offline', () => {
            this.handleNetworkStatusChange(false);
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange(!document.hidden);
        });

        // 监听自定义更新事件
        document.addEventListener('feedupdate', (event) => {
            this.handleFeedUpdate(event.detail);
        });
    }

    /**
     * 加载初始数据
     * @returns {Promise} 加载完成的Promise
     */
    async loadInitialData() {
        try {
            // 尝试从缓存加载
            let data = null;
            if (this.modules.cache) {
                data = await this.modules.cache.get('initial_data');
            }

            // 如果缓存中没有或已过期，从API获取
            if (!data) {
                data = await this.fetchData();
                
                // 保存到缓存
                if (this.modules.cache) {
                    await this.modules.cache.set('initial_data', data, {
                        ttl: 5 * 60 * 1000, // 5分钟
                        type: 'json',
                        priority: 10
                    });
                }
            }

            // 设置初始数据
            this.state.currentData = data;
            this.state.lastUpdateId = data.update_id;
            this.state.lastUpdateTime = Date.now();

            // 渲染初始数据
            await this.renderData(data);

            return data;
        } catch (error) {
            console.error('加载初始数据失败:', error);
            throw error;
        }
    }

    /**
     * 获取数据
     * @returns {Promise} 数据获取完成的Promise
     */
    async fetchData() {
        const startTime = performance.now();
        let timerId = null;

        if (this.modules.performance) {
            timerId = this.modules.performance.recordPollingStart({
                endpoint: this.options.apiEndpoint
            });
        }

        try {
            const headers = {};
            
            // 添加最后更新ID（如果存在）
            if (this.state.lastUpdateId) {
                headers['Last-Update-ID'] = this.state.lastUpdateId;
            }

            const response = await fetch(this.options.apiEndpoint, { headers });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // 验证响应格式
            if (data.status !== 'success') {
                throw new Error(data.error?.message || 'API返回错误');
            }

            // 记录性能指标
            if (this.modules.performance) {
                this.modules.performance.recordPollingEnd(timerId, true, {
                    size: JSON.stringify(data).length,
                    latency: performance.now() - startTime
                });

                // 记录网络请求
                this.modules.performance.recordNetworkRequest(
                    this.options.apiEndpoint,
                    startTime,
                    performance.now(),
                    true,
                    JSON.stringify(data).length
                );
            }

            return data.data || data;
        } catch (error) {
            // 记录失败指标
            if (this.modules.performance) {
                this.modules.performance.recordPollingEnd(timerId, false, {
                    error: error.message
                });

                this.modules.performance.recordNetworkRequest(
                    this.options.apiEndpoint,
                    startTime,
                    performance.now(),
                    false,
                    0
                );
            }

            throw error;
        }
    }

    /**
     * 处理数据更新
     * @param {Object} newData - 新数据
     */
    async handleDataUpdate(newData) {
        try {
            const oldData = this.state.currentData;
            
            // 检测数据变化
            const changes = this.modules.changeDetector.detectChanges(
                oldData?.insights || [],
                newData.insights || []
            );

            // 如果有变化，处理更新
            if (changes.hasChanges) {
                // 更新状态
                this.state.currentData = newData;
                this.state.lastUpdateId = newData.update_id;
                this.state.lastUpdateTime = Date.now();
                this.state.stats.totalUpdates++;
                this.state.stats.successfulUpdates++;
                this.state.error = null;

                // 更新状态管理器
                if (this.modules.stateManager) {
                    this.modules.stateManager.dispatch({
                        type: 'DATA_UPDATED',
                        payload: {
                            date: newData.date,
                            updateId: newData.update_id,
                            changes: changes.summary
                        }
                    });
                }

                // 渲染更新
                const renderStartTime = performance.now();
                let renderTimerId = null;

                if (this.modules.performance) {
                    renderTimerId = this.modules.performance.recordRenderStart(
                        changes.hasChanges ? 'incremental' : 'full',
                        { changes: changes.summary }
                    );
                }

                try {
                    await this.modules.renderer.renderUpdates(changes, newData);

                    // 记录渲染性能
                    if (this.modules.performance) {
                        this.modules.performance.recordRenderEnd(
                            renderTimerId,
                            newData.insights?.length || 0,
                            { changes: changes.summary }
                        );
                    }
                } catch (renderError) {
                    console.error('渲染失败:', renderError);
                    
                    if (this.modules.performance) {
                        this.modules.performance.recordRenderEnd(
                            renderTimerId,
                            0,
                            { error: renderError.message }
                        );
                    }
                }

                // 触发自定义回调
                if (this.options.onDataUpdate) {
                    this.options.onDataUpdate(changes, newData);
                }

                // 触发更新事件
                this.emitUpdateEvent(changes, newData);

                // 更新缓存
                if (this.modules.cache) {
                    await this.updateCache(newData, changes);
                }

                console.log('数据更新处理完成', changes.summary);
            } else {
                console.log('数据无变化，跳过更新');
            }
        } catch (error) {
            console.error('处理数据更新失败:', error);
            this.handleError(error);
        }
    }

    /**
     * 渲染数据
     * @param {Object} data - 要渲染的数据
     */
    async renderData(data) {
        if (!this.modules.renderer) return;

        try {
            const renderStartTime = performance.now();
            let timerId = null;

            if (this.modules.performance) {
                timerId = this.modules.performance.recordRenderStart('full', {
                    cards: data.insights?.length || 0
                });
            }

            // 清空容器并重新渲染
            this.modules.renderer.clearContainer();
            
            // 批量渲染卡片
            const cards = data.insights || [];
            for (let i = 0; i < cards.length; i += 10) {
                const batch = cards.slice(i, i + 10);
                await Promise.all(
                    batch.map(insight => {
                        const card = this.modules.renderer.createCard(insight);
                        this.modules.renderer.container.appendChild(card);
                    })
                );

                // 小延迟避免阻塞主线程
                if (i + 10 < cards.length) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            if (this.modules.performance) {
                this.modules.performance.recordRenderEnd(
                    timerId,
                    cards.length,
                    { type: 'initial_render' }
                );
            }
        } catch (error) {
            console.error('渲染数据失败:', error);
            throw error;
        }
    }

    /**
     * 更新缓存
     * @param {Object} newData - 新数据
     * @param {Object} changes - 变化数据
     */
    async updateCache(newData, changes) {
        try {
            // 缓存完整数据
            await this.modules.cache.set(`data_${newData.date}_${newData.update_id}`, newData, {
                ttl: 30 * 60 * 1000, // 30分钟
                type: 'json',
                priority: 8
            });

            // 缓存变化数据
            if (changes.hasChanges) {
                await this.modules.cache.set(`changes_${newData.update_id}`, changes, {
                    ttl: 10 * 60 * 1000, // 10分钟
                    type: 'json',
                    priority: 6
                });
            }

            // 更新最后数据引用
            await this.modules.cache.set('latest_data', {
                date: newData.date,
                update_id: newData.update_id,
                timestamp: Date.now()
            }, {
                ttl: 5 * 60 * 1000, // 5分钟
                type: 'json',
                priority: 9
            });
        } catch (error) {
            console.warn('更新缓存失败:', error);
        }
    }

    /**
     * 处理轮询错误
     * @param {Error} error - 错误对象
     * @param {string} reason - 错误原因
     */
    handlePollingError(error, reason) {
        console.error('轮询错误:', error, reason);
        
        this.state.error = error.message;
        this.state.stats.failedUpdates++;
        
        // 更新状态管理器
        if (this.modules.stateManager) {
            this.modules.stateManager.dispatch({
                type: 'DATA_LOADING_FAILED',
                payload: { error: error.message, reason }
            });
        }

        // 触发错误事件
        this.emitErrorEvent(error, reason);
    }

    /**
     * 处理网络状态变化
     * @param {boolean} isOnline - 是否在线
     */
    handleNetworkStatusChange(isOnline) {
        console.log(`网络状态变化: ${isOnline ? '在线' : '离线'}`);
        
        if (this.modules.stateManager) {
            this.modules.stateManager.dispatch({
                type: 'NETWORK_STATUS_CHANGED',
                payload: { isOnline }
            });
        }

        if (isOnline) {
            // 网络恢复，尝试重新连接
            this.reconnect();
        }
    }

    /**
     * 处理页面可见性变化
     * @param {boolean} isVisible - 是否可见
     */
    handleVisibilityChange(isVisible) {
        console.log(`页面可见性变化: ${isVisible ? '可见' : '隐藏'}`);
        
        if (this.modules.stateManager) {
            this.modules.stateManager.dispatch({
                type: 'VISIBILITY_CHANGED',
                payload: { isVisible }
            });
        }

        // 调整轮询行为
        if (isVisible) {
            this.resumePolling();
        } else {
            this.pausePolling();
        }
    }

    /**
     * 处理性能指标
     * @param {Object} metric - 性能指标
     */
    handlePerformanceMetric(metric) {
        // 可以在这里处理特定的性能指标
        // 例如：监控轮询延迟过高时发出警告
        if (metric.type === 'polling' && metric.data.duration > 5000) {
            console.warn('轮询响应时间过长:', metric.data.duration);
        }
    }

    /**
     * 处理性能报告
     * @param {Object} report - 性能报告
     */
    handlePerformanceReport(report) {
        // 可以在这里处理性能报告
        // 例如：发送到分析服务或显示给用户
        console.log('性能报告生成:', report.summary);
    }

    /**
     * 处理feed更新
     * @param {Object} detail - 更新详情
     */
    handleFeedUpdate(detail) {
        // 可以在这里处理feed更新事件
        console.log('Feed更新事件:', detail);
    }

    /**
     * 处理错误
     * @param {Error} error - 错误对象
     */
    handleError(error) {
        this.state.error = error.message;
        
        // 触发错误事件
        this.emitErrorEvent(error, 'engine_error');
    }

    /**
     * 开始轮询
     */
    startPolling() {
        if (this.modules.polling) {
            this.modules.polling.start();
            this.state.isActive = true;
            
            if (this.modules.stateManager) {
                this.modules.stateManager.dispatch({
                    type: 'POLLING_STARTED'
                });
            }
        }
    }

    /**
     * 暂停轮询
     */
    pausePolling() {
        if (this.modules.polling) {
            this.modules.polling.pause();
            
            if (this.modules.stateManager) {
                this.modules.stateManager.dispatch({
                    type: 'POLLING_STOPPED'
                });
            }
        }
    }

    /**
     * 恢复轮询
     */
    resumePolling() {
        if (this.modules.polling) {
            this.modules.polling.resume();
            this.state.isActive = true;
            
            if (this.modules.stateManager) {
                this.modules.stateManager.dispatch({
                    type: 'POLLING_STARTED'
                });
            }
        }
    }

    /**
     * 停止轮询
     */
    stopPolling() {
        if (this.modules.polling) {
            this.modules.polling.stop();
            this.state.isActive = false;
            
            if (this.modules.stateManager) {
                this.modules.stateManager.dispatch({
                    type: 'POLLING_STOPPED'
                });
            }
        }
    }

    /**
     * 重新连接
     */
    reconnect() {
        console.log('尝试重新连接...');
        
        // 停止当前轮询
        this.stopPolling();
        
        // 延迟后重新开始
        setTimeout(() => {
            this.startPolling();
        }, 2000);
    }

    /**
     * 手动刷新
     */
    async manualRefresh() {
        console.log('手动刷新...');
        
        try {
            const data = await this.fetchData();
            await this.handleDataUpdate(data);
        } catch (error) {
            console.error('手动刷新失败:', error);
        }
    }

    /**
     * 发射更新事件
     * @param {Object} changes - 变化数据
     * @param {Object} newData - 新数据
     */
    emitUpdateEvent(changes, newData) {
        const event = new CustomEvent('realtime-update', {
            detail: {
                changes,
                data: newData,
                timestamp: Date.now(),
                engineState: this.getState()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * 发射错误事件
     * @param {Error} error - 错误对象
     * @param {string} reason - 错误原因
     */
    emitErrorEvent(error, reason) {
        const event = new CustomEvent('realtime-error', {
            detail: {
                error: error.message,
                reason,
                timestamp: Date.now(),
                engineState: this.getState()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * 获取引擎状态
     * @returns {Object} 状态对象
     */
    getState() {
        return {
            isInitialized: this.state.isInitialized,
            isActive: this.state.isActive,
            currentDate: this.state.currentData?.date,
            lastUpdateId: this.state.lastUpdateId,
            lastUpdateTime: this.state.lastUpdateTime,
            error: this.state.error,
            stats: { ...this.state.stats },
            modules: {
                polling: this.modules.polling?.getState(),
                cache: this.modules.cache?.getStats(),
                performance: this.modules.performance?.getState(),
                stateManager: this.modules.stateManager?.getState()
            }
        };
    }

    /**
     * 获取模块实例
     * @param {string} moduleName - 模块名称
     * @returns {Object|null} 模块实例
     */
    getModule(moduleName) {
        return this.modules[moduleName] || null;
    }

    /**
     * 更新配置
     * @param {Object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        // 更新轮询配置
        if (newConfig.pollingConfig && this.modules.polling) {
            this.modules.polling.updateConfig(newConfig);
        }

        // 更新其他配置
        Object.assign(this.options, newConfig);
    }

    /**
     * 开始引擎
     */
    start() {
        this.startPolling();
    }

    /**
     * 停止引擎
     */
    stop() {
        this.stopPolling();
    }

    /**
     * 销毁引擎
     */
    destroy() {
        console.log('销毁实时更新引擎...');
        
        // 停止所有模块
        this.stop();
        
        // 销毁轮询服务
        if (this.modules.polling) {
            this.modules.polling.destroy();
        }
        
        // 销毁缓存管理器
        if (this.modules.cache) {
            this.modules.cache.destroy();
        }
        
        // 销毁渲染器
        if (this.modules.renderer) {
            this.modules.renderer.destroy();
        }
        
        // 销毁性能监控器
        if (this.modules.performance) {
            this.modules.performance.destroy();
        }
        
        // 销毁状态管理器
        if (this.modules.stateManager) {
            this.modules.stateManager.destroy();
        }
        
        // 清理状态
        this.state = {
            isInitialized: false,
            isActive: false,
            currentData: null,
            lastUpdateId: null,
            lastUpdateTime: null,
            error: null,
            stats: {
                totalUpdates: 0,
                successfulUpdates: 0,
                failedUpdates: 0,
                averageUpdateTime: 0,
                lastUpdateTime: 0
            }
        };
        
        console.log('实时更新引擎已销毁');
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeEngine;
} else {
    window.RealTimeEngine = RealTimeEngine;
}