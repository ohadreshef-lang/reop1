// Mondial PWA — minimal app-shell service worker.
//
// Strategy:
// - Cache-first for the static shell (HTML, JS, CSS, icons, flag SVGs).
// - Network-only passthrough for Firebase traffic (gstatic.com, firebaseio.com,
//   googleapis.com) — Firebase manages its own offline persistence.
// - Versioned cache name; bump CACHE_VERSION on each deploy to invalidate stale
//   assets (mirrors the existing `?v=` cache-busting convention).

const CACHE_VERSION = 'mondial-v20260702b';

const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/team-logos.js',
    '/i18n.js',
    '/firebase-config.js',
    '/manifest.json',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/apple-touch-icon-180.png',
    '/assets/flags/arsenal.svg',
    '/assets/flags/atletico.svg',
    '/assets/flags/bayern.svg',
    '/assets/flags/psg.svg',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache =>
            // addAll is atomic — any failure aborts the whole install.
            // Use Promise.allSettled-style individual adds so a missing asset
            // doesn't break the entire SW install.
            Promise.all(
                SHELL_ASSETS.map(url =>
                    cache.add(url).catch(err =>
                        console.warn('[SW] skip cache for', url, err.message)
                    )
                )
            )
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(
                names
                    .filter(n => n !== CACHE_VERSION)
                    .map(n => caches.delete(n))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    // Never cache or intercept Firebase / Google traffic.
    if (
        url.hostname.endsWith('gstatic.com') ||
        url.hostname.endsWith('firebaseio.com') ||
        url.hostname.endsWith('googleapis.com') ||
        url.hostname.endsWith('firebaseapp.com')
    ) {
        return; // default browser fetch
    }

    // Skip non-GET (POST/PUT etc.) — never cached.
    if (req.method !== 'GET') return;

    // Navigation requests (HTML page loads): network-first, fall back to
    // cached index.html so the app still launches offline.
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then(c => c.put('/index.html', copy));
                    return res;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Static assets: cache-first, then network + populate cache.
    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req).then(res => {
                if (!res || res.status !== 200 || res.type === 'opaque') return res;
                const copy = res.clone();
                caches.open(CACHE_VERSION).then(c => c.put(req, copy));
                return res;
            }).catch(() => cached);
        })
    );
});
