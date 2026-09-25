// ── Service Worker — Dashboard Budget — Démo ───────────────────────────────
// Stratégie :
//   • Cache First  → /assets/** (JS/CSS/polices buildés par Vite — hash dans le nom)
//   • Network First → /data/**  (JSON de données — peut évoluer entre sessions)
//   • Network First → navigation (index.html)
//
// Les polices sont embarquées et sortent dans /assets/ : elles suivent donc
// la stratégie Cache First, comme le reste du build. Aucune requête vers un
// domaine tiers n'est possible — il n'y en a plus une seule dans le site.

const CACHE_NAME = 'budget-demo-v1';

// Ressources précachées au moment de l'installation
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// ── Install : précache du shell ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Active immédiatement sans attendre que l'onglet soit fermé
  self.skipWaiting();
});

// ── Activate : nettoyage des anciens caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch : routage par stratégie ──────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les extensions de navigateur
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Cache First — assets Vite (hash dans le nom, immutables)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Cache First — icons et favicon
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.svg'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network First — données JSON (peuvent être mises à jour)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Network First — navigation SPA (index.html)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Tout le reste passe au réseau sans interception. En pratique il ne
  // reste rien : le site ne charge aucune ressource externe.
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fallback SPA : retourner index.html en cache si disponible
    return cache.match('/') ?? new Response('Offline', { status: 503 });
  }
}
