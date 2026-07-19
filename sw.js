/* ============================================================
   sw.js — Service Worker PWA
   Kalamundi — La Plume du Monde
   Stratégies :
     - Shell app (HTML/CSS/JS) → Cache First
     - API Supabase            → Network First + cache fallback
     - Images couvertures      → Stale While Revalidate
     - Page offline            → fallback si tout échoue
   ============================================================ */

const VERSION        = 'kala-v32';
const CACHE_SHELL    = `${VERSION}-shell`;
const CACHE_API      = `${VERSION}-api`;
const CACHE_IMAGES   = `${VERSION}-images`;

/* Shell minimal — uniquement les ressources critiques du chemin initial.
   Les autres pages/CSS/JS sont mis en cache au premier accès (Cache First on hit). */
const SHELL_URLS = [
  '/',
  '/pages/library.html',
  '/pages/login.html',
  '/pages/work.html',
  '/pages/reader.html',
  '/assets/css/base.css',
  '/assets/css/layout.css',
  '/assets/css/components.css',
  '/assets/css/home.css',
  '/assets/css/themes/light.css',
  '/assets/css/themes/dark.css',
  '/assets/css/themes/sepia.css',
  '/assets/fonts/fraunces-400.woff2',
  '/assets/fonts/fraunces-700.woff2',
  '/assets/fonts/inter-400.woff2',
  '/assets/fonts/inter-500.woff2',
  '/assets/fonts/inter-700.woff2',
  '/assets/img/logo-mark-km.png',
  '/assets/img/icons/icon-192.png',
  '/assets/img/icons/icon-512.png',
  '/assets/js/theme-init.js',
  '/assets/js/i18n-boot.js',
  '/assets/js/offline-page.js',
  '/assets/js/app.js',
  '/assets/js/auth.js',
  '/assets/js/api.js',
  '/assets/js/utils.js',
  '/assets/js/work.js',
  '/assets/js/reader.js',
  '/manifest.json',
  '/offline.html',
];

/* Domaines traités comme API (Network First) */
const API_ORIGINS = [
  'iobieffnaauecyukecds.supabase.co',
];

/* CDN statique — Cache First (supabase-js ne change pas souvent) */
const CDN_ORIGINS = [
  'cdn.jsdelivr.net',
];

/* ============================================================
   INSTALL — mise en cache du shell
   ============================================================ */

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then(cache => {
      /* on ignore les erreurs individuelles pour ne pas bloquer l'install */
      return Promise.allSettled(
        SHELL_URLS.map(url =>
          cache.add(url).catch(() => { /* fichier absent — ignoré */ })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ============================================================
   ACTIVATE — nettoyage des anciens caches
   ============================================================ */

self.addEventListener('activate', event => {
  const caches_actuels = [CACHE_SHELL, CACHE_API, CACHE_IMAGES];

  event.waitUntil(
    caches.keys().then(noms =>
      Promise.all(
        noms
          .filter(nom => !caches_actuels.includes(nom))
          .map(nom => caches.delete(nom))
      )
    ).then(() => self.clients.claim())
  );
});

/* ============================================================
   FETCH — routage des requêtes
   ============================================================ */

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Ignorer les requêtes non-GET et chrome-extension */
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  /* ── Navigations HTML → réseau puis fallback offline ── */
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  /* ── CDN statique (supabase-js) → Cache First ── */
  if (CDN_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(cacheFirst(request, CACHE_SHELL));
    return;
  }

  /* ── API Supabase → Network First ── */
  if (API_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(networkFirst(request, CACHE_API));
    return;
  }

  /* ── Images couvertures (Storage Supabase) → Stale While Revalidate ── */
  if (url.pathname.includes('/storage/') || isImage(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES));
    return;
  }

  /* ── Assets statiques (CSS / JS / fonts) → Cache First ── */
  if (url.hostname === self.location.hostname) {
    event.respondWith(cacheFirst(request, CACHE_SHELL));
  }
});

/* ============================================================
   Stratégies
   ============================================================ */

/* Cache First — renvoie le cache, sinon réseau, sinon offline */
async function cacheFirst(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) cache.put(request, response.clone());
    return response;
  } catch {
    /* Fallback page offline pour les navigations HTML */
    if (request.headers.get('accept')?.includes('text/html')) {
      const offline = await caches.match('/offline.html');
      if (offline) return offline;
    }
    return new Response('Hors ligne', { status: 503 });
  }
}

/* Network First — réseau prioritaire, cache en fallback */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.status === 200 && !response.redirected) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/* Navigation HTML — réseau prioritaire, cache/offline si connexion absente */
async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_SHELL);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    const offline = await caches.match('/offline.html');
    return cached || offline || new Response('Hors ligne', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/* Stale While Revalidate — cache immédiat + mise à jour en arrière-plan */
async function staleWhileRevalidate(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}

/* ============================================================
   Utilitaire — détection image
   ============================================================ */

function isImage(pathname) {
  return /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i.test(pathname);
}

/* ============================================================
   MESSAGE — forcer la mise à jour depuis l'app
   ============================================================ */

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'VIDER_CACHE_API') {
    caches.delete(CACHE_API);
  }
});
