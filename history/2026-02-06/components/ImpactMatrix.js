/**
 * 影响矩阵组件
 * 动态渲染综合影响矩阵表格，支持实时更新和响应式布局
 * 
 * @class ImpactMatrix
 */

class ImpactMatrix {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {HTMLElement|string} options.container - 容器元素或选择器
     * @param {Array} options.data - 矩阵数据数组
     * @param {Function} options.onFilterChange - 筛选变化回调
     * @param {Function} options.onItemClick - 项目点击回调
     * @param {string} options.viewMode - 视图模式 ('grid' | 'list' | 'heatmap')
     * @param {Object} options.userPreferences - 用户偏好设置
     */
    constructor(options = {}) {
        this.options = {
            container: options.container || 'impact-matrix-container',
            data: options.data || [],
            onFilterChange: options.onFilterChange || null,
            onItemClick: options.onItemClick || null,
            viewMode: options.viewMode || 'grid',
            userPreferences: options.userPreferences || {}
        };

        this.state = {
            isLoading: false,
            isMobile: window.innerWidth <= 768,
            sortBy: 'id',
            sortOrder: 'asc',
            filters: {},
            highlightedMarket: null
        };

        this.container = null;
        this.tableElement = null;
        this.theadElement = null;
        this.tbodyElement = null;
        
        this.init();
    }

    /**
     * 初始化组件
     */
    init() {
        this.resolveContainer();
        this.setupResponsiveBehavior();
        this.render();
        this.bindEvents();
    }

    /**
     * 解析容器元素
     */
    resolveContainer() {
        if (typeof this.options.container === 'string') {
            this.container = document.getElementById(this.options.container);
            
            if (!this.container) {
                // 创建新的容器
                this.container = document.createElement('div');
                this.container.id = this.options.container;
                this.container.className = 'impact-matrix-container';
                document.body.appendChild(this.container);
            }
        } else {
            this.container = this.options.container;
        }
    }

    /**
     * 渲染矩阵HTML
     */
    render() {
        // 清空容器
        this.container.innerHTML = '';
        
        // 创建矩阵容器
        const matrixContainer = document.createElement('div');
        matrixContainer.className = `impact-matrix ${this.options.viewMode} ${this.state.isMobile ? 'mobile' : 'desktop'}`;
        
        // 添加标题
        const title = document.createElement('div');
        title.className = 'matrix-title';
        title.innerHTML = `
            <h3>综合影响矩阵</h3>
            <div class="title-description">展示各洞察对不同市场的具体影响判断</div>
        `;
        matrixContainer.appendChild(title);
        
        // 添加筛选面板（桌面端）
        if (!this.state.isMobile) {
            const filterPanel = this.createFilterPanel();
            if (filterPanel) {
                matrixContainer.appendChild(filterPanel);
            }
        }
        
        // 创建表格
        this.createTable(matrixContainer);
        
        // 添加移动端筛选按钮
        if (this.state.isMobile) {
            const mobileFilterButton = this.createMobileFilterButton();
            matrixContainer.appendChild(mobileFilterButton);
        }
        
        // 添加图例
        const legend = this.createLegend();
        matrixContainer.appendChild(legend);
        
        // 添加到主容器
        this.container.appendChild(matrixContainer);
    }

    /**
     * 创建表格
     * @param {HTMLElement} container - 容器元素
     */
    createTable(container) {
        // 创建表格元素
        const table = document.createElement('table');
        table.className = 'matrix-table';
        table.setAttribute('role', 'grid');
        table.setAttribute('aria-label', '综合影响矩阵');
        
        // 创建表头
        this.createTableHeader(table);
        
        // 创建表格主体
        this.createTableBody(table);
        
        // 添加到容器
        container.appendChild(table);
        
        // 缓存引用
        this.tableElement = table;
    }

