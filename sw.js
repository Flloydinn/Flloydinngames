/* Service Worker do Flloydinn — leve, versionado e conservador.
 *
 * Para publicar uma versão nova do cache: mude VERSION (os caches antigos são apagados no "activate").
 *
 * Estratégias (só mesma origem; qualquer outra coisa passa direto pela rede):
 *   - HTML, JSON de dados (agenda, produtos, canais, posts, vídeos, TV), .md e JS/CSS  -> NETWORK-FIRST
 *       tenta a rede (4 s); se falhar, usa a cópia do cache. Novidades aparecem sempre; offline continua abrindo.
 *   - Imagens/ícones/fontes em /assets/  -> STALE-WHILE-REVALIDATE (mostra o cache e atualiza em segundo plano)
 *   - push / notificationclick: avisos de vídeo novo (payload JSON { title, body, url, icon, tag }; clique abre o vídeo
 *     ou /videos.html). Só links do próprio site ou do YouTube são abertos.
 *   - Nunca intercepta: métodos != GET, Range (vídeo/áudio), outras origens (YouTube, three.js/CDN,
 *     PeerJS/WebRTC, analytics), /scripts/ e o próprio sw.js. Jogos WebGL e a TV 24/7 não são tocados.
 */
const VERSION = 'v4'; // v4: js/notificacoes.js + eventos push/notificationclick; v3: js/storage.js; v2: scripts em /js e estilos em /css
const PRECACHE = 'flloydinn-pre-' + VERSION;
const PAGES = 'flloydinn-pages-' + VERSION;
const ASSETS = 'flloydinn-assets-' + VERSION;
const MAX_ASSETS = 80;
const NET_TIMEOUT = 4000;

// só ativos essenciais que existem no repositório
const CORE = [
  '/', '/index.html', '/css/styles.css', '/js/layout.js', '/js/img-fallback.js', '/js/engage.js', '/js/conquistas.js', '/js/storage.js', '/js/notificacoes.js', '/css/game-bar.css',
  '/manifest.webmanifest', '/assets/favicon-32.png', '/assets/apple-touch-icon.png', '/assets/pwa-192.png', '/assets/og-flloydinn.jpg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE).then(c => Promise.allSettled(CORE.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const keep = [PRECACHE, PAGES, ASSETS];
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('flloydinn-') && !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ---- Avisos de novos vídeos ----
const SAFE_HOSTS = ['www.youtube.com', 'youtube.com', 'youtu.be', 'm.youtube.com'];
function safeUrl(u) {
  try {
    const x = new URL(u || '/videos.html', self.location.origin);
    if (x.origin === self.location.origin) return x.href;
    if (x.protocol === 'https:' && SAFE_HOSTS.includes(x.hostname)) return x.href;
  } catch (e) {}
  return new URL('/videos.html', self.location.origin).href;
}

self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { try { d = { body: event.data.text() }; } catch (e2) {} }
  const title = String(d.title || 'Vídeo novo no Flloydinn').slice(0, 120);
  event.waitUntil(self.registration.showNotification(title, {
    body: String(d.body || 'Toque para assistir.').slice(0, 240),
    icon: '/assets/pwa-192.png', badge: '/assets/favicon-32.png', lang: 'pt-BR',
    tag: String(d.tag || 'novo-video'), data: { url: safeUrl(d.url) }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = all.find(c => c.url === target) || all.find(c => new URL(c.url).origin === self.location.origin);
    const focus = c => { try { return Promise.resolve(c.focus()).catch(() => c); } catch (e) { return c; } };
    if (same && same.url === target) return focus(same);
    if (same && 'navigate' in same && target.startsWith(self.location.origin)) {
      try { const nav = await same.navigate(target); return focus(nav || same); } catch (e) {}
    }
    return self.clients.openWindow(target);
  })());
});

const isData = p => /\.(json|md|webmanifest)$/.test(p);
const isCode = p => /\.(js|css)$/.test(p);
const isAsset = p => p.startsWith('/assets/');

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
const cacheable = res => res && res.status === 200 && res.type === 'basic';

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await withTimeout(fetch(req), NET_TIMEOUT);
    if (cacheable(res)) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = (await cache.match(req)) || (await caches.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    throw e;
  }
}

async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  const refresh = fetch(req).then(res => { if (cacheable(res)) { cache.put(req, res.clone()); trim(cache, MAX_ASSETS); } return res; });
  if (hit) { refresh.catch(() => {}); return hit; }
  return refresh;
}

const OFFLINE_HTML = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão — Flloydinn</title>' +
  '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0c;color:#e8e8ea;font-family:system-ui,sans-serif;text-align:center;padding:1rem">' +
  '<main><h1 style="margin:0 0 .5rem">Flloyd<span style="color:#8f0000">inn</span></h1><p>Você está sem conexão e esta página ainda não foi salva neste aparelho.</p>' +
  '<p><a href="/" style="color:#fff">Tentar a página inicial</a></p></main></body></html>';

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p === '/sw.js' || p.startsWith('/scripts/') || p.startsWith('/.')) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, PAGES).catch(() => new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
  } else if (isData(p) || isCode(p)) {
    event.respondWith(networkFirst(req, PAGES));
  } else if (isAsset(p)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});
