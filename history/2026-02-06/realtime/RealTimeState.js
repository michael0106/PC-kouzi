/**
 * 实时状态管理器
 * 统一管理实时更新相关的状态和事件
 * 
 * @class RealTimeState
 */
class RealTimeState {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Object} options.initialState - 初始状态
     * @param {Array} options.middleware - 中间件数组
     * @param {boolean} options.enableDevTools - 是否启用开发工具（默认false）
     */
    constructor(options = {}) {
        this.options = {
            initialState: options.initialState || this.getDefaultState(),
            middleware: options.middleware || [],
            enableDevTools: options.enableDevTools || false,
            persistence: options.persistence || {
                enabled: false,
                key: 'realtime-state',
                storage: 'localStorage'
            }
        };

        this.state = { ...this.options.initialState };
        this.listeners = new Set();
        this.middleware = this.options.middleware;
        this.isDispatching = false;
        this.history = [];
        this.maxHistorySize = 50;

        this.init();
    }

    /**
     * 获取默认状态
     * @returns {Object} 默认状态对象
     */
    getDefaultState() {
        return {
            // 轮询状态
            polling: {
                isActive: false,
                interval: 30000,
                lastPollTime: null,
                nextPollTime: null,
                retryCount: 0,
                maxRetries: 3
            },
            
            // 数据状态
            data: {
                currentDate: null,
                lastUpdateId: null,
                lastUpdateTime: null,
                hasUpdates: false,
                isLoading: false,
                error: null
            },
            
            // 用户状态
            user: {
                isOnline: navigator.onLine,
                isVisible: !document.hidden,
                isActive: true,
                lastActivityTime: Date.now()
            },
            
            // 缓存状态
            cache: {
                currentSize: 0,
                maxSize: 50 * 1024 * 1024, // 50MB
                items: 0,
                hitRate: 0,
                lastCleanup: null
            },
            
            // 性能状态
            performance: {
                lastPollDuration: 0,
                lastRenderDuration: 0,
                averagePollDuration: 0,
                averageRenderDuration: 0,
                totalPolls: 0,
                totalRenders: 0
            },
            
            // UI状态
            ui: {
                isRefreshing: false,
                lastManualRefresh: null,
                showUpdateNotification: false,
                autoRefreshEnabled: true,
                theme: 'dark'
            },
            
            // 时间戳
            timestamp: Date.now(),
            
            // 版本
            version: '1.0.0'
        };
    }

    /**
     * 初始化状态管理器
     */
    init() {
        // 加载持久化状态
        if (this.options.persistence.enabled) {
            this.loadPersistedState();
        }

        // 设置状态变更历史记录
        this.setupHistoryTracking();

        // 初始化开发工具
        if (this.options.enableDevTools && window.__REDUX_DEVTOOLS_EXTENSION__) {
            this.setupDevTools();
        }

        // 设置网络状态监听
        this.setupNetworkListeners();

        // 设置页面可见性监听
        this.setupVisibilityListeners();
    }

    /**
     * 设置网络状态监听
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.dispatch({
                type: 'NETWORK_STATUS_CHANGED',
                payload: { isOnline: true }
            });
        });

        window.addEventListener('offline', () => {
            this.dispatch({
                type: 'NETWORK_STATUS_CHANGED',
                payload: { isOnline: false }
            });
        });
    }

    /**
     * 设置页面可见性监听
     */
    setupVisibilityListeners() {
        document.addEventListener('visibilitychange', () => {
            this.dispatch({
                type: 'VISIBILITY_CHANGED',
                payload: { isVisible: !document.hidden }
            });
        });
    }

    /**
     * 设置历史跟踪
     */
    setupHistoryTracking() {
        // 添加初始状态到历史
        this.history.push({
            timestamp: Date.now(),
            action: { type: '@@INIT' },
            state: { ...this.state }
        });
    }

    /**
     * 设置开发工具
     */
    setupDevTools() {
        try {
            this.devTools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({
                name: 'RealTimeState',
                features: {
                    pause: true,
                    lock: true,
                    persist: true,
                    export: true,
                    import: 'custom',
                    jump: true,
                    skip: true,
                    reorder: true,
                    dispatch: true,
                    test: true
                }
            });

            this.devTools.init(this.state);

            // 监听开发工具动作
            this.devTools.subscribe((message) => {
                if (message.type === 'DISPATCH' && message.payload.type === 'JUMP_TO_ACTION') {
                    const index = parseInt(message.payload.actionId, 10);
                    if (index >= 0 && index < this.history.length) {
                        this.state = { ...this.history[index].state };
                        this.notifyListeners();
                    }
                }
            });
        } catch (error) {
            console.warn('Redux DevTools初始化失败:', error);
        }
    }

    /**
     * 加载持久化状态
     */
    loadPersistedState() {
        try {
            const storage = this.options.persistence.storage === 'localStorage' 
                ? localStorage 
                : sessionStorage;
            
            const saved = storage.getItem(this.options.persistence.key);
            if (saved) {
                const parsed = JSON.parse(saved);
                // 合并保存的状态，但保留当前状态中新增的字段
                this.state = this.mergeState(this.state, parsed);
                console.log('已加载持久化状态');
            }
        } catch (error) {
            console.warn('加载持久化状态失败:', error);
        }
    }

    /**
     * 保存持久化状态
     */
    savePersistedState() {
        if (!this.options.persistence.enabled) return;

        try {
            const storage = this.options.persistence.storage === 'localStorage' 
                ? localStorage 
                : sessionStorage;
            
            const stateToSave = this.filterStateForPersistence(this.state);
            storage.setItem(this.options.persistence.key, JSON.stringify(stateToSave));
        } catch (error) {
            console.warn('保存持久化状态失败:', error);
        }
    }

    /**
     * 过滤状态以进行持久化
     * @param {Object} state - 完整状态
     * @returns {Object} 过滤后的状态
     */
    filterStateForPersistence(state) {
        // 只持久化部分状态，避免存储过大或敏感数据
        const { ui, user, timestamp, version } = state;
        return {
            ui: {
                autoRefreshEnabled: ui.autoRefreshEnabled,
                theme: ui.theme
            },
            user: {
                isOnline: user.isOnline,
                isVisible: user.isVisible
            },
            timestamp,
            version
        };
    }

    /**
     * 合并状态对象
     * @param {Object} current - 当前状态
     * @param {Object} incoming - 输入状态
     * @returns {Object} 合并后的状态
     */
    mergeState(current, incoming) {
        const result = { ...current };
        
        for (const key in incoming) {
            if (incoming.hasOwnProperty(key)) {
                if (typeof incoming[key] === 'object' && incoming[key] !== null &&
                    typeof current[key] === 'object' && current[key] !== null) {
                    result[key] = this.mergeState(current[key], incoming[key]);
                } else {
                    result[key] = incoming[key];
                }
            }
        }
        
        return result;
    }

    /**
     * 分发动作
     * @param {Object} action - 动作对象
     * @returns {Object} 新状态
     */
    dispatch(action) {
        if (this.isDispatching) {
            throw new Error('Reducers may not dispatch actions.');
        }

        if (typeof action !== 'object' || action === null) {
            throw new Error('Actions must be plain objects.');
        }

        if (typeof action.type === 'undefined') {
            throw new Error('Actions must have a type property.');
        }

        try {
            this.isDispatching = true;

            // 执行中间件
            const processedAction = this.runMiddleware(action);

            // 应用reducer
            const newState = this.reduce(processedAction);

            // 更新状态
            this.state = newState;
            this.state.timestamp = Date.now();

            // 保存到历史
            this.history.push({
                timestamp: Date.now(),
                action: processedAction,
                state: { ...newState }
            });

            // 限制历史大小
            if (this.history.length > this.maxHistorySize) {
                this.history = this.history.slice(-this.maxHistorySize);
            }

            // 保存持久化状态
            this.savePersistedState();

            // 通知监听器
            this.notifyListeners();

            // 开发工具集成
            if (this.devTools) {
                this.devTools.send(action, newState);
            }

            return newState;
        } finally {
            this.isDispatching = false;
        }
    }

    /**
     * 运行中间件
     * @param {Object} action - 原始动作
     * @returns {Object} 处理后的动作
     */
    runMiddleware(action) {
        let processedAction = action;
        
        for (const middleware of this.middleware) {
            processedAction = middleware(processedAction, this.state);
        }
        
        return processedAction;
    }

    /**
     * 状态reducer
     * @param {Object} action - 动作
     * @returns {Object} 新状态
     */
    reduce(action) {
        const newState = { ...this.state };
        
        switch (action.type) {
            // 轮询状态更新
            case 'POLLING_STARTED':
                newState.polling.isActive = true;
                newState.polling.lastPollTime = Date.now();
                break;
                
            case 'POLLING_STOPPED':
                newState.polling.isActive = false;
                break;
                
            case 'POLLING_COMPLETED':
                newState.polling.lastPollTime = Date.now();
                newState.polling.retryCount = 0;
                newState.data.isLoading = false;
                newState.data.error = null;
                break;
                
            case 'POLLING_FAILED':
                newState.polling.retryCount++;
                newState.data.error = action.payload.error;
                newState.data.isLoading = false;
                break;
                
            // 数据状态更新
            case 'DATA_UPDATED':
                newState.data.currentDate = action.payload.date;
                newState.data.lastUpdateId = action.payload.updateId;
                newState.data.lastUpdateTime = Date.now();
                newState.data.hasUpdates = true;
                break;
                
            case 'DATA_UPDATE_CHECKED':
                newState.data.hasUpdates = action.payload.hasUpdates;
                break;
                
            case 'DATA_LOADING_STARTED':
                newState.data.isLoading = true;
                break;
                
            case 'DATA_LOADING_COMPLETED':
                newState.data.isLoading = false;
                break;
                
            // 用户状态更新
            case 'NETWORK_STATUS_CHANGED':
                newState.user.isOnline = action.payload.isOnline;
                break;
                
            case 'VISIBILITY_CHANGED':
                newState.user.isVisible = action.payload.isVisible;
                break;
                
            case 'USER_ACTIVITY_DETECTED':
                newState.user.isActive = true;
                newState.user.lastActivityTime = Date.now();
                break;
                
            case 'USER_INACTIVE':
                newState.user.isActive = false;
                break;
                
            // 缓存状态更新
            case 'CACHE_UPDATED':
                newState.cache.currentSize = action.payload.currentSize;
                newState.cache.items = action.payload.items;
                newState.cache.hitRate = action.payload.hitRate;
                break;
                
            case 'CACHE_CLEANUP_COMPLETED':
                newState.cache.lastCleanup = Date.now();
                break;
                
            // 性能状态更新
            case 'PERFORMANCE_METRIC_RECORDED':
                if (action.payload.type === 'poll') {
                    newState.performance.lastPollDuration = action.payload.duration;
                    newState.performance.totalPolls++;
                    
                    // 计算平均轮询时间
                    const oldAvg = newState.performance.averagePollDuration;
                    const newCount = newState.performance.totalPolls;
                    newState.performance.averagePollDuration = 
                        (oldAvg * (newCount - 1) + action.payload.duration) / newCount;
                } else if (action.payload.type === 'render') {
                    newState.performance.lastRenderDuration = action.payload.duration;
                    newState.performance.totalRenders++;
                    
                    // 计算平均渲染时间
                    const oldAvg = newState.performance.averageRenderDuration;
                    const newCount = newState.performance.totalRenders;
                    newState.performance.averageRenderDuration = 
                        (oldAvg * (newCount - 1) + action.payload.duration) / newCount;
                }
                break;
                
            // UI状态更新
            case 'REFRESH_STARTED':
                newState.ui.isRefreshing = true;
                break;
                
            case 'REFRESH_COMPLETED':
                newState.ui.isRefreshing = false;
                newState.ui.lastManualRefresh = Date.now();
                break;
                
            case 'UPDATE_NOTIFICATION_SHOWN':
                newState.ui.showUpdateNotification = true;
                break;
                
            case 'UPDATE_NOTIFICATION_DISMISSED':
                newState.ui.showUpdateNotification = false;
                break;
                
            case 'AUTO_REFRESH_TOGGLED':
                newState.ui.autoRefreshEnabled = action.payload.enabled;
                break;
                
            case 'THEME_CHANGED':
                newState.ui.theme = action.payload.theme;
                break;
                
            default:
                // 不做任何改变
                break;
        }
        
        return newState;
    }

    /**
     * 订阅状态变化
     * @param {Function} listener - 监听函数
     * @returns {Function} 取消订阅函数
     */
    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('Listener must be a function.');
        }

        this.listeners.add(listener);
        
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * 通知所有监听器
     */
    notifyListeners() {
        const currentState = this.getState();
        
        for (const listener of this.listeners) {
            try {
                listener(currentState);
            } catch (error) {
                console.error('状态监听器错误:', error);
            }
        }
    }

    /**
     * 获取当前状态
     * @returns {Object} 当前状态
     */
    getState() {
        return { ...this.state };
    }

    /**
     * 重置状态
     * @param {Object} newState - 新状态（可选）
     */
    resetState(newState = null) {
        this.state = newState ? { ...newState } : { ...this.options.initialState };
        this.state.timestamp = Date.now();
        
        // 清空历史
        this.history = [{
            timestamp: Date.now(),
            action: { type: '@@RESET' },
            state: { ...this.state }
        }];
        
        // 通知监听器
        this.notifyListeners();
    }

    /**
     * 获取状态历史
     * @returns {Array} 历史记录
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * 时间旅行到特定历史点
     * @param {number} index - 历史索引
     */
    timeTravelTo(index) {
        if (index >= 0 && index < this.history.length) {
            this.state = { ...this.history[index].state };
            this.notifyListeners();
        }
    }

    /**
     * 添加中间件
     * @param {Function} middleware - 中间件函数
     */
    addMiddleware(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function.');
        }
        
        this.middleware.push(middleware);
    }

    /**
     * 移除中间件
     * @param {Function} middleware - 要移除的中间件函数
     */
    removeMiddleware(middleware) {
        const index = this.middleware.indexOf(middleware);
        if (index !== -1) {
            this.middleware.splice(index, 1);
        }
    }

    /**
     * 销毁状态管理器
     */
    destroy() {
        this.listeners.clear();
        this.middleware = [];
        this.history = [];
        
        if (this.devTools) {
            this.devTools.disconnect();
        }
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeState;
} else {
    window.RealTimeState = RealTimeState;
}