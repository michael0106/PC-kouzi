/**
 * 性能优化管理器
 * 整合懒加载、性能监控、缓存优化等功能
 * 
 * @class PerformanceOptimizer
 */

class PerformanceOptimizer {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Object} options.lazyLoading - 懒加载配置
     * @param {Object} options.webVitals - Web Vitals监控配置
     * @param {Object} options.cache - 缓存配置
     * @param {Function} options.onOptimizationComplete - 优化完成回调
     * @param {Function} options.onError - 错误回调
     */
    constructor(options = {}) {
        this.options = {
            lazyLoading: {
                enable: options.lazyLoading?.enable !== false,
                rootMargin: options.lazyLoading?.rootMargin || '200px',
                threshold: options.lazyLoading?.threshold || 0.01,
                placeholderImage: options.lazyLoading?.placeholderImage || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PC9zdmc+'
            },
            webVitals: {
                enable: options.webVitals?.enable !== false,
                autoReportToConsole: options.webVitals?.autoReportToConsole !== false,
                thresholds: options.webVitals?.thresholds || {
                    lcp: { good: 2500, poor: 4000 },
                    fid: { good: 100, poor: 300 },
                    cls: { good: 0.1, poor: 0.25 },
                    fcp: { good: 1000, poor: 3000 },
                    ttfb: { good: 800, poor: 1800 }
                }
            },
            cache: {
                enableServiceWorker: options.cache?.enableServiceWorker !== false,
                enableMemoryCache: options.cache?.enableMemoryCache !== false
            },
            onOptimizationComplete: options.onOptimizationComplete || null,
            onError: options.onError || null
        };

        this.state = {
            isInitialized: false,
            lazyLoader: null,
            webVitalsMonitor: null,
            optimizationMetrics: {
                startTime: Date.now(),
                initialLoadSize: 0,
                optimizedLoadSize: 0,
                reductionPercentage: 0
            },
            performanceData: {
                lcp: null,
                fid: null,
                cls: null,
                fcp: null,
                ttfb: null
            }
        };

        this.init();
    }

    /**
     * 初始化性能优化器
     */
    async init() {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            console.warn('PerformanceOptimizer: 仅支持浏览器环境');
            return;
        }

        try {
            // 测量初始加载大小
            await this.measureInitialLoadSize();
            
            // 初始化懒加载
            if (this.options.lazyLoading.enable) {
                this.initLazyLoader();
            }
            
            // 初始化Web Vitals监控
            if (this.options.webVitals.enable) {
                this.initWebVitalsMonitor();
            }
            
            // 优化缓存策略
            if (this.options.cache.enableServiceWorker) {
                this.optimizeCaching();
            }
            
            // 设置完成状态
            this.state.isInitialized = true;
            
            // 计算优化指标
            this.calculateOptimizationMetrics();
            
            // 触发完成回调
            if (this.options.onOptimizationComplete) {
                this.options.onOptimizationComplete({
                    metrics: this.state.optimizationMetrics,
                    performance: this.state.performanceData
                });
            }
            
            console.log('PerformanceOptimizer: 初始化完成');
            
        } catch (error) {
            console.error('PerformanceOptimizer: 初始化失败', error);
            
            if (this.options.onError) {
                this.options.onError(error);
            }
        }
    }

    /**
     * 测量初始加载大小
     */
    async measureInitialLoadSize() {
        // 计算页面总资源大小（近似值）
        const resources = performance.getEntriesByType('resource');
        let totalSize = 0;
        
        resources.forEach(resource => {
            if (resource.transferSize) {
                totalSize += resource.transferSize;
            }
        });
        
        // 包括HTML文档大小
        const htmlSize = document.documentElement.outerHTML.length;
        totalSize += htmlSize;
        
        this.state.optimizationMetrics.initialLoadSize = totalSize;
        
        console.log(`PerformanceOptimizer: 初始加载大小 ≈ ${(totalSize / 1024).toFixed(1)} KB`);
    }

    /**
     * 初始化懒加载器
     */
    initLazyLoader() {
        try {
            // 检查是否已存在懒加载器
            if (window.LazyLoader) {
                this.state.lazyLoader = new window.LazyLoader({
                    rootMargin: this.options.lazyLoading.rootMargin,
                    threshold: this.options.lazyLoading.threshold,
                    placeholderConfig: {
                        image: this.options.lazyLoading.placeholderImage
                    },
                    onElementLoaded: (element, elementData) => {
                        this.onLazyElementLoaded(element, elementData);
                    },
                    onElementError: (element, elementData, error) => {
                        this.onLazyElementError(element, elementData, error);
                    }
                });
                
                console.log('PerformanceOptimizer: 懒加载器已初始化');
            } else {
                console.warn('PerformanceOptimizer: LazyLoader类未找到');
            }
        } catch (error) {
            console.error('PerformanceOptimizer: 懒加载器初始化失败', error);
        }
    }

    /**
     * 初始化Web Vitals监控器
     */
    initWebVitalsMonitor() {
        try {
            // 检查是否已存在WebVitalsMonitor
            if (window.WebVitalsMonitor) {
                this.state.webVitalsMonitor = new window.WebVitalsMonitor({
                    enableLCP: true,
                    enableFID: true,
                    enableCLS: true,
                    enableFCP: true,
                    enableTTFB: true,
                    thresholds: this.options.webVitals.thresholds,
                    autoReportToConsole: this.options.webVitals.autoReportToConsole,
                    onMetricReport: (metricData) => {
                        this.onWebVitalsReport(metricData);
                    }
                });
                
                console.log('PerformanceOptimizer: Web Vitals监控器已初始化');
            } else {
                console.warn('PerformanceOptimizer: WebVitalsMonitor类未找到');
            }
        } catch (error) {
            console.error('PerformanceOptimizer: Web Vitals监控器初始化失败', error);
        }
    }

    /**
     * 优化缓存策略
     */
    optimizeCaching() {
        // 检查Service Worker支持
        if ('serviceWorker' in navigator) {
            // Service Worker已经在PWAManager中注册
            console.log('PerformanceOptimizer: Service Worker缓存已启用');
            
            // 添加缓存策略优化（可由Service Worker处理）
            this.optimizeServiceWorkerCache();
        } else {
            console.warn('PerformanceOptimizer: Service Worker不支持');
        }
    }

    /**
     * 优化Service Worker缓存策略
     */
    optimizeServiceWorkerCache() {
        // 发送消息给Service Worker，优化缓存配置
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'OPTIMIZE_CACHE',
                config: {
                    jsonTtl: 5 * 60 * 1000, // 5分钟
                    staticTtl: 365 * 24 * 60 * 60 * 1000, // 1年
                    maxEntries: 100
                }
            });
            
            console.log('PerformanceOptimizer: 已发送缓存优化配置到Service Worker');
        }
    }

    /**
     * 计算优化指标
     */
    calculateOptimizationMetrics() {
        const { initialLoadSize } = this.state.optimizationMetrics;
        
        // 估算优化后的加载大小（假设减少30%）
        // 实际值应由性能测试得出
        const estimatedReduction = 0.30; // 30%
        const optimizedLoadSize = initialLoadSize * (1 - estimatedReduction);
        
        this.state.optimizationMetrics.optimizedLoadSize = optimizedLoadSize;
        this.state.optimizationMetrics.reductionPercentage = estimatedReduction * 100;
        
        console.log(`PerformanceOptimizer: 预计加载大小减少 ${(estimatedReduction * 100).toFixed(1)}%`);
        console.log(`  初始: ${(initialLoadSize / 1024).toFixed(1)} KB`);
        console.log(`  优化后: ${(optimizedLoadSize / 1024).toFixed(1)} KB`);
    }

    /**
     * 懒加载元素加载完成回调
     * @param {HTMLElement} element - 元素
     * @param {Object} elementData - 元素数据
     */
    onLazyElementLoaded(element, elementData) {
        console.log(`PerformanceOptimizer: 懒加载元素完成 - ${elementData.type}`);
        
        // 更新性能指标
        if (elementData.type === 'img') {
            // 图片加载完成，可记录相关指标
            this.recordImageLoadMetric(element);
        }
    }

    /**
     * 懒加载元素加载失败回调
     * @param {HTMLElement} element - 元素
     * @param {Object} elementData - 元素数据
     * @param {Error} error - 错误
     */
    onLazyElementError(element, elementData, error) {
        console.error(`PerformanceOptimizer: 懒加载元素失败 - ${elementData.type}`, error);
    }

    /**
     * Web Vitals指标报告回调
     * @param {Object} metricData - 指标数据
     */
    onWebVitalsReport(metricData) {
        // 保存性能数据
        const metricName = metricData.name.toLowerCase();
        this.state.performanceData[metricName] = metricData.value;
        
        // 输出到控制台（如果启用）
        if (this.options.webVitals.autoReportToConsole) {
            console.log(`PerformanceOptimizer: ${metricData.name} = ${metricData.value}ms (${metricData.rating})`);
        }
    }

    /**
     * 记录图片加载指标
     * @param {HTMLImageElement} img - 图片元素
     */
    recordImageLoadMetric(img) {
        // 计算图片加载时间
        const loadTime = Date.now() - this.state.optimizationMetrics.startTime;
        
        console.log(`PerformanceOptimizer: 图片加载时间 ≈ ${loadTime}ms`);
    }

    /**
     * 获取优化报告
     * @returns {Object} 优化报告
     */
    getReport() {
        return {
            timestamp: Date.now(),
            url: window.location.href,
            optimization: {
                ...this.state.optimizationMetrics,
                estimatedReduction: `${this.state.optimizationMetrics.reductionPercentage.toFixed(1)}%`
            },
            performance: this.state.performanceData,
            configuration: this.options
        };
    }

    /**
     * 手动触发优化评估
     */
    evaluateOptimization() {
        // 重新计算指标
        this.calculateOptimizationMetrics();
        
        // 收集当前性能数据
        const report = this.getReport();
        
        console.log('PerformanceOptimizer: 优化评估完成');
        console.log(report);
        
        return report;
    }

    /**
     * 销毁性能优化器
     */
    destroy() {
        // 销毁懒加载器
        if (this.state.lazyLoader) {
            this.state.lazyLoader.destroy();
            this.state.lazyLoader = null;
        }
        
        // 销毁Web Vitals监控器
        if (this.state.webVitalsMonitor) {
            this.state.webVitalsMonitor.destroy();
            this.state.webVitalsMonitor = null;
        }
        
        // 清空状态
        this.state.isInitialized = false;
        this.state.optimizationMetrics = {
            startTime: Date.now(),
            initialLoadSize: 0,
            optimizedLoadSize: 0,
            reductionPercentage: 0
        };
        this.state.performanceData = {
            lcp: null,
            fid: null,
            cls: null,
            fcp: null,
            ttfb: null
        };
        
        console.log('PerformanceOptimizer: 已销毁');
    }
}

// 全局导出
if (typeof window !== 'undefined') {
    window.PerformanceOptimizer = PerformanceOptimizer;
}

export default PerformanceOptimizer;