    /**
     * 创建表头
     * @param {HTMLElement} table - 表格元素
     */
    createTableHeader(table) {
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th scope="col" class="column-title" data-sort="id">
                    洞察
                    <span class="sort-indicator ${this.state.sortBy === 'id' ? this.state.sortOrder : ''}"></span>
                </th>
                <th scope="col" class="column-a-share" data-market="a_share" title="中国A股市场">
                    A股
                    <span class="market-icon">📈</span>
                </th>
                <th scope="col" class="column-hk-stock" data-market="hk_stock" title="香港股市">
                    港股
                    <span class="market-icon">🇭🇰</span>
                </th>
                <th scope="col" class="column-precious-metal" data-market="precious_metal" title="贵金属市场">
                    贵金属
                    <span class="market-icon">🥇</span>
                </th>
                <th scope="col" class="column-fx" data-market="fx" title="外汇汇率市场">
                    汇率
                    <span class="market-icon">💱</span>
                </th>
                <th scope="col" class="column-overall" data-sort="overall_impact">
                    综合影响
                    <span class="sort-indicator ${this.state.sortBy === 'overall_impact' ? this.state.sortOrder : ''}"></span>
                </th>
                <th scope="col" class="column-impact" data-sort="event_impact">
                    影响程度
                    <span class="sort-indicator ${this.state.sortBy === 'event_impact' ? this.state.sortOrder : ''}"></span>
                </th>
            </tr>
        `;
        
        table.appendChild(thead);
        this.theadElement = thead;
    }

    /**
     * 创建表格主体
     * @param {HTMLElement} table - 表格元素
     */
    createTableBody(table) {
        const tbody = document.createElement('tbody');
        
        // 获取排序后的数据
        const sortedData = this.getSortedData();
        
        // 生成表格行
        sortedData.forEach(item => {
            const row = this.createTableRow(item);
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        this.tbodyElement = tbody;
    }

    /**
     * 创建表格行
     * @param {Object} item - 矩阵数据项
     * @returns {HTMLElement} 表格行元素
     */
    createTableRow(item) {
        const { id, short_title, a_share, hk_stock, precious_metal, fx, overall_impact, event_impact } = item;
        
        const row = document.createElement('tr');
        row.className = 'matrix-row';
        row.dataset.insightId = id;
        row.setAttribute('role', 'row');
        
        // 根据整体影响添加CSS类
        if (overall_impact) {
            row.classList.add(`overall-${overall_impact}`);
        }
        
        // 创建单元格
        row.innerHTML = `
            <td class="cell-title" role="gridcell" title="${short_title || `洞察${id}`}">
                <div class="title-content">
                    <span class="title-text">${short_title || `洞察${id}`}</span>
                    <span class="title-id">#${id}</span>
                </div>
            </td>
            
            <td class="cell-market cell-a-share ${a_share}" 
                role="gridcell" 
                data-market="a_share" 
                data-impact="${a_share}"
                title="A股：${this.getImpactText(a_share)}">
                <div class="impact-indicator">
                    <span class="impact-icon">${this.getImpactIcon(a_share)}</span>
                    <span class="impact-text">${this.getImpactText(a_share)}</span>
                </div>
            </td>
            
            <td class="cell-market cell-hk-stock ${hk_stock}" 
                role="gridcell" 
                data-market="hk_stock" 
                data-impact="${hk_stock}"
                title="港股：${this.getImpactText(hk_stock)}">
                <div class="impact-indicator">
                    <span class="impact-icon">${this.getImpactIcon(hk_stock)}</span>
                    <span class="impact-text">${this.getImpactText(hk_stock)}</span>
                </div>
            </td>
            
            <td class="cell-market cell-precious-metal ${precious_metal}" 
                role="gridcell" 
                data-market="precious_metal" 
                data-impact="${precious_metal}"
                title="贵金属：${this.getImpactText(precious_metal)}">
                <div class="impact-indicator">
                    <span class="impact-icon">${this.getImpactIcon(precious_metal)}</span>
                    <span class="impact-text">${this.getImpactText(precious_metal)}</span>
                </div>
            </td>
            
            <td class="cell-market cell-fx ${fx}" 
                role="gridcell" 
                data-market="fx" 
                data-impact="${fx}"
                title="汇率：${this.getImpactText(fx)}">
                <div class="impact-indicator">
                    <span class="impact-icon">${this.getImpactIcon(fx)}</span>
                    <span class="impact-text">${this.getImpactText(fx)}</span>
                </div>
            </td>
            
            <td class="cell-overall ${overall_impact}" 
                role="gridcell" 
                data-impact="${overall_impact}"
                title="综合影响：${this.getOverallImpactText(overall_impact)}">
                <div class="overall-indicator">
                    <span class="overall-icon">${this.getOverallImpactIcon(overall_impact)}</span>
                    <span class="overall-text">${this.getOverallImpactText(overall_impact)}</span>
                </div>
            </td>
            
            <td class="cell-event-impact ${event_impact}" 
                role="gridcell" 
                data-impact="${event_impact}"
                title="影响程度：${this.getImpactLevelText(event_impact)}">
                <div class="impact-level-indicator">
                    <span class="level-icon">${this.getImpactLevelIcon(event_impact)}</span>
                    <span class="level-text">${this.getImpactLevelText(event_impact)}</span>
                </div>
            </td>
        `;
        
        return row;
    }

    /**
     * 创建筛选面板
     * @returns {HTMLElement|null} 筛选面板元素
     */
    createFilterPanel() {
        const panel = document.createElement('div');
        panel.className = 'matrix-filter-panel';
        
        // 市场筛选器
        const marketFilters = this.createMarketFilters();
        panel.appendChild(marketFilterPanel);
        
        return panel;
    }

    /**
     * 创建移动端筛选按钮
     * @returns {HTMLElement} 筛选按钮元素
     */
    createMobileFilterButton() {
        const button = document.createElement('button');
        button.className = 'mobile-filter-button';
        button.innerHTML = `
            <span class="filter-icon">⏷</span>
            <span class="filter-text">筛选</span>
        `;
        
        button.addEventListener('click', () => {
            this.toggleMobileFilterPanel();
        });
        
        return button;
    }

    /**
     * 创建图例
     * @returns {HTMLElement} 图例元素
     */
    createLegend() {
        const legend = document.createElement('div');
        legend.className = 'matrix-legend';
        
        legend.innerHTML = `
            <div class="legend-title">影响类型图例</div>
            <div class="legend-items">
                <div class="legend-item positive">
                    <span class="legend-icon">↑</span>
                    <span class="legend-text">正面影响</span>
                </div>
                <div class="legend-item negative">
                    <span class="legend-icon">↓</span>
                    <span class="legend-text">负面影响</span>
                </div>
                <div class="legend-item neutral">
                    <span class="legend-icon">→</span>
                    <span class="legend-text">中性影响</span>
                </div>
            </div>
        `;
        
        return legend;
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 排序功能
        const sortableHeaders = this.container.querySelectorAll('[data-sort]');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', (event) => {
                const sortField = event.currentTarget.getAttribute('data-sort');
                this.sortBy(sortField);
            });
        });
        
        // 市场单元格点击事件
        const marketCells = this.container.querySelectorAll('.cell-market');
        marketCells.forEach(cell => {
            cell.addEventListener('click', (event) => {
                this.handleMarketCellClick(event.currentTarget);
            });
            
            cell.addEventListener('mouseenter', (event) => {
                this.handleMarketCellHover(event.currentTarget, true);
            });
            
            cell.addEventListener('mouseleave', (event) => {
                this.handleMarketCellHover(event.currentTarget, false);
            });
        });
        
        // 行点击事件
        const tableRows = this.container.querySelectorAll('.matrix-row');
        tableRows.forEach(row => {
            row.addEventListener('click', (event) => {
                if (!event.target.closest('.cell-market')) {
                    this.handleRowClick(row);
                }
            });
        });
        
        // 响应式行为
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    /**
     * 设置响应式行为
     */
    setupResponsiveBehavior() {
        this.state.isMobile = window.innerWidth <= 768;
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        const wasMobile = this.state.isMobile;
        this.state.isMobile = window.innerWidth <= 768;
        
        // 如果移动状态发生变化，重新渲染
        if (wasMobile !== this.state.isMobile) {
            this.render();
        }
    }

    /**
     * 获取排序后的数据
     * @returns {Array} 排序后的数据
     */
    getSortedData() {
        const { data } = this.options;
        const { sortBy, sortOrder } = this.state;
        
        if (!sortBy || data.length === 0) {
            return [...data];
        }
        
        return [...data].sort((a, b) => {
            let valueA = a[sortBy];
            let valueB = b[sortBy];
            
            // 处理特殊排序逻辑
            if (sortBy === 'id') {
                valueA = parseInt(valueA);
                valueB = parseInt(valueB);
            } else if (sortBy === 'event_impact') {
                // 影响程度排序：高 > 中 > 低
                const impactOrder = { high: 3, medium: 2, low: 1 };
                valueA = impactOrder[valueA] || 0;
                valueB = impactOrder[valueB] || 0;
            } else if (sortBy === 'overall_impact') {
                // 综合影响排序：正面 > 中性 > 负面
                const overallOrder = { positive: 3, neutral: 2, negative: 1 };
                valueA = overallOrder[valueA] || 0;
                valueB = overallOrder[valueB] || 0;
            }
            
            if (sortOrder === 'asc') {
                return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
            } else {
                return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
            }
        });
    }

    /**
     * 排序功能
     * @param {string} field - 排序字段
     */
    sortBy(field) {
        if (this.state.sortBy === field) {
            // 切换排序顺序
            this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            // 设置新排序字段，默认升序
            this.state.sortBy = field;
            this.state.sortOrder = 'asc';
        }
        
        // 重新渲染表格
        this.refreshTableBody();
        
        // 触发排序事件
        this.emitSortEvent(field, this.state.sortOrder);
    }

    /**
     * 刷新表格主体
     */
    refreshTableBody() {
        if (!this.tbodyElement) return;
        
        // 清空表格主体
        this.tbodyElement.innerHTML = '';
        
        // 获取排序后的数据
        const sortedData = this.getSortedData();
        
        // 重新生成行
        sortedData.forEach(item => {
            const row = this.createTableRow(item);
            this.tbodyElement.appendChild(row);
        });
        
        // 重新绑定事件
        this.bindRowEvents();
    }

    /**
     * 绑定行事件
     */
    bindRowEvents() {
        const marketCells = this.container.querySelectorAll('.cell-market');
        marketCells.forEach(cell => {
            cell.addEventListener('click', (event) => {
                this.handleMarketCellClick(event.currentTarget);
            });
        });
        
        const tableRows = this.container.querySelectorAll('.matrix-row');
        tableRows.forEach(row => {
            row.addEventListener('click', (event) => {
                if (!event.target.closest('.cell-market')) {
                    this.handleRowClick(row);
                }
            });
        });
    }

    /**
     * 处理市场单元格点击
     * @param {HTMLElement} cell - 单元格元素
     */
    handleMarketCellClick(cell) {
        const insightId = cell.closest('.matrix-row').dataset.insightId;
        const market = cell.dataset.market;
        const impact = cell.dataset.impact;
        
        // 触发单元格点击事件
        const event = new CustomEvent('marketcellclick', {
            detail: {
                insightId,
                market,
                impact,
                timestamp: Date.now()
            }
        });
        
        this.container.dispatchEvent(event);
        
        // 回调函数
        if (this.options.onItemClick) {
            this.options.onItemClick({
                id: parseInt(insightId),
                market,
                impact
            });
        }
    }

    /**
     * 处理行点击
     * @param {HTMLElement} row - 表格行元素
     */
    handleRowClick(row) {
        const insightId = row.dataset.insightId;
        
        // 触发行点击事件
        const event = new CustomEvent('matrixrowclick', {
            detail: {
                insightId,
                timestamp: Date.now()
            }
        });
        
        this.container.dispatchEvent(event);
    }

    /**
     * 处理市场单元格悬停
     * @param {HTMLElement} cell - 单元格元素
     * @param {boolean} isEntering - 是否进入
     */
    handleMarketCellHover(cell, isEntering) {
        const market = cell.dataset.market;
        
        if (isEntering) {
            // 高亮相同市场列
            this.highlightMarketColumn(market, true);
        } else {
            // 移除高亮
            this.highlightMarketColumn(market, false);
        }
    }

    /**
     * 高亮市场列
     * @param {string} market - 市场标识
     * @param {boolean} highlight - 是否高亮
     */
    highlightMarketColumn(market, highlight) {
        const cells = this.container.querySelectorAll(`.cell-${market}`);
        
        cells.forEach(cell => {
            if (highlight) {
                cell.classList.add('highlighted');
            } else {
                cell.classList.remove('highlighted');
            }
        });
        
        // 更新状态
        this.state.highlightedMarket = highlight ? market : null;
    }

    /**
     * 切换移动端筛选面板
     */
    toggleMobileFilterPanel() {
        const panel = this.container.querySelector('.mobile-filter-panel');
        
        if (panel) {
            panel.classList.toggle('visible');
        } else {
            this.createMobileFilterPanel();
        }
    }

    /**
     * 创建移动端筛选面板
     */
    createMobileFilterPanel() {
        const panel = document.createElement('div');
        panel.className = 'mobile-filter-panel visible';
        
        // 创建筛选器内容
        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">筛选</div>
                <button class="panel-close">✕</button>
            </div>
            <div class="panel-content">
                <!-- 筛选器内容 -->
            </div>
        `;
        
        // 添加到容器
        this.container.appendChild(panel);
        
        // 绑定关闭事件
        const closeButton = panel.querySelector('.panel-close');
        closeButton.addEventListener('click', () => {
            panel.classList.remove('visible');
        });
    }

