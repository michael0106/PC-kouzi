/**
 * 数据变化检测器
 * 高效对比新旧JSON数据，识别新增、修改、删除的洞察条目
 * 
 * @class ChangeDetector
 */
class ChangeDetector {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {Array} options.keyFields - 用于标识唯一性的字段（默认['id']）
     * @param {Function} options.compareFunction - 自定义比较函数
     * @param {boolean} options.deepCompare - 是否深度比较对象（默认true）
     */
    constructor(options = {}) {
        this.options = {
            keyFields: options.keyFields || ['id'],
            compareFunction: options.compareFunction || null,
            deepCompare: options.deepCompare !== false,
            ignoreFields: options.ignoreFields || ['last_updated', 'generated_at']
        };
    }

    /**
     * 检测数据变化
     * @param {Array} oldData - 旧数据数组
     * @param {Array} newData - 新数据数组
     * @returns {Object} 变化结果
     */
    detectChanges(oldData = [], newData = []) {
        const changes = {
            hasChanges: false,
            added: [],
            updated: [],
            removed: [],
            unchanged: [],
            summary: {
                totalAdded: 0,
                totalUpdated: 0,
                totalRemoved: 0,
                totalUnchanged: 0,
                oldTotal: oldData.length,
                newTotal: newData.length
            }
        };

        try {
            // 构建数据映射
            const oldMap = this.buildDataMap(oldData);
            const newMap = this.buildDataMap(newData);

            // 检测新增和更新的项目
            for (const [key, newItem] of newMap) {
                const oldItem = oldMap.get(key);
                
                if (!oldItem) {
                    changes.added.push({
                        key,
                        data: newItem,
                        position: this.findItemPosition(newData, key)
                    });
                    changes.hasChanges = true;
                } else if (!this.areItemsEqual(oldItem, newItem)) {
                    changes.updated.push({
                        key,
                        old: oldItem,
                        new: newItem,
                        changes: this.getSpecificChanges(oldItem, newItem),
                        position: this.findItemPosition(newData, key)
                    });
                    changes.hasChanges = true;
                } else {
                    changes.unchanged.push({
                        key,
                        data: newItem,
                        position: this.findItemPosition(newData, key)
                    });
                }
            }

            // 检测删除的项目
            for (const [key, oldItem] of oldMap) {
                if (!newMap.has(key)) {
                    changes.removed.push({
                        key,
                        data: oldItem,
                        position: this.findItemPosition(oldData, key)
                    });
                    changes.hasChanges = true;
                }
            }

            // 更新统计信息
            changes.summary.totalAdded = changes.added.length;
            changes.summary.totalUpdated = changes.updated.length;
            changes.summary.totalRemoved = changes.removed.length;
            changes.summary.totalUnchanged = changes.unchanged.length;

            return changes;
        } catch (error) {
            console.error('变化检测失败:', error);
            return {
                hasChanges: false,
                added: [],
                updated: [],
                removed: [],
                unchanged: [],
                summary: {
                    totalAdded: 0,
                    totalUpdated: 0,
                    totalRemoved: 0,
                    totalUnchanged: 0,
                    oldTotal: oldData.length,
                    newTotal: newData.length
                },
                error: error.message
            };
        }
    }

    /**
     * 构建数据映射
     * @param {Array} data - 数据数组
     * @returns {Map} 键值映射
     */
    buildDataMap(data) {
        const map = new Map();
        
        for (const item of data) {
            const key = this.getItemKey(item);
            if (key) {
                map.set(key, item);
            } else {
                console.warn('无法为项目生成唯一键:', item);
            }
        }
        
        return map;
    }

    /**
     * 获取项目唯一键
     * @param {Object} item - 数据项目
     * @returns {string} 唯一键
     */
    getItemKey(item) {
        if (!item) return null;
        
        const keyValues = [];
        for (const field of this.options.keyFields) {
            if (item[field] !== undefined) {
                keyValues.push(item[field]);
            }
        }
        
        return keyValues.join('::');
    }

