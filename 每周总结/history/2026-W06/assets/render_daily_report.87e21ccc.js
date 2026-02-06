/**
 * 每日金融情报洞察前端渲染引擎
 * 动态加载JSON数据并渲染页面，保持现有视觉样式和交互功能
 * 版本: 1.0
 */

// 全局配置
const CONFIG = {
    DATA_DIR: '../../data/daily',
    HISTORY_DIR: 'history',
    DEFAULT_DATE: new Date().toISOString().split('T')[0], // YYYY-MM-DD格式
    DATE_FORMAT_OPTIONS: { year: 'numeric', month: '2-digit', day: '2-digit' },
    PRELOAD_ENABLED: true, // 启用预加载
    PRELOAD_DAYS_AHEAD: 1   // 预加载未来几天的数据
};

// 辅助函数：计算下一个日期
function getNextDate(dateString, days = 1) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

// 状态管理
const AppState = {
    currentDate: CONFIG.DEFAULT_DATE,
    reportData: null,
    isLoading: false,
    error: null,
    preloadedData: new Map() // 预加载数据缓存
};

/**
 * 主初始化函数
 */
async function init() {
    try {
        setLoadingState(true);
        
        // 设置报告日期显示
        updateReportDateDisplay();
        
        // 加载今日报告数据
        await loadData(CONFIG.DEFAULT_DATE);
        
        // 渲染页面内容
        renderPage();
        
        // 绑定事件
        attachEventListeners();
        
        setLoadingState(false);
    } catch (error) {
        console.error('初始化失败:', error);
        AppState.error = error;
        showError('无法加载报告数据，请稍后重试。');
        setLoadingState(false);
    }
}

/**
 * 加载指定日期的JSON数据
 * @param {string} date - YYYY-MM-DD格式的日期
 */
