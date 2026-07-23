/* ============================================
   AGF COLETA - Mapa
   ============================================ */

let mapa = null;
let marcadorAtual = null;
let circuloPrecisao = null;
let marcadores = [];
let layerPontos = null;
let marcadorMarcado = null;
let streetsLayer = null;
let satelliteLayer = null;
let camadasOverlay = {};
let layerControl = null;
let camadasInventarioCarregadas = false;

// ============================================
// INICIALIZAR MAPA
// ============================================

function inicializarMapa() {
    if (typeof L === 'undefined') {
        document.getElementById('mapa').innerHTML = '<div style="padding:40px;text-align:center;color:#c00;"><h3>Erro: Leaflet nao carregou</h3><p>Verifique sua conexao com a internet e recarregue a pagina.</p></div>';
        return;
    }
    
    const latInicial = -20.3132;
    const lngInicial = -42.6067;
    
    // Criar mapa
    mapa = L.map('mapa', {
        center: [latInicial, lngInicial],
        zoom: 13,
        zoomControl: false,
        attributionControl: true
    });
    
    // Camada de ruas (OpenStreetMap)
    streetsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        crossOrigin: true
    });
    
    // Camada de satelite (Google)
    satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: 'Google',
        maxZoom: 19
    });
    
    // Usar satelite como padrao
    satelliteLayer.addTo(mapa);
    
    // Camadas overlay
    camadasOverlay = {};
    
    // Controle de camadas
    layerControl = L.control.layers({
        'Satelite': satelliteLayer,
        'Ruas': streetsLayer
    }, camadasOverlay).addTo(mapa);
    
    // Controles de zoom
    L.control.zoom({
        position: 'topright'
    }).addTo(mapa);
    
    // Camada para pontos
    layerPontos = L.layerGroup().addTo(mapa);
    
    // Evento de clique no mapa
    mapa.on('click', function(e) {
        console.log('Clique no mapa:', e.latlng);
        
        // Fechar painel de camadas se aberto
        if (typeof fecharPainelCamadas === 'function') {
            fecharPainelCamadas();
        }
        
        // Se esta marcando ponto (GPS indisponivel)
        if (App.marcandoPonto) {
            App.pontoMarcado = {
                lat: e.latlng.lat,
                lng: e.latlng.lng
            };
            
            // Atualizar coordenadas no formulario
            const coordEl = document.getElementById('coordenadas-gps');
            if (coordEl) {
                coordEl.textContent = `Lat: ${e.latlng.lat.toFixed(6)} | Lon: ${e.latlng.lng.toFixed(6)}`;
                coordEl.className = 'coordenadas ativo';
            }
            
            // Colocar marcador no mapa
            if (marcadorMarcado) {
                mapa.removeLayer(marcadorMarcado);
            }
            const icon = L.divIcon({
                className: 'marcador-ponto',
                html: '<div class="marcador-ponto-inner" style="background-color: #FF6B6B; width: 16px; height: 16px;"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            marcadorMarcado = L.marker([e.latlng.lat, e.latlng.lng], { icon: icon })
                .addTo(mapa)
                .bindPopup('Ponto a coletar')
                .openPopup();
            
            mostrarToast('Ponto marcado! Preencha o formulario.', 'sucesso');
        }
    });
    
    // Atualizar coordenadas ao mover o mapa
    mapa.on('move', function() {
        if (typeof atualizarCoordenadasMapa === 'function') {
            atualizarCoordenadasMapa();
        }
    });
    
    // Marcador de posicao atual
    if (App.currentPosition) {
        adicionarMarcadorPosicao(App.currentPosition);
    }
    
    console.log('Mapa inicializado em', latInicial, lngInicial);
}

// ============================================
// CAMADAS DO INVENTARIO
// ============================================

function carregarCamadasInventario() {
    if (!mapa) return;
    if (camadasInventarioCarregadas) return;
    
    const layersParaFoco = [];
    
    // Propriedades NES
    if (typeof DADOS_Propriedades_NES !== 'undefined' && DADOS_Propriedades_NES.features) {
        const layerPropriedades = L.geoJSON(DADOS_Propriedades_NES, {
            style: { color: '#3498DB', weight: 2, fillColor: '#3498DB', fillOpacity: 0.15 },
            onEachFeature: function(feature, layer) {
                const props = feature.properties || {};
                const nome = props.Name || 'Propriedade';
                layer.bindPopup(`<b>${nome}</b><br>Area: ${props.Shape_Area ? Number(props.Shape_Area).toFixed(2) : '-'}`);
            }
        });
        camadasOverlay['Propriedades NES'] = layerPropriedades;
        layerPropriedades.addTo(mapa);
        layersParaFoco.push(layerPropriedades);
    }
    
    // Quadrantes
    if (typeof DADOS_Quadrantes !== 'undefined' && DADOS_Quadrantes.features) {
        const layerQuadrantes = L.geoJSON(DADOS_Quadrantes, {
            style: { color: '#F39C12', weight: 1.5, fillColor: '#F39C12', fillOpacity: 0.1 },
            onEachFeature: function(feature, layer) {
                const props = feature.properties || {};
                const nome = props.Name || 'Quadrante';
                layer.bindPopup(`<b>${nome}</b>`);
            }
        });
        camadasOverlay['Quadrantes'] = layerQuadrantes;
        layerQuadrantes.addTo(mapa);
        layersParaFoco.push(layerQuadrantes);
    }
    
    // Atualizar controle de camadas
    if (layerControl) {
        mapa.removeControl(layerControl);
    }
    layerControl = L.control.layers({
        'Satelite': satelliteLayer,
        'Ruas': streetsLayer
    }, camadasOverlay).addTo(mapa);
    
    // Focar no bounds de todas as camadas
    if (layersParaFoco.length > 0) {
        const grupoBounds = L.featureGroup(layersParaFoco);
        mapa.fitBounds(grupoBounds.getBounds(), { padding: [30, 30] });
    }
    
    camadasInventarioCarregadas = true;
    console.log('Camadas do inventario carregadas');
}

function removerCamadasInventario() {
    if (!mapa) return;
    
    Object.keys(camadasOverlay).forEach(nome => {
        if (nome === 'Propriedades NES' || nome === 'Quadrantes') {
            mapa.removeLayer(camadasOverlay[nome]);
            delete camadasOverlay[nome];
        }
    });
    
    if (layerControl) {
        mapa.removeControl(layerControl);
    }
    layerControl = L.control.layers({
        'Satelite': satelliteLayer,
        'Ruas': streetsLayer
    }, camadasOverlay).addTo(mapa);
    
    camadasInventarioCarregadas = false;
}

// ============================================
// MARCADORES
// ============================================

function adicionarMarcadorPosicao(posicao) {
    // Remover marcador anterior se existir
    if (marcadorAtual) {
        mapa.removeLayer(marcadorAtual);
    }
    if (circuloPrecisao) {
        mapa.removeLayer(circuloPrecisao);
    }
    
    // Criar circulo de precisao (estilo Google Maps)
    circuloPrecisao = L.circle([posicao.lat, posicao.lng], {
        radius: posicao.accuracy || 50,
        color: '#4285F4',
        fillColor: '#4285F4',
        fillOpacity: 0.25,
        weight: 2,
        opacity: 0.5
    }).addTo(mapa);
    
    // Criar marcador (bolinha azul estilo Google Maps)
    const icon = L.divIcon({
        className: 'marcador-posicao',
        html: `
            <div class="marcador-posicao-externo"></div>
            <div class="marcador-posicao-centro"></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    // Adicionar marcador
    marcadorAtual = L.marker([posicao.lat, posicao.lng], { icon: icon, zIndexOffset: 1000 })
        .addTo(mapa);
}

function adicionarPontoNoMapa(dados) {
    if (!dados || !dados.latitude || !dados.longitude) return;
    
    const campos = dados.campos || {};
    
    // Definir cor: primeiro por camada (Inventario), depois por status
    let cor = '#3498DB';
    
    if (dados.camada && typeof CamadasConfig !== 'undefined' && CamadasConfig.cores[dados.camada]) {
        cor = CamadasConfig.cores[dados.camada];
    } else {
        switch (campos.status) {
            case 'Aplicado':
                cor = '#27AE60'; // Verde
                break;
            case 'Ausente':
                cor = '#F39C12'; // Amarelo
                break;
            case 'Recusado':
                cor = '#E74C3C'; // Vermelho
                break;
            default:
                cor = '#3498DB'; // Azul
        }
    }
    
    // Criar ícone
    const icon = L.divIcon({
        className: 'marcador-ponto',
        html: `<div class="marcador-ponto-inner" style="background-color: ${cor}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
    
    // Criar marcador
    const marcador = L.marker([dados.latitude, dados.longitude], { icon: icon })
        .addTo(layerPontos);
    marcador.camada = dados.camada || null;
    
    // Criar popup
    const popupContent = criarPopupConteudo(dados);
    marcador.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'popup-ponto'
    });
    
    // Guardar referência
    dados._marcador = marcador;
    marcadores.push(marcador);
}

function criarPopupConteudo(dados) {
    const camada = dados.camada || '';
    const campos = dados.campos || {};
    
    let cor = '#3498DB';
    if (camada && typeof CamadasConfig !== 'undefined' && CamadasConfig.cores[camada]) {
        cor = CamadasConfig.cores[camada];
    }
    
    let nomeCamada = '';
    let camposHtml = '';
    
    if (camada && typeof DADOS_CONFIG_INVENTARIO !== 'undefined' && DADOS_CONFIG_INVENTARIO.camadas[camada]) {
        const configCamada = DADOS_CONFIG_INVENTARIO.camadas[camada];
        nomeCamada = configCamada.nome;
        const camposMostrar = configCamada.campos || [];
        const temFuste = camposMostrar.some(c => c.tipo === 'fuste_grupo');
        const fustes = campos.fustes || [];
        
        camposHtml = camposMostrar.map(campo => {
            if (campo.nome === 'DATA' || campo.nome === 'RESPONSAVEL_DE_CAMPO') return '';
            if (campo.tipo === 'fuste_campo') return '';
            if (campo.tipo === 'fuste_grupo') {
                if (temFuste && fustes.length > 0) {
                    let html = '';
                    fustes.forEach(fuste => {
                        let fusteHtml = `<div class="popup-fuste"><strong>Fuste ${fuste.numero} de ${fuste.de}:</strong>`;
                        if (fuste.ALTURA) fusteHtml += ` Altura: ${fuste.ALTURA}m`;
                        if (fuste.CAP) fusteHtml += ` | CAP: ${fuste.CAP}cm`;
                        if (fuste.COPA_D1) fusteHtml += ` | D1: ${fuste.COPA_D1}m`;
                        if (fuste.COPA_D2) fusteHtml += ` | D2: ${fuste.COPA_D2}m`;
                        fusteHtml += '</div>';
                        html += fusteHtml;
                    });
                    return html;
                }
                return '';
            }
            const valor = campos[campo.nome] || '';
            if (!valor) return '';
            return `<p><strong>${campo.label}:</strong> ${valor}</p>`;
        }).filter(Boolean).join('');
    }
    
    const status = dados.status || 'novo';
    const statusLabel = status === 'novo' ? 'Pendente' : 'Sincronizado';
    const statusClass = status === 'novo' ? 'pendente' : 'sincronizado';
    const editarBtn = `<button class="btn-editar-popup" onclick="editarPontoLocal('${dados.id}')">Editar</button>`;
    
    return `
        <div class="popup-conteudo">
            <div class="popup-cabecalho" style="background-color: ${cor}">
                <h4>${nomeCamada || 'Ponto'}</h4>
                <span>${camada || ''} - <span class="revisao-status ${statusClass}">${statusLabel}</span></span>
            </div>
            <div class="popup-corpo">
                ${camposHtml}
                <p><strong>Coletado por:</strong> ${dados.tecnico || 'N/A'}</p>
                <p><strong>Data:</strong> ${formatarData(dados.dataColeta)}</p>
            </div>
            <div class="popup-rodape">
                ${editarBtn}
            </div>
        </div>
    `;
}

function getCorStatus(status) {
    switch (status) {
        case 'Aplicado': return '#27AE60';
        case 'Ausente': return '#F39C12';
        case 'Recusado': return '#E74C3C';
        case 'Ainda Voltar': return '#9B59B6';
        default: return '#3498DB';
    }
}

function formatarData(dataISO) {
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// CARREGAR PONTOS
// ============================================

function carregarPontosNoMapa() {
    // Limpar marcadores anteriores
    layerPontos.clearLayers();
    marcadores = [];
    
    // Carregar dados do Box
    const dadosBox = App.dadosBox[App.projetoAtual] || [];
    
    // Adicionar cada feature no mapa
    dadosBox.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
            const coords = feature.geometry.coordinates;
            let lat, lng;
            
            // Converter coordenadas baseado no tipo de geometria
            if (feature.geometry.type === 'Point') {
                lng = coords[0];
                lat = coords[1];
            } else if (feature.geometry.type === 'MultiPoint' || feature.geometry.type === 'LineString') {
                // Usar primeiro ponto
                lng = coords[0][0];
                lat = coords[0][1];
            } else if (feature.geometry.type === 'Polygon') {
                // Usar primeiro ponto do anel externo
                lng = coords[0][0][0];
                lat = coords[0][0][1];
            }
            
            if (lat && lng) {
                adicionarFeatureNoMapa(feature, lat, lng);
            }
        }
    });
    
    // Tambem carregar dados locais (coletados pelo usuario)
    const dadosLocais = App.dadosLocais[App.projetoAtual] || [];
    dadosLocais.forEach(dado => {
        if (dado.latitude && dado.longitude) {
            adicionarPontoNoMapa(dado);
        }
    });
    
    console.log(`📍 ${marcadores.length} pontos carregados no mapa`);
}

