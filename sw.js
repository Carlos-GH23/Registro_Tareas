/* Offline-only (Only-Cache) Service Worker */
const CACHE = 'only-cache-v1';

// Lista de recursos estáticos a precachear (relativos al scope)
const ASSETS = [
    'index.html',
    'main.js',
    'manifest.json',
    'images/icons/192.png',
    'images/icons/512.png',
    'https://cdn.jsdelivr.net/npm/pouchdb@9.0.0/dist/pouchdb.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Estrategia ONLY CACHE: solo respondemos desde caché.
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;

            // Para navegaciones, devuelve index.html si está en caché
            if (request.mode === 'navigate') {
                return caches.match('index.html');
            }

            // Si no está en caché, devolvemos un 503 offline
            return new Response('Recurso no disponible sin conexión y no está en caché.', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
            });
        })
    );
});