    /**
     * 比较两个项目是否相等
     * @param {Object} item1 - 第一个项目
     * @param {Object} item2 - 第二个项目
     * @returns {boolean} 是否相等
     */
    areItemsEqual(item1, item2) {
        if (this.options.compareFunction) {
            return this.options.compareFunction(item1, item2);
        }

        if (this.options.deepCompare) {
            return this.deepEqual(item1, item2);
        } else {
            return JSON.stringify(item1) === JSON.stringify(item2);
        }
    }

    /**
     * 深度比较两个对象
     * @param {*} obj1 - 第一个对象
     * @param {*} obj2 - 第二个对象
     * @returns {boolean} 是否相等
     */
    deepEqual(obj1, obj2) {
        if (obj1 === obj2) return true;
        
        if (typeof obj1 !== 'object' || obj1 === null ||
            typeof obj2 !== 'object' || obj2 === null) {
            return false;
        }

        const keys1 = Object.keys(obj1).filter(key => !this.options.ignoreFields.includes(key));
        const keys2 = Object.keys(obj2).filter(key => !this.options.ignoreFields.includes(key));

        if (keys1.length !== keys2.length) return false;

        for (const key of keys1) {
            if (!keys2.includes(key)) return false;
            
            if (!this.deepEqual(obj1[key], obj2[key])) {
                return false;
            }
        }

        return true;
    }

    /**
     * 获取具体变化字段
     * @param {Object} oldItem - 旧项目
     * @param {Object} newItem - 新项目
     * @returns {Array} 变化字段列表
     */
    getSpecificChanges(oldItem, newItem) {
        const changes = [];
        const allKeys = new Set([...Object.keys(oldItem), ...Object.keys(newItem)]);
        
        for (const key of allKeys) {
            if (this.options.ignoreFields.includes(key)) continue;
            
            if (!this.deepEqual(oldItem[key], newItem[key])) {
                changes.push({
                    field: key,
                    oldValue: oldItem[key],
                    newValue: newItem[key],
                    type: typeof oldItem[key]
                });
            }
        }
        
        return changes;
    }

    /**
     * 查找项目位置
     * @param {Array} data - 数据数组
     * @param {string} key - 项目键
     * @returns {number} 位置索引
     */
    findItemPosition(data, key) {
        for (let i = 0; i < data.length; i++) {
            if (this.getItemKey(data[i]) === key) {
                return i;
            }
        }
        return -1;
    }

    /**
     * 快速变化检测（简化版，仅检查是否有变化）
     * @param {Array} oldData - 旧数据
     * @param {Array} newData - 新数据
     * @returns {boolean} 是否有变化
     */
    hasChanges(oldData, newData) {
        if (oldData.length !== newData.length) return true;
        
        const oldMap = this.buildDataMap(oldData);
        const newMap = this.buildDataMap(newData);
        
        // 检查键是否一致
        if (oldMap.size !== newMap.size) return true;
        
        for (const [key, newItem] of newMap) {
            const oldItem = oldMap.get(key);
            if (!oldItem || !this.areItemsEqual(oldItem, newItem)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 计算数据哈希
     * @param {Object} data - 数据对象
     * @returns {string} 哈希值
     */
    computeContentHash(data) {
        const obj = { ...data };
        
        // 移除忽略字段
        for (const field of this.options.ignoreFields) {
            delete obj[field];
        }
        
        // 排序键确保一致性
        const sorted = {};
        Object.keys(obj).sort().forEach(key => {
            sorted[key] = obj[key];
        });
        
        return JSON.stringify(sorted);
    }

    /**
     * 批量检测变化
     * @param {Array} dataSets - 数据集数组 [{old: [], new: []}, ...]
     * @returns {Array} 变化结果数组
     */
    batchDetectChanges(dataSets) {
        return dataSets.map(({ old, current }, index) => ({
            index,
            changes: this.detectChanges(old, current)
        }));
    }

    /**
     * 更新配置
     * @param {Object} newOptions - 新配置
     */
    updateOptions(newOptions) {
        Object.assign(this.options, newOptions);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChangeDetector;
} else {
    window.ChangeDetector = ChangeDetector;
}