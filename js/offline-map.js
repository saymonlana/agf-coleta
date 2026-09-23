/* ============================================
   AGF COLETA - Mapa Offline (tiles em cache)
   Baixa a area visivel (z12-z17) para uso em campo
   ============================================ */

const OfflineMap = {
    CACHE_TILES: 'agf-tiles-v1',
    STORAGE_KEY: 'agf_areas_offline',
    ZOOM_MIN: 12,
    ZOOM_MAX: 17,
    TILE_BYTES_EST: 20000,
    LIMITE_MB: 300,
    baixando: false,
    cancelar: false,
    areas: []
};

// ============================================
// URLS DOS TILES
// ============================================

function tileUrlSatelite(z, x, y) {
    return 'https://mt1.google.com/vt/lyrs=s&x=' + x + '&y=' + y + '&z=' + z;
}

function tileUrlRuas(z, x, y) {
    return 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png';
}

function urlsDoTile(z, x, y) {
    return [tileUrlSatelite(z, x, y), tileUrlRuas(z, x, y)];
}

// ============================================
// CONVERSAO LAT/LNG -> TILE
// ============================================

function lngParaTileX(lng, z) {
    const n = Math.pow(2, z);
    let x = Math.floor(((lng + 180) / 360) * n);
    if (x < 0) x = 0;
    if (x >= n) x = n - 1;
    return x;
}

function latParaTileY(lat, z) {
    const n = Math.pow(2, z);
    const rad = lat * Math.PI / 180;
    let y = Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n);
    if (y < 0) y = 0;
    if (y >= n) y = n - 1;
    return y;
}

function tilesParaBounds(sul, oeste, norte, leste, z) {
    const xMin = lngParaTileX(oeste, z);
    const xMax = lngParaTileX(leste, z);
    const yMin = latParaTileY(norte, z);
    const yMax = latParaTileY(sul, z);
    const tiles = [];
    for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
            tiles.push({ x: x, y: y });
        }
    }
    return tiles;
}

function contarTilesArea(sul, oeste, norte, leste) {
    let total = 0;
    for (let z = OfflineMap.ZOOM_MIN; z <= OfflineMap.ZOOM_MAX; z++) {
        total += tilesParaBounds(sul, oeste, norte, leste, z).length;
    }
    return total * 2;
}

