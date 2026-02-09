/**
 * 性能监控器
 * 记录轮询响应时间、渲染耗时等关键指标，支持性能分析和优化
 * 
 * @class PerformanceMonitor
 */
class PerformanceMonitor {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Object} options.metrics - 监控指标配置
     * @param {boolean} options.enableRealTimeStats - 是否启用实时统计（默认true）
     * @param {number} options.statsInterval - 统计报告间隔（默认60秒）
     * @param {boolean} options.enablePerformanceAPI - 是否使用Performance API（默认true）
     * @param {Function} options.onReport - 统计报告回调
     */
    constructor(options = {}) {
        this.options = {
            metrics: {
                polling: options.metrics?.polling !== false,
                rendering: options.metrics?.rendering !== false,
                memory: options.metrics?.memory || false,
                network: options.metrics?.network !== false,
                userInteraction: options.metrics?.userInteraction !== false
            },
            enableRealTimeStats: options.enableRealTimeStats !== false,
            statsInterval: options.statsInterval || 60000,
            enablePerformanceAPI: options.enablePerformanceAPI !== false,
            onReport: options.onReport || null
        };

        this.state = {
            isActive: false,
            startTime: Date.now(),
            metrics: {
                polling: {
                    durations: [],
                    successes: 0,
                    failures: 0,
                    retries: 0,
                    totalTime: 0,
                    lastDuration: 0,
                    averageDuration: 0,
                    minDuration: Infinity,
                    maxDuration: 0
                },
                rendering: {
                    durations: [],
                    renders: 0,
                    cardsRendered: 0,
                    incrementalRenders: 0,
                    fullRenders: 0,
                    totalTime: 0,
                    lastDuration: 0,
                    averageDuration: 0,
                    minDuration: Infinity,
                    maxDuration: 0
                },
                memory: {
                    measurements: [],
                    averageJSHeapSize: 0,
                    maxJSHeapSize: 0,
                    totalJSHeapSize: 0
                },
                network: {
                    requests: 0,
                    successes: 0,
                    failures: 0,
                    totalBytes: 0,
                    averageLatency: 0,
                    lastLatency: 0
                },
                userInteraction: {
                    clicks: 0,
                    scrolls: 0,
                    keypresses: 0,
                    lastActivity: Date.now()
                }
            },
            timers: new Map(),
            eventListeners: new Map(),
            reportInterval: null,
            customMetrics: new Map()
        };

        this.init();
    }

    /**
     * 初始化性能监控器
     */
    init() {
        if (this.options.enablePerformanceAPI) {
            this.setupPerformanceAPI();
        }

        if (this.options.enableRealTimeStats) {
            this.startReporting();
        }

        this.setupEventListeners();
        
        this.state.isActive = true;
        console.log('性能监控器已启动');
    }

    /**
     * 设置Performance API
     */
    setupPerformanceAPI() {
        // 标记监控启动
        if (performance && performance.mark) {
            performance.mark('performance-monitor-start');
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听用户交互
        if (this.options.metrics.userInteraction) {
            this.addUserInteractionListeners();
        }

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.recordMetric('page', 'hidden', { timestamp: Date.now() });
            } else {
                this.recordMetric('page', 'visible', { timestamp: Date.now() });
            }
        });

        // 监听页面卸载
        window.addEventListener('beforeunload', () => {
            this.generateFinalReport();
        });
    }

    /**
     * 添加用户交互监听器
     */
    addUserInteractionListeners() {
        const handleUserInteraction = (type) => {
            return () => {
                this.state.metrics.userInteraction[type]++;
                this.state.metrics.userInteraction.lastActivity = Date.now();
            };
        };

        const events = {
            click: handleUserInteraction('clicks'),
            scroll: handleUserInteraction('scrolls'),
            keydown: handleUserInteraction('keypresses')
        };

        for (const [event, handler] of Object.entries(events)) {
            document.addEventListener(event, handler, { passive: true });
            this.state.eventListeners.set(event, handler);
        }
    }

    /**
     * 开始定时报告
     */
    startReporting() {
        if (this.state.reportInterval) {
            clearInterval(this.state.reportInterval);
        }

        this.state.reportInterval = setInterval(() => {
            this.generateIntervalReport();
        }, this.options.statsInterval);
    }

    /**
     * 记录轮询开始
     * @param {Object} context - 上下文信息
     * @returns {string} 计时器ID
     */
    recordPollingStart(context = {}) {
        if (!this.options.metrics.polling) return null;

        const timerId = `polling_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.state.timers.set(timerId, {
            type: 'polling',
            startTime: performance.now ? performance.now() : Date.now(),
            context
        });

        return timerId;
    }

    /**
     * 记录轮询完成
     * @param {string} timerId - 计时器ID
     * @param {boolean} success - 是否成功
     * @param {Object} metadata - 元数据
     */
    recordPollingEnd(timerId, success = true, metadata = {}) {
        if (!this.options.metrics.polling) return;

        const timer = this.state.timers.get(timerId);
        if (!timer) return;

        const endTime = performance.now ? performance.now() : Date.now();
        const duration = endTime - timer.startTime;

        // 更新轮询统计
        const polling = this.state.metrics.polling;
        polling.durations.push(duration);
        polling.totalTime += duration;
        polling.lastDuration = duration;
        polling.averageDuration = polling.totalTime / polling.durations.length;
        
        if (duration < polling.minDuration) polling.minDuration = duration;
        if (duration > polling.maxDuration) polling.maxDuration = duration;

        if (success) {
            polling.successes++;
        } else {
            polling.failures++;
        }

        if (metadata.retryCount) {
            polling.retries += metadata.retryCount;
        }

        // 清理计时器
        this.state.timers.delete(timerId);

        // 触发更新事件
        this.dispatchUpdate('polling', { duration, success, metadata });
    }

    /**
     * 记录渲染开始
     * @param {string} renderType - 渲染类型（'incremental'|'full'）
     * @param {Object} context - 上下文信息
     * @returns {string} 计时器ID
     */
    recordRenderStart(renderType = 'incremental', context = {}) {
        if (!this.options.metrics.rendering) return null;

        const timerId = `render_${renderType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.state.timers.set(timerId, {
            type: 'rendering',
            renderType,
            startTime: performance.now ? performance.now() : Date.now(),
            context
        });

        return timerId;
    }

    /**
     * 记录渲染完成
     * @param {string} timerId - 计时器ID
     * @param {number} cardsRendered - 渲染卡片数
     * @param {Object} metadata - 元数据
     */
    recordRenderEnd(timerId, cardsRendered = 0, metadata = {}) {
        if (!this.options.metrics.rendering) return;

        const timer = this.state.timers.get(timerId);
        if (!timer) return;

        const endTime = performance.now ? performance.now() : Date.now();
        const duration = endTime - timer.startTime;

        // 更新渲染统计
        const rendering = this.state.metrics.rendering;
        rendering.durations.push(duration);
        rendering.totalTime += duration;
        rendering.lastDuration = duration;
        rendering.averageDuration = rendering.totalTime / rendering.durations.length;
        
        if (duration < rendering.minDuration) rendering.minDuration = duration;
        if (duration > rendering.maxDuration) rendering.maxDuration = duration;

        rendering.renders++;
        rendering.cardsRendered += cardsRendered;

        if (timer.renderType === 'incremental') {
            rendering.incrementalRenders++;
        } else {
            rendering.fullRenders++;
        }

        // 清理计时器
        this.state.timers.delete(timerId);

        // 触发更新事件
        this.dispatchUpdate('rendering', { 
            duration, 
            cardsRendered, 
            renderType: timer.renderType,
            metadata 
        });
    }

    /**
     * 记录网络请求
     * @param {string} url - 请求URL
     * @param {number} startTime - 开始时间
     * @param {number} endTime - 结束时间
     * @param {boolean} success - 是否成功
     * @param {number} bytes - 传输字节数
     */
    recordNetworkRequest(url, startTime, endTime, success = true, bytes = 0) {
        if (!this.options.metrics.network) return;

        const latency = endTime - startTime;
        const network = this.state.metrics.network;

        network.requests++;
        network.totalBytes += bytes;
        network.lastLatency = latency;

        if (success) {
            network.successes++;
        } else {
            network.failures++;
        }

        // 计算平均延迟（移动平均）
        const oldAvg = network.averageLatency || 0;
        const newCount = network.requests;
        network.averageLatency = (oldAvg * (newCount - 1) + latency) / newCount;

        this.dispatchUpdate('network', { url, latency, success, bytes });
    }

    /**
     * 记录内存使用
     */
    recordMemoryUsage() {
        if (!this.options.metrics.memory) return;
        if (!performance || !performance.memory) return;

        const memory = performance.memory;
        const memoryMetrics = this.state.metrics.memory;

        memoryMetrics.measurements.push({
            timestamp: Date.now(),
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            totalJSHeapSize: memory.totalJSHeapSize,
            usedJSHeapSize: memory.usedJSHeapSize
        });

        // 保留最近100次测量
        if (memoryMetrics.measurements.length > 100) {
            memoryMetrics.measurements.shift();
        }

        // 计算统计
        const totalSize = memoryMetrics.measurements.reduce((sum, m) => sum + m.totalJSHeapSize, 0);
        const maxSize = Math.max(...memoryMetrics.measurements.map(m => m.totalJSHeapSize));

        memoryMetrics.averageJSHeapSize = totalSize / memoryMetrics.measurements.length;
        memoryMetrics.maxJSHeapSize = maxSize;
        memoryMetrics.totalJSHeapSize = totalSize;

        this.dispatchUpdate('memory', { 
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
        });
    }

    /**
     * 开始自定义指标测量
     * @param {string} metricName - 指标名称
     * @param {Object} context - 上下文信息
     * @returns {string} 测量ID
     */
    startMeasurement(metricName, context = {}) {
        const measurementId = `${metricName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.state.customMetrics.set(measurementId, {
            name: metricName,
            startTime: performance.now ? performance.now() : Date.now(),
            context
        });

        return measurementId;
    }

    /**
     * 结束自定义指标测量
     * @param {string} measurementId - 测量ID
     * @param {Object} result - 测量结果
     */
    endMeasurement(measurementId, result = {}) {
        const measurement = this.state.customMetrics.get(measurementId);
        if (!measurement) return;

        const endTime = performance.now ? performance.now() : Date.now();
        const duration = endTime - measurement.startTime;

        this.state.customMetrics.delete(measurementId);

        // 触发自定义指标事件
        this.dispatchUpdate('custom', {
            name: measurement.name,
            duration,
            context: measurement.context,
            result
        });
    }

    /**
     * 记录自定义指标
     * @param {string} metricName - 指标名称
     * @param {*} value - 指标值
     */
    recordMetric(metricName, value, metadata = {}) {
        this.dispatchUpdate('metric', {
            name: metricName,
            value,
            metadata
        });
    }

    /**
     * 分发更新事件
     * @param {string} type - 更新类型
     * @param {Object} data - 更新数据
     */
    dispatchUpdate(type, data) {
        const event = new CustomEvent('performance-metric', {
            detail: {
                type,
                data,
                timestamp: Date.now(),
                monitorState: this.getState()
            }
        });

        document.dispatchEvent(event);
    }

    /**
     * 生成间隔报告
     */
    generateIntervalReport() {
        const report = this.generateReport('interval');
        
        if (this.options.onReport) {
            this.options.onReport(report);
        }

        console.log('性能监控间隔报告:', report.summary);
    }

    /**
     * 生成最终报告
     */
    generateFinalReport() {
        const report = this.generateReport('final');
        
        if (this.options.onReport) {
            this.options.onReport(report);
        }

        console.log('性能监控最终报告:', report.summary);
    }

    /**
     * 生成报告
     * @param {string} reportType - 报告类型
     * @returns {Object} 报告对象
     */
    generateReport(reportType = 'interval') {
        const now = Date.now();
        const uptime = now - this.state.startTime;

        const report = {
            type: reportType,
            timestamp: now,
            uptime,
            startTime: this.state.startTime,
            metrics: {},
            summary: {},
            recommendations: []
        };

        // 轮询指标
        if (this.options.metrics.polling) {
            const polling = this.state.metrics.polling;
            report.metrics.polling = {
                totalPolls: polling.successes + polling.failures,
                successes: polling.successes,
                failures: polling.failures,
                retries: polling.retries,
                successRate: polling.successes / Math.max(1, polling.successes + polling.failures),
                durations: {
                    last: polling.lastDuration,
                    average: polling.averageDuration,
                    min: polling.minDuration === Infinity ? 0 : polling.minDuration,
                    max: polling.maxDuration,
                    total: polling.totalTime
                }
            };

            // 轮询推荐
            if (polling.failures > 0 && polling.failures / (polling.successes + polling.failures) > 0.1) {
                report.recommendations.push({
                    type: 'polling',
                    priority: 'high',
                    message: '轮询失败率较高，建议检查网络连接或调整重试策略',
                    data: {
                        failureRate: polling.failures / (polling.successes + polling.failures)
                    }
                });
            }

            if (polling.averageDuration > 1000) {
                report.recommendations.push({
                    type: 'polling',
                    priority: 'medium',
                    message: '轮询平均响应时间较长，建议优化后端API性能',
                    data: {
                        averageDuration: polling.averageDuration
                    }
                });
            }
        }

        // 渲染指标
        if (this.options.metrics.rendering) {
            const rendering = this.state.metrics.rendering;
            report.metrics.rendering = {
                totalRenders: rendering.renders,
                incrementalRenders: rendering.incrementalRenders,
                fullRenders: rendering.fullRenders,
                totalCards: rendering.cardsRendered,
                averageCardsPerRender: rendering.cardsRendered / Math.max(1, rendering.renders),
                durations: {
                    last: rendering.lastDuration,
                    average: rendering.averageDuration,
                    min: rendering.minDuration === Infinity ? 0 : rendering.minDuration,
                    max: rendering.maxDuration,
                    total: rendering.totalTime
                }
            };

            // 渲染推荐
            if (rendering.averageDuration > 100) {
                report.recommendations.push({
                    type: 'rendering',
                    priority: 'medium',
                    message: '渲染平均耗时较高，建议优化DOM操作或减少卡片复杂度',
                    data: {
                        averageDuration: rendering.averageDuration
                    }
                });
            }

            if (rendering.incrementalRenders > 0 && rendering.fullRenders > 0) {
                const incrementalRate = rendering.incrementalRenders / rendering.renders;
                if (incrementalRate < 0.8) {
                    report.recommendations.push({
                        type: 'rendering',
                        priority: 'low',
                        message: '增量渲染比例较低，建议优化数据变化检测算法',
                        data: {
                            incrementalRate
                        }
                    });
                }
            }
        }

        // 网络指标
        if (this.options.metrics.network) {
            const network = this.state.metrics.network;
            report.metrics.network = {
                totalRequests: network.requests,
                successes: network.successes,
                failures: network.failures,
                successRate: network.successes / Math.max(1, network.requests),
                totalBytes: network.totalBytes,
                averageLatency: network.averageLatency,
                lastLatency: network.lastLatency
            };
        }

        // 用户交互指标
        if (this.options.metrics.userInteraction) {
            const user = this.state.metrics.userInteraction;
            report.metrics.userInteraction = {
                clicks: user.clicks,
                scrolls: user.scrolls,
                keypresses: user.keypresses,
                lastActivity: user.lastActivity
            };
        }

        // 汇总信息
        report.summary = {
            uptime: this.formatDuration(uptime),
            pollingSuccessRate: report.metrics.polling?.successRate,
            averagePollDuration: report.metrics.polling?.durations.average,
            averageRenderDuration: report.metrics.rendering?.durations.average,
            totalDataTransferred: this.formatBytes(report.metrics.network?.totalBytes),
            recommendationsCount: report.recommendations.length
        };

        return report;
    }

    /**
     * 获取当前状态
     * @returns {Object} 状态对象
     */
    getState() {
        return {
            isActive: this.state.isActive,
            startTime: this.state.startTime,
            uptime: Date.now() - this.state.startTime,
            metrics: JSON.parse(JSON.stringify(this.state.metrics))
        };
    }

    /**
     * 格式化持续时间
     * @param {number} ms - 毫秒数
     * @returns {string} 格式化字符串
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * 格式化字节大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化字符串
     */
    formatBytes(bytes) {
        if (bytes === 0 || bytes === undefined) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }

    /**
     * 停止监控
     */
    stop() {
        this.state.isActive = false;
        
        if (this.state.reportInterval) {
            clearInterval(this.state.reportInterval);
            this.state.reportInterval = null;
        }

        // 移除事件监听器
        for (const [event, handler] of this.state.eventListeners) {
            document.removeEventListener(event, handler);
        }
        this.state.eventListeners.clear();

        console.log('性能监控器已停止');
    }

    /**
     * 销毁监控器
     */
    destroy() {
        this.stop();
        this.state.timers.clear();
        this.state.customMetrics.clear();
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
} else {
    window.PerformanceMonitor = PerformanceMonitor;
}