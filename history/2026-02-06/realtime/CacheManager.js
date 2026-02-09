/**
 * 智能缓存管理器
 * 实现本地缓存管理，支持JSON数据、图片资源缓存和存储空间管理
 * 
 * @class CacheManager
 */
class CacheManager {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.cacheName - 缓存名称（默认'financial-insights-v1'）
     * @param {number} options.maxSizeMB - 最大缓存大小（MB，默认50）
     * @param {number} options.defaultTTL - 默认缓存时间（毫秒，默认5分钟）
     * @param {Object} options.storage - 存储配置
     * @param {boolean} options.enableMemoryCache - 是否启用内存缓存（默认true）
     * @param {boolean} options.enableIndexedDB - 是否启用IndexedDB（默认true）
     * @param {boolean} options.enableServiceWorker - 是否启用Service Worker缓存（默认false）
     */
    constructor(options = {}) {
        this.options = {
            cacheName: options.cacheName || 'financial-insights-v1',
            maxSizeMB: options.maxSizeMB || 50,
            defaultTTL: options.defaultTTL || 5 * 60 * 1000, // 5分钟
            storage: {
                memory: options.storage?.memory !== false,
                indexedDB: options.storage?.indexedDB !== false,
                serviceWorker: options.storage?.serviceWorker || false
            },
            enableMemoryCache: options.enableMemoryCache !== false,
            enableIndexedDB: options.enableIndexedDB !== false,
            enableServiceWorker: options.enableServiceWorker || false,
            cleanupInterval: options.cleanupInterval || 10 * 60 * 1000 // 10分钟清理一次
        };

        this.state = {
            isInitialized: false,
            currentSize: 0,
            itemCount: 0,
            lastCleanup: null,
            memoryCache: new Map(),
            indexedDB: null
        };

        this.init();
    }

    /**
     * 初始化缓存管理器
     * @returns {Promise} 初始化完成的Promise
     */
    async init() {
        try {
            // 初始化IndexedDB
            if (this.options.enableIndexedDB && 'indexedDB' in window) {
                await this.initIndexedDB();
            }

            // 初始化Service Worker缓存
            if (this.options.enableServiceWorker && 'serviceWorker' in navigator) {
                await this.initServiceWorkerCache();
            }

            // 计算当前缓存大小
            await this.calculateCacheSize();

            // 设置定期清理
            this.setupCleanupInterval();

            this.state.isInitialized = true;
            console.log('缓存管理器初始化完成');
        } catch (error) {
            console.error('缓存管理器初始化失败:', error);
        }
    }

    /**
     * 初始化IndexedDB
     * @returns {Promise} IndexedDB初始化完成的Promise
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.options.cacheName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.state.indexedDB = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建对象存储
                if (!db.objectStoreNames.contains('cache')) {
                    const store = db.createObjectStore('cache', { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('size', 'size', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    /**
     * 初始化Service Worker缓存
     * @returns {Promise} Service Worker注册完成的Promise
     */
    async initServiceWorkerCache() {
        try {
            // 注册Service Worker
            const registration = await navigator.serviceWorker.register('/sw.js');
            
            // 等待Service Worker激活
            await navigator.serviceWorker.ready;
            
            console.log('Service Worker缓存已启用');
        } catch (error) {
            console.warn('Service Worker缓存启用失败:', error);
        }
    }

    /**
     * 设置定期清理间隔
     */
    setupCleanupInterval() {
        setInterval(() => {
            this.cleanupExpiredCache();
        }, this.options.cleanupInterval);
    }

    /**
     * 计算缓存大小
     * @returns {Promise} 计算完成的Promise
     */
    async calculateCacheSize() {
        let totalSize = 0;
        let totalCount = 0;

        // 计算内存缓存大小
        if (this.options.enableMemoryCache) {
            this.state.memoryCache.forEach((item, key) => {
                totalSize += this.estimateSize(item);
                totalCount++;
            });
        }

        // 计算IndexedDB缓存大小（估算）
        if (this.state.indexedDB) {
            const transaction = this.state.indexedDB.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const countRequest = store.count();
            
            await new Promise((resolve, reject) => {
                countRequest.onsuccess = () => {
                    totalCount += countRequest.result;
                    // 估算每个条目平均大小（粗略估计）
                    totalSize += countRequest.result * 1024; // 假设平均1KB
                    resolve();
                };
                countRequest.onerror = reject;
            });
        }

        this.state.currentSize = totalSize;
        this.state.itemCount = totalCount;
    }

