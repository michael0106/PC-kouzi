/**
 * 每周金融情报要点总结前端渲染引擎
 * 动态加载JSON数据并渲染页面，保持现有视觉样式、Tab切换功能和历史报告访问能力
 * 版本: 1.0
 */

// 全局配置
const CONFIG = {
    DATA_DIR: '../../../data/weekly_summary',
    CURRENT_WEEK_FILE: 'current_week.json',
    HISTORY_FILE: 'history.json',
    DATE_FORMAT_OPTIONS: { year: 'numeric', month: '2-digit', day: '2-digit' }
};

// 状态管理
const AppState = {
    weekData: null,
    historyData: null,
    isLoading: false,
    error: null,
    currentTab: 'current-week'
};

/**
 * 主初始化函数
 */
async function init() {
    try {
        setLoadingState(true);
        
        // 加载本周要点数据
        await loadWeeklyData();
        
        // 加载历史报告数据
        await loadHistoryData();
        
        // 设置周信息显示
        updateWeekInfo();
        
        // 渲染页面内容
        renderPage();
        
        // 绑定事件
        attachEventListeners();
        
        setLoadingState(false);
    } catch (error) {
        console.error('初始化失败:', error);
        AppState.error = error;
        showError('无法加载每周要点总结数据，请稍后重试。');
        setLoadingState(false);
    }
}

/**
 * 加载本周要点数据
 */