async function loadData(date) {
    try {
        AppState.isLoading = true;
        AppState.currentDate = date;
        
        const dataPath = `${CONFIG.DATA_DIR}/${date}.json`;
        const timestamp = new Date().getTime();
        const response = await fetch(`${dataPath}?t=${timestamp}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 验证数据结构
        if (!validateDataStructure(data)) {
            throw new Error('数据格式无效');
        }
        
        AppState.reportData = data;
        AppState.error = null;
        
        console.log(`已加载 ${date} 的报告数据`, data);
        
        // 预加载下一个日期的数据（非阻塞）
        if (CONFIG.PRELOAD_ENABLED) {
            setTimeout(() => {
                preloadNextDate(date);
            }, 100);
        }
        
        return data;
    } catch (error) {
        console.error('数据加载失败:', error);
        AppState.error = error;
        throw error;
    } finally {
        AppState.isLoading = false;
    }
}

/**
 * 预加载下一个日期的JSON数据
 * @param {string} currentDate - 当前日期
 */
async function preloadNextDate(currentDate) {
    try {
        const nextDate = getNextDate(currentDate, CONFIG.PRELOAD_DAYS_AHEAD);
        const dataPath = `${CONFIG.DATA_DIR}/${nextDate}.json`;
        
        // 如果已经预加载过，跳过
        if (AppState.preloadedData.has(nextDate)) {
            return;
        }
        
        console.log(`预加载 ${nextDate} 的数据...`);
        const response = await fetch(`${dataPath}?t=${Date.now()}`);
        
        if (response.ok) {
            const data = await response.json();
            AppState.preloadedData.set(nextDate, data);
            console.log(`已预加载 ${nextDate} 的数据`);
        } else {
            // 文件不存在是正常的，特别是对于未来日期
            console.log(`预加载 ${nextDate} 失败（可能文件不存在）: ${response.status}`);
        }
    } catch (error) {
        // 预加载失败不应影响主流程
        console.log(`预加载失败（非关键）:`, error.message);
    }
}

/**
 * 验证JSON数据结构
 * @param {object} data - 待验证的数据
 * @returns {boolean} 是否有效
 */
function validateDataStructure(data) {
    const requiredFields = ['date', 'report_date_display', 'insights', 'impact_matrix'];
    
    for (const field of requiredFields) {
        if (!data[field]) {
            console.warn(`缺失必要字段: ${field}`);
            return false;
        }
    }
    
    // 验证insights数组
    if (!Array.isArray(data.insights) || data.insights.length === 0) {
        console.warn('insights必须是非空数组');
        return false;
    }
    
    // 验证每个洞察项的必要字段
    const insightRequiredFields = ['id', 'title', 'summary', 'analysis', 'impacts'];
    for (const insight of data.insights) {
        for (const field of insightRequiredFields) {
            // 对于summary和analysis字段，允许空字符串
            if (field === 'summary' || field === 'analysis') {
                if (!(field in insight)) {
                    console.warn(`洞察项缺失字段: ${field}`, insight);
                    return false;
                }
            } else {
                // 对于其他字段，检查值是否存在且非空
                if (!insight[field]) {
                    console.warn(`洞察项缺失字段: ${field}`, insight);
                    return false;
                }
            }
        }
    }
    
    return true;
}

/**
 * 更新报告日期显示
 */
function updateReportDateDisplay() {
    const dateElement = document.getElementById('report-date');
    if (!dateElement) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    dateElement.textContent = `报告日期：${year}年${month}月${day}日`;
}

/**
 * 渲染整个页面
 */
function renderPage() {
    if (!AppState.reportData) {
        showError('暂无报告数据');
        return;
    }
    
    // 清空容器
    const insightsContainer = document.getElementById('insights-container');
    const matrixTbody = document.querySelector('.matrix-table tbody');
    const historyContainer = document.getElementById('history-items');
    
    if (insightsContainer) insightsContainer.innerHTML = '';
    if (matrixTbody) matrixTbody.innerHTML = '';
    if (historyContainer) historyContainer.innerHTML = '';
    
    // 渲染各个部分
    renderInsights();
    renderImpactMatrix();
    renderHistoryList();
}

/**
 * 渲染洞察卡片
 */
function renderInsights() {
    const container = document.getElementById('insights-container');
    if (!container || !AppState.reportData) return;
    
    const { insights } = AppState.reportData;
    
    // 按ID排序
    const sortedInsights = [...insights].sort((a, b) => a.id - b.id);
    
    // 生成洞察卡片HTML
    sortedInsights.forEach(insight => {
        const insightCard = createInsightCard(insight);
        container.appendChild(insightCard);
    });
}

/**
 * 创建单个洞察卡片DOM元素
 * @param {object} insight - 洞察数据
 * @returns {HTMLElement} 卡片元素
 */
function createInsightCard(insight) {
    const { id, title, summary, formatted_analysis, analysis, impacts, short_title, overall_impact, event_impact } = insight;
    
    // 使用formatted_analysis如果存在，否则使用analysis
    const analysisContent = formatted_analysis || analysis;
    
    // 确定影响图标类名
    const getImpactClass = (impact) => {
        if (impact === 'positive') return 'positive';
        if (impact === 'negative') return 'negative';
        return 'neutral';
    };
    
    // 创建卡片元素
    const card = document.createElement('div');
    card.className = 'insight-item';
    card.dataset.insightId = id;
    
    card.innerHTML = `
        <div class="insight-header">
            <div class="insight-number">${id}</div>
            <div class="insight-title">${title}</div>
        </div>
        
        <!-- 洞察图片 -->
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

/**
 * 渲染影响矩阵
 */
function renderImpactMatrix() {
    const matrixTbody = document.querySelector('.matrix-table tbody');
    if (!matrixTbody || !AppState.reportData) return;
    
    const { impact_matrix } = AppState.reportData;
    
    // 按ID排序
    const sortedMatrix = [...impact_matrix].sort((a, b) => a.id - b.id);
    
    // 生成表格行
    sortedMatrix.forEach(item => {
        const { id, short_title, a_share, hk_stock, precious_metal, fx, overall_impact, event_impact } = item;
        
        const row = document.createElement('tr');
        row.dataset.insightId = id;
        
        row.innerHTML = `
            <td>${short_title || `洞察${id}`}</td>
            <td class="${getImpactClass(a_share)}">${getImpactText(a_share)}</td>
            <td class="${getImpactClass(hk_stock)}">${getImpactText(hk_stock)}</td>
            <td class="${getImpactClass(precious_metal)}">${getImpactText(precious_metal)}</td>
            <td class="${getImpactClass(fx)}">${getImpactText(fx)}</td>
            <td>${overall_impact}</td>
        `;
        
        matrixTbody.appendChild(row);
    });
}

/**
 * 获取影响类型对应的CSS类名
 * @param {string} impact - 影响类型（positive/negative/neutral）
 * @returns {string} CSS类名
 */
function getImpactClass(impact) {
    switch (impact) {
        case 'positive': return 'positive';
        case 'negative': return 'negative';
        default: return 'neutral';
    }
}

/**
 * 获取影响类型对应的显示文本
 * @param {string} impact - 影响类型（positive/negative/neutral）
 * @returns {string} 显示文本
 */
function getImpactText(impact) {
    switch (impact) {
        case 'positive': return '正面影响';
        case 'negative': return '负面影响';
        default: return '中性影响';
    }
}

/**
 * 渲染历史报告列表
 */
async function renderHistoryList() {
    const container = document.getElementById('history-items');
    if (!container) return;
    
    try {
        // 尝试获取可用的历史报告日期
        const availableDates = await getAvailableDates();
        
        if (availableDates.length === 0) {
            container.innerHTML = '<div class="history-item">暂无历史报告</div>';
            return;
        }
        
        // 按日期降序排序
        availableDates.sort((a, b) => new Date(b) - new Date(a));
        
        // 生成历史报告列表项
        availableDates.forEach(date => {
            const historyItem = createHistoryItem(date);
            container.appendChild(historyItem);
        });
    } catch (error) {
        console.error('加载历史报告列表失败:', error);
        container.innerHTML = '<div class="history-item">无法加载历史报告列表</div>';
    }
}

/**
 * 获取可用的历史报告日期
 * @returns {Promise<string[]>} 日期数组（YYYY-MM-DD格式）
 */
async function getAvailableDates() {
    try {
        // 从manifest.json加载可用日期列表
        const manifestPath = `${CONFIG.DATA_DIR}/manifest.json`;
        const timestamp = new Date().getTime();
        const response = await fetch(`${manifestPath}?t=${timestamp}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const manifest = await response.json();
        const dates = manifest.available_dates || [];
        
        console.log(`从manifest加载了 ${dates.length} 个可用日期`);
        return dates;
    } catch (error) {
        console.error('获取可用日期失败:', error);
        // 降级方案：尝试获取默认日期范围
        return generateDefaultDates();
    }
}

/**
 * 生成默认日期范围（当manifest不可用时）
 * @returns {string[]} 默认日期数组
 */
async function generateDefaultDates() {
    const dates = [];
    const startDate = new Date('2026-01-20');
    const endDate = new Date();
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dates.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`生成了 ${dates.length} 个默认日期`);
    return dates;
}

/**
 * 创建历史报告列表项
 * @param {string} date - YYYY-MM-DD格式的日期
 * @returns {HTMLElement} 列表项元素
 */
function createHistoryItem(date) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.date = date;
    
    // 格式化日期显示
    const displayDate = date.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1年$2月$3日');
    
    item.innerHTML = `
        <div class="history-date">${displayDate}</div>
        <div class="history-summary">点击查看该日报告</div>
    `;
    
    // 添加点击事件
    item.addEventListener('click', () => {
        loadAndRenderDate(date);
    });
    
    return item;
}

/**
 * 加载并渲染指定日期的报告
 * @param {string} date - YYYY-MM-DD格式的日期
 */
async function loadAndRenderDate(date) {
    try {
        setLoadingState(true);
        
        await loadData(date);
        renderPage();
        
        // 更新URL（如果需要）
        updateUrlForDate(date);
        
        setLoadingState(false);
    } catch (error) {
        console.error(`加载日期 ${date} 的报告失败:`, error);
        showError(`无法加载 ${date} 的报告`);
        setLoadingState(false);
    }
}

/**
 * 更新URL以反映当前日期（可选功能）
 * @param {string} date - YYYY-MM-DD格式的日期
 */
function updateUrlForDate(date) {
    // 可以根据需要实现URL更新逻辑
    // 例如：window.history.pushState({ date }, '', `?date=${date}`);
}

/**
 * 绑定事件监听器
 */
function attachEventListeners() {
    // 移动端折叠功能
    setupMobileFoldable();
    
    // 图片浮层功能
    setupImageOverlay();
    
    // 图片备用机制
    setupImageFallback();
    
    // 窗口大小变化处理
    window.addEventListener('resize', handleWindowResize);
    
    // 滚动进度指示器
    setupScrollProgress();
    
    // Tab切换功能（如果模板中已有，这里可以不重复绑定）
    // setupTabSwitching();
}

/**
 * 设置移动端折叠功能
 */
function setupMobileFoldable() {
    // 委托事件监听器到分析标签
    document.addEventListener('click', (event) => {
        if (window.innerWidth > 768) return;
        
        const analysisLabel = event.target.closest('.analysis-label');
        if (!analysisLabel) return;
        
        const insightItem = analysisLabel.closest('.insight-item');
        if (!insightItem) return;
        
        const analysisSection = insightItem.querySelector('.analysis-section');
        if (!analysisSection) return;
        
        const isExpanded = analysisSection.classList.contains('expanded');
        
        // 切换状态
        analysisSection.classList.toggle('expanded');
        analysisLabel.classList.toggle('expanded');
        
        // 如果展开，滚动到分析部分
        if (!isExpanded) {
            setTimeout(() => {
                analysisSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
        
        // 阻止事件冒泡
        event.stopPropagation();
    });
    
    // 桌面端默认展开
    if (window.innerWidth > 768) {
        document.querySelectorAll('.analysis-section').forEach(section => {
            section.classList.add('expanded');
        });
        document.querySelectorAll('.analysis-label').forEach(label => {
            label.classList.add('expanded');
        });
    }
}

/**
 * 设置图片浮层功能
 */
function setupImageOverlay() {
    const overlay = document.getElementById('image-overlay');
    const overlayImage = document.getElementById('overlay-image');
    const closeOverlayBtn = document.getElementById('close-overlay');
    
    if (!overlay || !overlayImage || !closeOverlayBtn) return;
    
    // 为所有洞察图片添加点击事件（委托）
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('insight-image')) {
            // 设置浮层图片的src为被点击图片的src
            overlayImage.src = event.target.src;
            // 显示浮层
            overlay.classList.add('active');
            // 禁止背景滚动
            document.body.style.overflow = 'hidden';
        }
    });
    
    // 关闭浮层
    function closeOverlay() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        // 清空图片src，避免内存占用
        setTimeout(() => {
            overlayImage.src = '';
        }, 300);
    }
    
    // 点击关闭按钮
    closeOverlayBtn.addEventListener('click', closeOverlay);
    
    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeOverlay();
        }
    });
    
    // 按ESC键关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeOverlay();
        }
    });
    
    // 触摸滑动关闭（移动端）
    let touchStartY = 0;
    let touchEndY = 0;
    
    overlay.addEventListener('touchstart', (e) => {
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    overlay.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].screenY;
        const deltaY = touchEndY - touchStartY;
        
        // 向下滑动超过100px关闭浮层
        if (deltaY > 100) {
            closeOverlay();
        }
    }, { passive: true });
}

/**
 * 设置图片备用机制
 */
function setupImageFallback() {
    document.addEventListener('DOMContentLoaded', () => {
        const images = document.querySelectorAll('.insight-image');
        images.forEach(img => {
            // 保存原始src
            const originalSrc = img.src;
            const fallbackSrc = img.dataset.fallback || 'assets/placeholder.jpg';
            
            // 图片加载失败时替换为备用图片
            img.addEventListener('error', function() {
                console.log(`图片加载失败: ${originalSrc}, 使用备用图片: ${fallbackSrc}`);
                this.src = fallbackSrc;
                // 防止备用图片也加载失败时无限循环
                this.onerror = null;
            });
            
            // 如果图片已经加载失败（如缓存中已失败）
            if (img.complete && img.naturalHeight === 0) {
                img.src = fallbackSrc;
            }
            
            // 图片加载成功
            img.addEventListener('load', function() {
                this.classList.add('loaded');
            });
            
            // 如果图片已缓存，直接添加loaded类
            if (img.complete && img.naturalHeight > 0) {
                img.classList.add('loaded');
            }
        });
    });
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
        
        // 桌面端：展开所有分析部分
        document.querySelectorAll('.analysis-section').forEach(section => {
            section.classList.add('expanded');
        });
        document.querySelectorAll('.analysis-label').forEach(label => {
            label.classList.add('expanded');
        });
    } else {
        navTabs.style.display = '';
        
        // 移动端：收起所有分析部分
        document.querySelectorAll('.analysis-section').forEach(section => {
            section.classList.remove('expanded');
        });
        document.querySelectorAll('.analysis-label').forEach(label => {
            label.classList.remove('expanded');
        });
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
                <div style="font-size: 1.2rem; font-weight: 600;">加载报告中...</div>
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

/**
 * 设置Tab切换功能
 */
function setupTabSwitching() {
    const tabs = document.querySelectorAll('.nav-tab');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // 更新活跃Tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 显示对应内容
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `${tabName}-tab`) {
                    pane.classList.add('active');
                }
            });
            
            // 滚动到顶部
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

/**
 * 设置滚动进度指示器
 */
function setupScrollProgress() {
    const progressBar = document.getElementById('scroll-progress-bar');
    const progressContainer = document.getElementById('scroll-progress-container');
    
    if (!progressBar || !progressContainer) return;
    
    // 监听滚动事件
    window.addEventListener('scroll', function() {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrollPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        
        progressBar.style.width = scrollPercent + '%';
    });
    
    // 初始隐藏，滚动时显示
    progressContainer.style.opacity = '0';
    progressContainer.style.transition = 'opacity 0.3s ease';
    
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        progressContainer.style.opacity = '1';
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            progressContainer.style.opacity = '0';
        }, 1000);
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 导出函数供全局使用（如果需要）
window.DailyReportRenderer = {
    init,
    loadData,
    renderPage,
    loadAndRenderDate,
    getCurrentDate: () => AppState.currentDate
};