    /**
     * 估计对象大小（粗略估计）
     * @param {*} obj - 对象
     * @returns {number} 估计大小（字节）
     */
    estimateSize(obj) {
        const str = JSON.stringify(obj);
        return new Blob([str]).size;
    }

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {*} value - 缓存值
     * @param {Object} options - 缓存选项
     * @param {number} options.ttl - 缓存时间（毫秒）
     * @param {string} options.type - 缓存类型（'json'|'image'|'html'）
     * @param {number} options.priority - 缓存优先级（1-10）
     * @returns {Promise} 缓存设置完成的Promise
     */
    async set(key, value, options = {}) {
        if (!this.state.isInitialized) {
            await this.init();
        }

        const cacheItem = {
            key,
            value,
            timestamp: Date.now(),
            ttl: options.ttl || this.options.defaultTTL,
            type: options.type || 'json',
            priority: options.priority || 5,
            size: this.estimateSize(value)
        };

        try {
            // 检查缓存空间
            if (await this.isStorageFull(cacheItem.size)) {
                await this.makeSpace(cacheItem.size);
            }

            // 存储到内存缓存
            if (this.options.enableMemoryCache) {
                this.state.memoryCache.set(key, cacheItem);
            }

            // 存储到IndexedDB
            if (this.state.indexedDB) {
                await this.storeInIndexedDB(cacheItem);
            }

            // 存储到Service Worker缓存（针对特定类型）
            if (this.options.enableServiceWorker && 
                (cacheItem.type === 'image' || cacheItem.type === 'html')) {
                await this.storeInServiceWorkerCache(key, value);
            }

            // 更新统计
            this.state.currentSize += cacheItem.size;
            this.state.itemCount++;

            return true;
        } catch (error) {
            console.error(`缓存设置失败 (key: ${key}):`, error);
            return false;
        }
    }

    /**
     * 获取缓存
     * @param {string} key - 缓存键
     * @returns {Promise} 缓存值或null
     */
    async get(key) {
        if (!this.state.isInitialized) {
            await this.init();
        }

        // 首先检查内存缓存
        if (this.options.enableMemoryCache) {
            const memoryItem = this.state.memoryCache.get(key);
            if (memoryItem && !this.isExpired(memoryItem)) {
                // 更新访问时间
                memoryItem.lastAccessed = Date.now();
                return memoryItem.value;
            }
        }

        // 检查IndexedDB
        if (this.state.indexedDB) {
            try {
                const dbItem = await this.getFromIndexedDB(key);
                if (dbItem && !this.isExpired(dbItem)) {
                    // 更新到内存缓存
                    if (this.options.enableMemoryCache) {
                        dbItem.lastAccessed = Date.now();
                        this.state.memoryCache.set(key, dbItem);
                    }
                    
                    // 更新最后访问时间
                    await this.updateLastAccessed(key);
                    
                    return dbItem.value;
                }
            } catch (error) {
                console.warn(`从IndexedDB获取缓存失败 (key: ${key}):`, error);
            }
        }

        return null;
    }

    /**
     * 删除缓存
     * @param {string} key - 缓存键
     * @returns {Promise} 删除完成的Promise
     */
    async delete(key) {
        // 从内存缓存删除
        if (this.options.enableMemoryCache && this.state.memoryCache.has(key)) {
            const item = this.state.memoryCache.get(key);
            this.state.currentSize -= item.size;
            this.state.itemCount--;
            this.state.memoryCache.delete(key);
        }

        // 从IndexedDB删除
        if (this.state.indexedDB) {
            await this.deleteFromIndexedDB(key);
        }

        // 从Service Worker缓存删除
        if (this.options.enableServiceWorker) {
            await this.deleteFromServiceWorkerCache(key);
        }

        return true;
    }

