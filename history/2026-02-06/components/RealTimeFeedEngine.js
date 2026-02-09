/**
 * 实时信息流引擎
 * 实现前端智能轮询、数据变化检测和增量渲染
 * 模仿X平台的信息流体验，支持下拉刷新
 * 
 * @class RealTimeFeedEngine
 */

class RealTimeFeedEngine {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.apiEndpoint - API端点URL
     * @param {Function} options.onDataUpdate - 数据更新回调函数
     * @param {Object} options.pollingConfig - 轮询配置
     * @param {boolean} options.enablePullToRefresh - 是否启用下拉刷新
     * @param {Function} options.renderFunction - 渲染函数
     */
    constructor(options = {}) {
        this.options = {
            apiEndpoint: options.apiEndpoint || '/api/insights/latest',
            onDataUpdate: options.onDataUpdate || null,
            pollingConfig: {
                normalInterval: options.pollingConfig?.normalInterval || 30000,      // 30秒
                activeInterval: options.pollingConfig?.activeInterval || 10000,      // 10秒（用户活跃时）
                backgroundInterval: options.pollingConfig?.backgroundInterval || 60000, // 60秒（后台标签页）
                retryDelay: options.pollingConfig?.retryDelay || 5000,               // 5秒重试延迟
                maxRetries: options.pollingConfig?.maxRetries || 3                   // 最大重试次数
            },
            enablePullToRefresh: options.enablePullToRefresh !== false,
            renderFunction: options.renderFunction || null,
            enableVisibilityDetection: options.enableVisibilityDetection !== false
        };

        this.state = {
            isPollingActive: false,
            currentInterval: this.options.pollingConfig.normalInterval,
            lastUpdateId: null,
            lastUpdateTime: null,
            dataCache: new Map(),
            retryCount: 0,
            isOnline: navigator.onLine,
            isVisible: !document.hidden,
            isLoading: false,
            lastError: null
        };

        this.pollingTimer = null;
        this.changeDetector = new ChangeDetector();
        this.incrementalRenderer = new IncrementalRenderer();
        this.pullToRefresh = null;

        this.init();
    }