async function loadWeeklyData() {
    try {
        AppState.isLoading = true;
        
        const dataPath = `${CONFIG.DATA_DIR}/${CONFIG.CURRENT_WEEK_FILE}`;
        const timestamp = new Date().getTime();
        const response = await fetch(`${dataPath}?t=${timestamp}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 验证数据结构
        if (!validateWeeklyDataStructure(data)) {
            throw new Error('本周要点数据格式无效');
        }
        
        AppState.weekData = data;
        AppState.error = null;
        
        console.log('已加载本周要点数据', data);
        return data;
    } catch (error) {
        console.error('本周要点数据加载失败:', error);
        AppState.error = error;
        throw error;
    } finally {
        AppState.isLoading = false;
    }
}

/**
 * 加载历史报告数据
 */
async function loadHistoryData() {
    try {
        const dataPath = `${CONFIG.DATA_DIR}/${CONFIG.HISTORY_FILE}`;
        const timestamp = new Date().getTime();
        const response = await fetch(`${dataPath}?t=${timestamp}`);
        
        if (!response.ok) {
            // 如果历史文件不存在，使用空数组
            if (response.status === 404) {
                AppState.historyData = [];
                return [];
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 验证数据结构
        if (!validateHistoryDataStructure(data)) {
            throw new Error('历史报告数据格式无效');
        }
        
        AppState.historyData = data;
        
        console.log('已加载历史报告数据', data);
        return data;
    } catch (error) {
        console.error('历史报告数据加载失败:', error);
        // 历史数据加载失败不影响主功能，设置为空数组
        AppState.historyData = [];
        return [];
    }
}

/**
 * 验证本周要点JSON数据结构
 * @param {object} data - 待验证的数据
 * @returns {boolean} 是否有效
 */
function validateWeeklyDataStructure(data) {
    const requiredFields = ['week_id', 'date_range', 'generation_date'];
    
    for (const field of requiredFields) {
        if (!data[field]) {
            console.warn(`缺失必要字段: ${field}`);
            return false;
        }
    }
    
    // 验证统计数据
    if (!data.stats) {
        console.warn('缺失stats字段');
        return false;
    }
    
    const statsRequired = ['total_insights', 'included_insights', 'avg_total_score', 'inclusion_rate'];
    for (const field of statsRequired) {
        if (data.stats[field] === undefined) {
            console.warn(`stats缺失字段: ${field}`);
            return false;
        }
    }
    
    // 验证insights数组（允许为空）
    if (!Array.isArray(data.insights)) {
        console.warn('insights必须是数组');
        return false;
    }
    
    // 验证每个洞察项的必要字段
    const insightRequiredFields = ['id', 'title', 'summary', 'date', 'score'];
    for (const insight of data.insights) {
        for (const field of insightRequiredFields) {
            if (!insight[field]) {
                console.warn(`洞察项缺失字段: ${field}`, insight);
                return false;
            }
        }
    }
    
    return true;
}

/**
 * 验证历史报告JSON数据结构
 * @param {object} data - 待验证的数据
 * @returns {boolean} 是否有效
 */
function validateHistoryDataStructure(data) {
    // 必须是数组
    if (!Array.isArray(data)) {
        console.warn('历史报告数据必须是数组');
        return false;
    }
    
    // 验证每个历史报告项的必要字段
    const reportRequiredFields = ['week_id', 'date_range', 'insight_count'];
    for (const report of data) {
        for (const field of reportRequiredFields) {
            if (!report[field]) {
                console.warn(`历史报告项缺失字段: ${field}`, report);
                return false;
            }
        }
    }
    
    return true;
}

/**
 * 更新周信息显示
 */
function updateWeekInfo() {
    const weekInfoElement = document.getElementById('week-info');
    if (!weekInfoElement || !AppState.weekData) return;
    
    weekInfoElement.textContent = `第${AppState.weekData.week_id}周（${AppState.weekData.date_range}）`;
}

/**
 * 渲染整个页面
 */
function renderPage() {
    if (!AppState.weekData) {
        showError('暂无本周要点数据');
        return;
    }
    
    // 清空容器
    const statsContainer = document.querySelector('.weekly-summary-stats');
    const insightsContainer = document.getElementById('insights-container');
    const historyContainer = document.getElementById('history-container');
    
    if (statsContainer) statsContainer.innerHTML = '';
    if (insightsContainer) insightsContainer.innerHTML = '';
    if (historyContainer) historyContainer.innerHTML = '';
    
    // 渲染各个部分
    renderWeeklyStats();
    renderWeeklyInsights();
    renderHistoryList();
}

/**
 * 渲染每周统计数据
 */
function renderWeeklyStats() {
    const statsContainer = document.querySelector('.weekly-summary-stats');
    if (!statsContainer || !AppState.weekData) return;
    
    const { stats } = AppState.weekData;
    
    // 创建统计卡片
    const statCards = [
        {
            id: 'total-insights',
            value: stats.total_insights,
            label: '本周总洞察数'
        },
        {
            id: 'included-insights',
            value: stats.included_insights,
            label: '收录要点数'
        },
        {
            id: 'avg-score',
            value: stats.avg_total_score.toFixed(1),
            label: '平均评分'
        },
        {
            id: 'threshold-rate',
            value: `${stats.inclusion_rate.toFixed(1)}%`,
            label: '达标率'
        }
    ];
    
    statCards.forEach(stat => {
        const statCard = document.createElement('div');
        statCard.className = 'stat-card';
        
        statCard.innerHTML = `
            <div class="stat-value" id="${stat.id}">${stat.value}</div>
            <div class="stat-label">${stat.label}</div>
        `;
        
        statsContainer.appendChild(statCard);
    });
}

/**
 * 渲染本周要点卡片
 */
function renderWeeklyInsights() {
    const container = document.getElementById('insights-container');
    if (!container || !AppState.weekData) return;
    
    const { insights } = AppState.weekData;
    
    if (insights.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px;">本周暂无收录要点</h3>
                <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto;">
                    本周生成的洞察尚未达到收录标准（≥${AppState.weekData.stats.threshold}分）。请查看历史报告或等待新数据生成。
                </p>
            </div>
        `;
        return;
    }
    
    // 按分数降序排序（后端已经排序，这里确保顺序）
    const sortedInsights = [...insights].sort((a, b) => b.score - a.score);
    
    // 生成洞察卡片HTML
    sortedInsights.forEach((insight, index) => {
        const insightCard = createInsightCard(insight, index + 1);
        container.appendChild(insightCard);
    });
}

/**
 * 创建单个要点卡片DOM元素
 * @param {object} insight - 要点数据
 * @param {number} rank - 排名（从1开始）
 * @returns {HTMLElement} 卡片元素
 */
function createInsightCard(insight, rank) {
    const { id, title, summary, date, score, scores } = insight;
    
    // 生成维度标签
    const dimensionTags = generateDimensionTags(scores);
    
    // 创建卡片元素
    const card = document.createElement('div');
    card.className = 'insight-card';
    card.dataset.insightId = id;
    
    card.innerHTML = `
        <div class="insight-rank">${rank}</div>
        <div class="insight-score">${score.toFixed(2)}分</div>
        <h3 class="insight-title">${title}</h3>
        <div class="insight-date">${date}</div>
        <div class="insight-summary">${summary}</div>
        <div class="insight-dimensions">
            ${dimensionTags}
        </div>
    `;
    
    return card;
}

/**
 * 生成维度标签HTML
 * @param {object} scores - 维度分数对象
 * @returns {string} HTML字符串
 */
function generateDimensionTags(scores) {
    if (!scores) return '';
    
    // 维度显示名称映射
    const dimensionDisplayNames = {
        'event_impact': '事件影响',
        'data_impact': '数据影响',
        'market_relevance': '市场相关',
        'timeliness': '时效性'
    };
    
    // 排除surprise维度
    const validDimensions = ['event_impact', 'data_impact', 'market_relevance', 'timeliness'];
    
    let tagsHtml = '';
    
    validDimensions.forEach(dimName => {
        const dimLevel = scores[dimName];
        if (!dimLevel) return;
        
        const dimDisplay = dimensionDisplayNames[dimName] || dimName;
        
        // 确定CSS类
        let levelClass = '';
        if (dimLevel === '高') {
            levelClass = 'high';
        } else if (dimLevel === '中') {
            levelClass = 'medium';
        } else if (dimLevel === '低') {
            levelClass = 'low';
        }
        
        tagsHtml += `<span class="dimension-tag ${levelClass}">${dimDisplay}: ${dimLevel}</span>`;
    });
    
    return tagsHtml;
}

/**
 * 渲染历史报告列表
 */
function renderHistoryList() {
    const container = document.getElementById('history-container');
    if (!container) return;
    
    if (!AppState.historyData || AppState.historyData.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📁</div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px;">暂无历史报告</h3>
                <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto;">
                    尚未生成任何每周要点总结报告。首份报告将在本周五生成。
                </p>
            </div>
        `;
        return;
    }
    
    // 按周ID降序排序（最新的在前面）
    const sortedHistory = [...AppState.historyData].sort((a, b) => {
        return b.week_id.localeCompare(a.week_id);
    });
    
    // 生成历史报告卡片
    sortedHistory.forEach(report => {
        const historyCard = createHistoryCard(report);
        container.appendChild(historyCard);
    });
}

/**
 * 创建历史报告卡片DOM元素
 * @param {object} report - 历史报告数据
 * @returns {HTMLElement} 卡片元素
 */
function createHistoryCard(report) {
    const { week_id, date_range, insight_count, summary, path } = report;
    
    // 确定跳转路径
    // 如果path存在，跳转到历史目录；否则跳转到当前周目录
    const reportPath = path ? `${path}/index.html` : `../${week_id}/index.html`;
    
    const card = document.createElement('div');
    card.className = 'history-card';
    
    card.innerHTML = `
        <div class="history-week">${week_id}</div>
        <div class="history-date-range">${date_range}</div>
        <div class="history-count">收录 ${insight_count} 个要点</div>
        <div class="history-snippet">${summary || '点击查看详细报告'}</div>
    `;
    
    // 添加点击事件
    card.addEventListener('click', function() {
        window.open(reportPath, '_blank');
    });
    
    return card;
}

/**
 * 绑定事件监听器
 */
function attachEventListeners() {
    // Tab切换功能
    setupTabSwitching();
    
    // 移动端菜单切换
    setupMobileMenu();
    
    // 窗口大小变化处理
    window.addEventListener('resize', handleWindowResize);
}

/**
 * 设置Tab切换功能
 */
function setupTabSwitching() {
    const subTabs = document.querySelectorAll('.sub-nav-tab');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    subTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // 更新活跃Tab
            subTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 显示对应内容
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `${tabName}-tab`) {
                    pane.classList.add('active');
                }
            });
            
            // 更新状态
            AppState.currentTab = tabName;
            
            // 如果是历史报告Tab，确保历史列表已渲染
            if (tabName === 'history' && AppState.historyData) {
                renderHistoryList();
            }
        });
    });
}

/**
 * 设置移动端菜单切换
 */
function setupMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const navTabs = document.getElementById('nav-tabs');
    
    if (menuToggle && navTabs) {
        menuToggle.addEventListener('click', function() {
            navTabs.classList.toggle('active');
        });
        
        // 点击外部关闭菜单
        document.addEventListener('click', function(event) {
            if (window.innerWidth <= 768 && 
                !menuToggle.contains(event.target) && 
                !navTabs.contains(event.target)) {
                navTabs.classList.remove('active');
            }
        });
    }
}

/**
 * 处理窗口大小变化
 */
function handleWindowResize() {
    const navTabs = document.getElementById('nav-tabs');
    if (!navTabs) return;
    
    if (window.innerWidth > 768) {
        navTabs.classList.remove('active');
        navTabs.style.display = 'flex';
    } else {
        navTabs.style.display = '';
    }
}

/**
 * 设置加载状态
 * @param {boolean} isLoading - 是否正在加载
 */
function setLoadingState(isLoading) {
    AppState.isLoading = isLoading;
    
    // 显示/隐藏加载指示器
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.style.display = isLoading ? 'block' : 'none';
    } else if (isLoading) {
        // 如果不存在加载指示器，创建并显示
        createLoadingIndicator();
    }
    
    // 禁用/启用交互元素
    const interactiveElements = document.querySelectorAll('button, .nav-tab, .history-item');
    interactiveElements.forEach(el => {
        el.disabled = isLoading;
        el.style.opacity = isLoading ? '0.5' : '1';
        el.style.pointerEvents = isLoading ? 'none' : 'auto';
    });
}

/**
 * 创建加载指示器
 */
function createLoadingIndicator() {
    const loader = document.createElement('div');
    loader.id = 'loading-indicator';
    loader.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 99999;
            backdrop-filter: blur(5px);
        ">
            <div style="
                background: linear-gradient(135deg, #1a3c8b 0%, #2a5caa 100%);
                padding: 2rem;
                border-radius: 16px;
                text-align: center;
                color: white;
                box-shadow: 0 20px 60px rgba(0, 15, 40, 0.6);
            ">
                <div style="font-size: 2rem; margin-bottom: 1rem;">⏳</div>
                <div style="font-size: 1.2rem; font-weight: 600;">加载每周要点总结中...</div>
                <div style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.8;">请稍候</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(loader);
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息
 */
function showError(message) {
    // 移除现有错误提示
    const existingError = document.getElementById('error-message');
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.id = 'error-message';
    errorDiv.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);
            color: white;
            padding: 1.5rem;
            border-radius: 12px;
            margin: 2rem auto;
            max-width: 800px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(192, 57, 43, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        ">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️ 加载失败</div>
            <div>${message}</div>
            <button id="retry-button" style="
                margin-top: 1rem;
                padding: 0.5rem 1.5rem;
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 8px;
                color: white;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
            ">
                重试
            </button>
        </div>
    `;
    
    // 插入到主要内容区域
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.insertBefore(errorDiv, mainContent.firstChild);
        
        // 绑定重试按钮事件
        const retryButton = document.getElementById('retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                errorDiv.remove();
                init();
            });
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 导出函数供全局使用（如果需要）
window.WeeklySummaryRenderer = {
    init,
    loadWeeklyData,
    loadHistoryData,
    renderPage,
    getWeekData: () => AppState.weekData
};