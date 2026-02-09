/**
 * 导航系统组件
 * 支持响应式导航栏，桌面端菜单和移动端汉堡菜单切换
 * 集成每日洞察/每周要点双Tab切换功能
 * 
 * @class NavigationBar
 */

class NavigationBar {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.containerId - 导航栏容器ID
     * @param {string} options.activeTab - 初始激活的Tab ('daily' | 'weekly')
     * @param {Function} options.onTabChange - Tab切换回调函数
     * @param {string} options.searchQuery - 初始搜索查询
     * @param {Function} options.onSearch - 搜索回调函数
     */
    constructor(options = {}) {
        this.options = {
            containerId: options.containerId || 'nav-container',
            activeTab: options.activeTab || 'daily',
            onTabChange: options.onTabChange || null,
            searchQuery: options.searchQuery || '',
            onSearch: options.onSearch || null,
            userPreferences: options.userPreferences || {}
        };

        this.container = null;
        this.navElement = null;
        this.tabsContainer = null;
        this.menuToggle = null;
        this.searchInput = null;
        this.currentTab = this.options.activeTab;

        this.init();
    }

    /**
     * 初始化导航栏
     */
    init() {
        this.createContainer();
        this.render();
        this.bindEvents();
        this.setupResponsiveBehavior();
    }

    /**
     * 创建容器元素
     */
    createContainer() {
        // 如果容器已存在，则使用现有容器
        this.container = document.getElementById(this.options.containerId);
        
        if (!this.container) {
            // 创建新容器
            this.container = document.createElement('div');
            this.container.id = this.options.containerId;
            this.container.className = 'navigation-container';
            
            // 插入到body开头
            document.body.insertBefore(this.container, document.body.firstChild);
        }
    }

