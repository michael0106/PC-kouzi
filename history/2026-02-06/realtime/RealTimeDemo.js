/**
 * 实时更新引擎演示
 * 展示引擎功能并提供交互界面
 * 
 * @class RealTimeDemo
 */
class RealTimeDemo {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
        this.options = {
            containerSelector: options.containerSelector || '#realtime-demo',
            apiEndpoint: options.apiEndpoint || '/api/insights/latest',
            enableUI: options.enableUI !== false
        };

        this.engine = null;
        this.ui = null;
        this.mockData = null;
        this.demoInterval = null;
        
        this.init();
    }

    /**
     * 初始化演示
     */
    async init() {
        console.log('初始化实时更新演示...');

        // 创建模拟数据
        this.createMockData();

        // 创建UI容器
        this.createUIContainer();

        // 初始化引擎
        await this.initEngine();

        // 启动演示
        this.startDemo();
    }

    /**
     * 创建模拟数据
     */
    createMockData() {
        this.mockData = {
            date: '2026-02-06',
            report_date_display: '2026年02月06日',
            generated_at: new Date().toISOString(),
            version: '1.0.0',
            metadata: {
                total_insights: 5,
                schema_version: '1.0.0',
                generator: 'RealTimeEngine'
            },
            update_id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            insights: [
                {
                    id: 1,
                    title: '美联储维持利率不变',
                    summary: '美联储按市场预期维持基准利率在5.25-5.50%区间，符合市场预期',
                    analysis: '美联储最新利率决议保持利率不变，对通胀立场偏鹰派...',
                    formatted_analysis: '<p>美联储最新利率决议保持利率不变，对通胀立场偏鹰派...</p>',
                    source: 'Reuters',
                    original_url: 'https://reuters.com/fed-rate',
                    publish_time: '2026-02-06T09:00:00Z',
                    source_links: [],
                    impacts: {
                        a_share: 'neutral',
                        hk_stock: 'neutral',
                        precious_metal: 'negative',
                        fx: 'negative'
                    },
                    impact_judgement: '对贵金属和美元汇率有负面影响',
                    scoring: {
                        scores: {
                            event_impact: 'high',
                            data_impact: 'high',
                            is_surprise: 'no',
                            market_relevance: 'high',
                            timeliness: 'high'
                        },
                        numeric_scores: {
                            event_impact: 3,
                            data_impact: 3,
                            is_surprise: 0,
                            market_relevance: 3,
                            timeliness: 3
                        },
                        total_score: 12,
                        standardized_score: 10.0,
                        should_include: true
                    },
                    short_title: '美联储决议',
                    overall_impact: '偏负面',
                    event_impact: '高'
                },
                {
                    id: 2,
                    title: '欧洲央行暗示降息周期启动',
                    summary: '欧洲央行行长拉加德表示通胀已得到控制，暗示可能开始降息周期',
                    analysis: '在欧洲央行最新会议上，行长拉加德表示通胀压力已显著缓解...',
                    formatted_analysis: '<p>在欧洲央行最新会议上，行长拉加德表示通胀压力已显著缓解...</p>',
                    source: 'Bloomberg',
                    original_url: 'https://bloomberg.com/ecb-hints',
                    publish_time: '2026-02-06T10:00:00Z',
                    source_links: [],
                    impacts: {
                        a_share: 'positive',
                        hk_stock: 'positive',
                        precious_metal: 'positive',
                        fx: 'positive'
                    },
                    impact_judgement: '对全球风险资产有正面影响',
                    scoring: {
                        scores: {
                            event_impact: 'high',
                            data_impact: 'medium',
                            is_surprise: 'yes',
                            market_relevance: 'high',
                            timeliness: 'high'
                        },
                        numeric_scores: {
                            event_impact: 3,
                            data_impact: 2,
                            is_surprise: 1,
                            market_relevance: 3,
                            timeliness: 3
                        },
                        total_score: 12,
                        standardized_score: 10.0,
                        should_include: true
                    },
                    short_title: '欧央行信号',
                    overall_impact: '偏正面',
                    event_impact: '高'
                },
                {
                    id: 3,
                    title: '中国制造业PMI连续第三个月扩张',
                    summary: '中国1月制造业PMI为52.1，超过预期的51.8，显示制造业持续复苏',
                    analysis: '中国国家统计局数据显示，1月制造业采购经理指数(PMI)为52.1...',
                    formatted_analysis: '<p>中国国家统计局数据显示，1月制造业采购经理指数(PMI)为52.1...</p>',
                    source: '国家统计局',
                    original_url: 'https://stats.gov.cn/pmidata',
                    publish_time: '2026-02-06T11:00:00Z',
                    source_links: [],
                    impacts: {
                        a_share: 'positive',
                        hk_stock: 'positive',
                        precious_metal: 'neutral',
                        fx: 'positive'
                    },
                    impact_judgement: '对A股、港股和人民币汇率有正面影响',
                    scoring: {
                        scores: {
                            event_impact: 'medium',
                            data_impact: 'high',
                            is_surprise: 'yes',
                            market_relevance: 'high',
                            timeliness: 'high'
                        },
                        numeric_scores: {
                            event_impact: 2,
                            data_impact: 3,
                            is_surprise: 1,
                            market_relevance: 3,
                            timeliness: 3
                        },
                        total_score: 12,
                        standardized_score: 10.0,
                        should_include: true
                    },
                    short_title: '中国PMI',
                    overall_impact: '偏正面',
                    event_impact: '中'
                }
            ],
            impact_matrix: [
                {
                    id: 1,
                    short_title: '美联储决议',
                    a_share: 'neutral',
                    hk_stock: 'neutral',
                    precious_metal: 'negative',
                    fx: 'negative',
                    overall_impact: '偏负面',
                    event_impact: '高'
                },
                {
                    id: 2,
                    short_title: '欧央行信号',
                    a_share: 'positive',
                    hk_stock: 'positive',
                    precious_metal: 'positive',
                    fx: 'positive',
                    overall_impact: '偏正面',
                    event_impact: '高'
                },
                {
                    id: 3,
                    short_title: '中国PMI',
                    a_share: 'positive',
                    hk_stock: 'positive',
                    precious_metal: 'neutral',
                    fx: 'positive',
                    overall_impact: '偏正面',
                    event_impact: '中'
                }
            ]
        };
    }

    /**
     * 创建UI容器
     */
    createUIContainer() {
        if (!this.options.enableUI) return;

        let container = document.querySelector(this.options.containerSelector);
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'realtime-demo-container';
            container.className = 'realtime-demo-container';
            
            // 添加到body末尾
            document.body.appendChild(container);
        }

        this.ui = container;
        this.renderUI();
    }

    /**
     * 渲染UI界面
     */
    renderUI() {
        if (!this.ui) return;

        this.ui.innerHTML = `
            <div class="realtime-demo">
                <div class="demo-header">
                    <h3>实时更新引擎演示</h3>
                    <div class="demo-status">
                        <span class="status-indicator" id="engine-status"></span>
                        <span id="engine-status-text">准备中</span>
                    </div>
                </div>
                
                <div class="demo-controls">
                    <button id="start-engine" class="btn btn-primary">启动引擎</button>
                    <button id="stop-engine" class="btn btn-secondary">停止引擎</button>
                    <button id="manual-refresh" class="btn btn-info">手动刷新</button>
                    <button id="add-mock-data" class="btn btn-success">添加模拟数据</button>
                    <button id="toggle-polling" class="btn btn-warning">切换轮询</button>
                </div>
                
                <div class="demo-stats">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">轮询次数</div>
                            <div class="stat-value" id="polling-count">0</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">成功更新</div>
                            <div class="stat-value" id="update-success">0</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">失败次数</div>
                            <div class="stat-value" id="update-failures">0</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">平均延迟</div>
                            <div class="stat-value" id="avg-latency">0ms</div>
                        </div>
                    </div>
                </div>
                
                <div class="demo-log">
                    <div class="log-header">
                        <h4>更新日志</h4>
                        <button id="clear-log" class="btn btn-sm btn-outline">清空</button>
                    </div>
                    <div class="log-content" id="update-log">
                        <div class="log-entry log-info">实时更新引擎演示已启动</div>
                    </div>
                </div>
                
                <div class="demo-insights">
                    <h4>当前洞察数据</h4>
                    <div id="insights-container" class="insights-container">
                        <div class="loading-placeholder">加载中...</div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.injectStyles();
    }

    /**
     * 注入样式
     */
    injectStyles() {
        if (document.getElementById('realtime-demo-styles')) return;

        const styles = `
            .realtime-demo-container {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 500px;
                max-width: 90vw;
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #f1f5f9;
            }
            
            .realtime-demo {
                display: flex;
                flex-direction: column;
                height: 600px;
                max-height: 80vh;
            }
            
            .demo-header {
                padding: 16px 20px;
                background: #0f172a;
                border-bottom: 1px solid #334155;
            }
            
            .demo-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #e2e8f0;
            }
            
            .demo-status {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 8px;
            }
            
            .status-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #6b7280;
            }
            
            .status-indicator.active {
                background: #10b981;
                box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
            }
            
            .demo-controls {
                padding: 16px 20px;
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                background: #0f172a;
                border-bottom: 1px solid #334155;
            }
            
            .btn {
                padding: 8px 12px;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                font-family: inherit;
            }
            
            .btn-primary {
                background: #3b82f6;
                color: white;
            }
            
            .btn-primary:hover {
                background: #2563eb;
            }
            
            .btn-secondary {
                background: #6b7280;
                color: white;
            }
            
            .btn-secondary:hover {
                background: #4b5563;
            }
            
            .btn-info {
                background: #0ea5e9;
                color: white;
            }
            
            .btn-info:hover {
                background: #0284c7;
            }
            
            .btn-success {
                background: #10b981;
                color: white;
            }
            
            .btn-success:hover {
                background: #059669;
            }
            
            .btn-warning {
                background: #f59e0b;
                color: white;
            }
            
            .btn-warning:hover {
                background: #d97706;
            }
            
            .btn-outline {
                background: transparent;
                border: 1px solid #4b5563;
                color: #e2e8f0;
            }
            
            .btn-outline:hover {
                background: #374151;
            }
            
            .demo-stats {
                padding: 16px 20px;
                background: #0f172a;
                border-bottom: 1px solid #334155;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
            }
            
            .stat-card {
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 12px;
                text-align: center;
            }
            
            .stat-label {
                font-size: 11px;
                color: #94a3b8;
                margin-bottom: 4px;
            }
            
            .stat-value {
                font-size: 14px;
                font-weight: 600;
                color: #e2e8f0;
            }
            
            .demo-log {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: #0f172a;
            }
            
            .log-header {
                padding: 12px 20px;
                background: #0f172a;
                border-bottom: 1px solid #334155;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .log-header h4 {
                margin: 0;
                font-size: 14px;
                font-weight: 600;
            }
            
            .log-content {
                flex: 1;
                overflow-y: auto;
                padding: 16px 20px;
                background: #1e293b;
            }
            
            .log-entry {
                padding: 8px 12px;
                margin-bottom: 8px;
                border-radius: 6px;
                font-size: 12px;
                line-height: 1.4;
                word-wrap: break-word;
            }
            
            .log-info {
                background: rgba(59, 130, 246, 0.15);
                border-left: 3px solid #3b82f6;
            }
            
            .log-success {
                background: rgba(16, 185, 129, 0.15);
                border-left: 3px solid #10b981;
            }
            
            .log-warning {
                background: rgba(245, 158, 11, 0.15);
                border-left: 3px solid #f59e0b;
            }
            
            .log-error {
                background: rgba(239, 68, 68, 0.15);
                border-left: 3px solid #ef4444;
            }
            
            .demo-insights {
                padding: 16px 20px;
                background: #0f172a;
                border-top: 1px solid #334155;
                max-height: 200px;
                overflow-y: auto;
            }
            
            .demo-insights h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                font-weight: 600;
            }
            
            .insights-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .insight-card {
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 12px;
            }
            
            .insight-title {
                font-size: 12px;
                font-weight: 600;
                color: #e2e8f0;
                margin-bottom: 4px;
            }
            
            .insight-summary {
                font-size: 11px;
                color: #94a3b8;
            }
            
            .loading-placeholder {
                padding: 20px;
                text-align: center;
                color: #94a3b8;
                font-style: italic;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.id = 'realtime-demo-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    /**
     * 附加事件监听器
     */
    attachEventListeners() {
        document.getElementById('start-engine')?.addEventListener('click', () => this.startEngine());
        document.getElementById('stop-engine')?.addEventListener('click', () => this.stopEngine());
        document.getElementById('manual-refresh')?.addEventListener('click', () => this.manualRefresh());
        document.getElementById('add-mock-data')?.addEventListener('click', () => this.addMockData());
        document.getElementById('toggle-polling')?.addEventListener('click', () => this.togglePolling());
        document.getElementById('clear-log')?.addEventListener('click', () => this.clearLog());
    }

    /**
     * 初始化引擎
     */
    async initEngine() {
        try {
            // 创建引擎实例
            this.engine = new RealTimeEngine({
                apiEndpoint: this.options.apiEndpoint,
                pollingConfig: {
                    normalInterval: 10000, // 演示用更短的间隔
                    activeInterval: 5000,
                    backgroundInterval: 15000,
                    retryDelay: 2000,
                    maxRetries: 2
                },
                onDataUpdate: (changes, newData) => {
                    this.handleDataUpdate(changes, newData);
                },
                enableCache: true,
                enablePerformanceMonitor: true
            });

            // 等待引擎初始化
            await new Promise((resolve, reject) => {
                const checkInit = () => {
                    if (this.engine.getState().isInitialized) {
                        resolve();
                    } else {
                        setTimeout(checkInit, 100);
                    }
                };
                checkInit();
            });

            this.log('实时更新引擎初始化完成', 'success');
            this.updateStatus('active');
        } catch (error) {
            this.log(`引擎初始化失败: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 启动引擎
     */
    startEngine() {
        if (!this.engine) return;

        this.engine.start();
        this.log('引擎已启动', 'success');
        this.updateStatus('active');
    }

    /**
     * 停止引擎
     */
    stopEngine() {
        if (!this.engine) return;

        this.engine.stop();
        this.log('引擎已停止', 'warning');
        this.updateStatus('inactive');
    }

    /**
     * 手动刷新
     */
    async manualRefresh() {
        if (!this.engine) return;

        this.log('执行手动刷新...', 'info');
        await this.engine.manualRefresh();
    }

    /**
     * 添加模拟数据
     */
    addMockData() {
        if (!this.engine) return;

        // 创建新的模拟数据
        const newId = this.mockData.insights.length + 1;
        const newInsight = {
            id: newId,
            title: `新增模拟洞察 #${newId}`,
            summary: `这是通过演示界面添加的第${newId}条模拟洞察数据`,
            analysis: `模拟洞察内容 #${newId}，用于演示实时更新引擎的功能`,
            formatted_analysis: `<p>模拟洞察内容 #${newId}，用于演示实时更新引擎的功能</p>`,
            source: '演示系统',
            original_url: '#',
            publish_time: new Date().toISOString(),
            source_links: [],
            impacts: {
                a_share: Math.random() > 0.5 ? 'positive' : 'negative',
                hk_stock: Math.random() > 0.5 ? 'positive' : 'negative',
                precious_metal: 'neutral',
                fx: 'neutral'
            },
            impact_judgement: '演示数据',
            scoring: {
                scores: {
                    event_impact: 'medium',
                    data_impact: 'medium',
                    is_surprise: 'no',
                    market_relevance: 'medium',
                    timeliness: 'high'
                },
                numeric_scores: {
                    event_impact: 2,
                    data_impact: 2,
                    is_surprise: 0,
                    market_relevance: 2,
                    timeliness: 3
                },
                total_score: 9,
                standardized_score: 7.5,
                should_include: true
            },
            short_title: `模拟${newId}`,
            overall_impact: Math.random() > 0.5 ? '偏正面' : '偏负面',
            event_impact: '中'
        };

        // 添加到模拟数据
        this.mockData.insights.push(newInsight);
        this.mockData.impact_matrix.push({
            id: newId,
            short_title: `模拟${newId}`,
            a_share: newInsight.impacts.a_share,
            hk_stock: newInsight.impacts.hk_stock,
            precious_metal: newInsight.impacts.precious_metal,
            fx: newInsight.impacts.fx,
            overall_impact: newInsight.overall_impact,
            event_impact: newInsight.event_impact
        });

        this.log(`已添加模拟洞察 #${newId}`, 'success');
        this.renderInsights();
    }

    /**
     * 切换轮询
     */
    togglePolling() {
        if (!this.engine) return;

        const state = this.engine.getState();
        if (state.isActive) {
            this.engine.stop();
            this.log('轮询已停止', 'warning');
        } else {
            this.engine.start();
            this.log('轮询已启动', 'success');
        }
    }

    /**
     * 处理数据更新
     * @param {Object} changes - 变化数据
     * @param {Object} newData - 新数据
     */
    handleDataUpdate(changes, newData) {
        // 更新统计信息
        this.updateStats(changes, newData);
        
        // 记录更新日志
        this.logUpdate(changes);
        
        // 渲染洞察数据
        this.renderInsights();
    }

    /**
     * 更新统计信息
     * @param {Object} changes - 变化数据
     * @param {Object} newData - 新数据
     */
    updateStats(changes, newData) {
        if (!this.ui) return;

        const state = this.engine.getState();
        
        // 更新轮询次数
        const pollingCount = document.getElementById('polling-count');
        if (pollingCount) {
            pollingCount.textContent = state.stats.totalUpdates;
        }
        
        // 更新成功更新次数
        const updateSuccess = document.getElementById('update-success');
        if (updateSuccess) {
            updateSuccess.textContent = state.stats.successfulUpdates;
        }
        
        // 更新失败次数
        const updateFailures = document.getElementById('update-failures');
        if (updateFailures) {
            updateFailures.textContent = state.stats.failedUpdates;
        }
        
        // 更新平均延迟
        const avgLatency = document.getElementById('avg-latency');
        if (avgLatency) {
            const pollingModule = this.engine.getModule('polling');
            if (pollingModule && pollingModule.averageDuration) {
                avgLatency.textContent = `${pollingModule.averageDuration.toFixed(0)}ms`;
            }
        }
    }

    /**
     * 记录更新日志
     * @param {Object} changes - 变化数据
     */
    logUpdate(changes) {
        if (!this.ui) return;

        const logContent = document.getElementById('update-log');
        if (!logContent) return;

        const timestamp = new Date().toLocaleTimeString();
        let logMessage = '';
        let logType = 'info';

        if (changes.added.length > 0) {
            logMessage = `${timestamp} - 新增${changes.added.length}条洞察`;
            logType = 'success';
        } else if (changes.updated.length > 0) {
            logMessage = `${timestamp} - 更新${changes.updated.length}条洞察`;
            logType = 'warning';
        } else {
            logMessage = `${timestamp} - 数据无变化`;
        }

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${logType}`;
        logEntry.textContent = logMessage;

        logContent.prepend(logEntry);
        
        // 限制日志条目数量
        const maxLogEntries = 20;
        if (logContent.children.length > maxLogEntries) {
            for (let i = maxLogEntries; i < logContent.children.length; i++) {
                logContent.removeChild(logContent.children[i]);
            }
        }
    }

    /**
     * 渲染洞察数据
     */
    renderInsights() {
        if (!this.ui) return;

        const container = document.getElementById('insights-container');
        if (!container) return;

        container.innerHTML = '';
        
        this.mockData.insights.forEach(insight => {
            const card = document.createElement('div');
            card.className = 'insight-card';
            
            const title = document.createElement('div');
            title.className = 'insight-title';
            title.textContent = `#${insight.id} ${insight.short_title}`;
            
            const summary = document.createElement('div');
            summary.className = 'insight-summary';
            summary.textContent = insight.summary.substring(0, 60) + '...';
            
            card.appendChild(title);
            card.appendChild(summary);
            container.appendChild(card);
        });
    }

    /**
     * 更新状态指示器
     * @param {string} status - 状态类型
     */
    updateStatus(status) {
        const indicator = document.getElementById('engine-status');
        const text = document.getElementById('engine-status-text');
        
        if (!indicator || !text) return;
        
        switch (status) {
            case 'active':
                indicator.className = 'status-indicator active';
                text.textContent = '运行中';
                break;
            case 'inactive':
                indicator.className = 'status-indicator';
                text.textContent = '已停止';
                break;
            case 'error':
                indicator.className = 'status-indicator';
                indicator.style.background = '#ef4444';
                text.textContent = '错误';
                break;
            default:
                indicator.className = 'status-indicator';
                text.textContent = '准备中';
        }
    }

    /**
     * 记录日志
     * @param {string} message - 日志消息
     * @param {string} type - 日志类型
     */
    log(message, type = 'info') {
        if (!this.ui) {
            console.log(`[RealTimeDemo] ${message}`);
            return;
        }

        const logContent = document.getElementById('update-log');
        if (!logContent) return;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `${timestamp} - ${message}`;

        logContent.prepend(logEntry);
        
        // 限制日志条目数量
        const maxLogEntries = 20;
        if (logContent.children.length > maxLogEntries) {
            for (let i = maxLogEntries; i < logContent.children.length; i++) {
                logContent.removeChild(logContent.children[i]);
            }
        }
    }

    /**
     * 清空日志
     */
    clearLog() {
        const logContent = document.getElementById('update-log');
        if (logContent) {
            logContent.innerHTML = '<div class="log-entry log-info">日志已清空</div>';
        }
    }

    /**
     * 启动演示
     */
    startDemo() {
        // 更新状态
        this.updateStatus('active');
        
        // 开始演示循环
        this.demoInterval = setInterval(() => {
            this.simulateDataUpdate();
        }, 15000);
        
        this.log('演示已启动，将每15秒模拟数据更新', 'success');
    }

    /**
     * 模拟数据更新
     */
    simulateDataUpdate() {
        if (!this.engine || !this.engine.getState().isActive) return;

        // 模拟随机更新
        const updateType = Math.random();
        
        if (updateType < 0.3) {
            this.log('模拟数据更新：无变化', 'info');
        } else if (updateType < 0.6) {
            this.log('模拟数据更新：轻微变化', 'info');
        } else {
            this.log('模拟数据更新：新增数据', 'success');
            this.addMockData();
        }
    }

    /**
     * 停止演示
     */
    stopDemo() {
        if (this.demoInterval) {
            clearInterval(this.demoInterval);
            this.demoInterval = null;
        }
        
        if (this.engine) {
            this.engine.stop();
        }
        
        this.updateStatus('inactive');
        this.log('演示已停止', 'warning');
    }

    /**
     * 销毁演示
     */
    destroy() {
        this.stopDemo();
        
        if (this.ui) {
            this.ui.remove();
            this.ui = null;
        }
        
        const styles = document.getElementById('realtime-demo-styles');
        if (styles) {
            styles.remove();
        }
        
        console.log('实时更新演示已销毁');
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeDemo;
} else {
    window.RealTimeDemo = RealTimeDemo;
}