/**
 * 懒加载管理器
 * 基于IntersectionObserver实现图片、脚本、样式表的按需加载
 * 支持占位符、错误处理、加载优先级控制
 * 
 * @class LazyLoader
 */

class LazyLoader {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {number} options.rootMargin - 观察器根边距（默认'200px'）
     * @param {number} options.threshold - 触发阈值（默认0.01）
     * @param {boolean} options.enableImageLazyLoading - 是否启用图片懒加载
     * @param {boolean} options.enableScriptLazyLoading - 是否启用脚本懒加载
     * @param {boolean} options.enableIframeLazyLoading - 是否启用iframe懒加载
     * @param {Object} options.placeholderConfig - 占位符配置
     * @param {Function} options.onElementLoaded - 元素加载完成回调
     * @param {Function} options.onElementError - 元素加载失败回调
     */
    constructor(options = {}) {
        this.options = {
            rootMargin: options.rootMargin || '200px',
            threshold: options.threshold || 0.01,
            enableImageLazyLoading: options.enableImageLazyLoading !== false,
            enableScriptLazyLoading: options.enableScriptLazyLoading !== false,
            enableIframeLazyLoading: options.enableIframeLazyLoading !== false,
            placeholderConfig: options.placeholderConfig || {
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PC9zdmc+',
                backgroundColor: '#f0f0f0'
            },
            onElementLoaded: options.onElementLoaded || null,
            onElementError: options.onElementError || null
        };

        this.state = {
            isEnabled: 'IntersectionObserver' in window,
            observer: null,
            observedElements: new Map(),
            loadedElements: new Set(),
            pendingElements: new Set()
        };

        this.init();
    }

    /**
     * 初始化懒加载器
     */
    init() {
        if (!this.state.isEnabled) {
            console.warn('LazyLoader: IntersectionObserver不支持，将使用传统加载方式');
            this.loadAllElementsImmediately();
            return;
        }

        this.setupObserver();
        this.scanAndObserveElements();
    }