    /**
     * 清空缓存
     * @returns {Promise} 清空完成的Promise
     */
    async clear() {
        // 清空内存缓存
        if (this.options.enableMemoryCache) {
            this.state.memoryCache.clear();
        }

        // 清空IndexedDB
        if (this.state.indexedDB) {
            const transaction = this.state.indexedDB.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            await store.clear();
        }

        // 清空Service Worker缓存
        if (this.options.enableServiceWorker) {
            const cache = await caches.open(this.options.cacheName);
            await cache.keys().then(keys => {
                return Promise.all(keys.map(key => cache.delete(key)));
            });
        }

        // 重置统计
        this.state.currentSize = 0;
        this.state.itemCount = 0;

        return true;
    }

    /**
     * 检查缓存是否过期
     * @param {Object} cacheItem - 缓存项
     * @returns {boolean} 是否过期
     */
    isExpired(cacheItem) {
        const now = Date.now();
        return now - cacheItem.timestamp > cacheItem.ttl;
    }

    /**
     * 检查存储空间是否已满
     * @param {number} additionalSize - 需要添加的大小（字节）
     * @returns {Promise<boolean>} 是否已满
     */
    async isStorageFull(additionalSize = 0) {
        const maxSizeBytes = this.options.maxSizeMB * 1024 * 1024;
        return (this.state.currentSize + additionalSize) > maxSizeBytes;
    }

