/**
 * Web Vitals 性能监控器
 * 测量并报告 LCP、FID、CLS 等核心 Web 指标
 * 
 * @class WebVitalsMonitor
 */

class WebVitalsMonitor {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {boolean} options.enableLCP - 是否监控LCP（默认true）
     * @param {boolean} options.enableFID - 是否监控FID（默认true）
     * @param {boolean} options.enableCLS - 是否监控CLS（默认true）
     * @param {boolean} options.enableFCP - 是否监控FCP（默认true）
     * @param {boolean} options.enableTTFB - 是否监控TTFB（默认true）
     * @param {Function} options.onMetricReport - 指标报告回调
     * @param {Function} options.onError - 错误回调
     * @param {Object} options.thresholds - 指标阈值配置
     * @param {boolean} options.autoReportToConsole - 是否自动输出到控制台（默认true）
     */
    constructor(options = {}) {
        this.options = {
            enableLCP: options.enableLCP !== false,
            enableFID: options.enableFID !== false,
            enableCLS: options.enableCLS !== false,
            enableFCP: options.enableFCP !== false,
            enableTTFB: options.enableTTFB !== false,
            onMetricReport: options.onMetricReport || null,
            onError: options.onError || null,
            thresholds: options.thresholds || {
                lcp: { good: 2500, poor: 4000 },
                fid: { good: 100, poor: 300 },
                cls: { good: 0.1, poor: 0.25 },
                fcp: { good: 1000, poor: 3000 },
                ttfb: { good: 800, poor: 1800 }
            },
            autoReportToConsole: options.autoReportToConsole !== false
        };

        this.state = {
            isInitialized: false,
            metrics: {
                lcp: null,
                fid: null,
                cls: null,
                fcp: null,
                ttfb: null
            },
            listeners: [],
            performanceObserver: null
        };

        this.init();
    }

    /**
     * 初始化监控器
     */
    init() {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            console.warn('WebVitalsMonitor: 仅支持浏览器环境');
            return;
        }

        if (!('PerformanceObserver' in window) || !('performance' in window)) {
            console.warn('WebVitalsMonitor: Performance API不支持');
            return;
        }

        this.setupEventListeners();
        this.setupPerformanceObservers();
        
        this.state.isInitialized = true;
        
        if (this.options.autoReportToConsole) {
            console.log('WebVitalsMonitor: 已初始化，开始监控性能指标');
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听页面卸载，保存最终指标
        window.addEventListener('beforeunload', () => {
            this.reportFinalMetrics();
        });

        // 监听用户交互（用于FID测量）
        if (this.options.enableFID) {
            ['click', 'keydown', 'mousedown', 'pointerdown'].forEach(eventType => {
                document.addEventListener(eventType, (event) => {
                    this.handleFirstInput(event);
                }, { once: true, capture: true });
            });
        }
    }

