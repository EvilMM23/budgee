/**
 * Service Worker – HaushaltsFinanz
 * Robuste Offline-Strategie speziell für iOS Safari.
 *
 * Bekanntes iOS-Problem: Safari kann den SW-Cache in einen inkonsistenten
 * Zustand bringen. Lösung:
 *  - Cache-Version im Namen → erzwingt kompletten Neuaufbau bei Updates
 *  - Network-first für HTML → immer frischste index.html wenn online
 *  - Cache-first für Assets (JS/CSS) → schnell & offline-fähig
 *  - Robuster Fallback: bei jedem Fehler index.html aus Cache liefern
 */

const CACHE_VERSION  = 'v3';
const CACHE_NAME     = `haushaltsfinanz-${CACHE_VERSION}`;
const FALLBACK_PAGE  = '/index.html';

// Alle App-Ressourcen die gecacht werden sollen
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/components.css',
  '/css/views.css',
  '/js/core/db.js',
  '/js/core/state.js',
  '/js/core/router.js',
  '/js/core/utils.js',
  '/js/components/toast.js',
  '/js/components/modal.js',
  '/js/components/chart.js',
  '/js/components/navbar.js',
  '/js/views/login.js',
  '/js/views/setup.js',
  '/js/views/dashboard.js',
  '/js/views/accounts.js',
  '/js/views/budget.js',
  '/js/views/analytics.js',
  '/js/views/settings.js',
  '/js/views/transaction-form.js',
  '/js/app.js',
];

// ── Install: alle Assets einzeln cachen (robust gegen Einzelfehler) ──
self.addEventListener('install', (event) => {
  console.log('[SW] Install, Cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      let cached = 0;
      let failed = 0;

      // Jede Datei einzeln versuchen – ein Fehler blockiert nicht alles
      for (const url of ASSETS_TO_CACHE) {
        try {
          const response = await fetch(url, {
            cache: 'no-cache',
            credentials: 'same-origin',
          });
          if (response.ok) {
            await cache.put(url, response);
            cached++;
            console.log('[SW] ✓ Gecacht:', url);
          } else {
            console.warn('[SW] ✗ HTTP-Fehler:', url, response.status);
            failed++;
          }
        } catch (err) {
          console.warn('[SW] ✗ Fetch-Fehler:', url, err.message);
          failed++;
        }
      }

      console.log(`[SW] Install fertig: ${cached} gecacht, ${failed} fehlgeschlagen.`);

      // Clients über den Cache-Status informieren
      const clients = await self.clients.matchAll();
      clients.forEach(client => client.postMessage({
        type: 'CACHE_STATUS',
        cached,
        failed,
        total: ASSETS_TO_CACHE.length,
      }));

      return self.skipWaiting();
    })
  );
});

// ── Activate: alte Caches löschen ──
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate, entferne alte Caches...');
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Lösche alten Cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => {
        console.log('[SW] Aktiviert, übernehme alle Clients.');
        return self.clients.claim();
      })
  );
});

// ── Fetch: Strategie je Ressourcentyp ──
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Nur GET cachen
  if (request.method !== 'GET') return;

  // Chrome-Extensions und externe Requests ignorieren
  if (!request.url.startsWith(self.location.origin) &&
      !request.url.includes('fonts.googleapis.com') &&
      !request.url.includes('fonts.gstatic.com')) {
    return;
  }

  // ── Fonts: Cache-first mit Netzwerk-Fallback ──
  if (request.url.includes('fonts.googleapis.com') ||
      request.url.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirstWithFallback(request));
    return;
  }

  // ── HTML (Navigation): Network-first → frische App bei Online ──
  // Bei Offline sofort aus Cache. Verhindert schwarze Seite.
  if (request.mode === 'navigate' ||
      request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithCacheFallback(request));
    return;
  }

  // ── JS / CSS / Assets: Cache-first → schnell & zuverlässig offline ──
  event.respondWith(cacheFirstWithFallback(request));
});

/**
 * Network-first Strategie (für HTML/Navigation)
 * Versucht Netzwerk, nimmt bei Fehler den Cache.
 * Letzter Fallback: index.html aus Cache (für schwarze-Seite-Bug).
 */
async function networkFirstWithCacheFallback(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetchWithTimeout(request, 4000);
    if (networkResponse.ok) {
      // Erfolgreich geladen → Cache aktualisieren
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.log('[SW] Netzwerk nicht erreichbar, nehme Cache:', request.url);

    // Cache-Treffer?
    const cached = await cache.match(request);
    if (cached) return cached;

    // Absoluter Fallback: index.html
    const fallback = await cache.match(FALLBACK_PAGE);
    if (fallback) return fallback;

    // Gar nichts im Cache → leere Fehlerseite (verhindert schwarzen Screen)
    return new Response(offlineFallbackHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

/**
 * Cache-first Strategie (für JS/CSS/Fonts)
 * Nimmt direkt aus Cache, aktualisiert Cache im Hintergrund.
 */
async function cacheFirstWithFallback(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    // Im Hintergrund aktualisieren (stale-while-revalidate)
    fetchWithTimeout(request, 5000)
      .then(res => { if (res.ok) cache.put(request, res); })
      .catch(() => {}); // Offline → still
    return cached;
  }

  // Nicht im Cache → Netzwerk
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.warn('[SW] Ressource nicht verfügbar:', request.url);
    // Leere 503-Antwort statt Absturz
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/**
 * fetch() mit Timeout – verhindert endloses Warten auf iOS
 * @param {Request} request
 * @param {number} ms – Timeout in Millisekunden
 */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout nach ${ms}ms`)),
      ms
    );
    fetch(request)
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Offline-Fallback HTML – wird angezeigt wenn gar nichts im Cache ist.
 * Schlichtes Design, kein externer CSS nötig.
 */
function offlineFallbackHTML() {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HaushaltsFinanz – Offline</title>
  <style>
    body {
      background: #0f1117; color: #f0f2f8;
      font-family: system-ui, sans-serif;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100dvh; margin: 0; text-align: center; padding: 32px;
    }
    .icon { font-size: 3rem; margin-bottom: 16px; }
    h2 { margin: 0 0 8px; font-size: 1.4rem; }
    p  { color: #8a90a8; margin: 0 0 24px; max-width: 280px; line-height: 1.5; }
    button {
      background: #f5a623; color: #000; border: none;
      padding: 14px 28px; border-radius: 12px;
      font-size: 1rem; font-weight: 600; cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="icon">📡</div>
  <h2>App nicht im Cache</h2>
  <p>
    Die App konnte nicht geladen werden. Öffne sie einmal mit einer
    Internetverbindung, damit sie für die Offline-Nutzung gespeichert wird.
  </p>
  <button onclick="location.reload()">Erneut versuchen</button>
</body>
</html>`;
}