function formatarMb(bytes) {
    if (bytes >= 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
    return Math.max(1, Math.round(bytes / (1024 * 1024))) + ' MB';
}

// ============================================
// ÁREAS SALVAS (localStorage)
// ============================================

function carregarAreasOffline() {
    try {
        OfflineMap.areas = JSON.parse(localStorage.getItem(OfflineMap.STORAGE_KEY) || '[]');
    } catch (e) {
        OfflineMap.areas = [];
    }
    return OfflineMap.areas;
}

function salvarAreasOffline(areas) {
    OfflineMap.areas = areas;
    try {
        localStorage.setItem(OfflineMap.STORAGE_KEY, JSON.stringify(areas));
    } catch (e) {}
}

function espacoUsadoAreas() {
    return carregarAreasOffline().reduce((soma, a) => soma + (a.bytes || 0), 0);
}

function gerarUrlArea(area, z, x, y) {
    return urlsDoTile(z, x, y);
}

function tilesDaAreaSalva(area) {
    const urls = [];
    const b = area.bounds;
    for (let z = area.zoomMin; z <= area.zoomMax; z++) {
        const tiles = tilesParaBounds(b[0], b[1], b[2], b[3], z);
        for (let i = 0; i < tiles.length; i++) {
            const par = gerarUrlArea(area, z, tiles[i].x, tiles[i].y);
            urls.push(par[0], par[1]);
        }
    }
    return urls;
}

// ============================================
// STATUS NO HEADER
// ============================================

function areaCobreViewport(bounds) {
    const areas = carregarAreasOffline();
    if (!areas.length) return false;
    const sul = bounds.getSouth();
    const oeste = bounds.getWest();
    const norte = bounds.getNorth();
    const leste = bounds.getEast();
    return areas.some(function(a) {
        const b = a.bounds;
        return sul >= b[0] && oeste >= b[1] && norte <= b[2] && leste <= b[3];
    });
}

function atualizarStatusOfflineHeader() {
    const btn = document.getElementById('btn-status-offline');
    if (!btn) return;
    btn.classList.remove('status-baixando', 'status-ok', 'status-sem');

    if (OfflineMap.baixando) {
        btn.classList.add('status-baixando');
        btn.title = 'Baixando mapa offline...';
        return;
    }

    if (typeof mapa === 'undefined' || !mapa) {
        btn.classList.add('status-sem');
        return;
    }

    if (areaCobreViewport(mapa.getBounds())) {
        btn.classList.add('status-ok');
        btn.title = 'Mapa offline disponivel nesta area';
    } else {
        btn.classList.add('status-sem');
        const areas = carregarAreasOffline();
        btn.title = areas.length
            ? 'Esta area nao esta no mapa offline (use Camadas > Baixar)'
            : 'Sem mapa offline (use Camadas > Baixar)';
    }
}

// ============================================
// PROGRESSO
// ============================================

function mostrarProgressoOffline(texto) {
    const el = document.getElementById('progresso-offline');
    if (!el) return;
    el.style.display = 'block';
    const t = document.getElementById('progresso-offline-texto');
    if (t && texto) t.textContent = texto;
    const fill = document.getElementById('progresso-offline-fill');
    if (fill && texto === null) fill.style.width = '0%';
}

function atualizarProgressoOffline(porcentagem, texto) {
    const fill = document.getElementById('progresso-offline-fill');
    const t = document.getElementById('progresso-offline-texto');
    if (fill) fill.style.width = Math.max(0, Math.min(100, porcentagem)) + '%';
    if (t && texto) t.textContent = texto;
}

function esconderProgressoOffline() {
    const el = document.getElementById('progresso-offline');
    if (el) el.style.display = 'none';
}

// ============================================
// BAIXAR AREA VISIVEL
// ============================================

async function baixarAreaOfflineAtual() {
    if (OfflineMap.baixando) {
        mostrarToast('Ja existe um download em andamento', 'aviso');
        return;
    }
    if (typeof mapa === 'undefined' || !mapa) {
        mostrarToast('Mapa nao inicializado', 'erro');
        return;
    }
    if (!navigator.onLine) {
        mostrarToast('Sem internet. Conecte-se para baixar o mapa.', 'aviso');
        return;
    }
    if (!('caches' in window)) {
        mostrarToast('Cache offline nao suportado neste navegador', 'erro');
        return;
    }

    const bounds = mapa.getBounds();
    const area = {
        id: Date.now(),
        nome: 'Area ' + new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        bounds: [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()],
        zoomMin: OfflineMap.ZOOM_MIN,
        zoomMax: OfflineMap.ZOOM_MAX,
        data: new Date().toISOString(),
        bytes: 0,
        tiles: 0
    };

    const tilesPorZoom = [];
    let totalRequisicoes = 0;
    for (let z = OfflineMap.ZOOM_MIN; z <= OfflineMap.ZOOM_MAX; z++) {
        const tiles = tilesParaBounds(area.bounds[0], area.bounds[1], area.bounds[2], area.bounds[3], z);
        tilesPorZoom.push({ z: z, tiles: tiles });
        totalRequisicoes += tiles.length * 2;
    }

    if (totalRequisicoes === 0) {
        mostrarToast('Area invalida para download', 'erro');
        return;
    }

    const bytesEstimados = totalRequisicoes * OfflineMap.TILE_BYTES_EST;
    const areas = carregarAreasOffline();
    const jaUsado = espacoUsadoAreas();
    const restante = OfflineMap.LIMITE_MB * 1024 * 1024 - jaUsado;

    if (bytesEstimados > restante) {
        const ok = window.confirm(
            'Espaco insuficiente no limite do app.\n\n' +
            'Area estimada: ' + formatarMb(bytesEstimados) + '\n' +
            'Disponivel: ' + formatarMb(Math.max(0, restante)) + '\n' +
            'Limite: ' + OfflineMap.LIMITE_MB + ' MB\n\n' +
            'Remova areas antigas em "Mapa offline" ou continue mesmo assim?'
        );
        if (!ok) return;
    }

    const okConfirm = window.confirm(
        'Baixar esta area para uso offline?\n\n' +
        'Zoom: z' + OfflineMap.ZOOM_MIN + ' a z' + OfflineMap.ZOOM_MAX + ' (detalhe)\n' +
        'Tiles: ~' + totalRequisicoes + '\n' +
        'Tamanho estimado: ' + formatarMb(bytesEstimados) + '\n\n' +
        'Posicione o mapa na area de trabalho antes de confirmar.'
    );
    if (!okConfirm) return;

    OfflineMap.baixando = true;
    OfflineMap.cancelar = false;
    atualizarStatusOfflineHeader();
    mostrarProgressoOffline('Preparando download...');
    atualizarProgressoOffline(0, 'Baixando mapa... 0%');

    const btnBaixar = document.getElementById('btn-baixar-area');
    if (btnBaixar) btnBaixar.disabled = true;

    let cache;
    try {
        cache = await caches.open(OfflineMap.CACHE_TILES);
    } catch (e) {
        OfflineMap.baixando = false;
        esconderProgressoOffline();
        if (btnBaixar) btnBaixar.disabled = false;
        atualizarStatusOfflineHeader();
        mostrarToast('Erro ao abrir cache: ' + e.message, 'erro');
        return;
    }

    let feitos = 0;
    let falhas = 0;
    const CONCORRENCIA = 6;

    async function baixarUma(url) {
        if (OfflineMap.cancelar) return;
        try {
            const resp = await fetch(url, { mode: 'no-cors', cache: 'no-store' });
            if (resp) {
                await cache.put(url, resp);
                feitos++;
            } else {
                falhas++;
            }
        } catch (e) {
            falhas++;
        }
        const pct = Math.round((feitos + falhas) / totalRequisicoes * 100);
        atualizarProgressoOffline(pct, 'Baixando mapa... ' + pct + '% (' + (feitos + falhas) + '/' + totalRequisicoes + ')');
    }

    for (let i = 0; i < tilesPorZoom.length && !OfflineMap.cancelar; i++) {
        const grupo = tilesPorZoom[i];
        const urls = [];
        for (let j = 0; j < grupo.tiles.length; j++) {
            const par = urlsDoTile(grupo.z, grupo.tiles[j].x, grupo.tiles[j].y);
            urls.push(par[0], par[1]);
        }
        for (let k = 0; k < urls.length; k += CONCORRENCIA) {
            if (OfflineMap.cancelar) break;
            const lote = urls.slice(k, k + CONCORRENCIA);
            await Promise.all(lote.map(baixarUma));
        }
    }

    OfflineMap.baixando = false;
    if (btnBaixar) btnBaixar.disabled = false;
    atualizarStatusOfflineHeader();

    if (OfflineMap.cancelar) {
        esconderProgressoOffline();
        mostrarToast('Download cancelado', 'aviso');
        OfflineMap.cancelar = false;
        renderizarSecaoOffline();
        return;
    }

    area.tiles = feitos;
    area.bytes = bytesEstimados;
    const novasAreas = carregarAreasOffline();
    novasAreas.push(area);
    salvarAreasOffline(novasAreas);

    atualizarProgressoOffline(100, 'Concluido! ' + formatarMb(bytesEstimados));
    setTimeout(esconderProgressoOffline, 1500);

    mostrarToast('Mapa offline baixado: ' + formatarMb(bytesEstimados) + ' (' + feitos + ' tiles)', 'sucesso');
    renderizarSecaoOffline();
    atualizarStatusOfflineHeader();
}

function cancelarDownloadOffline() {
    OfflineMap.cancelar = true;
}

// ============================================
// REMOVER / LIMPAR
// ============================================

async function removerAreaOffline(id) {
    const areas = carregarAreasOffline();
    const area = areas.find(a => a.id === id);
    if (!area) return;

    if (!window.confirm('Remover "' + area.nome + '" do mapa offline?\n(' + formatarMb(area.bytes || 0) + ')')) {
        return;
    }

    try {
        const cache = await caches.open(OfflineMap.CACHE_TILES);
        const urls = tilesDaAreaSalva(area);
        for (let i = 0; i < urls.length; i++) {
            await cache.delete(urls[i], { ignoreVary: true });
        }
    } catch (e) {
        console.warn('Erro ao remover tiles:', e);
    }

    salvarAreasOffline(areas.filter(a => a.id !== id));
    mostrarToast('Area removida do mapa offline', 'sucesso');
    renderizarSecaoOffline();
    atualizarStatusOfflineHeader();
}

async function limparMapaOffline() {
    const areas = carregarAreasOffline();
    if (!areas.length) {
        mostrarToast('Nenhuma area baixada', 'aviso');
        return;
    }
    if (!window.confirm('Remover TODAS as areas do mapa offline?\n(' + formatarMb(espacoUsadoAreas()) + ')')) {
        return;
    }
    try {
        await caches.delete(OfflineMap.CACHE_TILES);
    } catch (e) {}
    salvarAreasOffline([]);
    mostrarToast('Mapa offline limpo', 'sucesso');
    renderizarSecaoOffline();
    atualizarStatusOfflineHeader();
}

// ============================================
// RENDERIZAR SECAO NO PAINEL DE CAMADAS
// ============================================

function renderizarSecaoOffline() {
    const info = document.getElementById('offline-info');
    const lista = document.getElementById('offline-lista-areas');
    if (!info || !lista) return;

    const areas = carregarAreasOffline();
    const usado = espacoUsadoAreas();

    let infoHtml = '';
    if (typeof mapa !== 'undefined' && mapa) {
        const b = mapa.getBounds();
        const nTiles = contarTilesArea(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
        const bytes = nTiles * OfflineMap.TILE_BYTES_EST;
        infoHtml += '<div class="offline-linha"><span>Area na tela:</span><strong>~' + formatarMb(bytes) + '</strong></div>';
        infoHtml += '<div class="offline-linha"><span>Zoom:</span><strong>z' + OfflineMap.ZOOM_MIN + ' – z' + OfflineMap.ZOOM_MAX + '</strong></div>';
    }
    infoHtml += '<div class="offline-linha"><span>Baixado:</span><strong>' + formatarMb(usado) + ' / ' + OfflineMap.LIMITE_MB + ' MB</strong></div>';
    info.innerHTML = infoHtml;

    if (!areas.length) {
        lista.innerHTML = '<div class="offline-vazio">Nenhuma area baixada ainda</div>';
        return;
    }

    lista.innerHTML = areas.map(function(a) {
        return '<div class="offline-area-item">' +
            '<div class="offline-area-info">' +
                '<div class="offline-area-nome">' + a.nome + '</div>' +
                '<div class="offline-area-meta">z' + a.zoomMin + '-' + a.zoomMax + ' · ' + formatarMb(a.bytes || 0) + ' · ' + a.tiles + ' tiles</div>' +
            '</div>' +
            '<button class="offline-area-remover" data-id="' + a.id + '" title="Remover">&times;</button>' +
        '</div>';
    }).join('');

    lista.querySelectorAll('.offline-area-remover').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            removerAreaOffline(parseInt(btn.dataset.id, 10));
        });
    });
}

