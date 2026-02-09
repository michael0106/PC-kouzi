/**
 * Service Worker 实现离线缓存策略
 * 支持缓存优先、网络回退策略，实现PWA离线访问功能
 */

// 缓存名称和版本控制
const CACHE_NAME = 'financial-insights-v1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/css/main.css',
  '/static/js/main.js',
  '/static/images/logo.png'
];

// 动态API缓存配置
const API_CACHE_CONFIG = {
  ttl: 5 * 60 * 1000, // 5分钟
  maxEntries: 50,     // 最大缓存条目数
  prefix: '/api/'     // API路径前缀
};

// 缓存策略：静态资源使用缓存优先，API使用网络优先
const CACHE_STRATEGIES = {
  STATIC: 'cache-first',
  API: 'network-first',
  IMAGES: 'cache-first-with-update'
};

// 安装阶段：预缓存关键静态资源
self.addEventListener('install', event => {
  console.log('ServiceWorker: 安装中...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('ServiceWorker: 预缓存静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('ServiceWorker: 安装完成，跳过等待阶段');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('ServiceWorker: 安装失败:', error);
      })
  );
});

// 激活阶段：清理旧缓存，接管所有客户端
self.addEventListener('activate', event => {
  console.log('ServiceWorker: 激活中...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('ServiceWorker: 清理旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('ServiceWorker: 激活完成，接管所有客户端');
      return self.clients.claim();
    })
  );
});

// 请求拦截：根据请求类型应用不同的缓存策略
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // 跳过非GET请求
  if (request.method !== 'GET') {
    return;
  }
  
  // 跳过浏览器扩展请求
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // 根据请求类型应用不同的策略
  if (url.pathname.startsWith(API_CACHE_CONFIG.prefix)) {
    // API请求：网络优先，缓存回退
    event.respondWith(handleApiRequest(request));
  } else if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
    // 图片请求：缓存优先，后台更新
    event.respondWith(handleImageRequest(request));
  } else {
    // 静态资源：缓存优先，网络回退
    event.respondWith(handleStaticRequest(request));
  }
});

/**
 * 处理API请求（网络优先策略）
 */
async function handleApiRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  try {
    // 优先尝试网络请求
    const networkResponse = await fetch(request);
    
    // 如果网络响应成功，缓存响应
    if (networkResponse.ok) {
      const clone = networkResponse.clone();
      cache.put(request, clone);
      
      // 清理过期的API缓存
      cleanupExpiredApiCache(cache);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('ServiceWorker: API网络请求失败，使用缓存:', error);
    
    // 网络失败时，返回缓存的响应
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 没有缓存时，返回离线页面
    return getOfflineResponse();
  }
}

/**
 * 处理静态资源请求（缓存优先策略）
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // 先尝试从缓存获取
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // 缓存命中，同时后台更新缓存
    updateCacheInBackground(request, cache);
    return cachedResponse;
  }
  
  try {
    // 缓存未命中，尝试网络请求
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // 缓存新资源
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('ServiceWorker: 静态资源网络请求失败:', error);
    
    // 返回离线页面
    return getOfflineResponse();
  }
}

/**
 * 处理图片请求（带更新的缓存优先策略）
 */
async function handleImageRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // 缓存命中，后台检查更新
    updateCacheInBackground(request, cache);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('ServiceWorker: 图片网络请求失败:', error);
    
    // 返回备用图片
    return getFallbackImage();
  }
}

/**
 * 后台更新缓存
 */
async function updateCacheInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      console.log('ServiceWorker: 缓存已后台更新:', request.url);
    }
  } catch (error) {
    // 后台更新失败，不影响主流程
    console.log('ServiceWorker: 后台缓存更新失败:', error);
  }
}

/**
 * 清理过期的API缓存
 */
