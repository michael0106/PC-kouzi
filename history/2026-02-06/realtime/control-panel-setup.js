/**
 * 设置实时更新控制面板
 */
function setupRealtimeControlPanel() {
    console.log('正在设置实时更新控制面板...');
    
    // 获取DOM元素
    const togglePollingBtn = document.getElementById('toggle-polling');
    const manualRefreshBtn = document.getElementById('manual-refresh');
    const toggleDemoBtn = document.getElementById('toggle-demo');
    const resetStatsBtn = document.getElementById('reset-stats');
    const clearLogBtn = document.getElementById('clear-log');
    
    // 更新状态显示
    function updateStatusIndicators(isPolling) {
        const engineStatus = document.getElementById('engine-status');
        if (engineStatus) {
            engineStatus.textContent = isPolling ? '运行中' : '待机';
            engineStatus.className = `status-badge engine-status ${isPolling ? 'active' : ''}`;
        }
        
        const toggleBtn = document.getElementById('toggle-polling');
        if (toggleBtn) {
            toggleBtn.textContent = isPolling ? '停止轮询' : '启动轮询';
            toggleBtn.className = `btn ${isPolling ? 'btn-warning' : 'btn-primary'}`;
        }
    }
    
    // 更新网络状态
    function updateNetworkStatus(isOnline) {
        const networkStatus = document.getElementById('network-status');
        if (networkStatus) {
            networkStatus.textContent = isOnline ? '在线' : '离线';
            networkStatus.className = `status-badge network-status ${isOnline ? 'online' : 'offline'}`;
        }
    }
    
    // 添加控制面板日志
    function addControlPanelLog(message, type = 'info') {
        const logContent = document.getElementById('update-log');
        if (!logContent) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `${timestamp} - ${message}`;
        
        logContent.prepend(logEntry);
        
        // 限制日志条目数量
        const maxLogEntries = 20;
        if (logContent.children.length > maxLogEntries) {
            for (let i = maxLogEntries; i < logContent.children.length; i++) {
                logContent.removeChild(logContent.children[i]);
            }
        }
    }
    
    // 更新控制面板统计信息
    function updateControlPanelStats(engineState) {
        const pollingCountEl = document.getElementById('polling-count');
        const updateSuccessEl = document.getElementById('update-success');
        const updateFailuresEl = document.getElementById('update-failures');
        const avgLatencyEl = document.getElementById('avg-latency');
        
        if (engineState) {
            if (pollingCountEl) {
                pollingCountEl.textContent = engineState.stats.totalUpdates || 0;
            }
            
            if (updateSuccessEl) {
                updateSuccessEl.textContent = engineState.stats.successfulUpdates || 0;
            }
            
            if (updateFailuresEl) {
                updateFailuresEl.textContent = engineState.stats.failedUpdates || 0;
            }
            
            if (avgLatencyEl && engineState.modules?.performance?.averagePollDuration) {
                avgLatencyEl.textContent = `${engineState.modules.performance.averagePollDuration.toFixed(0)}ms`;
            }
        }
    }
    
    // 事件监听器
    if (togglePollingBtn) {
        togglePollingBtn.addEventListener('click', () => {
            // 查找实时引擎实例
            if (window.realtimeEngine) {
                const state = window.realtimeEngine.getState();
                if (state.isActive) {
                    window.realtimeEngine.stopPolling();
                    addControlPanelLog('轮询已停止', 'warning');
                } else {
                    window.realtimeEngine.startPolling();
                    addControlPanelLog('轮询已启动', 'success');
                }
                updateStatusIndicators(!state.isActive);
            } else {
                addControlPanelLog('实时引擎未找到', 'error');
            }
        });
    }
    
    if (manualRefreshBtn) {
        manualRefreshBtn.addEventListener('click', () => {
            if (window.realtimeEngine) {
                addControlPanelLog('执行手动刷新...', 'info');
                window.realtimeEngine.manualRefresh().catch(error => {
                    addControlPanelLog(`手动刷新失败: ${error.message}`, 'error');
                });
            } else {
                addControlPanelLog('实时引擎未找到', 'error');
            }
        });
    }
    
    if (toggleDemoBtn) {
        toggleDemoBtn.addEventListener('click', () => {
            if (window.realtimeDemo) {
                const demoState = window.realtimeDemo.getState();
                if (demoState.isActive) {
                    window.realtimeDemo.stopDemo();
                    toggleDemoBtn.textContent = '启动演示';
                    addControlPanelLog('演示模式已停止', 'warning');
                } else {
                    window.realtimeDemo.startDemo();
                    toggleDemoBtn.textContent = '停止演示';
                    addControlPanelLog('演示模式已启动', 'success');
                }
            } else {
                addControlPanelLog('演示实例未找到', 'error');
            }
        });
    }
    
    if (resetStatsBtn) {
        resetStatsBtn.addEventListener('click', () => {
            // 重置统计显示
            document.getElementById('polling-count').textContent = '0';
            document.getElementById('update-success').textContent = '0';
            document.getElementById('update-failures').textContent = '0';
            document.getElementById('avg-latency').textContent = '0ms';
            
            addControlPanelLog('统计信息已重置', 'info');
        });
    }
    
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => {
            const logContent = document.getElementById('update-log');
            if (logContent) {
                logContent.innerHTML = '<div class="log-entry log-info">日志已清空</div>';
            }
        });
    }
    
    // 监听网络状态变化
    window.addEventListener('online', () => {
        updateNetworkStatus(true);
        addControlPanelLog('网络恢复: 在线', 'success');
    });
    
    window.addEventListener('offline', () => {
        updateNetworkStatus(false);
        addControlPanelLog('网络中断: 离线', 'warning');
    });
    
    // 监听引擎事件
    document.addEventListener('realtime-update', (event) => {
        const detail = event.detail;
        updateControlPanelStats(detail.engineState);
        
        if (detail.changes.hasChanges) {
            if (detail.changes.added.length > 0) {
                addControlPanelLog(`新增${detail.changes.added.length}条洞察`, 'success');
            }
            if (detail.changes.updated.length > 0) {
                addControlPanelLog(`更新${detail.changes.updated.length}条洞察`, 'warning');
            }
        }
    });
    
    // 初始状态更新
    updateStatusIndicators(false);
    updateNetworkStatus(navigator.onLine);
    
    // 添加到全局对象
    window.controlPanel = {
        updateStatus: updateStatusIndicators,
        updateNetwork: updateNetworkStatus,
        addLog: addControlPanelLog,
        updateStats: updateControlPanelStats
    };
    
    addControlPanelLog('控制面板已初始化', 'info');
    console.log('实时更新控制面板设置完成');
}