    /**
     * 获取影响文本
     * @param {string} impact - 影响类型
     * @returns {string} 影响文本
     */
    getImpactText(impact) {
        const map = {
            positive: '正面',
            negative: '负面',
            neutral: '中性'
        };
        
        return map[impact] || '未知';
    }

    /**
     * 获取影响图标
     * @param {string} impact - 影响类型
     * @returns {string} 影响图标
     */
    getImpactIcon(impact) {
        const map = {
            positive: '↑',
            negative: '↓',
            neutral: '→'
        };
        
        return map[impact] || '?';
    }

    /**
     * 获取整体影响文本
     * @param {string} overallImpact - 整体影响类型
     * @returns {string} 整体影响文本
     */
    getOverallImpactText(overallImpact) {
        const map = {
            positive: '偏正面',
            negative: '偏负面',
            neutral: '中性'
        };
        
        return map[overallImpact] || '未知';
    }

    /**
     * 获取整体影响图标
     * @param {string} overallImpact - 整体影响类型
     * @returns {string} 整体影响图标
     */
    getOverallImpactIcon(overallImpact) {
        const map = {
            positive: '↗',
            negative: '↘',
            neutral: '→'
        };
        
        return map[overallImpact] || '?';
    }

    /**
     * 获取影响程度文本
     * @param {string} impactLevel - 影响程度
     * @returns {string} 影响程度文本
     */
    getImpactLevelText(impactLevel) {
        const map = {
            high: '高',
            medium: '中',
            low: '低'
        };
        
        return map[impactLevel] || '未知';
    }