    /**
     * 清理过期缓存
     * @returns {Promise} 清理完成的Promise
     */
    async cleanupExpiredCache() {
        const now = Date.now();
        let cleanedCount = 0;
        let cleanedSize = 0;

        // 清理内存缓存
        if (this.options.enableMemoryCache) {
            for (const [key, item] of this.state.memoryCache) {
                if (this.isExpired(item)) {
                    cleanedSize += item.size;
                    cleanedCount++;
                    this.state.memoryCache.delete(key);
                }
            }
        }

        // 清理IndexedDB缓存
        if (this.state.indexedDB) {
            const transaction = this.state.indexedDB.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const index = store.index('timestamp');
            
            const range = IDBKeyRange.upperBound(now - this.options.defaultTTL);
            const request = index.openCursor(range);
            
            await new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cleanedSize += cursor.value.size;
                        cleanedCount++;
                        store.delete(cursor.primaryKey);
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                request.onerror = reject;
            });
        }

        // 更新统计
        this.state.currentSize -= cleanedSize;
        this.state.itemCount -= cleanedCount;
        this.state.lastCleanup = now;

        if (cleanedCount > 0) {
            console.log(`清理过期缓存: ${cleanedCount}项, ${(cleanedSize / 1024).toFixed(2)}KB`);
        }

        return { cleanedCount, cleanedSize };
    }

    /**
     * 腾出存储空间
     * @param {number} requiredSize - 需要的大小（字节）
     * @returns {Promise} 空间腾出完成的Promise
     */
    async makeSpace(requiredSize) {
        const maxSizeBytes = this.options.maxSizeMB * 1024 * 1024;
        const targetSize = maxSizeBytes * 0.7; // 清理到70%
        
        if (this.state.currentSize + requiredSize <= targetSize) {
            return;
        }

        console.log(`需要腾出存储空间: ${(requiredSize / 1024).toFixed(2)}KB`);

        // 策略1: 清理过期缓存
        await this.cleanupExpiredCache();

        // 策略2: 清理低优先级缓存
        if (this.state.currentSize + requiredSize > targetSize) {
            await this.cleanupLowPriorityItems();
        }

        // 策略3: 清理最旧未访问的缓存
        if (this.state.currentSize + requiredSize > targetSize) {
            await this.cleanupOldestItems();
        }
    }

    /**
     * 清理低优先级缓存项
     * @returns {Promise} 清理完成的Promise
     */
    async cleanupLowPriorityItems() {
        if (!this.state.indexedDB) return;

        const transaction = this.state.indexedDB.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        const index = store.index('priority');
        
        // 清理优先级1-3的项
        const range = IDBKeyRange.bound(1, 3);
        const request = index.openCursor(range);
        
        let cleanedCount = 0;
        let cleanedSize = 0;
        
        await new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cleanedSize += cursor.value.size;
                    cleanedCount++;
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = reject;
        });

        // 更新内存缓存
        if (this.options.enableMemoryCache) {
            for (const [key, item] of this.state.memoryCache) {
                if (item.priority >= 1 && item.priority <= 3) {
                    this.state.memoryCache.delete(key);
                }
            }
        }

        // 更新统计
        this.state.currentSize -= cleanedSize;
        this.state.itemCount -= cleanedCount;

        if (cleanedCount > 0) {
            console.log(`清理低优先级缓存: ${cleanedCount}项, ${(cleanedSize / 1024).toFixed(2)}KB`);
        }
    }

    /**
     * 清理最旧未访问的缓存项
     * @returns {Promise} 清理完成的Promise
     */
    async cleanupOldestItems() {
        if (!this.state.indexedDB) return;

        const transaction = this.state.indexedDB.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        const timestampIndex = store.index('timestamp');
        
        // 按时间戳排序，获取最旧的项
        const request = timestampIndex.openCursor();
        
        let cleanedCount = 0;
        let cleanedSize = 0;
        const maxSizeBytes = this.options.maxSizeMB * 1024 * 1024;
        const targetSize = maxSizeBytes * 0.7;
        
        await new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && this.state.currentSize > targetSize) {
                    cleanedSize += cursor.value.size;
                    cleanedCount++;
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = reject;
        });

        // 更新统计
        this.state.currentSize -= cleanedSize;
        this.state.itemCount -= cleanedCount;

        if (cleanedCount > 0) {
            console.log(`清理最旧缓存: ${cleanedCount}项, ${(cleanedSize / 1024).toFixed(2)}KB`);
        }
    }

    /**
     * 存储到IndexedDB
     * @param {Object} cacheItem - 缓存项
     * @returns {Promise} 存储完成的Promise
     */
    async storeInIndexedDB(cacheItem) {
        return new Promise((resolve, reject) => {
            const transaction = this.state.indexedDB.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            
            const request = store.put(cacheItem);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 从IndexedDB获取
     * @param {string} key - 缓存键
     * @returns {Promise} 缓存项或null
     */
    async getFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.state.indexedDB.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 从IndexedDB删除
     * @param {string} key - 缓存键
     * @returns {Promise} 删除完成的Promise
     */
    async deleteFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.state.indexedDB.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            
            const request = store.delete(key);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 更新最后访问时间
     * @param {string} key - 缓存键
     * @returns {Promise} 更新完成的Promise
     */
    async updateLastAccessed(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.state.indexedDB.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            
            const getRequest = store.get(key);
            
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    item.lastAccessed = Date.now();
                    const updateRequest = store.put(item);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve();
                }
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * 存储到Service Worker缓存
     * @param {string} key - 缓存键
     * @param {*} value - 缓存值
     * @returns {Promise} 存储完成的Promise
     */
    async storeInServiceWorkerCache(key, value) {
        try {
            const cache = await caches.open(this.options.cacheName);
            
            let response;
            if (value instanceof Response) {
                response = value;
            } else if (typeof value === 'string') {
                response = new Response(value, {
                    headers: { 'Content-Type': 'text/html' }
                });
            } else {
                response = new Response(JSON.stringify(value), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            await cache.put(key, response);
        } catch (error) {
            console.warn('Service Worker缓存存储失败:', error);
        }
    }

    /**
     * 从Service Worker缓存删除
     * @param {string} key - 缓存键
     * @returns {Promise} 删除完成的Promise
     */
    async deleteFromServiceWorkerCache(key) {
        try {
            const cache = await caches.open(this.options.cacheName);
            await cache.delete(key);
        } catch (error) {
            // 忽略删除错误
        }
    }

    /**
     * 获取缓存统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            isInitialized: this.state.isInitialized,
            currentSize: this.state.currentSize,
            currentSizeMB: (this.state.currentSize / (1024 * 1024)).toFixed(2),
            itemCount: this.state.itemCount,
            maxSizeMB: this.options.maxSizeMB,
            lastCleanup: this.state.lastCleanup,
            memoryCacheSize: this.options.enableMemoryCache ? this.state.memoryCache.size : 0
        };
    }

    /**
     * 销毁缓存管理器
     */
    destroy() {
        // 清空内存缓存
        this.state.memoryCache.clear();
        
        // 关闭IndexedDB连接
        if (this.state.indexedDB) {
            this.state.indexedDB.close();
            this.state.indexedDB = null;
        }
        
        this.state.isInitialized = false;
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
} else {
    window.CacheManager = CacheManager;
}