    /**
     * 设置IntersectionObserver
     */
    setupObserver() {
        this.state.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const element = entry.target;
                        this.handleElementVisible(element);
                    }
                });
            },
            {
                rootMargin: this.options.rootMargin,
                threshold: this.options.threshold
            }
        );
    }

    /**
     * 扫描并观察页面中的懒加载元素
     */
    scanAndObserveElements() {
        // 图片懒加载
        if (this.options.enableImageLazyLoading) {
            const images = document.querySelectorAll('img[data-src], img[data-srcset]');
            images.forEach(img => this.observeElement(img));
        }

        // 脚本懒加载
        if (this.options.enableScriptLazyLoading) {
            const scripts = document.querySelectorAll('script[data-src]');
            scripts.forEach(script => this.observeElement(script));
        }

        // iframe懒加载
        if (this.options.enableIframeLazyLoading) {
            const iframes = document.querySelectorAll('iframe[data-src]');
            iframes.forEach(iframe => this.observeElement(iframe));
        }

        console.log(`LazyLoader: 开始观察 ${this.state.observedElements.size} 个元素`);
    }

    /**
     * 观察单个元素
     * @param {HTMLElement} element - 要观察的元素
     */
    observeElement(element) {
        if (!this.state.observer || !element) {
            return;
        }

        // 保存原始数据
        const elementData = {
            src: element.getAttribute('data-src'),
            srcset: element.getAttribute('data-srcset'),
            type: element.tagName.toLowerCase(),
            isLoading: false
        };

        this.state.observedElements.set(element, elementData);

        // 设置占位符
        this.setupPlaceholder(element, elementData);

        // 开始观察
        this.state.observer.observe(element);
    }

    /**
     * 设置元素占位符
     * @param {HTMLElement} element - 元素
     * @param {Object} elementData - 元素数据
     */
    setupPlaceholder(element, elementData) {
        if (elementData.type === 'img') {
            // 保存原始src（如果有）
            const originalSrc = element.getAttribute('src');
            if (originalSrc) {
                element.setAttribute('data-original-src', originalSrc);
            }

            // 设置占位符
            element.setAttribute('src', this.options.placeholderConfig.image);
            element.classList.add('lazy-loading');
        }
    }

    /**
     * 处理元素进入视口
     * @param {HTMLElement} element - 可见的元素
     */
    handleElementVisible(element) {
        const elementData = this.state.observedElements.get(element);
        if (!elementData || elementData.isLoading) {
            return;
        }

        elementData.isLoading = true;
        this.state.pendingElements.add(element);

        // 根据元素类型加载资源
        switch (elementData.type) {
            case 'img':
                this.loadImage(element, elementData);
                break;
            case 'script':
                this.loadScript(element, elementData);
                break;
            case 'iframe':
                this.loadIframe(element, elementData);
                break;
        }
    }

    /**
     * 加载图片
     * @param {HTMLImageElement} img - 图片元素
     * @param {Object} elementData - 元素数据
     */
    loadImage(img, elementData) {
        const image = new Image();

        // 设置加载完成回调
        image.onload = () => {
            this.onElementLoaded(img, elementData);
        };

        // 设置加载失败回调
        image.onerror = (error) => {
            this.onElementError(img, elementData, error);
        };

        // 开始加载
        if (elementData.srcset) {
            img.srcset = elementData.srcset;
            if (elementData.src) {
                img.src = elementData.src;
            }
        } else if (elementData.src) {
            img.src = elementData.src;
        }

        // 移除占位符类
        img.classList.remove('lazy-loading');
        img.classList.add('lazy-loaded');
    }

    /**
     * 加载脚本
     * @param {HTMLScriptElement} script - 脚本元素
     * @param {Object} elementData - 元素数据
     */
    loadScript(script, elementData) {
        const newScript = document.createElement('script');
        
        // 复制所有属性
        Array.from(script.attributes).forEach(attr => {
            if (attr.name !== 'data-src') {
                newScript.setAttribute(attr.name, attr.value);
            }
        });

        // 设置src
        newScript.src = elementData.src;

        // 设置加载回调
        newScript.onload = () => {
            this.onElementLoaded(script, elementData);
            script.parentNode.removeChild(script);
        };

        newScript.onerror = (error) => {
            this.onElementError(script, elementData, error);
        };

        // 插入新脚本
        script.parentNode.insertBefore(newScript, script);
    }

    /**
     * 加载iframe
     * @param {HTMLIFrameElement} iframe - iframe元素
     * @param {Object} elementData - 元素数据
     */
    loadIframe(iframe, elementData) {
        iframe.src = elementData.src;

        iframe.onload = () => {
            this.onElementLoaded(iframe, elementData);
        };

        iframe.onerror = (error) => {
            this.onElementError(iframe, elementData, error);
        };
    }

    /**
     * 元素加载完成处理
     * @param {HTMLElement} element - 元素
     * @param {Object} elementData - 元素数据
     */
    onElementLoaded(element, elementData) {
        // 停止观察
        if (this.state.observer) {
            this.state.observer.unobserve(element);
        }

        // 更新状态
        this.state.observedElements.delete(element);
        this.state.pendingElements.delete(element);
        this.state.loadedElements.add(element);

        // 触发回调
        if (this.options.onElementLoaded) {
            this.options.onElementLoaded(element, elementData);
        }

        console.log(`LazyLoader: 元素加载完成 - ${elementData.type}`);
    }

    /**
     * 元素加载失败处理
     * @param {HTMLElement} element - 元素
     * @param {Object} elementData - 元素数据
     * @param {Error} error - 错误对象
     */
    onElementError(element, elementData, error) {
        console.error(`LazyLoader: 元素加载失败 - ${elementData.type}`, error);

        // 回退到原始src（对于图片）
        if (elementData.type === 'img') {
            const originalSrc = element.getAttribute('data-original-src');
            if (originalSrc) {
                element.src = originalSrc;
            }
        }

        // 触发回调
        if (this.options.onElementError) {
            this.options.onElementError(element, elementData, error);
        }
    }

    /**
     * 立即加载所有元素（兼容模式）
     */
    loadAllElementsImmediately() {
        const elements = document.querySelectorAll('[data-src], [data-srcset]');
        
        elements.forEach(element => {
            const src = element.getAttribute('data-src');
            const srcset = element.getAttribute('data-srcset');
            
            if (srcset) {
                element.srcset = srcset;
            }
            if (src) {
                element.src = src;
            }
            
            element.classList.remove('lazy-loading');
            element.classList.add('lazy-loaded');
        });

        console.log(`LazyLoader: 立即加载了 ${elements.length} 个元素`);
    }

    /**
     * 手动触发元素加载
     * @param {HTMLElement} element - 要加载的元素
     */
    loadElement(element) {
        const elementData = this.state.observedElements.get(element);
        if (!elementData) {
            return;
        }

        this.handleElementVisible(element);
    }

    /**
     * 添加新的懒加载元素
     * @param {HTMLElement} element - 新元素
     */
    addElement(element) {
        this.observeElement(element);
    }

    /**
     * 销毁懒加载器
     */
    destroy() {
        if (this.state.observer) {
            this.state.observer.disconnect();
            this.state.observer = null;
        }

        this.state.observedElements.clear();
        this.state.pendingElements.clear();
        this.state.loadedElements.clear();

        console.log('LazyLoader: 已销毁');
    }
}

// 全局导出
if (typeof window !== 'undefined') {
    window.LazyLoader = LazyLoader;
}

export default LazyLoader;