    /**
     * 获取影响程度图标
     * @param {string} impactLevel - 影响程度
     * @returns {string} 影响程度图标
     */
    getImpactLevelIcon(impactLevel) {
        const map = {
            high: '🔥',
            medium: '⚡',
            low: '💧'
        };
        
        return map[impactLevel] || '?';
    }

    /**
     * 更新数据
     * @param {Array} newData - 新数据数组
     */
    updateData(newData) {
        this.options.data = newData;
        this.refreshTableBody();
    }

    /**
     * 添加数据
     * @param {Object} newItem - 新数据项
     */
    addData(newItem) {
        this.options.data.push(newItem);
        this.refreshTableBody();
    }

    /**
     * 移除数据
     * @param {number} insightId - 洞察ID
     */
    removeData(insightId) {
        this.options.data = this.options.data.filter(item => item.id !== insightId);
        this.refreshTableBody();
    }

    /**
     * 获取当前数据
     * @returns {Array} 当前数据
     */
    getData() {
        return [...this.options.data];
    }

    /**
     * 获取当前状态
     * @returns {Object} 状态对象
     */
    getState() {
        return {
            ...this.state,
            dataCount: this.options.data.length
        };
    }

    /**
     * 触发排序事件
     * @param {string} field - 排序字段
     * @param {string} order - 排序顺序
     */
    emitSortEvent(field, order) {
        const event = new CustomEvent('matrixsort', {
            detail: {
                field,
                order,
                timestamp: Date.now()
            }
        });
        
        this.container.dispatchEvent(event);
    }

    /**
     * 销毁组件
     */
    destroy() {
        // 移除事件监听器
        const sortableHeaders = this.container?.querySelectorAll('[data-sort]');
        sortableHeaders?.forEach(header => {
            header.replaceWith(header.cloneNode(true));
        });
        
        const marketCells = this.container?.querySelectorAll('.cell-market');
        marketCells?.forEach(cell => {
            cell.replaceWith(cell.cloneNode(true));
        });
        
        // 移除DOM元素
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        // 清理引用
        this.container = null;
        this.tableElement = null;
        this.theadElement = null;
        this.tbodyElement = null;
    }
}

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImpactMatrix;
} else {
    window.ImpactMatrix = ImpactMatrix;
}