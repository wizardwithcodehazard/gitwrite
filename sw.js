// ================================
// GitWrite Service Worker
// Provides offline functionality and caching
// ================================

const CACHE_NAME = 'gitwrite-v1';
const STATIC_CACHE = 'gitwrite-static-v1';

// Files to cache for offline functionality
const STATIC_FILES = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './services/github.js'
];

// ================================
// Service Worker Installation
// ================================

self.addEventListener('install', event => {
    console.log('[SW] Installing service worker');
    
    event.waitUntil(
        Promise.all([
            // Cache static files
            caches.open(STATIC_CACHE).then(cache => {
                console.log('[SW] Caching static files');
                return cache.addAll(STATIC_FILES.map(url => {
                    // Handle relative URLs
                    return url.startsWith('/') || url.startsWith('http') 
                        ? url 
                        : `/${url}`;
                }));
            }),
            
            // Skip waiting to activate immediately
            self.skipWaiting()
        ])
    );
});

// ================================
// Service Worker Activation
// ================================

self.addEventListener('activate', event => {
    console.log('[SW] Activating service worker');
    
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => 
                            cacheName !== STATIC_CACHE && 
                            cacheName !== CACHE_NAME
                        )
                        .map(cacheName => {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            }),
            
            // Take control of all pages
            self.clients.claim()
        ])
    );
});

// ================================
// Fetch Event Handler
// ================================

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip GitHub API requests
    if (url.hostname === 'api.github.com') {
        return;
    }
    
    // Handle requests
    event.respondWith(handleFetch(request));
});

// ================================
// Fetch Handling Strategy
// ================================

async function handleFetch(request) {
    const url = new URL(request.url);
    
    try {
        // Strategy: Cache First for static files, Network First for others
        if (isStaticFile(url.pathname)) {
            return await cacheFirst(request);
        } else {
            return await networkFirst(request);
        }
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        
        // Fallback to cached version or offline page
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback for navigation requests
        if (request.mode === 'navigate') {
            const offlineResponse = await caches.match('/index.html');
            if (offlineResponse) {
                return offlineResponse;
            }
        }
        
        // Return a basic offline response
        return new Response(
            'Offline - GitWrite is not available without an internet connection',
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
            }
        );
    }
}

// ================================
// Caching Strategies
// ================================

async function cacheFirst(request) {
    // Check cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Fetch from network and cache
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
}

async function networkFirst(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

// ================================
// Helper Functions
// ================================

function isStaticFile(pathname) {
    const staticExtensions = ['.css', '.js', '.html', '.ico', '.png', '.jpg', '.svg', '.woff', '.woff2'];
    const staticPaths = ['/', '/index.html', '/manifest.json'];
    
    return staticPaths.includes(pathname) || 
           staticExtensions.some(ext => pathname.endsWith(ext));
}

// ================================
// Background Sync (Future Enhancement)
// ================================

self.addEventListener('sync', event => {
    console.log('[SW] Background sync event:', event.tag);
    
    if (event.tag === 'github-sync') {
        event.waitUntil(handleBackgroundSync());
    }
});

async function handleBackgroundSync() {
    // This would communicate with the main app to process sync queue
    // Implementation depends on background sync support
    console.log('[SW] Processing background sync');
    
    try {
        // Send message to all clients to process sync queue
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'BACKGROUND_SYNC',
                data: { action: 'processSyncQueue' }
            });
        });
    } catch (error) {
        console.error('[SW] Background sync failed:', error);
    }
}

// ================================
// Push Notifications (Future Enhancement)
// ================================

self.addEventListener('push', event => {
    console.log('[SW] Push notification received');
    
    const options = {
        body: 'GitWrite has new updates available',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1'
        },
        actions: [
            {
                action: 'explore',
                title: 'Open GitWrite',
                icon: '/icon-192.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icon-192.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('GitWrite', options)
    );
});

self.addEventListener('notificationclick', event => {
    console.log('[SW] Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// ================================
// Message Handler
// ================================

self.addEventListener('message', event => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_UPDATE') {
        // Handle cache updates from main app
        event.waitUntil(updateCache(event.data.urls));
    }
});

async function updateCache(urls) {
    if (!urls || !Array.isArray(urls)) return;
    
    const cache = await caches.open(CACHE_NAME);
    
    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                await cache.put(url, response);
                console.log('[SW] Cached:', url);
            }
        } catch (error) {
            console.error('[SW] Failed to cache:', url, error);
        }
    }
}

// ================================
// Error Handling
// ================================

self.addEventListener('error', event => {
    console.error('[SW] Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('[SW] Unhandled rejection:', event.reason);
    event.preventDefault();
});

console.log('[SW] Service worker script loaded');