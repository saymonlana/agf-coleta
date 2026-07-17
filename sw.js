/* ============================================
   AGF COLETA - Service Worker
   Funciona offline após primeiro acesso
   ============================================ */

const CACHE_NAME = 'agf-coleta-v23';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/map.js',
    './js/sync.js',
    './img/logo.jpg',
    './manifest.json',
    './dados/projetos.js',
    './dados/config.js',
    './dados/Questionario_PAEBM_SAG.js',
    './dados/Animais_Domesticos_PAEBM_SAG.js',
    './dados/Moradores_PAEBM_SAG.js',
    './dados/Animais_Silvestres_Exoticos_PAEBM_SAG.js',
    './dados/Producao_Agropecuaria_PAEBM_SAG.js',
    './dados/Centro_Urbano.js'
];

// ============================================
// INSTALAÇÃO
// ============================================

self.addEventListener('install', (event) => {
    console.log('📦 Service Worker instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📁 Cache aberto');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✅ Todos os arquivos em cache');
                return self.skipWaiting();
            })
    );
});

// ============================================
// ATIVAÇÃO
// ============================================

self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker ativado');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Removendo cache antigo:', cacheName);
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
// INTERCEPTAR REQUISIÇÕES
// ============================================

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Nao interceptar chamadas ao proxy (API calls)
    if (url.pathname === '/proxy/box' || url.hostname !== location.hostname) {
        return;
    }
    
    console.log('🌐 Buscando:', event.request.url);
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Retornar do cache se disponível
                if (response) {
                    console.log('📦 Retornando do cache:', event.request.url);
                    return response;
                }
                
                // Buscar da rede
                return fetch(event.request)
                    .then((response) => {
                        // Verificar se é válida
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clonar a resposta
                        const responseToCache = response.clone();
                        
                        // Adicionar ao cache
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // Se falhar e for página, retornar index.html
                        if (event.request.destination === 'document') {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});

// ============================================
// SINCRONIZAÇÃO EM SEGUNDO PLANO
// ============================================

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-dados') {
        console.log('🔄 Sincronização em segundo plano...');
        event.waitUntil(sincronizarEmSegundoPlano());
    }
});

async function sincronizarEmSegundoPlano() {
    // Aqui seria implementada a sincronização real
    // Por enquanto, apenas log
    console.log('🔄 Sincronização concluída em segundo plano');
}

// ============================================
// NOTIFICAÇÕES
// ============================================

self.addEventListener('push', (event) => {
    const titulo = 'AGF Coleta';
    const opcoes = {
        body: event.data ? event.data.text() : 'Nova notificação',
        icon: '/img/logo.jpg',
        badge: '/img/logo.jpg',
        vibrate: [100, 50, 100],
        data: {
            url: '/'
        }
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
