/**
 * 增量渲染引擎
 * 基于变化检测结果，只更新发生变化的DOM节点，支持平滑动画过渡
 * 
 * @class IncrementalRenderer
 */
class IncrementalRenderer {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.containerSelector - 容器选择器（默认'#insights-container'）
     * @param {Function} options.cardTemplate - 卡片模板函数
     * @param {Object} options.animation - 动画配置
     * @param {boolean} options.enableAnimation - 是否启用动画（默认true）
     * @param {boolean} options.preserveScroll - 是否保持滚动位置（默认true）
     */
    constructor(options = {}) {
        this.options = {
            containerSelector: options.containerSelector || '#insights-container',
            cardTemplate: options.cardTemplate || this.defaultCardTemplate,
            animation: {
                duration: options.animation?.duration || 300,
                easing: options.animation?.easing || 'cubic-bezier(0.4, 0, 0.2, 1)',
                enterClass: options.animation?.enterClass || 'card-enter',
                updateClass: options.animation?.updateClass || 'card-update',
                exitClass: options.animation?.exitClass || 'card-exit'
            },
            enableAnimation: options.enableAnimation !== false,
            preserveScroll: options.preserveScroll !== false,
            batchSize: options.batchSize || 10, // 批量渲染大小
            batchDelay: options.batchDelay || 50 // 批量渲染延迟（毫秒）
        };

        this.state = {
            isRendering: false,
            lastRenderTime: null,
            renderStats: {
                totalRenders: 0,
                totalCards: 0,
                averageRenderTime: 0
            }
        };

        this.container = null;
        this.observer = null;
        
        this.init();
    }

    /**
     * 初始化渲染器
     */
    init() {
        this.container = document.querySelector(this.options.containerSelector);
        
        if (!this.container) {
            console.warn(`容器未找到: ${this.options.containerSelector}`);
        }

        this.setupIntersectionObserver();
        this.injectAnimationStyles();
    }