    /**
     * 初始化引擎
     */
    init() {
        this.setupEventListeners();
        this.setupVisibilityDetection();
        this.setupPullToRefresh();
        this.startPolling();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 网络状态变化
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            this.resumePolling();
        });

        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            this.pausePolling();
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
     * 设置页面可见性检测
     */
    setupVisibilityDetection() {
        if (this.options.enableVisibilityDetection) {
            // 初始可见状态
            this.state.isVisible = !document.hidden;
            
            // 可见性变化时调整轮询间隔
            document.addEventListener('visibilitychange', () => {
                this.state.isVisible = !document.hidden;
                this.adjustPollingInterval();
            });
        }
    }

    /**
     * 设置用户活动检测
     */
    setupUserActivityDetection() {
        const activityEvents = ['mousemove', 'keydown', 'scroll', 'touchstart'];
        let activityTimeout = null;

        const handleUserActive = () => {
            this.state.userActive = true;
            this.adjustPollingInterval();

            clearTimeout(activityTimeout);
            activityTimeout = setTimeout(() => {
                this.state.userActive = false;
                this.adjustPollingInterval();
            }, 60000); // 1分钟无活动后视为不活跃
        };

        activityEvents.forEach(event => {
            document.addEventListener(event, handleUserActive, { passive: true });
        });

        // 初始触发
        handleUserActive();
    }

    /**
     * 设置下拉刷新
     */
    setupPullToRefresh() {
        if (this.options.enablePullToRefresh && 'ontouchstart' in window) {
            this.pullToRefresh = new PullToRefreshController({
                onRefresh: () => this.forceRefresh()
            });
        }
    }

    /**
     * 调整轮询间隔
     */
    adjustPollingInterval() {
        let newInterval = this.options.pollingConfig.normalInterval;

        if (!this.state.isOnline) {
            newInterval = this.options.pollingConfig.backgroundInterval * 2; // 离线时延长
        } else if (!this.state.isVisible) {
            newInterval = this.options.pollingConfig.backgroundInterval; // 后台标签页
        } else if (this.state.userActive) {
            newInterval = this.options.pollingConfig.activeInterval; // 用户活跃时
        }

        if (newInterval !== this.state.currentInterval) {
            this.state.currentInterval = newInterval;
            
            if (this.state.isPollingActive) {
                this.restartPolling();
            }
        }
    }

    /**
     * 开始轮询
     */
    startPolling() {
        if (this.state.isPollingActive) return;

        this.state.isPollingActive = true;
        this.executePollingCycle();
    }

    /**
     * 暂停轮询
     */
    pausePolling() {
        this.state.isPollingActive = false;
        
        if (this.pollingTimer) {
            clearTimeout(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    /**
     * 恢复轮询
     */
    resumePolling() {
        if (!this.state.isPollingActive) {
            this.state.isPollingActive = true;
            this.executePollingCycle();
        }
    }

    /**
     * 重启轮询
     */
    restartPolling() {
        this.pausePolling();
        this.resumePolling();
    }

    /**
     * 执行轮询周期
     */
    async executePollingCycle() {
        if (!this.state.isPollingActive) return;

        try {
            this.state.isLoading = true;
            const updates = await this.checkForUpdates();

            if (updates.hasUpdates) {
                await this.handleUpdates(updates.data);
            }

            this.state.retryCount = 0;
            this.state.lastError = null;
        } catch (error) {
            console.error('轮询失败:', error);
            await this.handlePollingError(error);
        } finally {
            this.state.isLoading = false;
            
            if (this.state.isPollingActive) {
                this.pollingTimer = setTimeout(() => {
                    this.executePollingCycle();
                }, this.state.currentInterval);
            }
        }
    }

    /**
     * 强制刷新
     */
    async forceRefresh() {
        this.pausePolling();
        
        try {
            this.state.isLoading = true;
            const updates = await this.checkForUpdates(true); // 强制刷新，忽略lastUpdateId
            
            if (updates.data) {
                await this.handleUpdates(updates.data);
            }
        } catch (error) {
            console.error('强制刷新失败:', error);
        } finally {
            this.state.isLoading = false;
            this.resumePolling();
        }
    }

    /**
     * 检查更新
     * @param {boolean} force - 是否强制刷新（忽略lastUpdateId）
     * @returns {Promise<Object>} 更新检查结果
     */
    async checkForUpdates(force = false) {
        const headers = {};
        
        if (!force && this.state.lastUpdateId) {
            headers['Last-Update-ID'] = this.state.lastUpdateId;
        }

        const response = await fetch(this.options.apiEndpoint, { headers });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // 验证响应格式
        if (result.status !== 'success') {
            throw new Error(result.error?.message || 'API返回错误');
        }

        return {
            hasUpdates: result.data?.update_id !== this.state.lastUpdateId,
            data: result.data,
            updateId: result.data?.update_id
        };
    }

    /**
     * 处理更新数据
     * @param {Object} newData - 新数据
     */
    async handleUpdates(newData) {
        const oldData = this.state.dataCache.get('current') || [];
        
        // 检测数据变化
        const changes = this.changeDetector.detectChanges(oldData, newData.insights || []);
        
        if (changes.hasChanges) {
            // 更新缓存
            this.state.dataCache.set('current', newData.insights || []);
            this.state.lastUpdateId = newData.update_id;
            this.state.lastUpdateTime = new Date();
            
            // 触发回调
            if (this.options.onDataUpdate) {
                this.options.onDataUpdate(changes, newData);
            }
            
            // 渲染更新
            if (this.options.renderFunction) {
                await this.options.renderFunction(changes, newData);
            } else {
                await this.incrementalRenderer.renderUpdates(changes, newData);
            }
            
            // 触发更新事件
            this.emitUpdateEvent(changes, newData);
        }
    }

    /**
     * 处理轮询错误
     * @param {Error} error - 错误对象
     */
    async handlePollingError(error) {
        this.state.lastError = error;
        this.state.retryCount++;

        if (this.state.retryCount >= this.options.pollingConfig.maxRetries) {
            // 超过最大重试次数，暂停轮询
            this.pausePolling();
            this.emitErrorEvent(error, 'max_retries_exceeded');
        } else {
            // 延迟重试
            await this.delay(this.options.pollingConfig.retryDelay);
        }
    }

    /**
     * 触发更新事件
     * @param {Object} changes - 变化数据
     * @param {Object} newData - 新数据
     */
    emitUpdateEvent(changes, newData) {
        const event = new CustomEvent('feedupdate', {
            detail: {
                changes,
                data: newData,
                timestamp: Date.now(),
                updateId: this.state.lastUpdateId
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * 触发错误事件
     * @param {Error} error - 错误对象
     * @param {string} reason - 错误原因
     */
    emitErrorEvent(error, reason) {
        const event = new CustomEvent('feederror', {
            detail: {
                error: error.message,
                reason,
                timestamp: Date.now(),
                retryCount: this.state.retryCount
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * 获取当前状态
     * @returns {Object} 状态对象
     */
    getState() {
        return {
            isPollingActive: this.state.isPollingActive,
            currentInterval: this.state.currentInterval,
            lastUpdateId: this.state.lastUpdateId,
            lastUpdateTime: this.state.lastUpdateTime,
            retryCount: this.state.retryCount,
            isOnline: this.state.isOnline,
            isVisible: this.state.isVisible,
            isLoading: this.state.isLoading,
            lastError: this.state.lastError
        };
    }

    /**
     * 手动触发更新检查
     */
    async manualRefresh() {
        await this.forceRefresh();
    }

    /**
     * 销毁引擎
     */
    destroy() {
        this.pausePolling();
        
        if (this.pullToRefresh) {
            this.pullToRefresh.destroy();
        }

        // 移除事件监听器
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

        // 清理引用
        this.changeDetector = null;
        this.incrementalRenderer = null;
        this.pullToRefresh = null;
        this.pollingTimer = null;
    }

    /**
     * 延迟函数
     * @param {number} ms - 毫秒数
     * @returns {Promise} Promise对象
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 变化检测器
 */
class ChangeDetector {
    detectChanges(oldData, newData) {
        const changes = {
            hasChanges: false,
            added: [],
            updated: [],
            removed: [],
            unchanged: []
        };

        // 构建哈希映射加速查找
        const oldMap = new Map(oldData.map(item => [item.id, item]));
        const newMap = new Map(newData.map(item => [item.id, item]));

        // 检测新增和更新
        for (const [id, newItem] of newMap) {
            const oldItem = oldMap.get(id);
            
            if (!oldItem) {
                changes.added.push(newItem);
                changes.hasChanges = true;
            } else if (this.computeContentHash(oldItem) !== this.computeContentHash(newItem)) {
                changes.updated.push({
                    id,
                    old: oldItem,
                    new: newItem
                });
                changes.hasChanges = true;
            } else {
                changes.unchanged.push(newItem);
            }
        }

        // 检测删除
        for (const [id, oldItem] of oldMap) {
            if (!newMap.has(id)) {
                changes.removed.push(oldItem);
                changes.hasChanges = true;
            }
        }

        return changes;
    }

    computeContentHash(obj) {
        // 简单的内容哈希计算
        return JSON.stringify(obj, Object.keys(obj).sort());
    }
}

/**
 * 增量渲染器
 */
class IncrementalRenderer {
    async renderUpdates(changes, newData) {
        const container = document.getElementById('insights-container');
        if (!container) return;

        // 处理删除的项目
        if (changes.removed.length > 0) {
            changes.removed.forEach(item => {
                const element = document.querySelector(`[data-insight-id="${item.id}"]`);
                if (element) {
                    element.remove();
                }
            });
        }

        // 处理更新的项目
        if (changes.updated.length > 0) {
            changes.updated.forEach(update => {
                const element = document.querySelector(`[data-insight-id="${update.id}"]`);
                if (element) {
                    this.updateInsightCard(element, update.new);
                }
            });
        }

        // 处理新增的项目
        if (changes.added.length > 0) {
            changes.added.forEach(item => {
                const card = this.createInsightCard(item);
                container.appendChild(card);
            });
        }
    }

    createInsightCard(insight) {
        // 复用现有的卡片创建逻辑
        const { id, title, summary, formatted_analysis, analysis, impacts, short_title, overall_impact, event_impact } = insight;
        const analysisContent = formatted_analysis || analysis;

        const card = document.createElement('div');
        card.className = 'insight-item';
        card.dataset.insightId = id;

        card.innerHTML = `
            <div class="insight-header">
                <div class="insight-number">${id}</div>
                <div class="insight-title">${title}</div>
            </div>
            
            <div class="insight-image-container">
                <img src="assets/insight${id}_placeholder.jpg" data-fallback="assets/placeholder.jpg" alt="洞察图片" class="insight-image">
                <div class="image-placeholder">图片加载中...</div>
            </div>
            
            <div class="summary-section">
                <div class="summary-label">核心摘要</div>
                <div class="summary-content" id="summary-${id}">
                    ${summary}
                </div>
            </div>
            
            <div class="analysis-section">
                <div class="analysis-label">深度分析</div>
                <div class="analysis-content" id="analysis-${id}">
                    ${analysisContent}
                </div>
            </div>
        `;

        return card;
    }

    updateInsightCard(element, insight) {
        // 更新卡片内容
        const { id, title, summary, formatted_analysis, analysis, impacts, short_title, overall_impact, event_impact } = insight;
        const analysisContent = formatted_analysis || analysis;

        const header = element.querySelector('.insight-header');
        if (header) {
            const titleElement = header.querySelector('.insight-title');
            if (titleElement) titleElement.textContent = title;
        }

        const summaryContent = element.querySelector(`#summary-${id}`);
        if (summaryContent) summaryContent.innerHTML = summary;

        const analysisContentElement = element.querySelector(`#analysis-${id}`);
        if (analysisContentElement) analysisContentElement.innerHTML = analysisContent;
    }
}

/**
 * 下拉刷新控制器
 */
class PullToRefreshController {
    constructor(options = {}) {
        this.options = {
            onRefresh: options.onRefresh || null,
            threshold: options.threshold || 80,
            resistance: options.resistance || 2.5
        };

        this.state = {
            isTouching: false,
            startY: 0,
            currentY: 0,
            isRefreshing: false
        };

        this.container = null;
        this.refreshElement = null;

        this.init();
    }

    init() {
        this.createContainer();
        this.bindEvents();
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'pull-to-refresh-container';
        this.container.style.cssText = `
            position: fixed;
            top: -60px;
            left: 0;
            right: 0;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            transition: transform 0.3s ease;
        `;

        this.refreshElement = document.createElement('div');
        this.refreshElement.className = 'pull-to-refresh-indicator';
        this.refreshElement.innerHTML = `
            <div class="refresh-icon">↻</div>
            <div class="refresh-text">下拉刷新</div>
        `;

        this.container.appendChild(this.refreshElement);
        document.body.appendChild(this.container);
    }

    bindEvents() {
        let touchStartHandler, touchMoveHandler, touchEndHandler;

        touchStartHandler = (event) => {
            if (window.scrollY <= 0 && !this.state.isRefreshing) {
                this.state.isTouching = true;
                this.state.startY = event.touches[0].clientY;
            }
        };

        touchMoveHandler = (event) => {
            if (!this.state.isTouching) return;

            event.preventDefault();
            
            this.state.currentY = event.touches[0].clientY;
            const distance = Math.max(0, (this.state.currentY - this.state.startY) / this.options.resistance);
            
            this.container.style.transform = `translateY(${distance}px)`;
            
            // 更新指示器状态
            if (distance > this.options.threshold) {
                this.refreshElement.classList.add('ready');
            } else {
                this.refreshElement.classList.remove('ready');
            }
        };

        touchEndHandler = () => {
            if (!this.state.isTouching) return;
            
            this.state.isTouching = false;
            
            const distance = Math.max(0, (this.state.currentY - this.state.startY) / this.options.resistance);
            
            if (distance > this.options.threshold && this.options.onRefresh) {
                this.startRefresh();
            } else {
                this.reset();
            }
        };

        document.addEventListener('touchstart', touchStartHandler, { passive: true });
        document.addEventListener('touchmove', touchMoveHandler, { passive: false });
        document.addEventListener('touchend', touchEndHandler, { passive: true });

        // 保存引用以便销毁时移除
        this.handlers = { touchStartHandler, touchMoveHandler, touchEndHandler };
    }

    startRefresh() {
        this.state.isRefreshing = true;
        this.refreshElement.classList.add('refreshing');
        
        if (this.options.onRefresh) {
            this.options.onRefresh().then(() => {
                this.completeRefresh();
            }).catch(() => {
                this.completeRefresh();
            });
        }
    }

    completeRefresh() {
        setTimeout(() => {
            this.state.isRefreshing = false;
            this.reset();
        }, 500);
    }

    reset() {
        this.container.style.transform = 'translateY(-60px)';
        this.refreshElement.classList.remove('ready', 'refreshing');
    }

    destroy() {
        if (this.handlers) {
            document.removeEventListener('touchstart', this.handlers.touchStartHandler);
            document.removeEventListener('touchmove', this.handlers.touchMoveHandler);
            document.removeEventListener('touchend', this.handlers.touchEndHandler);
        }
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeFeedEngine;
} else {
    window.RealTimeFeedEngine = RealTimeFeedEngine;
}