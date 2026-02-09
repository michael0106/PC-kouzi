/**
 * 洞察卡片组件
 * 可复用的洞察卡片组件，支持移动端折叠展开交互
 * 保持现有视觉样式和图片浮层功能，优化触摸交互体验
 * 
 * @class InsightCard
 */

class InsightCard {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {HTMLElement|string} options.container - 容器元素或选择器
     * @param {Object} options.insight - 洞察数据
     * @param {boolean} options.isExpanded - 初始是否展开
     * @param {Function} options.onToggleExpand - 展开/收起回调
     * @param {Function} options.onBookmark - 收藏回调
     * @param {Function} options.onShare - 分享回调
     * @param {string} options.variant - 卡片变体 ('compact' | 'detailed' | 'featured')
     * @param {boolean} options.enableImageOverlay - 是否启用图片浮层
     * @param {Object} options.userPreferences - 用户偏好设置
     */
    constructor(options = {}) {
        this.options = {
            container: options.container || 'insights-container',
            insight: options.insight || null,
            isExpanded: options.isExpanded !== undefined ? options.isExpanded : false,
            onToggleExpand: options.onToggleExpand || null,
            onBookmark: options.onBookmark || null,
            onShare: options.onShare || null,
            variant: options.variant || 'detailed',
            enableImageOverlay: options.enableImageOverlay !== false,
            userPreferences: options.userPreferences || {}
        };

        this.state = {
            isExpanded: this.options.isExpanded,
            isLoading: false,
            isBookmarked: false,
            imageLoaded: false
        };

        this.container = null;
        this.cardElement = null;
        this.imageElement = null;
        
        this.init();
    }

