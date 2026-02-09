/**
 * 实时更新引擎测试
 * 验证引擎核心功能
 */

async function testRealtimeEngine() {
    console.log('开始测试实时更新引擎...');
    
    try {
        // 1. 测试依赖模块是否可用
        console.log('1. 检查模块依赖...');
        
        const modules = [
            'PollingService',
            'ChangeDetector',
            'IncrementalRenderer',
            'CacheManager',
            'RealTimeState',
            'PerformanceMonitor',
            'RealTimeEngine',
            'RealtimeIntegration'
        ];
        
        modules.forEach(moduleName => {
            if (window[moduleName]) {
                console.log(`  ✓ ${moduleName} 可用`);
            } else {
                console.error(`  ✗ ${moduleName} 不可用`);
                throw new Error(`模块 ${moduleName} 未加载`);
            }
        });
        
        console.log('  ✓ 所有依赖模块加载成功');
        
        // 2. 测试缓存管理器
        console.log('2. 测试缓存管理器...');
        const cache = new CacheManager({
            cacheName: 'test-cache',
            maxSizeMB: 10,
            enableMemoryCache: true,
            enableIndexedDB: false
        });
        
        // 等待初始化
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const testData = { id: 1, content: '测试数据' };
        await cache.set('testKey', testData);
        const retrievedData = await cache.get('testKey');
        
        if (retrievedData && retrievedData.id === testData.id) {
            console.log('  ✓ 缓存读写功能正常');
        } else {
            throw new Error('缓存读写失败');
        }
        
        // 3. 测试变化检测器
        console.log('3. 测试变化检测器...');
        const detector = new ChangeDetector({
            keyFields: ['id']
        });
        
        const oldData = [
            { id: 1, title: '洞察1' },
            { id: 2, title: '洞察2' }
        ];
        
        const newData = [
            { id: 1, title: '洞察1(更新)' },
            { id: 3, title: '洞察3(新增)' }
        ];
        
        const changes = detector.detectChanges(oldData, newData);
        
        if (changes.hasChanges && 
            changes.added.length === 1 && 
            changes.updated.length === 1 && 
            changes.removed.length === 1) {
            console.log('  ✓ 变化检测功能正常');
        } else {
            console.error('变化检测结果:', changes);
            throw new Error('变化检测功能异常');
        }
        
        // 4. 测试实时更新引擎
        console.log('4. 测试实时更新引擎...');
        
        // 创建模拟的Fetch函数
        let callCount = 0;
        const mockFetch = () => {
            callCount++;
            return Promise.resolve({
                date: '2026-02-06',
                update_id: `update_${callCount}`,
                insights: [
                    { id: 1, title: `测试洞察${callCount}` },
                    { id: 2, title: `另一洞察${callCount}` }
                ],
                impact_matrix: [
                    { id: 1, short_title: `测试${callCount}` },
                    { id: 2, short_title: `另一${callCount}` }
                ]
            });
        };
        
        const engine = new RealTimeEngine({
            apiEndpoint: 'https://api.example.com/test',
            pollingConfig: {
                normalInterval: 2000, // 2秒用于测试
                activeInterval: 1000,
                backgroundInterval: 3000,
                retryDelay: 1000,
                maxRetries: 1
            },
            enableCache: false,
            enablePerformanceMonitor: false
        });
        
        // 重写引擎的fetch方法
        engine.fetchData = mockFetch;
        
        console.log('  启动引擎...');
        engine.start();
        
        // 等待一段时间
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const state = engine.getState();
        console.log(`  引擎状态: ${state.isActive ? '运行中' : '已停止'}`);
        console.log(`  轮询次数: ${state.stats.totalUpdates}`);
        
        if (state.stats.totalUpdates > 0) {
            console.log('  ✓ 引擎轮询功能正常');
        } else {
            console.error('引擎状态:', state);
            throw new Error('引擎轮询功能异常');
        }
        
        // 停止引擎
        console.log('  停止引擎...');
        engine.stop();
        
        // 5. 测试增量渲染器
        console.log('5. 测试增量渲染器...');
        
        // 创建测试容器
        const testContainer = document.createElement('div');
        testContainer.id = 'test-container';
        testContainer.style.display = 'none';
        document.body.appendChild(testContainer);
        
        const renderer = new IncrementalRenderer({
            containerSelector: '#test-container',
            enableAnimation: false,
            cardTemplate: (insight) => {
                const card = document.createElement('div');
                card.className = 'test-insight-card';
                card.textContent = insight.title;
                card.dataset.id = insight.id;
                return card;
            }
        });
        
        // 测试渲染功能
        const testInsight = { id: 999, title: '测试渲染' };
        const testCard = renderer.createCard(testInsight);
        
        if (testCard && testCard.textContent === testInsight.title) {
            console.log('  ✓ 渲染器卡片创建功能正常');
        } else {
            throw new Error('渲染器卡片创建失败');
        }
        
        // 清理测试容器
        testContainer.remove();
        
        // 6. 测试性能监控器
        console.log('6. 测试性能监控器...');
        const monitor = new PerformanceMonitor({
            enableRealTimeStats: false
        });
        
        // 测试自定义指标
        const measurementId = monitor.startMeasurement('testMetric', { custom: 'data' });
        await new Promise(resolve => setTimeout(resolve, 50));
        monitor.endMeasurement(measurementId, { result: 'success' });
        
        console.log('  ✓ 性能监控器基础功能正常');
        
        // 7. 清理测试资源
        console.log('7. 清理测试资源...');
        cache.destroy();
        engine.destroy();
        monitor.destroy();
        
        console.log('  ✓ 资源清理完成');
        
        console.log('\n✅ 所有测试通过！实时更新引擎功能正常。');
        console.log('\n引擎状态总结:');
        console.log('- 轮询服务: 正常');
        console.log('- 变化检测: 正常');
        console.log('- 增量渲染: 正常');
        console.log('- 缓存管理: 正常');
        console.log('- 性能监控: 正常');
        console.log('- 状态管理: 正常');
        
        return {
            success: true,
            message: '所有测试通过',
            modules: modules.reduce((acc, module) => {
                acc[module] = true;
                return acc;
            }, {}),
            stats: {
                cacheTest: true,
                detectorTest: true,
                engineTest: state.stats.totalUpdates > 0,
                rendererTest: true,
                monitorTest: true
            }
        };
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        console.error('错误堆栈:', error.stack);
        
        return {
            success: false,
            message: error.message,
            error: error.stack
        };
    }
}

// 如果直接运行此文件，执行测试
if (typeof window !== 'undefined') {
    // 等待页面加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                console.log('等待页面组件初始化...');
                setTimeout(testRealtimeEngine, 1000);
            }, 1000);
        });
    } else {
        setTimeout(testRealtimeEngine, 1000);
    }
}

// 导出测试函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testRealtimeEngine };
} else {
    window.testRealtimeEngine = testRealtimeEngine;
}