// ============================================
// ADICIONAR FEATURE DO BOX NO MAPA
// ============================================

function adicionarFeatureNoMapa(feature, lat, lng) {
    const props = feature.properties || {};
    
    // Determinar cor: primeiro por camada (Inventario), depois por status
    let cor = '#3498DB'; // Azul padrao
    
    const camada = feature._camada || props._camada;
    if (camada && typeof CamadasConfig !== 'undefined' && CamadasConfig.cores[camada]) {
        cor = CamadasConfig.cores[camada];
    } else {
        const status = props.STATUS_DA_PESQUISA || props.status || '';
        
        if (status.includes('Aplicado') || status.includes('APLICADO')) {
            cor = '#27AE60'; // Verde
        } else if (status.includes('Ausente') || status.includes('AUSENTE')) {
            cor = '#F39C12'; // Amarelo
        } else if (status.includes('Recusado') || status.includes('RECUSADO')) {
            cor = '#E74C3C'; // Vermelho
        } else if (status.includes('Voltar') || status.includes('VOLTAR')) {
            cor = '#9B59B6'; // Roxo
        }
    }
    
    // Criar icone
    const icon = L.divIcon({
        className: 'marcador-ponto',
        html: `<div class="marcador-ponto-inner" style="background-color: ${cor}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
    
    // Criar marcador
    const marcador = L.marker([lat, lng], { icon: icon })
        .addTo(layerPontos);
    marcador.camada = camada || null;
    
    // Criar popup
    const popupContent = criarPopupFeature(feature, camada);
    marcador.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'popup-ponto'
    });
    
    marcadores.push(marcador);
}

// ============================================
// CRIAR POPUP PARA FEATURE DO BOX
// ============================================

function criarPopupFeature(feature, camada) {
    const props = feature.properties || {};
    
    let cor = '#3498DB';
    if (camada && typeof CamadasConfig !== 'undefined' && CamadasConfig.cores[camada]) {
        cor = CamadasConfig.cores[camada];
    }
    
    let nomeCamada = '';
    let camposHtml = '';
    
    if (camada && typeof DADOS_CONFIG_INVENTARIO !== 'undefined' && DADOS_CONFIG_INVENTARIO.camadas[camada]) {
        const configCamada = DADOS_CONFIG_INVENTARIO.camadas[camada];
        nomeCamada = configCamada.nome;
        const camposMostrar = configCamada.campos || [];
        const temFuste = camposMostrar.some(c => c.tipo === 'fuste_grupo');
        const fustes = props.fustes || [];
        
        camposHtml = camposMostrar.map(campo => {
            if (campo.nome === 'DATA' || campo.nome === 'RESPONSAVEL_DE_CAMPO') return '';
            if (campo.tipo === 'fuste_campo') return '';
            if (campo.tipo === 'fuste_grupo') {
                if (temFuste && fustes.length > 0) {
                    let html = '';
                    fustes.forEach(fuste => {
                        let fusteHtml = `<div class="popup-fuste"><strong>Fuste ${fuste.numero} de ${fuste.de}:</strong>`;
                        if (fuste.ALTURA) fusteHtml += ` Altura: ${fuste.ALTURA}m`;
                        if (fuste.CAP) fusteHtml += ` | CAP: ${fuste.CAP}cm`;
                        if (fuste.COPA_D1) fusteHtml += ` | D1: ${fuste.COPA_D1}m`;
                        if (fuste.COPA_D2) fusteHtml += ` | D2: ${fuste.COPA_D2}m`;
                        fusteHtml += '</div>';
                        html += fusteHtml;
                    });
                    return html;
                }
                return '';
            }
            const valor = props[campo.nome] || '';
            if (!valor) return '';
            return `<p><strong>${campo.label}:</strong> ${valor}</p>`;
        }).filter(Boolean).join('');
    } else {
        camposHtml = `
            ${props.ENDERECO_COMPLETO || props.endereco ? `<p><strong>Endereco:</strong> ${props.ENDERECO_COMPLETO || props.endereco}</p>` : ''}
            <p><strong>Coletado por:</strong> ${props.ENTREVISTADOR || props._tecnico || 'N/A'}</p>
            <p><strong>Data:</strong> ${props.DATA || props._data_coleta || 'N/A'}</p>
        `;
    }
    
    const featureId = props._id || '';
    const editarBtn = featureId ? `<button class="btn-editar-popup" onclick="editarPontoBox('${featureId}', '${camada}')">Editar</button>` : '';
    
    return `
        <div class="popup-conteudo">
            <div class="popup-cabecalho" style="background-color: ${cor}">
                <h4>${nomeCamada || 'Ponto'}</h4>
                <span>${camada || ''} - <span class="revisao-status sincronizado">Sincronizado</span></span>
            </div>
            <div class="popup-corpo">
                ${camposHtml}
            </div>
            <div class="popup-rodape">
                ${editarBtn}
            </div>
        </div>
    `;
}

// ============================================
// ESTILOS CSS DINAMICOS
// ============================================

// Criar estilos para marcadores
const estiloMarcadores = document.createElement('style');
estiloMarcadores.textContent = `
    .marcador-ponto {
        background: transparent;
    }
    
    .marcador-ponto-inner {
        width: 12px;
        height: 12px;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .popup-conteudo {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .popup-cabecalho {
        padding: 12px;
        color: white;
        border-radius: 8px 8px 0 0;
    }
    
    .popup-cabecalho h4 {
        margin: 0 0 4px 0;
        font-size: 14px;
    }
    
    .popup-cabecalho span {
        font-size: 12px;
        opacity: 0.9;
    }
    
    .popup-corpo {
        padding: 12px;
    }
    
    .popup-corpo p {
        margin: 0 0 8px 0;
        font-size: 12px;
        color: #333;
    }
    
    .popup-corpo p:last-child {
        margin-bottom: 0;
    }
    
    .marcador-posicao {
        background: transparent;
        border: none;
    }
    
    .marcador-posicao-externo {
        width: 24px;
        height: 24px;
        background: rgba(66, 133, 244, 0.2);
        border: 2px solid rgba(66, 133, 244, 0.6);
        border-radius: 50%;
        position: absolute;
        top: 0;
        left: 0;
    }
    
    .marcador-posicao-centro {
        width: 12px;
        height: 12px;
        background: #4285F4;
        border: 3px solid white;
        border-radius: 50%;
        position: absolute;
        top: 6px;
        left: 6px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
`;
document.head.appendChild(estiloMarcadores);