function inicializarSecaoOffline() {
    const btnBaixar = document.getElementById('btn-baixar-area');
    const btnLimpar = document.getElementById('btn-limpar-offline');
    const btnCancelar = document.getElementById('btn-progresso-offline-cancelar');

    if (btnBaixar && !btnBaixar.dataset.bind) {
        btnBaixar.dataset.bind = '1';
        btnBaixar.addEventListener('click', baixarAreaOfflineAtual);
    }
    if (btnLimpar && !btnLimpar.dataset.bind) {
        btnLimpar.dataset.bind = '1';
        btnLimpar.addEventListener('click', limparMapaOffline);
    }
    if (btnCancelar && !btnCancelar.dataset.bind) {
        btnCancelar.dataset.bind = '1';
        btnCancelar.addEventListener('click', cancelarDownloadOffline);
    }

    carregarAreasOffline();
    renderizarSecaoOffline();
    atualizarStatusOfflineHeader();
}

document.addEventListener('DOMContentLoaded', function() {
    inicializarSecaoOffline();

    const btnStatus = document.getElementById('btn-status-offline');
    if (btnStatus && !btnStatus.dataset.bind) {
        btnStatus.dataset.bind = '1';
        btnStatus.addEventListener('click', function() {
            if (typeof abrirPainelCamadas === 'function') {
                abrirPainelCamadas();
            }
        });
    }

    if (typeof mapa === 'undefined' || !mapa) {
        const esperarMapa = setInterval(function() {
            if (typeof mapa !== 'undefined' && mapa) {
                mapa.on('moveend zoomend', function() {
                    atualizarStatusOfflineHeader();
                    if (document.getElementById('painel-camadas') &&
                        document.getElementById('painel-camadas').style.display === 'flex') {
                        renderizarSecaoOffline();
                    }
                });
                atualizarStatusOfflineHeader();
                clearInterval(esperarMapa);
            }
        }, 500);
        setTimeout(function() { clearInterval(esperarMapa); }, 30000);
    }
});