async function cleanupExpiredApiCache(cache) {
  try {
    const keys = await cache.keys();
    const now = Date.now();
    
    for (const key of keys) {
      const url = new URL(key.url);
      
      // 只处理API请求
      if (url.pathname.startsWith(API_CACHE_CONFIG.prefix)) {
        const response = await cache.match(key);
        
        if (response) {
          const dateHeader = response.headers.get('date');
          if (dateHeader) {
            const cachedTime = new Date(dateHeader).getTime();
            
            if (now - cachedTime > API_CACHE_CONFIG.ttl) {
              console.log('ServiceWorker: 清理过期API缓存:', url.pathname);
              cache.delete(key);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('ServiceWorker: 清理API缓存失败:', error);
  }
}

/**
 * 获取离线响应
 */
async function getOfflineResponse() {
  const cache = await caches.open(CACHE_NAME);
  const offlinePage = await cache.match('/offline.html');
  
  if (offlinePage) {
    return offlinePage;
  }
  
  // 没有离线页面，返回简单的离线提示
  return new Response(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>离线状态</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
          color: #333;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          padding: 20px;
          text-align: center;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          margin: 0 0 10px 0;
          font-size: 24px;
        }
        p {
          margin: 0 0 20px 0;
          color: #666;
          max-width: 400px;
          line-height: 1.5;
        }
        button {
          background: #007aff;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.3s;
        }
        button:hover {
          background: #0056cc;
        }
      </style>
    </head>
    <body>
      <div class="icon">📡</div>
      <h1>网络连接不可用</h1>
      <p>当前处于离线状态，请检查网络连接后重试。</p>
      <button onclick="location.reload()">重新加载</button>
    </body>
    </html>
    `,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    }
  );
}

/**
 * 获取备用图片
 */
async function getFallbackImage() {
  const cache = await caches.open(CACHE_NAME);
  const fallbackImage = await cache.match('/static/images/fallback.png');
  
  if (fallbackImage) {
    return fallbackImage;
  }
  
  // 返回简单的SVG占位符
  return new Response(
    `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="#f0f0f0"/>
      <rect x="50" y="50" width="300" height="200" fill="#e0e0e0"/>
      <text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="20" fill="#999">
        图片加载失败
      </text>
    </svg>
    `,
    {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache'
      }
    }
  );
}

// 监听推送事件
self.addEventListener('push', event => {
  console.log('ServiceWorker: 收到推送消息');
  
  const options = {
    body: event.data?.text() || '新的金融情报洞察已更新',
    icon: '/static/icons/icon-192x192.png',
    badge: '/static/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('金融情报', options)
  );
});

// 监听通知点击事件
self.addEventListener('notificationclick', event => {
  console.log('ServiceWorker: 通知被点击');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // 如果已经打开了窗口，聚焦到该窗口
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      // 否则打开新窗口
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// 监听同步事件
self.addEventListener('sync', event => {
  console.log('ServiceWorker: 收到后台同步事件:', event.tag);
  
  if (event.tag === 'sync-insights') {
    event.waitUntil(syncInsightsData());
  }
});

/**
 * 同步洞察数据
 */
async function syncInsightsData() {
  try {
    console.log('ServiceWorker: 开始同步洞察数据');
    
    // 同步逻辑
    const response = await fetch('/api/insights/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('ServiceWorker: 洞察数据同步成功');
      
      // 发送同步完成消息
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'sync-complete',
          timestamp: Date.now()
        });
      });
    }
  } catch (error) {
    console.error('ServiceWorker: 洞察数据同步失败:', error);
  }
}

// 监听消息事件
self.addEventListener('message', event => {
  console.log('ServiceWorker: 收到消息:', event.data);
  
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      clearCache();
      break;
      
    case 'UPDATE_CACHE':
      updateCache(payload);
      break;
  }
});

/**
 * 清理缓存
 */
async function clearCache() {
  try {
    const keys = await caches.keys();
    
    for (const key of keys) {
      await caches.delete(key);
    }
    
    console.log('ServiceWorker: 缓存已清理');
    
    // 发送清理完成消息
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'clear-cache-complete',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('ServiceWorker: 清理缓存失败:', error);
  }
}

/**
 * 更新缓存
 */
async function updateCache(payload) {
  try {
    const { urls } = payload;
    const cache = await caches.open(CACHE_NAME);
    
    for (const url of urls) {
      const response = await fetch(url);
      
      if (response.ok) {
        cache.put(url, response.clone());
      }
    }
    
    console.log('ServiceWorker: 缓存已更新');
    
    // 发送更新完成消息
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'update-cache-complete',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('ServiceWorker: 更新缓存失败:', error);
  }
}