    /**
     * 渲染导航栏HTML
     */
    render() {
        this.container.innerHTML = `
            <nav class="main-nav">
                <!-- 品牌标识 -->
                <div class="nav-brand">
                    <span class="brand-icon">📈</span>
                    <span class="brand-text">金融情报</span>
                </div>

                <!-- 移动端菜单切换按钮 -->
                <button class="menu-toggle" id="menu-toggle" aria-label="切换菜单">
                    <span class="hamburger-icon">☰</span>
                </button>

                <!-- 导航选项卡 -->
                <div class="nav-tabs" id="nav-tabs">
                    <button class="nav-tab ${this.currentTab === 'daily' ? 'active' : ''}" 
                            data-tab="daily" 
                            aria-label="每日洞察">
                        每日洞察
                    </button>
                    <button class="nav-tab ${this.currentTab === 'weekly' ? 'active' : ''}" 
                            data-tab="weekly" 
                            aria-label="每周要点总结">
                        每周要点总结
                    </button>
                </div>

                <!-- 搜索框（可选） -->
                ${this.options.onSearch ? `
                <div class="nav-search">
                    <input type="text" 
                           class="search-input" 
                           placeholder="搜索洞察..." 
                           value="${this.options.searchQuery}"
                           aria-label="搜索洞察">
                    <button class="search-button" aria-label="搜索">
                        🔍
                    </button>
                </div>
                ` : ''}

                <!-- 用户偏好按钮（可选） -->
                ${this.options.userPreferences.theme ? `
                <div class="nav-actions">
                    <button class="theme-toggle" aria-label="切换主题">
                        ${this.options.userPreferences.theme === 'dark' ? '🌙' : '☀️'}
                    </button>
                </div>
                ` : ''}
            </nav>
        `;

        // 缓存DOM元素
        this.navElement = this.container.querySelector('.main-nav');
        this.tabsContainer = this.container.getElementById('nav-tabs');
        this.menuToggle = this.container.getElementById('menu-toggle');
        this.searchInput = this.container.querySelector('.search-input');
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // Tab切换事件
        const tabButtons = this.container.querySelectorAll('.nav-tab');
        tabButtons.forEach(tab => {
            tab.addEventListener('click', (event) => {
                const tabName = event.currentTarget.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // 移动端菜单切换
        if (this.menuToggle) {
            this.menuToggle.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
        }

        // 搜索功能
        if (this.searchInput && this.options.onSearch) {
            const searchButton = this.container.querySelector('.search-button');
            const handleSearch = () => {
                const query = this.searchInput.value.trim();
                this.options.onSearch(query);
            };

            searchButton.addEventListener('click', handleSearch);
            this.searchInput.addEventListener('keyup', (event) => {
                if (event.key === 'Enter') {
                    handleSearch();
                }
            });
        }

        // 主题切换
        const themeToggle = this.container.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // 点击外部关闭移动端菜单
        document.addEventListener('click', (event) => {
            if (window.innerWidth <= 768) {
                const isClickInside = this.navElement.contains(event.target);
                if (!isClickInside && this.tabsContainer.classList.contains('active')) {
                    this.tabsContainer.classList.remove('active');
                }
            }
        });

        // 窗口大小变化时重置菜单状态
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    /**
     * 切换Tab
     * @param {string} tabName - Tab名称 ('daily' | 'weekly')
     */
    switchTab(tabName) {
        if (tabName === this.currentTab) return;

        // 更新活动Tab样式
        const tabButtons = this.container.querySelectorAll('.nav-tab');
        tabButtons.forEach(tab => {
            tab.classList.remove('active');
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            }
        });

        const previousTab = this.currentTab;
        this.currentTab = tabName;

        // 触发Tab切换事件
        this.emitTabChange(tabName, previousTab);

        // 回调函数
        if (this.options.onTabChange) {
            this.options.onTabChange(tabName);
        }

        // 移动端切换后关闭菜单
        if (window.innerWidth <= 768) {
            this.tabsContainer.classList.remove('active');
        }
    }

    /**
     * 触发Tab切换自定义事件
     * @param {string} newTab - 新Tab
     * @param {string} oldTab - 旧Tab
     */
    emitTabChange(newTab, oldTab) {
        const event = new CustomEvent('tabchange', {
            detail: {
                newTab,
                oldTab,
                timestamp: Date.now()
            }
        });
        this.container.dispatchEvent(event);
    }

    /**
     * 切换移动端菜单
     */
    toggleMobileMenu() {
        this.tabsContainer.classList.toggle('active');
        
        // 更新菜单按钮状态
        const hamburgerIcon = this.menuToggle.querySelector('.hamburger-icon');
        if (this.tabsContainer.classList.contains('active')) {
            hamburgerIcon.textContent = '✕';
            this.menuToggle.setAttribute('aria-expanded', 'true');
        } else {
            hamburgerIcon.textContent = '☰';
            this.menuToggle.setAttribute('aria-expanded', 'false');
        }
    }

    /**
     * 切换主题
     */
    toggleTheme() {
        const currentTheme = this.options.userPreferences.theme || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // 更新用户偏好
        this.options.userPreferences.theme = newTheme;
        
        // 更新按钮图标
        const themeToggle = this.container.querySelector('.theme-toggle');
        themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️';
        
        // 触发主题切换事件
        this.emitThemeChange(newTheme, currentTheme);
    }

    /**
     * 触发主题切换自定义事件
     * @param {string} newTheme - 新主题
     * @param {string} oldTheme - 旧主题
     */
    emitThemeChange(newTheme, oldTheme) {
        const event = new CustomEvent('themechange', {
            detail: {
                newTheme,
                oldTheme,
                timestamp: Date.now()
            }
        });
        this.container.dispatchEvent(event);
    }

    /**
     * 设置响应式行为
     */
    setupResponsiveBehavior() {
        // 初始检查
        this.handleResize();
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        const isMobile = window.innerWidth <= 768;
        
        // 桌面端自动展开菜单
        if (!isMobile) {
            this.tabsContainer.classList.remove('active');
            
            // 重置菜单按钮
            if (this.menuToggle) {
                this.menuToggle.querySelector('.hamburger-icon').textContent = '☰';
                this.menuToggle.setAttribute('aria-expanded', 'false');
            }
        }
    }

    /**
     * 获取当前激活的Tab
     * @returns {string} 当前Tab名称
     */
    getActiveTab() {
        return this.currentTab;
    }

    /**
     * 更新搜索查询
     * @param {string} query - 搜索查询
     */
    updateSearchQuery(query) {
        if (this.searchInput) {
            this.searchInput.value = query;
        }
    }

    /**
     * 销毁组件
     */
    destroy() {
        // 移除事件监听器
        const tabButtons = this.container.querySelectorAll('.nav-tab');
        tabButtons.forEach(tab => {
            tab.replaceWith(tab.cloneNode(true));
        });

        // 移除DOM元素
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        // 清理引用
        this.container = null;
        this.navElement = null;
        this.tabsContainer = null;
        this.menuToggle = null;
        this.searchInput = null;
    }
}

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationBar;
} else {
    window.NavigationBar = NavigationBar;
}