    /**
     * 设置PerformanceObserver
     */
    setupPerformanceObservers() {
        // 监控CLS（累积布局偏移）
        if (this.options.enableCLS) {
            try {
                this.state.clsObserver = new PerformanceObserver((entryList) => {
                    for (const entry of entryList.getEntries()) {
                        if (!entry.hadRecentInput) {
                            this.updateCLS(entry.value);
                        }
                    }
                });
                
                this.state.clsObserver.observe({ type: 'layout-shift', buffered: true });
            } catch (e) {
                console.warn('WebVitalsMonitor: CLS监控设置失败', e);
            }
        }

        // 监控LCP（最大内容绘制）
        if (this.options.enableLCP) {
            try {
                this.state.lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    
                    if (lastEntry) {
                        this.updateLCP(lastEntry.startTime);
                    }
                });
                
                this.state.lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
            } catch (e) {
                console.warn('WebVitalsMonitor: LCP监控设置失败', e);
            }
        }

        // 监控FCP（首次内容绘制）
        if (this.options.enableFCP) {
            try {
                this.state.fcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
                    
                    if (fcpEntry) {
                        this.updateFCP(fcpEntry.startTime);
                    }
                });
                
                this.state.fcpObserver.observe({ type: 'paint', buffered: true });
            } catch (e) {
                console.warn('WebVitalsMonitor: FCP监控设置失败', e);
            }
        }
    }

    /**
     * 处理首次用户输入（测量FID）
     * @param {Event} event - 输入事件
     */
    handleFirstInput(event) {
        if (this.state.metrics.fid !== null) {
            return; // 已经记录过FID
        }

        const processingStart = performance.now();
        const inputDelay = processingStart - event.timeStamp;

        // 保存FID值
        this.state.metrics.fid = inputDelay;
        
        this.reportMetric('fid', inputDelay, 'first input delay');
    }

    /**
     * 更新CLS值
     * @param {number} clsValue - CLS值
     */
    updateCLS(clsValue) {
        // CLS是累积值，取最大值
        const currentCLS = this.state.metrics.cls || 0;
        const newCLS = currentCLS + clsValue;
        
        this.state.metrics.cls = newCLS;
        
        if (this.options.autoReportToConsole) {
            console.log(`WebVitalsMonitor: CLS更新至 ${newCLS.toFixed(4)}`);
        }
    }

    /**
     * 更新LCP值
     * @param {number} lcpValue - LCP值（毫秒）
     */
    updateLCP(lcpValue) {
        if (this.state.metrics.lcp === null || lcpValue > this.state.metrics.lcp) {
            this.state.metrics.lcp = lcpValue;
            
            this.reportMetric('lcp', lcpValue, 'largest contentful paint');
        }
    }

    /**
     * 更新FCP值
     * @param {number} fcpValue - FCP值（毫秒）
     */
    updateFCP(fcpValue) {
        if (this.state.metrics.fcp === null) {
            this.state.metrics.fcp = fcpValue;
            
            this.reportMetric('fcp', fcpValue, 'first contentful paint');
        }
    }

    /**
     * 更新TTFB值
     * @param {number} ttfbValue - TTFB值（毫秒）
     */
    updateTTFB(ttfbValue) {
        if (this.state.metrics.ttfb === null) {
            this.state.metrics.ttfb = ttfbValue;
            
            this.reportMetric('ttfb', ttfbValue, 'time to first byte');
        }
    }

    /**
     * 报告指标
     * @param {string} metricName - 指标名称
     * @param {number} value - 指标值
     * @param {string} description - 指标描述
     */
    reportMetric(metricName, value, description) {
        const threshold = this.options.thresholds[metricName];
        let rating = 'good';
        
        if (threshold) {
            if (value <= threshold.good) {
                rating = 'good';
            } else if (value <= threshold.poor) {
                rating = 'needs improvement';
            } else {
                rating = 'poor';
            }
        }
        
        const metricData = {
            name: metricName.toUpperCase(),
            value: Math.round(value),
            rating: rating,
            description: description,
            timestamp: Date.now()
        };
        
        // 保存到状态
        this.state.metrics[metricName] = value;
        
        // 输出到控制台（如果启用）
        if (this.options.autoReportToConsole) {
            console.log(`WebVitalsMonitor: ${metricData.name} = ${metricData.value}ms (${metricData.rating})`);
        }
        
        // 触发回调
        if (this.options.onMetricReport) {
            this.options.onMetricReport(metricData);
        }
    }

    /**
     * 获取所有指标数据
     * @returns {Object} 指标数据
     */
    getMetrics() {
        return {
            ...this.state.metrics,
            collectedAt: Date.now()
        };
    }

    /**
     * 获取指标报告（格式化）
     * @returns {Object} 格式化报告
     */
    getReport() {
        const metrics = this.getMetrics();
        const report = {
            timestamp: metrics.collectedAt,
            url: window.location.href,
            userAgent: navigator.userAgent,
            metrics: {}
        };
        
        // 为每个指标添加详细信息和评级
        Object.keys(metrics).forEach(key => {
            if (key !== 'collectedAt' && metrics[key] !== null) {
                const threshold = this.options.thresholds[key];
                let rating = 'good';
                
                if (threshold) {
                    if (metrics[key] <= threshold.good) {
                        rating = 'good';
                    } else if (metrics[key] <= threshold.poor) {
                        rating = 'needs improvement';
                    } else {
                        rating = 'poor';
                    }
                }
                
                report.metrics[key] = {
                    value: Math.round(metrics[key]),
                    unit: 'ms',
                    rating: rating,
                    threshold: threshold || null
                };
            }
        });
        
        return report;
    }

    /**
     * 报告最终指标（页面卸载前）
     */
    reportFinalMetrics() {
        const report = this.getReport();
        
        // 保存到localStorage以便后续分析
        try {
            const previousReports = JSON.parse(localStorage.getItem('webVitalsReports') || '[]');
            previousReports.push(report);
            
            // 只保留最近100份报告
            if (previousReports.length > 100) {
                previousReports.splice(0, previousReports.length - 100);
            }
            
            localStorage.setItem('webVitalsReports', JSON.stringify(previousReports));
            
            if (this.options.autoReportToConsole) {
                console.log('WebVitalsMonitor: 最终指标已保存');
                console.log(report);
            }
        } catch (e) {
            console.error('WebVitalsMonitor: 保存指标失败', e);
        }
        
        // 触发最终回调
        if (this.options.onMetricReport) {
            this.options.onMetricReport({
                type: 'final_report',
                report: report
            });
        }
    }

    /**
     * 手动记录自定义指标
     * @param {string} metricName - 指标名称
     * @param {number} value - 指标值
     * @param {string} description - 指标描述
     */
    recordCustomMetric(metricName, value, description = 'custom metric') {
        this.reportMetric(metricName, value, description);
    }

    /**
     * 销毁监控器
     */
    destroy() {
        // 断开所有PerformanceObserver
        if (this.state.clsObserver) {
            this.state.clsObserver.disconnect();
        }
        if (this.state.lcpObserver) {
            this.state.lcpObserver.disconnect();
        }
        if (this.state.fcpObserver) {
            this.state.fcpObserver.disconnect();
        }
        
        // 移除事件监听器
        window.removeEventListener('beforeunload', this.reportFinalMetrics);
        
        // 清空状态
        this.state.isInitialized = false;
        this.state.metrics = {
            lcp: null,
            fid: null,
            cls: null,
            fcp: null,
            ttfb: null
        };
        
        if (this.options.autoReportToConsole) {
            console.log('WebVitalsMonitor: 已销毁');
        }
    }
}

// 全局导出
if (typeof window !== 'undefined') {
    window.WebVitalsMonitor = WebVitalsMonitor;
}

export default WebVitalsMonitor;