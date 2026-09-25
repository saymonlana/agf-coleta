/* ============================================
   AGF COLETA - Service Worker
   Funciona offline após primeiro acesso
   ============================================ */

const CACHE_NAME = 'agf-coleta-v76';
const TILE_CACHE_NAME = 'agf-tiles-v1';

const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/map.js',
    './js/sync.js',
    './js/excel.js',
    './js/inventario.js',
    './js/offline-map.js',
    './img/logo.jpg',
    './img/logo_192.png',
    './img/logo_512.png',
    './manifest.json',
    './dados/projetos.js',
    './dados/config.js',
    './dados/config_inventario.js',
    './dados/Questionario_PAEBM_SAG.js',
    './dados/Animais_Domesticos_PAEBM_SAG.js',
    './dados/Moradores_PAEBM_SAG.js',
    './dados/Animais_Silvestres_Exoticos_PAEBM_SAG.js',
    './dados/Producao_Agropecuaria_PAEBM_SAG.js',
    './dados/Centro_Urbano.js',
    './dados/Municipios_PAEBM_CMD.js',
    './dados/Manchas_RC_PAEBM.js',
    './dados/Acessos_Secundarios.js',
    './Inventario_Florestal/Propriedades_NES.js',
    './Inventario_Florestal/Quadrantes.js',
    './Logo_Clientes/Vale.png',
    './Logo_Clientes/Samarco.png',
    './Logo_Clientes/Gerdau.png',
    './Logo_Clientes/Anglo.png',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js',
    'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js'
];

function ehRequisicaoTiles(url) {
    return url.hostname === 'tile.openstreetmap.org' ||
        url.hostname.endsWith('.tile.openstreetmap.org') ||
        (url.hostname.endsWith('google.com') && url.pathname.indexOf('/vt/') !== -1) ||
        (url.hostname.endsWith('googleapis.com') && url.pathname.indexOf('/vt/') !== -1);
}

function ehProxy(url) {
    return url.pathname === '/proxy/box' ||
        url.pathname === '/upload-excel' ||
        url.pathname === '/generate-excel';
}

// ============================================
// INSTALACAO
// ============================================

self.addEventListener('install', (event) => {
    console.log('Service Worker instalando...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return Promise.allSettled(
                    urlsToCache.map((u) =>
                        cache.add(u).catch((e) => {
                            console.warn('Falha ao cachear:', u, e);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// ============================================
// ATIVACAO
// ============================================

self.addEventListener('activate', (event) => {
    console.log('Service Worker ativado');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName.startsWith('agf-coleta-') && cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// ============================================
// INTERCEPTAR REQUISICOES
// ============================================

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (ehProxy(url)) {
        return;
    }

    // Reverse geocoding: sempre ir na rede ( coordenadas mudam a cada ponto )
    if (url.hostname === 'nominatim.openstreetmap.org') {
        return;
    }

    if (ehRequisicaoTiles(url)) {
        event.respondWith(cacheFirstTiles(event.request));
        return;
    }

    if (url.hostname !== location.hostname) {
        event.respondWith(cacheFirstCdn(event.request));
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((resp) => {
                if (resp && resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
                }
                return resp;
            })
            .catch(() =>
                caches.match(event.request, { ignoreSearch: true }).then((r) => r || Response.error())
            )
    );
});

async function cacheFirstTiles(request) {
    const cache = await caches.open(TILE_CACHE_NAME);
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) {
        return cached;
    }
    try {
        const resp = await fetch(request);
        if (resp && (resp.ok || resp.type === 'opaque')) {
            cache.put(request, resp.clone());
        }
        return resp;
    } catch (e) {
        return new Response('', { status: 504, statusText: 'Mapa offline nao disponivel nesta regiao' });
    }
}

async function cacheFirstCdn(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) {
        return cached;
    }
    try {
        const resp = await fetch(request);
        if (resp && resp.ok) {
            cache.put(request, resp.clone());
        }
        return resp;
    } catch (e) {
        return Response.error();
    }
}

// ============================================
// SINCRONIZACAO EM SEGUNDO PLANO
// ============================================

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-dados') {
        event.waitUntil(sincronizarEmSegundoPlano());
    }
});

async function sincronizarEmSegundoPlano() {
    console.log('Sincronizacao concluida em segundo plano');
}

// ============================================
// NOTIFICACOES
// ============================================

self.addEventListener('push', (event) => {
    const titulo = 'AGF Coleta';
    const opcoes = {
        body: event.data ? event.data.text() : 'Nova notificacao',
        icon: '/img/logo.jpg',
        badge: '/img/logo.jpg',
        vibrate: [100, 50, 100],
        data: { url: '/' }
    };

    event.waitUntil(
        self.registration.showNotification(titulo, opcoes)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
