// 身体档案 3D — 离线缓存 Service Worker（纯本地，不请求任何外部资源）
const CACHE_NAME = 'body-archive-3d-v1'

// 构建后由 scripts/gen-sw-manifest.mjs 自动注入 assets 下全部构建产物（含 .glb、.js、.css）
const PRECACHE_ASSETS = /* __PRECACHE_MANIFEST__ */ [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(PRECACHE_ASSETS)
      try {
        const res = await fetch('./sw-assets.json')
        if (res.ok) {
          const list = await res.json()
          if (Array.isArray(list)) {
            await cache.addAll(list)
          }
        }
      } catch {
        // 开发模式或未生成清单时忽略
      }
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(cached => {
      if (cached) return cached
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone))
        }
        return res
      }).catch(() => {
        if (req.mode === 'navigate') {
          return caches.match('./index.html')
        }
        return new Response('', { status: 504, statusText: 'Offline' })
      })
    })
  )
})