    /**
     * 初始化组件
     */
    init() {
        this.resolveContainer();
        
        if (this.options.insight) {
            this.render();
            this.bindEvents();
            this.setupResponsiveBehavior();
        }
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
                document.body.appendChild(this.container);
            }
        } else {
            this.container = this.options.container;
        }
    }

    /**
     * 渲染卡片HTML
     */
    render() {
        const { insight } = this.options;
        const { id, title, summary, formatted_analysis, analysis, source, publish_time, impacts, short_title, overall_impact, event_impact } = insight;
        
        const analysisContent = formatted_analysis || analysis;
        const impactColors = this.getImpactColors(impacts);
        const cardClass = `insight-card insight-card-${this.options.variant}`;
        const expandedClass = this.state.isExpanded ? 'expanded' : '';
        const bookmarkedClass = this.state.isBookmarked ? 'bookmarked' : '';

        this.cardElement = document.createElement('div');
        this.cardElement.className = `${cardClass} ${expandedClass} ${bookmarkedClass}`;
        this.cardElement.dataset.insightId = id;
        this.cardElement.dataset.cardId = `card-${id}-${Date.now()}`;

        this.cardElement.innerHTML = `
            <!-- 卡片头部 -->
            <div class="card-header">
                <div class="header-left">
                    <div class="insight-number" style="${impactColors.number}">${id}</div>
                    <div class="header-content">
                        <h3 class="insight-title">${title}</h3>
                        <div class="metadata">
                            <span class="source">${source || '未知来源'}</span>
                            <span class="separator">•</span>
                            <span class="time">${this.formatTime(publish_time)}</span>
                            ${event_impact ? `<span class="separator">•</span><span class="impact-level ${event_impact}">${this.getImpactLevelText(event_impact)}</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="header-right">
                    <!-- 影响指示器 -->
                    <div class="impact-indicators">
                        ${this.renderImpactIndicators(impacts)}
                    </div>
                    
                    <!-- 操作按钮 -->
                    <div class="action-buttons">
                        <button class="action-button toggle-expand" aria-label="${this.state.isExpanded ? '收起' : '展开'}">
                            ${this.state.isExpanded ? '−' : '+'}
                        </button>
                        
                        ${this.options.onBookmark ? `
                        <button class="action-button bookmark" aria-label="${this.state.isBookmarked ? '取消收藏' : '收藏'}">
                            ${this.state.isBookmarked ? '★' : '☆'}
                        </button>
                        ` : ''}
                        
                        ${this.options.onShare ? `
                        <button class="action-button share" aria-label="分享">
                            ⎘
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <!-- 卡片内容 -->
            <div class="card-content">
                <!-- 图片区域 -->
                <div class="image-section">
                    <div class="image-container">
                        <img src="${this.getImageUrl(id)}" 
                             data-fallback="${this.getFallbackImageUrl()}"
                             alt="${title}"
                             class="insight-image ${this.state.imageLoaded ? 'loaded' : ''}"
                             loading="lazy">
                        <div class="image-placeholder ${this.state.imageLoaded ? 'hidden' : ''}">
                            图片加载中...
                        </div>
                    </div>
                    
                    ${this.options.enableImageOverlay ? `
                    <div class="image-overlay-trigger">
                        <button class="overlay-button" aria-label="查看大图">
                            🔍
                        </button>
                    </div>
                    ` : ''}
                </div>
                
                <!-- 摘要区域 -->
                <div class="summary-section">
                    <div class="section-label">
                        <span class="label-icon">📌</span>
                        <span class="label-text">核心摘要</span>
                    </div>
                    <div class="summary-content">
                        ${summary}
                    </div>
                </div>
                
                <!-- 分析区域 -->
                <div class="analysis-section">
                    <div class="section-label toggle-label" data-toggle-id="${id}">
                        <span class="label-icon">📊</span>
                        <span class="label-text">深度分析</span>
                        <span class="toggle-icon">${this.state.isExpanded ? '▽' : '△'}</span>
                    </div>
                    <div class="analysis-content ${this.state.isExpanded ? 'expanded' : ''}" id="analysis-${id}">
                        ${analysisContent}
                    </div>
                </div>
                
                <!-- 标签区域 -->
                <div class="tags-section">
                    ${this.renderTags(insight)}
                </div>
            </div>
            
            <!-- 卡片页脚 -->
            <div class="card-footer">
                <div class="footer-left">
                    <div class="impact-summary">
                        <span class="summary-label">综合影响：</span>
                        <span class="summary-value ${overall_impact}">
                            ${this.getOverallImpactText(overall_impact)}
                        </span>
                    </div>
                </div>
                
                <div class="footer-right">
                    <div class="action-links">
                        <button class="action-link report-issue" aria-label="报告问题">
                            报告问题
                        </button>
                        <button class="action-link view-details" aria-label="查看详情">
                            查看详情
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 添加到容器
        this.container.appendChild(this.cardElement);

        // 缓存图片元素
        this.imageElement = this.cardElement.querySelector('.insight-image');
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 展开/收起切换
        const toggleLabel = this.cardElement.querySelector('.toggle-label');
        const toggleButton = this.cardElement.querySelector('.toggle-expand');
        
        if (toggleLabel) {
            toggleLabel.addEventListener('click', (event) => {
                this.toggleExpand();
                event.stopPropagation();
            });
        }
        
        if (toggleButton) {
            toggleButton.addEventListener('click', (event) => {
                this.toggleExpand();
                event.stopPropagation();
            });
        }

        // 收藏按钮
        const bookmarkButton = this.cardElement.querySelector('.bookmark');
        if (bookmarkButton) {
            bookmarkButton.addEventListener('click', (event) => {
                this.toggleBookmark();
                event.stopPropagation();
            });
        }

        // 分享按钮
        const shareButton = this.cardElement.querySelector('.share');
        if (shareButton) {
            shareButton.addEventListener('click', (event) => {
                this.handleShare();
                event.stopPropagation();
            });
        }

        // 图片浮层
        if (this.options.enableImageOverlay) {
            const overlayButton = this.cardElement.querySelector('.overlay-button');
            if (overlayButton) {
                overlayButton.addEventListener('click', (event) => {
                    this.openImageOverlay();
                    event.stopPropagation();
                });
            }
            
            // 图片点击也触发浮层
            if (this.imageElement) {
                this.imageElement.addEventListener('click', () => {
                    this.openImageOverlay();
                });
            }
        }

        // 图片加载事件
        if (this.imageElement) {
            this.imageElement.addEventListener('load', () => {
                this.handleImageLoad();
            });
            
            // 如果图片已缓存
            if (this.imageElement.complete) {
                this.handleImageLoad();
            }
            
            // 图片加载失败时使用备用图片
            this.imageElement.addEventListener('error', () => {
                this.handleImageError();
            });
        }

        // 响应式行为：窗口大小变化
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    /**
     * 设置响应式行为
     */
    setupResponsiveBehavior() {
        this.handleResize();
    }

    /**
     * 切换展开/收起状态
     */
    toggleExpand() {
        this.state.isExpanded = !this.state.isExpanded;
        
        // 更新DOM
        this.cardElement.classList.toggle('expanded');
        
        const analysisContent = this.cardElement.querySelector(`#analysis-${this.options.insight.id}`);
        const toggleIcon = this.cardElement.querySelector('.toggle-icon');
        const toggleButton = this.cardElement.querySelector('.toggle-expand');
        
        if (analysisContent) {
            analysisContent.classList.toggle('expanded');
        }
        
        if (toggleIcon) {
            toggleIcon.textContent = this.state.isExpanded ? '▽' : '△';
        }
        
        if (toggleButton) {
            toggleButton.textContent = this.state.isExpanded ? '−' : '+';
            toggleButton.setAttribute('aria-label', this.state.isExpanded ? '收起' : '展开');
        }
        
        // 回调函数
        if (this.options.onToggleExpand) {
            this.options.onToggleExpand(this.options.insight.id, this.state.isExpanded);
        }
        
        // 触发自定义事件
        this.emitToggleEvent();
        
        // 如果是移动端展开，滚动到分析部分
        if (this.state.isExpanded && window.innerWidth <= 768) {
            setTimeout(() => {
                analysisContent?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    }

    /**
     * 切换收藏状态
     */
    toggleBookmark() {
        this.state.isBookmarked = !this.state.isBookmarked;
        
        // 更新DOM
        this.cardElement.classList.toggle('bookmarked');
        
        const bookmarkButton = this.cardElement.querySelector('.bookmark');
        if (bookmarkButton) {
            bookmarkButton.textContent = this.state.isBookmarked ? '★' : '☆';
            bookmarkButton.setAttribute('aria-label', this.state.isBookmarked ? '取消收藏' : '收藏');
        }
        
        // 回调函数
        if (this.options.onBookmark) {
            this.options.onBookmark(this.options.insight.id, this.state.isBookmarked);
        }
        
        // 触发自定义事件
        this.emitBookmarkEvent();
    }

    /**
     * 处理分享
     */
    handleShare() {
        if (this.options.onShare) {
            this.options.onShare(this.options.insight.id);
        }
        
        // 触发分享事件
        this.emitShareEvent();
    }

    /**
     * 处理图片加载
     */
    handleImageLoad() {
        this.state.imageLoaded = true;
        
        if (this.imageElement) {
            this.imageElement.classList.add('loaded');
        }
        
        const placeholder = this.cardElement.querySelector('.image-placeholder');
        if (placeholder) {
            placeholder.classList.add('hidden');
        }
    }

    /**
     * 处理图片加载失败
     */
    handleImageError() {
        if (this.imageElement) {
            const fallbackUrl = this.imageElement.getAttribute('data-fallback');
            if (fallbackUrl) {
                this.imageElement.src = fallbackUrl;
            }
        }
    }

    /**
     * 打开图片浮层
     */
    openImageOverlay() {
        if (!this.imageElement) return;
        
        const event = new CustomEvent('openimageoverlay', {
            detail: {
                imageUrl: this.imageElement.src,
                altText: this.imageElement.alt,
                insightId: this.options.insight.id,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        const isMobile = window.innerWidth <= 768;
        
        // 移动端默认收起，桌面端默认展开
        if (isMobile && !this.state.isExpanded) {
            // 保持收起状态
        } else if (!isMobile && !this.state.isExpanded) {
            // 桌面端自动展开
            this.state.isExpanded = true;
            this.cardElement.classList.add('expanded');
            
            const analysisContent = this.cardElement.querySelector(`#analysis-${this.options.insight.id}`);
            const toggleIcon = this.cardElement.querySelector('.toggle-icon');
            const toggleButton = this.cardElement.querySelector('.toggle-expand');
            
            if (analysisContent) analysisContent.classList.add('expanded');
            if (toggleIcon) toggleIcon.textContent = '▽';
            if (toggleButton) {
                toggleButton.textContent = '−';
                toggleButton.setAttribute('aria-label', '收起');
            }
        }
    }

    /**
     * 渲染影响指示器
     * @param {Object} impacts - 影响对象
     * @returns {string} HTML字符串
     */
    renderImpactIndicators(impacts) {
        if (!impacts) return '';
        
        const markets = [
            { key: 'a_share', label: 'A股', icon: '📈' },
            { key: 'hk_stock', label: '港股', icon: '🇭🇰' },
            { key: 'precious_metal', label: '贵金属', icon: '🥇' },
            { key: 'fx', label: '汇率', icon: '💱' }
        ];
        
        return markets.map(market => {
            const impact = impacts[market.key];
            if (!impact) return '';
            
            const impactClass = `impact-indicator ${impact}`;
            const impactText = this.getImpactText(impact);
            
            return `
                <div class="${impactClass}" title="${market.label}: ${impactText}">
                    <span class="indicator-icon">${market.icon}</span>
                    <span class="indicator-text">${impactText}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * 渲染标签
     * @param {Object} insight - 洞察数据
     * @returns {string} HTML字符串
     */
    renderTags(insight) {
        const tags = [];
        
        // 添加影响标签
        if (insight.overall_impact) {
            tags.push({
                text: this.getOverallImpactText(insight.overall_impact),
                class: `tag-impact ${insight.overall_impact}`
            });
        }
        
        // 添加事件影响程度标签
        if (insight.event_impact) {
            tags.push({
                text: this.getImpactLevelText(insight.event_impact),
                class: `tag-event-impact ${insight.event_impact}`
            });
        }
        
        // 添加来源标签
        if (insight.source) {
            tags.push({
                text: insight.source,
                class: 'tag-source'
            });
        }
        
        if (tags.length === 0) return '';
        
        return `
            <div class="tags-container">
                ${tags.map(tag => `
                    <span class="tag ${tag.class}">${tag.text}</span>
                `).join('')}
            </div>
        `;
    }

    /**
     * 获取影响颜色配置
     * @param {Object} impacts - 影响对象
     * @returns {Object} 颜色配置对象
     */
    getImpactColors(impacts) {
        if (!impacts) {
            return {
                number: 'color: #666;',
                border: 'border-color: #ddd;'
            };
        }
        
        // 根据整体影响决定颜色
        const overallImpact = impacts.overall_impact || 'neutral';
        
        const colorMap = {
            positive: '#1e8449',
            negative: '#c0392b',
            neutral: '#666'
        };
        
        const color = colorMap[overallImpact] || '#666';
        
        return {
            number: `color: ${color};`,
            border: `border-color: ${color};`
        };
    }

    /**
     * 获取图片URL
     * @param {number} id - 洞察ID
     * @returns {string} 图片URL
     */
    getImageUrl(id) {
        return `assets/insight${id}_placeholder.jpg`;
    }

    /**
     * 获取备用图片URL
     * @returns {string} 备用图片URL
     */
    getFallbackImageUrl() {
        return 'assets/placeholder.jpg';
    }

    /**
     * 格式化时间
     * @param {string} timeString - 时间字符串
     * @returns {string} 格式化后的时间
     */
    formatTime(timeString) {
        if (!timeString) return '未知时间';
        
        try {
            const date = new Date(timeString);
            
            // 如果是今天，显示时间
            const now = new Date();
            if (date.toDateString() === now.toDateString()) {
                return date.toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            }
            
            // 否则显示日期
            return date.toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit'
            });
        } catch (error) {
            return timeString;
        }
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
        
        return map[overallImpact] || '中性';
    }

    /**
     * 获取影响程度文本
     * @param {string} impactLevel - 影响程度
     * @returns {string} 影响程度文本
     */
    getImpactLevelText(impactLevel) {
        const map = {
            high: '高影响',
            medium: '中影响',
            low: '低影响'
        };
        
        return map[impactLevel] || '未知';
    }

    /**
     * 触发展开/收起事件
     */
    emitToggleEvent() {
        const event = new CustomEvent('insightcardtoggle', {
            detail: {
                insightId: this.options.insight.id,
                isExpanded: this.state.isExpanded,
                timestamp: Date.now()
            }
        });
        
        this.cardElement.dispatchEvent(event);
    }

    /**
     * 触发收藏事件
     */
    emitBookmarkEvent() {
        const event = new CustomEvent('insightcardbookmark', {
            detail: {
                insightId: this.options.insight.id,
                isBookmarked: this.state.isBookmarked,
                timestamp: Date.now()
            }
        });
        
        this.cardElement.dispatchEvent(event);
    }

    /**
     * 触发分享事件
     */
    emitShareEvent() {
        const event = new CustomEvent('insightcardshare', {
            detail: {
                insightId: this.options.insight.id,
                timestamp: Date.now()
            }
        });
        
        this.cardElement.dispatchEvent(event);
    }

    /**
     * 更新洞察数据
     * @param {Object} newInsight - 新洞察数据
     */
    updateInsight(newInsight) {
        this.options.insight = { ...this.options.insight, ...newInsight };
        
        // 重新渲染卡片
        const oldCard = this.cardElement;
        this.render();
        
        // 替换旧卡片
        if (oldCard && oldCard.parentNode) {
            oldCard.parentNode.replaceChild(this.cardElement, oldCard);
        }
        
        // 重新绑定事件
        this.bindEvents();
    }

    /**
     * 获取卡片元素
     * @returns {HTMLElement} 卡片元素
     */
    getElement() {
        return this.cardElement;
    }

    /**
     * 获取当前状态
     * @returns {Object} 状态对象
     */
    getState() {
        return {
            isExpanded: this.state.isExpanded,
            isBookmarked: this.state.isBookmarked,
            imageLoaded: this.state.imageLoaded
        };
    }

    /**
     * 销毁组件
     */
    destroy() {
        // 移除事件监听器
        const toggleLabel = this.cardElement?.querySelector('.toggle-label');
        const toggleButton = this.cardElement?.querySelector('.toggle-expand');
        const bookmarkButton = this.cardElement?.querySelector('.bookmark');
        const shareButton = this.cardElement?.querySelector('.share');
        const overlayButton = this.cardElement?.querySelector('.overlay-button');
        
        if (toggleLabel) {
            toggleLabel.replaceWith(toggleLabel.cloneNode(true));
        }
        
        if (toggleButton) {
            toggleButton.replaceWith(toggleButton.cloneNode(true));
        }
        
        if (bookmarkButton) {
            bookmarkButton.replaceWith(bookmarkButton.cloneNode(true));
        }
        
        if (shareButton) {
            shareButton.replaceWith(shareButton.cloneNode(true));
        }
        
        if (overlayButton) {
            overlayButton.replaceWith(overlayButton.cloneNode(true));
        }
        
        // 移除DOM元素
        if (this.cardElement && this.cardElement.parentNode) {
            this.cardElement.parentNode.removeChild(this.cardElement);
        }
        
        // 清理引用
        this.container = null;
        this.cardElement = null;
        this.imageElement = null;
    }
}

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InsightCard;
} else {
    window.InsightCard = InsightCard;
}