// 修仙问答 Service Worker
// 策略：
//  1) 应用壳 + JS/CSS/字体/图标 → 缓存优先（二次访问≈0 网络，提速 + 省 CDN 流量）
//  2) 导航请求 → 网络优先，失败回退到缓存的 index.html（离线可用、SPA 不白屏）
//  3) 其他 GET → 网络优先，成功则写入缓存
// 注意：CACHE 用稳定版本号，避免每次加载换新名导致缓存永不复用、白费流量。
const CACHE = 'xiuixian-v26';
// 基于 SW 自身 URL 推导部署根路径，兼容根域名与子路径（GitHub Pages）
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');
const APP_SHELL = [BASE + '/', BASE + '/index.html', BASE + '/manifest.webmanifest', BASE + '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // 不缓存写请求（POST 到 Supabase 等）
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 只处理同源静态资源

  // 导航请求：网络优先，失败回退 index.html（SPA fallback）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match(BASE + '/index.html').then((r) => r || fetch(req)))
    );
    return;
  }

  // 静态资源：缓存优先
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
