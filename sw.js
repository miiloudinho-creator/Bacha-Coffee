// Service Worker - Bacha Coffee Companion
// Incrémente CACHE_VERSION à chaque déploiement majeur pour forcer le refresh
const CACHE_VERSION = 'bacha-v12-fix';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Détecte les requêtes pour le shell HTML (qu'on veut tenir le plus à jour possible)
function isHTMLNavigation(req){
  if(req.mode==='navigate')return true;
  const accept=req.headers.get('accept')||'';
  return accept.includes('text/html');
}

// Installation : mise en cache des assets de base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activation : nettoyage des vieux caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch :
//  - Netlify Functions  → network-only (toujours frais)
//  - HTML / navigation  → stale-while-revalidate (sert le cache, met à jour en background)
//  - Autres assets      → cache-first (rapide, fallback réseau)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.pathname.startsWith('/.netlify/functions/')) {
    return; // pas de cache pour l'API
  }

  if (isHTMLNavigation(req)) {
    // SWR : retourne le cache immédiatement, refresh en arrière-plan.
    // L'utilisateur voit l'app instantanément même offline ; au prochain reload il a la dernière version.
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Cache-first pour tout le reste (icônes, manifest, fonts en cache, etc.)
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return response;
      });
    })
  );
});