    /**
     * 设置交叉观察器（用于懒加载）
     */
    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target.querySelector('img');
                        if (img && img.dataset.src) {
                            img.src = img.dataset.src;
                            delete img.dataset.src;
                        }
                        this.observer.unobserve(entry.target);
                    }
                });
            }, {
                root: null,
                rootMargin: '100px',
                threshold: 0.1
            });
        }
    }

    /**
     * 注入动画样式
     */
    injectAnimationStyles() {
        if (!this.options.enableAnimation) return;
        
        const styleId = 'incremental-renderer-animations';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .card-enter {
                opacity: 0;
                transform: translateY(20px);
            }
            
            .card-enter-active {
                opacity: 1;
                transform: translateY(0);
                transition: opacity ${this.options.animation.duration}ms ${this.options.animation.easing},
                            transform ${this.options.animation.duration}ms ${this.options.animation.easing};
            }
            
            .card-update {
                background-color: rgba(0, 212, 170, 0.1);
                transition: background-color ${this.options.animation.duration}ms ${this.options.animation.easing};
            }
            
            .card-exit {
                opacity: 1;
                transform: translateY(0);
            }
            
            .card-exit-active {
                opacity: 0;
                transform: translateY(-20px);
                transition: opacity ${this.options.animation.duration}ms ${this.options.animation.easing},
                            transform ${this.options.animation.duration}ms ${this.options.animation.easing};
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 渲染更新
     * @param {Object} changes - 变化检测结果
     * @param {Object} newData - 新数据
     * @returns {Promise} 渲染完成的Promise
     */
    async renderUpdates(changes, newData) {
        if (!this.container) {
            console.error('渲染容器未找到');
            return;
        }

        if (!changes.hasChanges) {
            console.log('没有检测到变化，跳过渲染');
            return;
        }

        this.state.isRendering = true;
        const startTime = performance.now();

        try {
            // 保存当前滚动位置
            const scrollTop = this.container.scrollTop;
            const scrollHeight = this.container.scrollHeight;

            // 批量处理删除的项目
            await this.handleRemovedItems(changes.removed);

            // 批量处理更新的项目
            await this.handleUpdatedItems(changes.updated);

            // 批量处理新增的项目
            await this.handleAddedItems(changes.added, newData);

            // 更新未变化的项目位置（如果需要）
            this.handleUnchangedItems(changes.unchanged);

            // 恢复滚动位置
            if (this.options.preserveScroll) {
                const newScrollHeight = this.container.scrollHeight;
                const scrollRatio = scrollTop / Math.max(1, scrollHeight);
                this.container.scrollTop = newScrollHeight * scrollRatio;
            }

            // 更新渲染统计
            const endTime = performance.now();
            this.updateRenderStats(endTime - startTime, changes);

            console.log(`渲染完成，耗时: ${(endTime - startTime).toFixed(2)}ms`, changes.summary);
        } catch (error) {
            console.error('渲染失败:', error);
        } finally {
            this.state.isRendering = false;
            this.state.lastRenderTime = new Date();
        }
    }

    /**
     * 处理删除的项目
     * @param {Array} removedItems - 删除的项目列表
     * @returns {Promise} 处理完成的Promise
     */
    async handleRemovedItems(removedItems) {
        if (!removedItems.length) return;

        const promises = removedItems.map(item => {
            const element = this.findElementByKey(item.key);
            if (element) {
                return this.animateExit(element);
            }
            return Promise.resolve();
        });

        await Promise.all(promises);
    }

    /**
     * 处理更新的项目
     * @param {Array} updatedItems - 更新的项目列表
     * @returns {Promise} 处理完成的Promise
     */
    async handleUpdatedItems(updatedItems) {
        if (!updatedItems.length) return;

        const promises = updatedItems.map(item => {
            const element = this.findElementByKey(item.key);
            if (element) {
                return this.animateUpdate(element, item.new);
            }
            return Promise.resolve();
        });

        await Promise.all(promises);
    }

    /**
     * 处理新增的项目
     * @param {Array} addedItems - 新增的项目列表
     * @param {Object} newData - 新数据
     * @returns {Promise} 处理完成的Promise
     */
    async handleAddedItems(addedItems, newData) {
        if (!addedItems.length) return;

        // 按位置排序
        addedItems.sort((a, b) => a.position - b.position);

        // 批量渲染，避免阻塞主线程
        for (let i = 0; i < addedItems.length; i += this.options.batchSize) {
            const batch = addedItems.slice(i, i + this.options.batchSize);
            
            await Promise.all(batch.map(item => {
                const card = this.createCard(item.data);
                return this.animateEnter(card, item.position);
            }));

            if (i + this.options.batchSize < addedItems.length) {
                await this.delay(this.options.batchDelay);
            }
        }
    }

    /**
     * 处理未变化的项目
     * @param {Array} unchangedItems - 未变化的项目列表
     */
    handleUnchangedItems(unchangedItems) {
        // 如果需要重新排序，可以在这里处理
        // 目前只更新数据引用，不改变DOM
    }

    /**
     * 创建卡片元素
     * @param {Object} insight - 洞察数据
     * @returns {HTMLElement} 卡片元素
     */
    createCard(insight) {
        const card = this.options.cardTemplate(insight);
        
        // 添加观察
        if (this.observer) {
            this.observer.observe(card);
        }
        
        return card;
    }

    /**
     * 默认卡片模板
     * @param {Object} insight - 洞察数据
     * @returns {HTMLElement} 卡片元素
     */
    defaultCardTemplate(insight) {
        const { id, title, summary, formatted_analysis, impacts, short_title, overall_impact } = insight;
        const analysisContent = formatted_analysis || insight.analysis || '';

        const card = document.createElement('div');
        card.className = 'insight-item';
        card.dataset.insightId = id;
        card.dataset.insightKey = `insight::${id}`;

        card.innerHTML = `
            <div class="insight-header">
                <div class="insight-number">${id}</div>
                <div class="insight-title">${title}</div>
                ${short_title ? `<div class="insight-short-title">${short_title}</div>` : ''}
            </div>
            
            <div class="insight-image-container">
                <img data-src="assets/insight${id}_placeholder.jpg" src="assets/placeholder.jpg" alt="${title}" class="insight-image">
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
            
            <div class="impact-tags">
                ${impacts.a_share !== 'neutral' ? `<span class="impact-tag a-share">A股:${impacts.a_share}</span>` : ''}
                ${impacts.hk_stock !== 'neutral' ? `<span class="impact-tag hk-stock">港股:${impacts.hk_stock}</span>` : ''}
                ${impacts.precious_metal !== 'neutral' ? `<span class="impact-tag precious-metal">贵金属:${impacts.precious_metal}</span>` : ''}
                ${impacts.fx !== 'neutral' ? `<span class="impact-tag fx">汇率:${impacts.fx}</span>` : ''}
            </div>
        `;

        return card;
    }

    /**
     * 动画：进入效果
     * @param {HTMLElement} element - 元素
     * @param {number} position - 插入位置
     * @returns {Promise} 动画完成的Promise
     */
    async animateEnter(element, position) {
        if (!this.options.enableAnimation) {
            this.insertElement(element, position);
            return Promise.resolve();
        }

        element.classList.add(this.options.animation.enterClass);
        
        // 插入到DOM但隐藏
        this.insertElement(element, position);
        
        // 触发动画
        requestAnimationFrame(() => {
            element.classList.add(`${this.options.animation.enterClass}-active`);
        });

        // 等待动画完成
        await this.delay(this.options.animation.duration);
        
        element.classList.remove(
            this.options.animation.enterClass,
            `${this.options.animation.enterClass}-active`
        );
    }

    /**
     * 动画：更新效果
     * @param {HTMLElement} element - 元素
     * @param {Object} newData - 新数据
     * @returns {Promise} 动画完成的Promise
     */
    async animateUpdate(element, newData) {
        if (!this.options.enableAnimation) {
            this.updateElementContent(element, newData);
            return Promise.resolve();
        }

        element.classList.add(this.options.animation.updateClass);
        
        // 更新内容
        this.updateElementContent(element, newData);
        
        // 触发动画
        requestAnimationFrame(() => {
            element.classList.add(`${this.options.animation.updateClass}-active`);
        });

        // 等待动画完成
        await this.delay(this.options.animation.duration);
        
        element.classList.remove(
            this.options.animation.updateClass,
            `${this.options.animation.updateClass}-active`
        );
    }

    /**
     * 动画：退出效果
     * @param {HTMLElement} element - 元素
     * @returns {Promise} 动画完成的Promise
     */
    async animateExit(element) {
        if (!this.options.enableAnimation) {
            element.remove();
            return Promise.resolve();
        }

        element.classList.add(this.options.animation.exitClass);
        
        // 触发动画
        requestAnimationFrame(() => {
            element.classList.add(`${this.options.animation.exitClass}-active`);
        });

        // 等待动画完成
        await this.delay(this.options.animation.duration);
        
        element.remove();
    }

    /**
     * 插入元素到指定位置
     * @param {HTMLElement} element - 元素
     * @param {number} position - 位置索引
     */
    insertElement(element, position) {
        if (position >= 0 && position < this.container.children.length) {
            this.container.insertBefore(element, this.container.children[position]);
        } else {
            this.container.appendChild(element);
        }
    }

    /**
     * 更新元素内容
     * @param {HTMLElement} element - 元素
     * @param {Object} newData - 新数据
     */
    updateElementContent(element, newData) {
        const newCard = this.createCard(newData);
        
        // 替换内容但保留动画类
        const oldClasses = Array.from(element.classList);
        element.innerHTML = newCard.innerHTML;
        
        // 恢复原来的类（除了动画类）
        oldClasses.forEach(className => {
            if (!className.includes('enter') && 
                !className.includes('update') && 
                !className.includes('exit')) {
                element.classList.add(className);
            }
        });
        
        // 更新数据属性
        element.dataset.insightId = newData.id;
        element.dataset.insightKey = `insight::${newData.id}`;
    }

    /**
     * 根据键查找元素
     * @param {string} key - 项目键
     * @returns {HTMLElement|null} 元素
     */
    findElementByKey(key) {
        if (!key) return null;
        
        // 尝试直接查找
        const [type, id] = key.split('::');
        if (type === 'insight' && id) {
            return document.querySelector(`[data-insight-id="${id}"]`);
        }
        
        // 回退到遍历
        const elements = this.container.querySelectorAll('.insight-item');
        for (const element of elements) {
            if (element.dataset.insightKey === key) {
                return element;
            }
        }
        
        return null;
    }

    /**
     * 更新渲染统计
     * @param {number} renderTime - 渲染时间（毫秒）
     * @param {Object} changes - 变化数据
     */
    updateRenderStats(renderTime, changes) {
        this.state.renderStats.totalRenders++;
        this.state.renderStats.totalCards += changes.summary.newTotal;
        
        // 计算平均渲染时间（移动平均）
        const oldAvg = this.state.renderStats.averageRenderTime;
        const newCount = this.state.renderStats.totalRenders;
        this.state.renderStats.averageRenderTime = 
            (oldAvg * (newCount - 1) + renderTime) / newCount;
    }

    /**
     * 获取渲染统计
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            ...this.state.renderStats,
            lastRenderTime: this.state.lastRenderTime,
            isRendering: this.state.isRendering
        };
    }

    /**
     * 清空容器
     */
    clearContainer() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    /**
     * 延迟函数
     * @param {number} ms - 毫秒数
     * @returns {Promise} Promise对象
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 销毁渲染器
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        this.container = null;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IncrementalRenderer;
} else {
    window.IncrementalRenderer = IncrementalRenderer;
}