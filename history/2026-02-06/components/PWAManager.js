/**
 * PWA管理器组件
 * 管理Service Worker注册、更新检测和离线状态管理
 * 
 * @class PWAManager
 */

class PWAManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.serviceWorkerPath - Service Worker文件路径
     * @param {Object} options.manifest - Web App Manifest配置
     * @param {boolean} options.enableOfflineDetection - 是否启用离线检测
     * @param {Function} options.onUpdateAvailable - 更新可用回调
     * @param {Function} options.onOfflineStatusChange - 离线状态变化回调
     */
    constructor(options = {}) {
        this.options = {
            serviceWorkerPath: options.serviceWorkerPath || '/service-worker.js',
            manifest: options.manifest || null,
            enableOfflineDetection: options.enableOfflineDetection !== false,
            onUpdateAvailable: options.onUpdateAvailable || null,
            onOfflineStatusChange: options.onOfflineStatusChange || null
        };

        this.state = {
            isOnline: navigator.onLine,
            isServiceWorkerRegistered: false,
            isUpdateAvailable: false,
            registration: null,
            waitingServiceWorker: null
        };

        this.init();
    }

    /**
     * 初始化PWA管理器
     */
    async init() {
        // 设置Web App Manifest
        this.setupManifest();
        
        // 检测离线状态
        this.setupOfflineDetection();
        
        // 注册Service Worker
        await this.registerServiceWorker();
        
        // 检测更新
        this.setupUpdateDetection();
    }

    /**
     * 设置Web App Manifest
     */
    setupManifest() {
        if (this.options.manifest) {
            // 动态创建manifest链接
            const manifestLink = document.createElement('link');
            manifestLink.rel = 'manifest';
            manifestLink.href = this.createManifestUrl();
            document.head.appendChild(manifestLink);
        }
    }

    /**
     * 创建Manifest URL
     * @returns {string} Manifest URL
     */
    createManifestUrl() {
        const manifest = this.options.manifest;
        
        // 为简单起见，创建一个对象URL
        const manifestBlob = new Blob([JSON.stringify(manifest)], {
            type: 'application/manifest+json'
        });
        
        return URL.createObjectURL(manifestBlob);
    }

    /**
     * 设置离线检测
     */
    setupOfflineDetection() {
        if (this.options.enableOfflineDetection) {
            window.addEventListener('online', () => {
                this.handleOnline();
            });
            
            window.addEventListener('offline', () => {
                this.handleOffline();
            });
        }
    }

    /**
     * 注册Service Worker
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register(
                    this.options.serviceWorkerPath,
                    {
                        scope: '/',
                        updateViaCache: 'none'
                    }
                );
                
                this.state.registration = registration;
                this.state.isServiceWorkerRegistered = true;
                
                console.log('ServiceWorker注册成功，作用域:', registration.scope);
                
                // 监听更新
                registration.addEventListener('updatefound', () => {
                    this.handleUpdateFound(registration);
                });
                
            } catch (error) {
                console.error('ServiceWorker注册失败:', error);
            }
        } else {
            console.warn('当前浏览器不支持Service Worker');
        }
    }

    /**
     * 设置更新检测
     */
    setupUpdateDetection() {
        if (this.state.registration) {
            // 检查是否有等待中的Service Worker
            if (this.state.registration.waiting) {
                this.handleWaitingServiceWorker(this.state.registration.waiting);
            }
            
            // 监听Service Worker状态变化
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                this.handleControllerChange();
            });
        }
    }

    /**
     * 处理在线状态
     */
    handleOnline() {
        this.state.isOnline = true;
        
        if (this.options.onOfflineStatusChange) {
            this.options.onOfflineStatusChange(true);
        }
        
        this.emitOnlineStatusChange(true);
        
        // 通知用户网络已恢复
        this.showOnlineNotification();
    }

    /**
     * 处理离线状态
     */
    handleOffline() {
        this.state.isOnline = false;
        
        if (this.options.onOfflineStatusChange) {
            this.options.onOfflineStatusChange(false);
        }
        
        this.emitOnlineStatusChange(false);
        
        // 通知用户网络已断开
        this.showOfflineNotification();
    }

    /**
     * 处理更新发现
     * @param {ServiceWorkerRegistration} registration - Service Worker注册对象
     */
    handleUpdateFound(registration) {
        const newWorker = registration.installing;
        
        if (newWorker) {
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // 新版本可用
                    this.handleUpdateAvailable(newWorker);
                }
            });
        }
    }

    /**
     * 处理更新可用
     * @param {ServiceWorker} newWorker - 新的Service Worker
     */
    handleUpdateAvailable(newWorker) {
        this.state.isUpdateAvailable = true;
        this.state.waitingServiceWorker = newWorker;
        
        if (this.options.onUpdateAvailable) {
            this.options.onUpdateAvailable(newWorker);
        }
        
        this.emitUpdateAvailableEvent(newWorker);
        
        // 显示更新提示
        this.showUpdateNotification();
    }

    /**
     * 处理等待中的Service Worker
     * @param {ServiceWorker} waitingWorker - 等待中的Service Worker
     */
    handleWaitingServiceWorker(waitingWorker) {
        this.state.isUpdateAvailable = true;
        this.state.waitingServiceWorker = waitingWorker;
        
        this.emitUpdateAvailableEvent(waitingWorker);
    }

    /**
     * 处理控制器变化
     */
    handleControllerChange() {
        // 当新的Service Worker接管控制时，刷新页面以加载新版本
        window.location.reload();
    }

    /**
     * 应用更新
     */
    applyUpdate() {
        if (this.state.waitingServiceWorker) {
            // 发送跳过等待的消息
            this.state.waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    }

    /**
     * 检查更新
     */
    async checkForUpdates() {
        if (this.state.registration) {
            try {
                const newRegistration = await this.state.registration.update();
                
                if (newRegistration.waiting) {
                    this.handleWaitingServiceWorker(newRegistration.waiting);
                }
                
                return {
                    hasUpdate: !!newRegistration.waiting,
                    registration: newRegistration
                };
                
            } catch (error) {
                console.error('检查更新失败:', error);
                return { hasUpdate: false, error };
            }
        }
        
        return { hasUpdate: false };
    }

    /**
     * 显示在线通知
     */
    showOnlineNotification() {
        // 创建在线提示
        this.showStatusNotification('网络已恢复', 'success');
    }

    /**
     * 显示离线通知
     */
    showOfflineNotification() {
        // 创建离线提示
        this.showStatusNotification('网络已断开，部分功能可能受限', 'warning');
    }

    /**
     * 显示更新通知
     */
    showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">🔄</div>
                <div class="notification-text">
                    <div class="notification-title">新版本可用</div>
                    <div class="notification-description">点击刷新页面以应用更新</div>
                </div>
                <button class="notification-button" id="apply-update">刷新</button>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            overflow: hidden;
        `;
        
        const contentStyle = `
            display: flex;
            align-items: center;
            padding: 16px;
            gap: 12px;
        `;
        
        const textStyle = `
            flex: 1;
            min-width: 0;
        `;
        
        const titleStyle = `
            font-weight: 600;
            font-size: 14px;
            color: #333;
            margin-bottom: 4px;
        `;
        
        const descriptionStyle = `
            font-size: 12px;
            color: #666;
            line-height: 1.4;
        `;
        
        const buttonStyle = `
            background: #007aff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.3s;
            white-space: nowrap;
        `;
        
        const notificationContent = notification.querySelector('.notification-content');
        const notificationText = notification.querySelector('.notification-text');
        const notificationButton = notification.querySelector('.notification-button');
        
        notificationContent.style.cssText = contentStyle;
        notificationText.style.cssText = textStyle;
        notification.querySelector('.notification-title').style.cssText = titleStyle;
        notification.querySelector('.notification-description').style.cssText = descriptionStyle;
        notificationButton.style.cssText = buttonStyle;
        
        // 添加CSS动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .update-notification {
                transition: transform 0.3s ease, opacity 0.3s ease;
            }
            
            .update-notification.hiding {
                transform: translateX(100%);
                opacity: 0;
            }
        `;
        document.head.appendChild(style);
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 绑定按钮事件
        notificationButton.addEventListener('click', () => {
            this.applyUpdate();
            this.hideNotification(notification);
        });
        
        // 5秒后自动隐藏
        setTimeout(() => {
            this.hideNotification(notification);
        }, 5000);
    }

    /**
     * 显示状态通知
     * @param {string} message - 消息内容
     * @param {string} type - 通知类型 ('success' | 'warning' | 'error')
     */
    showStatusNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `status-notification status-${type}`;
        notification.textContent = message;
        
        const typeStyles = {
            success: {
                background: 'rgba(30, 132, 73, 0.9)',
                color: 'white'
            },
            warning: {
                background: 'rgba(243, 156, 18, 0.9)',
                color: 'white'
            },
            error: {
                background: 'rgba(192, 57, 43, 0.9)',
                color: 'white'
            },
            info: {
                background: 'rgba(26, 60, 139, 0.9)',
                color: 'white'
            }
        };
        
        const style = typeStyles[type] || typeStyles.info;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            backdrop-filter: blur(10px);
            background: ${style.background};
            color: ${style.color};
            font-weight: 500;
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
        
        // 添加CSS动画
        if (!document.querySelector('#notification-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'notification-styles';
            styleSheet.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(styleSheet);
        }
    }

    /**
     * 隐藏通知
     * @param {HTMLElement} notification - 通知元素
     */
    hideNotification(notification) {
        notification.classList.add('hiding');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    /**
     * 发射在线状态变化事件
     * @param {boolean} isOnline - 是否在线
     */
    emitOnlineStatusChange(isOnline) {
        const event = new CustomEvent('pwaonlinestatuschange', {
            detail: {
                isOnline,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * 发射更新可用事件
     * @param {ServiceWorker} newWorker - 新的Service Worker
     */
    emitUpdateAvailableEvent(newWorker) {
        const event = new CustomEvent('pwaupdateavailable', {
            detail: {
                newWorker,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * 获取当前状态
     * @returns {Object} 状态对象
     */
    getState() {
        return {
            ...this.state,
            canInstall: this.canInstallPWA()
        };
    }

    /**
     * 检查是否可以安装PWA
     * @returns {boolean} 是否可以安装
     */
    canInstallPWA() {
        return !window.matchMedia('(display-mode: standalone)').matches &&
               'BeforeInstallPromptEvent' in window;
    }

    /**
     * 请求安装PWA
     */
    async installPWA() {
        if (this.canInstallPWA()) {
            // 触发安装提示
            window.dispatchEvent(new Event('beforeinstallprompt'));
        }
    }

    /**
     * 添加安装提示监听
     * @param {Function} callback - 安装提示回调
     */
    addInstallPromptListener(callback) {
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            
            if (callback) {
                callback(event);
            }
            
            // 可以在这里显示自定义的安装提示
            this.showInstallPrompt(event);
        });
    }

    /**
     * 显示安装提示
     * @param {Event} event - beforeinstallprompt事件
     */
    showInstallPrompt(event) {
        const installPrompt = document.createElement('div');
        installPrompt.className = 'install-prompt';
        
        installPrompt.innerHTML = `
            <div class="prompt-content">
                <div class="prompt-icon">📱</div>
                <div class="prompt-text">
                    <div class="prompt-title">安装金融情报应用</div>
                    <div class="prompt-description">添加到主屏幕，获得更好的体验</div>
                </div>
                <button class="prompt-button" id="install-app">安装</button>
                <button class="prompt-button secondary" id="dismiss-prompt">稍后</button>
            </div>
        `;
        
        // 样式和动画...
        
        document.body.appendChild(installPrompt);
        
        // 绑定按钮事件
        const installButton = installPrompt.querySelector('#install-app');
        const dismissButton = installPrompt.querySelector('#dismiss-prompt');
        
        installButton.addEventListener('click', async () => {
            try {
                await event.prompt();
                console.log('用户已接受安装提示');
            } catch (error) {
                console.error('安装失败:', error);
            }
            
            this.hideNotification(installPrompt);
        });
        
        dismissButton.addEventListener('click', () => {
            this.hideNotification(installPrompt);
        });
    }

    /**
     * 销毁管理器
     */
    destroy() {
        // 移除事件监听器
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        
        // 清理Service Worker
        if (this.state.registration) {
            this.state.registration.unregister();
        }
        
        // 清理引用
        this.state.registration = null;
        this.state.waitingServiceWorker = null;
    }
}

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAManager;
} else {
    window.PWAManager = PWAManager;
}