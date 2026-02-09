/**
 * 组件管理器
 * 管理所有组件的生命周期、状态共享和事件通信
 * 
 * @class ComponentManager
 */

class ComponentManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Object} options.components - 组件配置
     * @param {Object} options.state - 初始状态
     * @param {Function} options.onStateChange - 状态变化回调
     */
    constructor(options = {}) {
        this.options = {
            components: options.components || {},
            state: options.state || {},
            onStateChange: options.onStateChange || null
        };

        this.state = {
            ...this.options.state,
            isLoading: false,
            componentsReady: false,
            componentsLoaded: []
        };

        this.components = {};
        this.eventBus = new EventBus();
        this.stateStore = new StateStore();
        this.componentRegistry = new ComponentRegistry();

        this.init();
    }

    /**
     * 初始化组件管理器
     */
    async init() {
        // 注册事件监听器
        this.setupEventListeners();
        
        // 初始化状态存储
        await this.stateStore.init();
        
        // 加载配置的组件
        await this.loadComponents();
        
        // 标记组件就绪
        this.state.componentsReady = true;
        
        // 触发组件就绪事件
        this.emitComponentsReady();
        
        console.log('组件管理器初始化完成，加载组件:', this.state.componentsLoaded);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听来自组件的事件
        this.eventBus.on('component:register', (event) => {
            this.handleComponentRegister(event.detail);
        });
        
        this.eventBus.on('component:unregister', (event) => {
            this.handleComponentUnregister(event.detail);
        });
        
        this.eventBus.on('component:statechange', (event) => {
            this.handleComponentStateChange(event.detail);
        });
        
        this.eventBus.on('component:event', (event) => {
            this.handleComponentEvent(event.detail);
        });
    }

    /**
     * 加载组件
     */
    async loadComponents() {
        const { components } = this.options;
        const loadingPromises = [];
        
        // 动态导入组件模块
        for (const [name, config] of Object.entries(components)) {
            loadingPromises.push(
                this.loadComponent(name, config)
            );
        }
        
        // 等待所有组件加载完成
        await Promise.all(loadingPromises);
    }

    /**
     * 加载单个组件
     * @param {string} name - 组件名称
     * @param {Object} config - 组件配置
     */
    async loadComponent(name, config) {
        try {
            const { type, container, options = {} } = config;
            
            // 根据类型创建组件实例
            let componentInstance;
            
            switch (type) {
                case 'NavigationBar':
                    componentInstance = new NavigationBar({
                        ...options,
                        container
                    });
                    break;
                    
                case 'RealTimeFeedEngine':
                    componentInstance = new RealTimeFeedEngine({
                        ...options,
                        container
                    });
                    break;
                    
                case 'InsightCard':
                    componentInstance = new InsightCard({
                        ...options,
                        container
                    });
                    break;
                    
                case 'ImpactMatrix':
                    componentInstance = new ImpactMatrix({
                        ...options,
                        container
                    });
                    break;
                    
                case 'ServiceWorker':
                    componentInstance = null; // Service Worker由PWAManager处理
                    break;
                    
                case 'PWAManager':
                    componentInstance = new PWAManager({
                        ...options,
                        container
                    });
                    break;
                    
                default:
                    console.warn(`未知组件类型: ${type}`);
                    return;
            }
            
            if (componentInstance) {
                // 注册组件
                this.registerComponent(name, componentInstance, config);
                
                // 更新加载列表
                this.state.componentsLoaded.push(name);
            }
            
        } catch (error) {
            console.error(`加载组件 ${name} 失败:`, error);
        }
    }

    /**
     * 注册组件
     * @param {string} name - 组件名称
     * @param {Object} instance - 组件实例
     * @param {Object} config - 组件配置
     */
    registerComponent(name, instance, config) {
        // 添加到组件映射
        this.components[name] = {
            instance,
            config,
            state: {},
            subscriptions: []
        };
        
        // 注册到组件注册表
        this.componentRegistry.register(name, instance, config);
        
        // 设置组件状态监听
        this.setupComponentStateListener(name, instance);
        
        // 触发组件注册事件
        this.emitComponentRegistered(name, instance);
    }

    /**
     * 设置组件状态监听器
     * @param {string} name - 组件名称
     * @param {Object} instance - 组件实例
     */
    setupComponentStateListener(name, instance) {
        // 监听组件的状态变化
        if (typeof instance.getState === 'function') {
            // 存储初始状态
            this.components[name].state = instance.getState();
            
            // 如果组件有状态更新方法，设置监听
            if (typeof instance.onStateChange === 'function') {
                instance.onStateChange((newState) => {
                    this.handleComponentStateUpdate(name, newState);
                });
            }
        }
    }

    /**
     * 处理组件注册
     * @param {Object} detail - 事件详情
     */
    handleComponentRegister(detail) {
        const { name, instance, config } = detail;
        
        // 如果组件尚未注册，则注册
        if (!this.components[name]) {
            this.registerComponent(name, instance, config);
        }
    }

    /**
     * 处理组件注销
     * @param {Object} detail - 事件详情
     */
    handleComponentUnregister(detail) {
        const { name } = detail;
        
        if (this.components[name]) {
            this.unregisterComponent(name);
        }
    }

    /**
     * 处理组件状态变化
     * @param {Object} detail - 事件详情
     */
    handleComponentStateChange(detail) {
        const { name, state } = detail;
        
        // 更新组件状态
        if (this.components[name]) {
            this.components[name].state = { ...this.components[name].state, ...state };
            
            // 触发全局状态更新
            this.updateGlobalState(name, state);
        }
    }

    /**
     * 处理组件事件
     * @param {Object} detail - 事件详情
     */
    handleComponentEvent(detail) {
        const { name, event, data } = detail;
        
        // 广播组件事件
        this.emitComponentEvent(name, event, data);
    }

    /**
     * 处理组件状态更新
     * @param {string} name - 组件名称
     * @param {Object} newState - 新状态
     */
    handleComponentStateUpdate(name, newState) {
        this.components[name].state = newState;
        
        // 触发全局状态更新
        this.updateGlobalState(name, newState);
    }

    /**
     * 更新全局状态
     * @param {string} componentName - 组件名称
     * @param {Object} state - 状态更新
     */
    updateGlobalState(componentName, state) {
        // 更新全局状态存储
        this.stateStore.setState(componentName, state);
        
        // 触发状态变化事件
        this.emitStateChange(componentName, state);
        
        // 回调函数
        if (this.options.onStateChange) {
            this.options.onStateChange(componentName, state);
        }
    }

    /**
     * 获取组件实例
     * @param {string} name - 组件名称
     * @returns {Object|null} 组件实例
     */
    getComponent(name) {
        return this.components[name]?.instance || null;
    }

    /**
     * 获取组件状态
     * @param {string} name - 组件名称
     * @returns {Object} 组件状态
     */
    getComponentState(name) {
        return this.components[name]?.state || {};
    }

    /**
     * 获取所有组件状态
     * @returns {Object} 所有组件状态
     */
    getAllComponentStates() {
        const states = {};
        
        for (const [name, component] of Object.entries(this.components)) {
            states[name] = component.state;
        }
        
        return states;
    }

    /**
     * 发送事件到组件
     * @param {string} componentName - 组件名称
     * @param {string} event - 事件名称
     * @param {Object} data - 事件数据
     */
    sendToComponent(componentName, event, data = {}) {
        const component = this.components[componentName];
        
        if (component && component.instance) {
            // 根据事件类型调用对应方法
            switch (event) {
                case 'updateData':
                    if (typeof component.instance.updateData === 'function') {
                        component.instance.updateData(data);
                    }
                    break;
                    
                case 'refresh':
                    if (typeof component.instance.refresh === 'function') {
                        component.instance.refresh();
                    }
                    break;
                    
                case 'show':
                    if (typeof component.instance.show === 'function') {
                        component.instance.show(data);
                    }
                    break;
                    
                case 'hide':
                    if (typeof component.instance.hide === 'function') {
                        component.instance.hide(data);
                    }
                    break;
                    
                default:
                    // 尝试调用通用事件处理器
                    if (typeof component.instance.handleEvent === 'function') {
                        component.instance.handleEvent(event, data);
                    }
            }
        }
    }

    /**
     * 广播事件到所有组件
     * @param {string} event - 事件名称
     * @param {Object} data - 事件数据
     */
    broadcastToAllComponents(event, data = {}) {
        for (const [name, component] of Object.entries(this.components)) {
            this.sendToComponent(name, event, data);
        }
    }

    /**
     * 注销组件
     * @param {string} name - 组件名称
     */
    unregisterComponent(name) {
        const component = this.components[name];
        
        if (component) {
            // 销毁组件实例
            if (typeof component.instance.destroy === 'function') {
                component.instance.destroy();
            }
            
            // 从注册表注销
            this.componentRegistry.unregister(name);
            
            // 清理订阅
            this.cleanupComponentSubscriptions(name);
            
            // 从组件映射中移除
            delete this.components[name];
            
            // 从加载列表中移除
            const index = this.state.componentsLoaded.indexOf(name);
            if (index > -1) {
                this.state.componentsLoaded.splice(index, 1);
            }
            
            // 触发组件注销事件
            this.emitComponentUnregistered(name);
        }
    }

    /**
     * 清理组件订阅
     * @param {string} name - 组件名称
     */
    cleanupComponentSubscriptions(name) {
        const component = this.components[name];
        
        if (component) {
            // 取消事件监听
            this.eventBus.off(`component:${name}:*`);
            
            // 清理状态订阅
            this.stateStore.unsubscribe(name);
        }
    }

    /**
     * 发射组件就绪事件
     */
    emitComponentsReady() {
        const event = new CustomEvent('componentsready', {
            detail: {
                timestamp: Date.now(),
                components: this.state.componentsLoaded
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * 发射组件注册事件
     * @param {string} name - 组件名称
     * @param {Object} instance - 组件实例
     */
    emitComponentRegistered(name, instance) {
        const event = new CustomEvent('componentregistered', {
            detail: {
                name,
                instance,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * 发射组件注销事件
     * @param {string} name - 组件名称
     */
    emitComponentUnregistered(name) {
        const event = new CustomEvent('componentunregistered', {
            detail: {
                name,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * 发射状态变化事件
     * @param {string} componentName - 组件名称
     * @param {Object} state - 状态
     */
    emitStateChange(componentName, state) {
        const event = new CustomEvent('statechange', {
            detail: {
                componentName,
                state,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * 发射组件事件
     * @param {string} componentName - 组件名称
     * @param {string} eventName - 事件名称
     * @param {Object} data - 事件数据
     */
    emitComponentEvent(componentName, eventName, data) {
        const event = new CustomEvent('componentevent', {
            detail: {
                componentName,
                event: eventName,
                data,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * 获取事件总线
     * @returns {EventBus} 事件总线实例
     */
    getEventBus() {
        return this.eventBus;
    }

    /**
     * 获取状态存储
     * @returns {StateStore} 状态存储实例
     */
    getStateStore() {
        return this.stateStore;
    }

    /**
     * 获取组件注册表
     * @returns {ComponentRegistry} 组件注册表实例
     */
    getComponentRegistry() {
        return this.componentRegistry;
    }

    /**
     * 销毁管理器
     */
    destroy() {
        // 销毁所有组件
        for (const [name] of Object.entries(this.components)) {
            this.unregisterComponent(name);
        }
        
        // 清理事件总线
        this.eventBus.destroy();
        
        // 清理状态存储
        this.stateStore.destroy();
        
        // 清理组件注册表
        this.componentRegistry.destroy();
    }
}

/**
 * 事件总线
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback({ type: event, detail: data });
                } catch (error) {
                    console.error(`事件处理器错误: ${event}`, error);
                }
            });
        }
        
        // 通配符监听器
        const wildcardEvent = event.replace(/:[^:]*$/, ':*');
        if (wildcardEvent !== event && this.listeners.has(wildcardEvent)) {
            this.listeners.get(wildcardEvent).forEach(callback => {
                try {
                    callback({ type: event, detail: data });
                } catch (error) {
                    console.error(`通配符事件处理器错误: ${event}`, error);
                }
            });
        }
    }

    destroy() {
        this.listeners.clear();
    }
}

/**
 * 状态存储
 */
class StateStore {
    constructor() {
        this.state = {};
        this.subscribers = new Map();
        this.isInitialized = false;
    }

    async init() {
        // 尝试从localStorage加载持久化状态
        try {
            const savedState = localStorage.getItem('componentStateStore');
            if (savedState) {
                this.state = JSON.parse(savedState);
            }
        } catch (error) {
            console.warn('加载持久化状态失败:', error);
        }
        
        this.isInitialized = true;
        console.log('状态存储初始化完成');
    }

    setState(componentName, newState) {
        // 更新状态
        if (!this.state[componentName]) {
            this.state[componentName] = {};
        }
        
        this.state[componentName] = { ...this.state[componentName], ...newState };
        
        // 通知订阅者
        this.notifySubscribers(componentName, newState);
        
        // 持久化到localStorage
        this.persistState();
    }

    getState(componentName) {
        return this.state[componentName] || {};
    }

    getAllState() {
        return { ...this.state };
    }

    subscribe(componentName, callback) {
        if (!this.subscribers.has(componentName)) {
            this.subscribers.set(componentName, []);
        }
        this.subscribers.get(componentName).push(callback);
        
        return () => this.unsubscribe(componentName, callback);
    }

    unsubscribe(componentName, callback) {
        if (this.subscribers.has(componentName)) {
            const callbacks = this.subscribers.get(componentName);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    notifySubscribers(componentName, newState) {
        if (this.subscribers.has(componentName)) {
            this.subscribers.get(componentName).forEach(callback => {
                try {
                    callback(newState);
                } catch (error) {
                    console.error(`状态订阅者错误: ${componentName}`, error);
                }
            });
        }
    }

    persistState() {
        try {
            localStorage.setItem('componentStateStore', JSON.stringify(this.state));
        } catch (error) {
            console.warn('持久化状态失败:', error);
        }
    }

    clearState() {
        this.state = {};
        this.subscribers.clear();
        
        try {
            localStorage.removeItem('componentStateStore');
        } catch (error) {
            console.warn('清理持久化状态失败:', error);
        }
    }

    destroy() {
        this.clearState();
    }
}

/**
 * 组件注册表
 */
class ComponentRegistry {
    constructor() {
        this.registry = new Map();
        this.componentTypes = new Map();
    }

    register(name, instance, config) {
        this.registry.set(name, {
            instance,
            config,
            metadata: {
                registeredAt: Date.now(),
                type: config.type
            }
        });
        
        // 记录组件类型
        this.componentTypes.set(config.type, name);
    }

    unregister(name) {
        this.registry.delete(name);
        
        // 清理组件类型映射
        for (const [type, componentName] of this.componentTypes.entries()) {
            if (componentName === name) {
                this.componentTypes.delete(type);
                break;
            }
        }
    }

    get(name) {
        return this.registry.get(name);
    }

    getByType(type) {
        const componentName = this.componentTypes.get(type);
        return componentName ? this.registry.get(componentName) : null;
    }

    getAll() {
        return Array.from(this.registry.entries()).map(([name, data]) => ({
            name,
            ...data
        }));
    }

    has(name) {
        return this.registry.has(name);
    }

    count() {
        return this.registry.size;
    }

    clear() {
        this.registry.clear();
        this.componentTypes.clear();
    }

    destroy() {
        this.clear();
    }
}

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ComponentManager,
        EventBus,
        StateStore,
        ComponentRegistry
    };
} else {
    window.ComponentManager = ComponentManager;
    window.EventBus = EventBus;
    window.StateStore = StateStore;
    window.ComponentRegistry = ComponentRegistry;
}