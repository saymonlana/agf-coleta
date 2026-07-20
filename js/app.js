/* ============================================
   AGF COLETA - App Principal
   ============================================ */

// Estado do App
const App = {
    usuario: null,
    projetoAtual: null,
    dadosLocais: {},
    dadosBox: {},
    config: null,
    positionWatch: null,
    currentPosition: null,
    projetos: [],
    marcandoPonto: false,
    pontoMarcado: null
};

// ============================================
// INICIALIZACAO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    inicializarApp();
});

function inicializarApp() {
    console.log('AGF Coleta inicializando...');
    
    // Registrar Service Worker para offline
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado'))
            .catch(err => console.log('Erro ao registrar SW:', err));
    }
    
    // Verificar callback OAuth (quando volta do login do Box)
    try {
        if (typeof verificarCallbackOAuth === 'function') {
            verificarCallbackOAuth();
        }
    } catch(e) { console.log('Erro callback:', e); }
    
    // Verificar se ja esta logado
    const usuarioSalvo = localStorage.getItem('agf_usuario');
    if (usuarioSalvo) {
        App.usuario = JSON.parse(usuarioSalvo);
        mostrarTela('tela-projetos');
    }
    
    // Carregar dados locais e fila
    carregarDadosLocais();
    try { FilaSync.carregar(); } catch(e) { console.log('Erro fila:', e); }
    
    // Carregar dados do Box
    carregarDadosBox();
    
    // Configurar event listeners
    try {
        configurarEventListeners();
    } catch(e) {
        console.log('Erro ao configurar listeners:', e);
        // Fallback: adicionar listener direto no form
        const form = document.getElementById('form-login');
        if (form) {
            form.addEventListener('submit', function(evt) {
                evt.preventDefault();
                handleLogin(evt);
                return false;
            });
        }
    }
    
    // Verificar status do token Box
    try {
        const tokenSalvo = localStorage.getItem('agf_box_token_input');
        if (tokenSalvo) {
            document.getElementById('input-token-box').value = tokenSalvo;
        }
        atualizarStatusToken();
    } catch(e) { console.log('Erro token:', e); }
    
    // Iniciar GPS
    try { iniciarGPS(); } catch(e) { console.log('Erro GPS:', e); }
    
    // Verificar conexao
    if (!navigator.onLine) {
        mostrarToast('Modo offline. Dados serao sincronizados quando conectar.', 'aviso');
    }
}

// ============================================
// CARREGAR DADOS DO BOX
// ============================================

async function carregarDadosBox() {
    console.log('Carregando dados...');
    
    try {
        // 1. Carregar configuracao (variavel global DADOS_CONFIG)
        if (typeof DADOS_CONFIG !== 'undefined') {
            App.config = DADOS_CONFIG;
            console.log('  Configuracao PAEBM carregada');
        }
        
        // 2. Carregar configuracao do Inventário
        if (typeof DADOS_CONFIG_INVENTARIO !== 'undefined') {
            App.configInventario = DADOS_CONFIG_INVENTARIO;
            console.log('  Configuracao Inventario carregada');
        }
        
        // 3. Carregar projetos (variavel global DADOS_PROJETOS)
        if (typeof DADOS_PROJETOS !== 'undefined') {
            App.projetos = DADOS_PROJETOS.projetos || [];
            console.log(`  ${App.projetos.length} projetos encontrados`);
        }
        
        // 4. Carregar dados do Questionario (variavel global DADOS_QUESTIONARIO)
        if (typeof DADOS_QUESTIONARIO !== 'undefined') {
            App.dadosBox['paebm'] = DADOS_QUESTIONARIO.features || [];
            console.log(`  Questionario: ${App.dadosBox['paebm'].length} registros`);
        }
        
        // 5. Carregar complementos
        if (typeof DADOS_ANIMAIS !== 'undefined') {
            App.dadosBox['animais'] = DADOS_ANIMAIS.features || [];
        }
        if (typeof DADOS_MORADORES !== 'undefined') {
            App.dadosBox['moradores'] = DADOS_MORADORES.features || [];
        }
        
        // 6. Tentar carregar dados do Inventário do Box (se token disponível)
        const tokenSalvo = localStorage.getItem('agf_box_token');
        if (tokenSalvo && typeof listarGeoJSONInventario === 'function') {
            console.log('  Tentando carregar dados do Inventario do Box...');
            // Será carregado quando o usuário abrir o projeto
        }
        
        // Atualizar UI
        atualizarListaProjetos();
        
    } catch (e) {
        console.log('Erro ao carregar dados: ' + e.message);
    }
}

// ============================================
// CACHE DO INVENTARIO (localStorage)
// ============================================

function salvarCacheInventario(dados) {
    try {
        const cache = {
            dados: dados,
            timestamp: Date.now()
        };
        localStorage.setItem('agf_inventario_cache', JSON.stringify(cache));
        console.log('Cache salvo:', dados.length, 'registros');
    } catch (e) {
        console.error('Erro ao salvar cache:', e);
    }
}

function carregarCacheInventario() {
    try {
        const raw = localStorage.getItem('agf_inventario_cache');
        if (!raw) return null;
        
        const cache = JSON.parse(raw);
        const idadeHoras = (Date.now() - cache.timestamp) / (1000 * 60 * 60);
        console.log('Cache encontrado:', cache.dados.length, 'registros,', idadeHoras.toFixed(1), 'horas atras');
        
        return cache.dados;
    } catch (e) {
        console.error('Erro ao carregar cache:', e);
        return null;
    }
}

function limparCacheInventario() {
    localStorage.removeItem('agf_inventario_cache');
}

// ============================================
// CARREGAR INVENTARIO DO BOX
// ============================================

async function carregarInventarioDoBox() {
    console.log('Iniciando carregamento do Box...');
    
    // 1. Carregar do cache primeiro (instantaneo)
    const cache = carregarCacheInventario();
    if (cache && cache.length > 0) {
        App.dadosBox['inventario'] = cache;
        console.log('Carregado do cache:', cache.length, 'registros');
    }
    
    // 2. Buscar do Box em background
    if (!await verificarToken()) {
        console.log('Sem token Box, usando cache');
        if (!cache || cache.length === 0) {
            mostrarToast('Sem conexao com Box. Dados locais apenas.', 'aviso');
        }
        return;
    }
    
    try {
        // Mostrar toast persistente (sem auto-hide)
        const toast = document.getElementById('toast');
        toast.textContent = 'Baixando dados do Box...';
        toast.className = 'toast info ativo';
        
        await listarGeoJSONInventario();
        
        const camadas = Object.keys(InventarioSync.file_ids);
        console.log('Camadas:', camadas);
        
        if (camadas.length === 0) {
            console.log('Nenhum GeoJSON encontrado no Box');
            toast.classList.remove('ativo');
            return;
        }
        
        const novosDados = [];
        const resultados = await Promise.all(camadas.map(camada => baixarGeoJSON(camada)));
        
        resultados.forEach((geojson, i) => {
            if (geojson && geojson.features) {
                geojson.features.forEach(f => {
                    f._camada = camadas[i];
                    novosDados.push(f);
                });
                console.log(`  ${camadas[i]}: ${geojson.features.length} registros`);
            }
        });
        
        // 3. Salvar no cache
        App.dadosBox['inventario'] = novosDados;
        salvarCacheInventario(novosDados);
        
        console.log(`Total do Box: ${novosDados.length} registros`);
        
        // 4. Atualizar mapa
        if (mapa && App.projetoAtual === 'inventario') {
            carregarPontosNoMapa();
        }
        
        // 5. Esconder toast e mostrar sucesso
        toast.classList.remove('ativo');
        if (cache && cache.length !== novosDados.length) {
            mostrarToast(`${novosDados.length} registros atualizados do Box`, 'sucesso');
        }
        
    } catch (e) {
        console.error('Erro ao carregar inventario do Box:', e);
        const toast = document.getElementById('toast');
        toast.classList.remove('ativo');
        if (!cache || cache.length === 0) {
            mostrarToast('Erro ao carregar do Box', 'erro');
        }
    }
}

// ============================================
// ATUALIZAR LISTA DE PROJETOS
// ============================================

function atualizarListaProjetos() {
    const container = document.getElementById('lista-projetos');
    const cardPaebm = container.querySelector('[data-projeto="paebm"]');
    const cardInventario = container.querySelector('[data-projeto="inventario"]');
    
    if (cardPaebm && App.dadosBox['paebm']) {
        const total = App.dadosBox['paebm'].length;
        const status = cardPaebm.querySelector('.projeto-status');
        if (status) {
            status.textContent = `${total} registros no Box`;
        }
    }
    
    // Atualizar status do Inventário
    if (cardInventario) {
        const dadosLocais = App.dadosLocais['inventario'] || [];
        const novos = dadosLocais.filter(d => d.status === 'novo').length;
        const status = cardInventario.querySelector('.projeto-status');
        if (status) {
            if (novos > 0) {
                status.textContent = `${novos} coletados (pendentes)`;
            } else {
                status.textContent = 'Nenhum registro coletado';
            }
        }
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function configurarEventListeners() {
    // Login
    try { document.getElementById('form-login').addEventListener('submit', handleLogin); } catch(e) {}
    
    // Login com Box
    try { document.getElementById('btn-login-box').addEventListener('click', handleLoginBox); } catch(e) {}
    
    // Logout
    try { document.getElementById('btn-logout').addEventListener('click', handleLogout); } catch(e) {}
    
    // Projetos
    document.querySelectorAll('.projeto-card[data-projeto]').forEach(card => {
        card.addEventListener('click', () => {
            const projeto = card.dataset.projeto;
            if (projeto === 'paebm' || projeto === 'inventario') {
                abrirProjeto(projeto);
            } else {
                mostrarToast('Projeto em configuracao', 'aviso');
            }
        });
    });
    
    // Botao voltar (mapa -> projetos)
    try { document.getElementById('btn-voltar').addEventListener('click', () => { mostrarTela('tela-projetos'); }); } catch(e) {}
    
    // Botao coletar
    try { document.getElementById('btn-coletar').addEventListener('click', () => { abrirFormularioColeta(); }); } catch(e) {}
    
    // Botao salvar
    try { document.getElementById('btn-salvar').addEventListener('click', handleSalvar); } catch(e) {}
    
    // Botao voltar do mapa (coleta -> mapa)
    try { document.getElementById('btn-voltar-mapa').addEventListener('click', () => { restaurarTituloProjeto(); mostrarTela('tela-mapa'); }); } catch(e) {}
    
    // Botao sync
    try { document.getElementById('btn-sync').addEventListener('click', handleSync); } catch(e) {}
    
    // Botao minha localizacao
    try {
        document.getElementById('btn-minha-localizacao').addEventListener('click', () => {
            if (App.currentPosition) {
                mapa.setView([App.currentPosition.lat, App.currentPosition.lng], 16);
                adicionarMarcadorPosicao(App.currentPosition);
                mostrarToast('Centralizando na sua localizacao', 'sucesso');
            } else {
                mostrarToast('GPS ainda nao disponível', 'aviso');
            }
        });
    } catch(e) {}
    
    // Botao foto
    try { document.getElementById('btn-tirar-foto').addEventListener('click', () => { document.getElementById('input-foto').click(); }); } catch(e) {}
    
    // Input foto
    try { document.getElementById('input-foto').addEventListener('change', handleFoto); } catch(e) {}
    
    // Modal sync
    try { document.getElementById('btn-fechar-sync').addEventListener('click', () => { document.getElementById('modal-sync').classList.remove('ativo'); }); } catch(e) {}
    
    // Token Box
    try {
        document.getElementById('btn-salvar-token').addEventListener('click', () => {
            const token = document.getElementById('input-token-box').value.trim();
            if (configurarTokenBox(token)) {
                atualizarStatusToken();
            }
        });
    } catch(e) {}
    
    // Limpar token
    try {
        document.getElementById('btn-limpar-token').addEventListener('click', () => {
            limparTokenBox();
            document.getElementById('input-token-box').value = '';
        });
    } catch(e) {}
}

function handleSync() {
    console.log('handleSync chamado');
    console.log('Token:', Sync.access_token ? 'presente' : 'ausente');
    
    if (!Sync.access_token) {
        mostrarToast('Configure o token do Box primeiro!', 'aviso');
        return;
    }
    
    const dadosLocais = App.dadosLocais[App.projetoAtual] || [];
    const dadosNovos = dadosLocais.filter(d => d.status === 'novo');
    const dadosEditadosBox = JSON.parse(localStorage.getItem('agf_inventario_editados') || '[]');
    
    console.log('Dados locais:', dadosLocais.length, '| Novos:', dadosNovos.length, '| Editados Box:', dadosEditadosBox.length);
    
    if (dadosNovos.length === 0 && dadosEditadosBox.length === 0) {
        mostrarToast('Nenhum dado novo para sincronizar', 'aviso');
        return;
    }
    
    sincronizarDados();
}



function atualizarStatusToken() {
    const statusEl = document.getElementById('token-status');
    const salvo = obterTokenSalvo();
    const tokenType = localStorage.getItem('agf_box_token_type');
    
    if (salvo) {
        const restante = Math.round((salvo.expira - Date.now()) / 60000);
        let texto = '';
        
        if (tokenType === 'oauth') {
            if (restante > 1440) { // mais de 24h
                const dias = Math.floor(restante / 1440);
                texto = `Conectado via Box (expira em ${dias} dias)`;
            } else if (restante > 60) {
                const horas = Math.floor(restante / 60);
                const mins = restante % 60;
                texto = `Conectado via Box (expira em ${horas}h ${mins}min)`;
            } else {
                texto = `Conectado via Box (expira em ${restante} min)`;
            }
        } else {
            if (restante > 60) {
                const horas = Math.floor(restante / 60);
                const mins = restante % 60;
                texto = `Token ativo (expira em ${horas}h ${mins}min)`;
            } else {
                texto = `Token ativo (expira em ${restante} min)`;
            }
        }
        
        statusEl.textContent = texto;
        statusEl.className = 'token-status conectado';
    } else {
        statusEl.textContent = 'Nao conectado ao Box';
        statusEl.className = 'token-status erro';
    }
}

// ============================================
// AUTENTICACAO
// ============================================

function handleLogin(e) {
    e.preventDefault();
    
    const nome = document.getElementById('email').value;
    
    if (nome && nome.trim() !== '') {
        App.usuario = {
            email: nome.trim().toLowerCase().replace(/\s+/g, '.') + '@agroflor.com.br',
            nome: nome.trim(),
            loginEm: new Date().toISOString()
        };
        
        localStorage.setItem('agf_usuario', JSON.stringify(App.usuario));
        mostrarToast('Bem-vindo, ' + App.usuario.nome + '!', 'sucesso');
        mostrarTela('tela-projetos');
    } else {
        mostrarToast('Digite seu nome', 'erro');
    }
    return false;
}

async function handleLoginBox() {
    mostrarToast('Abrindo login do Box...', 'info');
    await iniciarLoginBox();
}

function handleLogout() {
    App.usuario = null;
    localStorage.removeItem('agf_usuario');
    
    // Logout do Box tambem
    if (typeof logoutBox === 'function') {
        logoutBox();
    }
    
    mostrarTela('tela-login');
    mostrarToast('Logout realizado', 'info');
}

// ============================================
// NAVEGACAO ENTRE TELAS
// ============================================

function mostrarTela(telaId) {
    document.querySelectorAll('.tela').forEach(tela => {
        tela.classList.remove('ativa');
    });
    document.getElementById(telaId).classList.add('ativa');
    
    if (telaId === 'tela-mapa') {
        setTimeout(() => {
            if (mapa) {
                mapa.invalidateSize();
            }
        }, 200);
    }
}

// ============================================
// PROJETOS
// ============================================

async function abrirProjeto(projetoId) {
    App.projetoAtual = projetoId;
    
    const projeto = App.projetos.find(p => p.id === projetoId);
    const nomeProjeto = projeto ? projeto.nome : 'Projeto';
    
    document.getElementById('titulo-projeto').textContent = nomeProjeto;
    atualizarContadorPontos();
    
    // Mostrar/esconder botão de camadas (só para Inventário)
    const btnCamadas = document.getElementById('btn-camadas');
    if (btnCamadas) {
        btnCamadas.style.display = projetoId === 'inventario' ? 'flex' : 'none';
    }
    
    // Controlar botão de coleta
    const btnColetar = document.getElementById('btn-coletar');
    const crosshair = document.getElementById('crosshair');
    if (btnColetar) {
        if (projetoId === 'inventario') {
            // No Inventário, esconder até selecionar camada
            btnColetar.style.display = 'none';
            if (crosshair) crosshair.style.display = 'none';
            CamadasConfig.camadaAtiva = null;
        } else {
            // Em outros projetos, mostrar normalmente
            btnColetar.style.display = 'flex';
            if (crosshair) crosshair.style.display = 'none';
        }
    }
    
    mostrarTela('tela-mapa');
    
    if (!mapa) {
        inicializarMapa();
    } else {
        setTimeout(() => { mapa.invalidateSize(); }, 200);
    }
    
    if (projetoId === 'inventario') {
        carregarInventarioDoBox();
        carregarCamadasInventario();
    } else {
        removerCamadasInventario();
    }
    
    carregarPontosNoMapa();
    atualizarContadorPontos();
}

function restaurarTituloProjeto() {
    const projeto = App.projetos.find(p => p.id === App.projetoAtual);
    const nomeProjeto = projeto ? projeto.nome : 'Projeto';
    document.getElementById('titulo-projeto').textContent = nomeProjeto;
}

function atualizarContadorPontos() {
    const dadosBox = App.dadosBox[App.projetoAtual] || [];
    const totalBox = dadosBox.length;
    
    const dadosLocais = App.dadosLocais[App.projetoAtual] || [];
    const novos = dadosLocais.filter(d => d.status === 'novo').length;
    
    const dadosEditados = JSON.parse(localStorage.getItem('agf_inventario_editados') || '[]');
    const editadosBox = dadosEditados.length;
    
    const totalPendentes = novos + editadosBox;
    
    let texto = `${totalBox} registros`;
    if (totalPendentes > 0) {
        texto += ` | ${totalPendentes} pendente(s)`;
    }
    
    document.getElementById('contador-pontos').textContent = texto;
    
    // Atualizar badge no botao de sync
    const btnSync = document.getElementById('btn-sync');
    let badge = btnSync.querySelector('.badge-pendentes');
    
    if (totalPendentes > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge-pendentes';
            btnSync.style.position = 'relative';
            btnSync.appendChild(badge);
        }
        badge.textContent = totalPendentes;
    } else if (badge) {
        badge.remove();
    }
}

// ============================================
// FORMULARIO DE COLETA
// ============================================

function abrirFormularioColeta() {
    document.getElementById('form-coleta').reset();
    document.getElementById('preview-foto').innerHTML = '';
    
    // Atualizar titulo do cabecalho com nome da camada (Inventario)
    const h1 = document.querySelector('#tela-coleta h1');
    if (App.projetoAtual === 'inventario' && CamadasConfig.camadaAtiva) {
        const camadas = DADOS_CONFIG_INVENTARIO.camadas;
        const nomeCamada = camadas[CamadasConfig.camadaAtiva]?.nome || '';
        h1.textContent = `Novo Ponto - ${nomeCamada}`;
    } else {
        h1.textContent = 'Novo Ponto';
    }
    
    // Para Inventário, usar coordenadas do centro do mapa (crosshair)
    if (App.projetoAtual === 'inventario' && mapa) {
        const center = mapa.getCenter();
        document.getElementById('coordenadas-gps').textContent = 
            `Lat: ${center.lat.toFixed(6)} | Lon: ${center.lng.toFixed(6)}`;
        document.getElementById('coordenadas-gps').className = 'coordenadas ativo';
        
        // Exibir coordenadas UTM
        exibirCoordenadasUTM(center.lat, center.lng);
        
        // Salvar posição do crosshair para uso no salvar
        App.crosshairPosition = {
            lat: center.lat,
            lng: center.lng
        };
    } else if (App.currentPosition) {
        document.getElementById('coordenadas-gps').textContent = 
            `Lat: ${App.currentPosition.lat.toFixed(6)} | Lon: ${App.currentPosition.lng.toFixed(6)}`;
        document.getElementById('coordenadas-gps').className = 'coordenadas ativo';
        
        // Exibir coordenadas UTM
        exibirCoordenadasUTM(App.currentPosition.lat, App.currentPosition.lng);
    } else {
        document.getElementById('coordenadas-gps').textContent = 'GPS indisponivel - clique no mapa para marcar';
        document.getElementById('coordenadas-gps').className = 'coordenadas sem-gps';
        document.getElementById('coordenadas-utm').className = 'coordenadas-utm';
        // Ativar modo de clique no mapa
        App.marcandoPonto = true;
        mostrarToast('Clique no mapa para marcar a localizacao', 'info');
    }
    
    gerarCamposFormulario();
    mostrarTela('tela-coleta');
}

function gerarCamposFormulario() {
    const container = document.getElementById('campos-formulario');
    container.innerHTML = '';
    
    // Para o Inventário, primeiro mostrar seleção de camada
    if (App.projetoAtual === 'inventario') {
        gerarFormularioInventario(container);
        return;
    }
    
    let campos = [];
    
    // Buscar campos do config.json (PAEBM)
    if (App.config && App.config.camadas_coleta) {
        const questionario = App.config.camadas_coleta['Questionario_PAEBM_SAG'];
        if (questionario && questionario.campos) {
            campos = questionario.campos;
        }
    }
    
    // Se nao tem config, usar campos padrao
    if (campos.length === 0) {
        campos = [
            { nome: 'STATUS_DA_PESQUISA', label: 'Status da Pesquisa', tipo: 'lista', obrigatorio: true, opcoes: ['Aplicado', 'Ausente', 'Recusado', 'Ainda Voltar'] },
            { nome: 'NOME_DO_ENTREVISTADO', label: 'Nome do Entrevistado', tipo: 'texto', obrigatorio: true },
            { nome: 'ENDERECO_COMPLETO', label: 'Endereco Completo', tipo: 'textarea', obrigatorio: true },
            { nome: 'NOME_DO_PROPRIETARIO', label: 'Nome do Proprietario', tipo: 'texto', obrigatorio: false },
            { nome: 'TIPO_DE_USO_DO_IMOVEL', label: 'Tipo de Uso do Imovel', tipo: 'lista', obrigatorio: true, opcoes: ['Residencial', 'Comercial', 'Misto', 'Outro'] },
            { nome: 'QUANTAS_PESSOAS_MORAM_NA_RESIDENCIA', label: 'Quantas pessoas moram na residencia', tipo: 'numero', obrigatorio: true },
            { nome: 'OBSERVACOES', label: 'Observacoes', tipo: 'textarea', obrigatorio: false }
        ];
    }
    
    campos.forEach(campo => {
        const div = document.createElement('div');
        div.className = 'campo-formulario';
        
        const label = document.createElement('label');
        label.textContent = campo.label;
        if (campo.obrigatorio) {
            label.innerHTML += ' <span class="obrigatorio">*</span>';
        }
        div.appendChild(label);
        
        let input;
        
        if (campo.tipo === 'lista') {
            input = document.createElement('select');
            input.innerHTML = '<option value="">Selecione...</option>';
            (campo.opcoes || []).forEach(opcao => {
                const option = document.createElement('option');
                option.value = opcao;
                option.textContent = opcao;
                input.appendChild(option);
            });
        } else if (campo.tipo === 'textarea') {
            input = document.createElement('textarea');
            input.placeholder = 'Digite suas observacoes...';
        } else if (campo.tipo === 'numero' || campo.tipo === 'numero_decimal') {
            input = document.createElement('input');
            input.type = 'number';
            input.step = campo.tipo === 'numero_decimal' ? '0.01' : '1';
            input.placeholder = `Digite ${campo.label.toLowerCase()}...`;
        } else if (campo.tipo === 'data') {
            input = document.createElement('input');
            input.type = 'date';
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Digite ${campo.label.toLowerCase()}...`;
        }
        
        input.name = campo.nome;
        input.required = campo.obrigatorio;
        div.appendChild(input);
        
        container.appendChild(div);
    });
    
    // Adicionar botoes para complementos
    const divComplementos = document.createElement('div');
    divComplementos.className = 'complementos-section';
    divComplementos.innerHTML = `
        <h3>Complementos (opcional)</h3>
        <div class="botoes-complementos">
            <button type="button" class="btn-complemento" onclick="abrirComplemento('moradores')">
                + Morador
            </button>
            <button type="button" class="btn-complemento" onclick="abrirComplemento('animais_domesticos')">
                + Animal Domestico
            </button>
            <button type="button" class="btn-complemento" onclick="abrirComplemento('animais_silvestres')">
                + Animal Silvestre
            </button>
            <button type="button" class="btn-complemento" onclick="abrirComplemento('producao')">
                + Producao
            </button>
        </div>
        <div id="lista-complementos"></div>
    `;
    container.appendChild(divComplementos);
}

// ============================================
// FORMULARIO INVENTARIO FLORESTAL
// ============================================

function gerarFormularioInventario(container) {
    if (typeof DADOS_CONFIG_INVENTARIO === 'undefined') {
        container.innerHTML = '<p>Configuracao do inventario nao encontrada.</p>';
        return;
    }
    
    const camadas = DADOS_CONFIG_INVENTARIO.camadas;
    // Verificar se há camada ativa
    const camadaAtiva = CamadasConfig.camadaAtiva;
    
    // Container para os campos da camada selecionada
    const divCampos = document.createElement('div');
    divCampos.id = 'campos-inventario-dinamicos';
    container.appendChild(divCampos);
    
    // Se há camada ativa, já carregar os campos
    if (camadaAtiva) {
        setTimeout(() => atualizarFormularioInventario(), 10);
    }
    
    // Adicionar data automatica
    const divData = document.createElement('div');
    divData.className = 'campo-formulario';
    divData.innerHTML = `
        <label>Data <span class="obrigatorio">*</span></label>
        <input type="date" name="DATA" value="${new Date().toISOString().split('T')[0]}" required>
    `;
    container.insertBefore(divData, divCampos);
    
    // Adicionar responsavel de campo apenas se a camada tiver esse campo
    if (camadaAtiva && camadas[camadaAtiva]) {
        const temResponsavel = camadas[camadaAtiva].campos.some(c => c.nome === 'RESPONSAVEL_DE_CAMPO');
        if (temResponsavel) {
            const divResponsavel = document.createElement('div');
            divResponsavel.className = 'campo-formulario';
            divResponsavel.innerHTML = `
                <label>Responsável de Campo <span class="obrigatorio">*</span></label>
                <input type="text" name="RESPONSAVEL_DE_CAMPO" value="${App.usuario ? App.usuario.nome : ''}" required>
            `;
            container.insertBefore(divResponsavel, divData.nextSibling);
        }
    }
}

function atualizarFormularioInventario() {
    const container = document.getElementById('campos-inventario-dinamicos');
    
    if (!container) return;
    
    const camadaSelecionada = CamadasConfig.camadaAtiva;
    container.innerHTML = '';
    
    if (!camadaSelecionada) return;
    
    const camada = DADOS_CONFIG_INVENTARIO.camadas[camadaSelecionada];
    if (!camada) return;
    
    // Gerar campos da camada (pular DATA porque ja existe)
    // Pular RESPONSAVEL_DE_CAMPO apenas se a camada tiver esse campo (pois ja e adicionado manualmente)
    const temResponsavel = camada.campos.some(c => c.nome === 'RESPONSAVEL_DE_CAMPO');
    camada.campos.forEach(campo => {
        if (campo.nome === 'DATA') return;
        if (campo.nome === 'RESPONSAVEL_DE_CAMPO' && temResponsavel) return;
        
        const div = document.createElement('div');
        div.className = 'campo-formulario';
        
        const label = document.createElement('label');
        label.textContent = campo.label;
        if (campo.obrigatorio) {
            label.innerHTML += ' <span class="obrigatorio">*</span>';
        }
        div.appendChild(label);
        
        let input;
        
        if (campo.tipo === 'lista') {
            input = document.createElement('select');
            input.innerHTML = '<option value="">Selecione...</option>';
            (campo.opcoes || []).forEach(opcao => {
                const option = document.createElement('option');
                option.value = opcao;
                option.textContent = opcao;
                input.appendChild(option);
            });
        } else if (campo.tipo === 'textarea') {
            input = document.createElement('textarea');
            input.placeholder = campo.placeholder || 'Digite...';
        } else if (campo.tipo === 'numero' || campo.tipo === 'numero_decimal') {
            input = document.createElement('input');
            input.type = 'number';
            input.step = campo.tipo === 'numero_decimal' ? '0.01' : '1';
            input.placeholder = `Digite ${campo.label.toLowerCase()}...`;
        } else if (campo.tipo === 'data') {
            input = document.createElement('input');
            input.type = 'date';
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.placeholder = campo.placeholder || `Digite ${campo.label.toLowerCase()}...`;
        }
        
        input.name = campo.nome;
        input.required = campo.obrigatorio;
        div.appendChild(input);
        
        container.appendChild(div);
    });
    
    // Campo de observacoes geral (se nao existir na camada e nao estiver desativado)
    const temObservacao = camada.campos.some(c => c.nome === 'OBSERVACOES' || c.nome === 'OBSERVACAO');
    const autoObservacaoDesativada = DADOS_CONFIG_INVENTARIO.camadas[camadaSelecionada]?.autoObservacao === false;
    if (!temObservacao && !autoObservacaoDesativada) {
        const divObs = document.createElement('div');
        divObs.className = 'campo-formulario';
        divObs.innerHTML = `
            <label>Observacoes</label>
            <textarea name="OBSERVACOES" placeholder="Digite observacoes..."></textarea>
        `;
        container.appendChild(divObs);
    }
}

// ============================================
// EDICAO DE PONTOS
// ============================================

let AppEditando = {
    id: null,
    origem: null,
    camada: null
};

function editarPontoLocal(id) {
    const dadosLocais = App.dadosLocais[App.projetoAtual] || [];
    const ponto = dadosLocais.find(d => d.id === id);
    
    if (!ponto) {
        mostrarToast('Ponto nao encontrado', 'erro');
        return;
    }
    
    AppEditando = { id: id, origem: 'local', camada: ponto.camada };
    
    App.projetoAtual = 'inventario';
    CamadasConfig.camadaAtiva = ponto.camada;
    
    document.getElementById('titulo-projeto').textContent = 'Editar Ponto';
    
    gerarCamposFormulario();
    mostrarTela('tela-coleta');
    
    const h1 = document.querySelector('#tela-coleta h1');
    if (h1) {
        const configCamada = DADOS_CONFIG_INVENTARIO.camadas[ponto.camada];
        h1.textContent = `Editar - ${configCamada ? configCamada.nome : 'Ponto'}`;
    }
    
    // Exibir coordenadas salvas do ponto
    if (ponto.latitude && ponto.longitude) {
        document.getElementById('coordenadas-gps').textContent = 
            `Lat: ${ponto.latitude.toFixed(6)} | Lon: ${ponto.longitude.toFixed(6)}`;
        document.getElementById('coordenadas-gps').className = 'coordenadas ativo';
        exibirCoordenadasUTM(ponto.latitude, ponto.longitude);
        App.crosshairPosition = { lat: ponto.latitude, lng: ponto.longitude };
    }
    
    setTimeout(() => {
        const form = document.getElementById('form-coleta');
        if (!form) return;
        
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name && ponto.campos[input.name] !== undefined) {
                input.value = ponto.campos[input.name];
            }
        });
        
        const btnSubmeter = form.querySelector('button[type="submit"]');
        if (btnSubmeter) {
            btnSubmeter.textContent = 'Salvar Alteracoes';
        }
    }, 200);
}

function editarPontoBox(id, camada) {
    const dadosBox = App.dadosBox['inventario'] || [];
    const ponto = dadosBox.find(f => f.properties && f.properties._id === id);
    
    if (!ponto) {
        mostrarToast('Ponto nao encontrado no Box', 'erro');
        return;
    }
    
    AppEditando = { id: id, origem: 'box', camada: camada };
    
    App.projetoAtual = 'inventario';
    CamadasConfig.camadaAtiva = camada;
    
    document.getElementById('titulo-projeto').textContent = 'Editar Ponto (Box)';
    
    gerarCamposFormulario();
    mostrarTela('tela-coleta');
    
    const h1 = document.querySelector('#tela-coleta h1');
    if (h1) {
        const configCamada = DADOS_CONFIG_INVENTARIO.camadas[camada];
        h1.textContent = `Editar Box - ${configCamada ? configCamada.nome : 'Ponto'}`;
    }
    
    // Exibir coordenadas salvas do ponto
    const geom = ponto.geometry;
    if (geom && geom.coordinates) {
        const lon = geom.coordinates[0];
        const lat = geom.coordinates[1];
        document.getElementById('coordenadas-gps').textContent = 
            `Lat: ${lat.toFixed(6)} | Lon: ${lon.toFixed(6)}`;
        document.getElementById('coordenadas-gps').className = 'coordenadas ativo';
        exibirCoordenadasUTM(lat, lon);
        App.crosshairPosition = { lat, lng: lon };
    }
    
    setTimeout(() => {
        const form = document.getElementById('form-coleta');
        if (!form) return;
        
        const props = ponto.properties;
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name && props[input.name] !== undefined) {
                input.value = props[input.name];
            }
        });
        
        const btnSubmeter = form.querySelector('button[type="submit"]');
        if (btnSubmeter) {
            btnSubmeter.textContent = 'Salvar Alteracoes';
        }
    }, 200);
}

function salvarEdicao(campos) {
    if (!AppEditando.id) return false;
    
    if (AppEditando.origem === 'local') {
        const dadosLocais = App.dadosLocais[App.projetoAtual] || [];
        const ponto = dadosLocais.find(d => d.id === AppEditando.id);
        
        if (ponto) {
            Object.assign(ponto.campos, campos);
            ponto.editado = true;
            ponto.editadoEm = new Date().toISOString();
            if (ponto.status !== 'novo') {
                ponto.status = 'novo';
            }
            salvarDadosLocais();
            
            AppEditando = { id: null, origem: null, camada: null };
            atualizarContadorPontos();
            mostrarToast('Ponto atualizado! Sincronize para enviar.', 'sucesso');
            return true;
        }
    } else if (AppEditando.origem === 'box') {
        const dadosBox = App.dadosBox['inventario'] || [];
        const ponto = dadosBox.find(f => f.properties && f.properties._id === AppEditando.id);
        
        if (ponto) {
            Object.assign(ponto.properties, campos);
            ponto.properties._editado = true;
            ponto.properties._editado_em = new Date().toISOString();
            
            let dadosEditados = JSON.parse(localStorage.getItem('agf_inventario_editados') || '[]');
            dadosEditados = dadosEditados.filter(d => d._id !== AppEditando.id);
            dadosEditados.push({
                _id: AppEditando.id,
                _camada: AppEditando.camada,
                properties: ponto.properties,
                geometry: ponto.geometry
            });
            localStorage.setItem('agf_inventario_editados', JSON.stringify(dadosEditados));
            
            AppEditando = { id: null, origem: null, camada: null };
            atualizarContadorPontos();
            mostrarToast('Ponto atualizado (sera sincronizado)!', 'sucesso');
            return true;
        }
    }
    
    return false;
}

// ============================================
// COMPLEMENTOS
// ============================================

const COMPLEMENTOS_CONFIG = {
    moradores: {
        titulo: 'Morador',
        camada: 'Moradores_PAEBM_SAG',
        campos: [
            { nome: 'NOME', label: 'Nome', tipo: 'texto', obrigatorio: true },
            { nome: 'IDADE', label: 'Idade', tipo: 'numero', obrigatorio: false },
            { nome: 'ESCOLARIDADE', label: 'Escolaridade', tipo: 'texto', obrigatorio: false },
            { nome: 'OCUPACAO_PROFISSAO', label: 'Ocupacao/Profissao', tipo: 'texto', obrigatorio: false },
            { nome: 'GENERO', label: 'Genero', tipo: 'lista', obrigatorio: false, opcoes: ['Masculino', 'Feminino', 'Outro'] },
            { nome: 'ESTADO_CIVIL', label: 'Estado Civil', tipo: 'lista', obrigatorio: false, opcoes: ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viuvo(a)', 'Outro'] }
        ]
    },
    animais_domesticos: {
        titulo: 'Animal Domestico',
        camada: 'Animais_Domesticos_PAEBM_SAG',
        campos: [
            { nome: 'NOME_DO_ANIMAL', label: 'Nome do Animal', tipo: 'texto', obrigatorio: true },
            { nome: 'CLASIFICACAO_DECLARADA', label: 'Classificacao', tipo: 'texto', obrigatorio: false },
            { nome: 'QUANTIDADE', label: 'Quantidade', tipo: 'numero', obrigatorio: true },
            { nome: 'PORTE', label: 'Porte', tipo: 'lista', obrigatorio: false, opcoes: ['Pequeno', 'Medio', 'Grande'] }
        ]
    },
    animais_silvestres: {
        titulo: 'Animal Silvestre/Exotico',
        camada: 'Animais_Silvestres_Exoticos_PAEBM_SAG',
        campos: [
            { nome: 'NOME_COMUM', label: 'Nome Comum', tipo: 'texto', obrigatorio: true },
            { nome: 'NOME_CIENTIFICO_', label: 'Nome Cientifico', tipo: 'texto', obrigatorio: false },
            { nome: 'QUANTIDADE_', label: 'Quantidade', tipo: 'numero', obrigatorio: true }
        ]
    },
    producao: {
        titulo: 'Producao Agropecuaria',
        camada: 'Producao_Agropecuaria_PAEBM_SAG',
        campos: [
            { nome: 'ATIVIDADE_PRODUTIVA', label: 'Atividade Produtiva', tipo: 'texto', obrigatorio: true },
            { nome: 'QUAL_ATIVIDADE', label: 'Qual Atividade', tipo: 'texto', obrigatorio: false },
            { nome: 'DESCRICAO_DA_ATIVIDADE', label: 'Descricao', tipo: 'textarea', obrigatorio: false }
        ]
    }
};

function abrirComplemento(tipo) {
    const config = COMPLEMENTOS_CONFIG[tipo];
    if (!config) return;
    
    // Gerar formulario do complemento
    const container = document.getElementById('lista-complementos');
    
    const formHtml = `
        <div class="complemento-form" id="form-complemento-${tipo}">
            <h4>${config.titulo}</h4>
            <div class="campos-complemento">
                ${config.campos.map(campo => {
                    let input = '';
                    if (campo.tipo === 'lista') {
                        input = `<select name="${campo.nome}" ${campo.obrigatorio ? 'required' : ''}>
                            <option value="">Selecione...</option>
                            ${(campo.opcoes || []).map(o => `<option value="${o}">${o}</option>`).join('')}
                        </select>`;
                    } else if (campo.tipo === 'textarea') {
                        input = `<textarea name="${campo.nome}" placeholder="Digite..."></textarea>`;
                    } else {
                        input = `<input type="${campo.tipo === 'numero' ? 'number' : 'text'}" name="${campo.nome}" placeholder="Digite..." ${campo.obrigatorio ? 'required' : ''}>`;
                    }
                    return `<label>${campo.label}</label>${input}`;
                }).join('')}
            </div>
            <div class="botoes-complemento">
                <button type="button" class="btn-salvar-complemento" onclick="salvarComplemento('${tipo}')">Salvar</button>
                <button type="button" class="btn-cancelar-complemento" onclick="cancelarComplemento('${tipo}')">Cancelar</button>
            </div>
        </div>
    `;
    
    container.innerHTML += formHtml;
}

function salvarComplemento(tipo) {
    const form = document.getElementById(`form-complemento-${tipo}`);
    const config = COMPLEMENTOS_CONFIG[tipo];
    
    const dados = {
        id: gerarId(),
        tipo: tipo,
        camada: config.camada,
        campos: {}
    };
    
    // Coletar valores
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.name) {
            dados.campos[input.name] = input.value;
        }
    });
    
    // Salvar no localStorage
    const key = `agf_complementos_${tipo}`;
    const complementos = JSON.parse(localStorage.getItem(key) || '[]');
    complementos.push(dados);
    localStorage.setItem(key, JSON.stringify(complementos));
    
    // Mostrar na lista
    mostrarComplementoSalvo(tipo, dados);
    
    // Remover formulario
    form.remove();
    
    mostrarToast(`${config.titulo} salvo!`, 'sucesso');
}

function cancelarComplemento(tipo) {
    const form = document.getElementById(`form-complemento-${tipo}`);
    if (form) form.remove();
}

function mostrarComplementoSalvo(tipo, dados) {
    const container = document.getElementById('lista-complementos');
    const config = COMPLEMENTOS_CONFIG[tipo];
    
    const nome = dados.campos[config.campos[0].nome] || 'Sem nome';
    
    const div = document.createElement('div');
    div.className = 'complemento-salvo';
    div.innerHTML = `
        <span>${config.titulo}: ${nome}</span>
        <button type="button" onclick="this.parentElement.remove()">X</button>
    `;
    
    container.appendChild(div);
}

// ============================================
// SALVAR DADOS
// ============================================

function handleSalvar() {
    try {
    const form = document.getElementById('form-coleta');
    
    // Modo edicao
    if (AppEditando.id) {
        const campos = {};
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.name) {
                campos[input.name] = input.value;
            }
        });
        
        if (salvarEdicao(campos)) {
            form.reset();
            form.closest('.tela').classList.remove('ativo');
            restaurarTituloProjeto();
            mostrarTela('tela-mapa');
            carregarPontosNoMapa();
            return;
        }
    }
    
    // Validacao manual - campos obrigatorios
    const camposObrigatorios = form.querySelectorAll('[required]');
    for (const campo of camposObrigatorios) {
        const valor = campo.value || '';
        if (valor.trim() === '') {
            const nomeCampo = campo.name || 'Campo';
            mostrarToast(`Preencha o campo obrigatorio: ${nomeCampo}`, 'erro');
            campo.focus();
            campo.style.borderColor = '#E74C3C';
            setTimeout(() => campo.style.borderColor = '', 3000);
            return;
        }
    }
    
    // Determinar coordenadas
    let lat = null;
    let lng = null;
    
    // Para Inventário, usar posição do crosshair
    if (App.projetoAtual === 'inventario' && App.crosshairPosition) {
        lat = App.crosshairPosition.lat;
        lng = App.crosshairPosition.lng;
    } else if (App.currentPosition) {
        lat = App.currentPosition.lat;
        lng = App.currentPosition.lng;
    } else if (App.pontoMarcado) {
        lat = App.pontoMarcado.lat;
        lng = App.pontoMarcado.lng;
    }
    
    if (!lat || !lng) {
        mostrarToast('Marque um ponto no mapa ou aguarde GPS!', 'erro');
        return;
    }
    
    // Coletar coordenadas UTM
    let coordenadas_utm = wgs84ParaUtm(lng, lat);
    
    const dados = {
        id: gerarId(),
        projeto: App.projetoAtual,
        status: 'novo',
        dataColeta: new Date().toISOString(),
        tecnico: App.usuario ? App.usuario.email : 'desconhecido',
        coordenadas_utm: coordenadas_utm,
        latitude: lat,
        longitude: lng,
        campos: {}
    };
    
    // Para Inventário, adicionar a camada selecionada
    if (App.projetoAtual === 'inventario') {
        const selectCamada = document.getElementById('select-camada-inventario');
        if (selectCamada && selectCamada.value) {
            dados.camada = selectCamada.value;
        } else if (CamadasConfig.camadaAtiva) {
            dados.camada = CamadasConfig.camadaAtiva;
        } else {
            mostrarToast('Selecione o tipo de coleta!', 'erro');
            return;
        }
    }
    
    // Preencher campos
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.name && input.name !== 'foto') {
            dados.campos[input.name] = input.value;
        }
    });
    
    // Salvar localmente
    if (!App.dadosLocais[App.projetoAtual]) {
        App.dadosLocais[App.projetoAtual] = [];
    }
    App.dadosLocais[App.projetoAtual].push(dados);
    salvarDadosLocais();
    
    // Adicionar a fila de sincronizacao
    if (typeof FilaSync !== 'undefined') {
        FilaSync.adicionar(dados);
    }
    
    // Limpar marcador manual
    App.pontoMarcado = null;
    App.marcandoPonto = false;
    if (typeof marcadorMarcado !== 'undefined' && marcadorMarcado) {
        mapa.removeLayer(marcadorMarcado);
        marcadorMarcado = null;
    }
    
    // Atualizar UI
    atualizarContadorPontos();
    carregarPontosNoMapa();
    
    mostrarTela('tela-mapa');
    mostrarToast('Ponto salvo com sucesso!', 'sucesso');
    
    } catch(e) {
        console.error('Erro ao salvar:', e);
        mostrarToast('Erro ao salvar: ' + e.message, 'erro');
    }
}

// ============================================
// CONVERSOR DE COORDENADAS (WGS84 <-> UTM Zona 23S)
// ============================================

function wgs84ParaUtm(lon, lat, zona = 23) {
    const K0 = 0.9996;
    const E = 0.00669438;
    const E2 = E * E;
    const EP2 = E / (1 - E);
    const A = 6378137.0;
    const rad = Math.PI / 180;
    const meridiano_central = (zona * 6 - 183);
    
    const latRad = lat * rad;
    const lonRad = lon * meridiano_central * rad;
    
    const N = A / Math.sqrt(1 - E * Math.sin(latRad) ** 2);
    const T = Math.tan(latRad) ** 2;
    const C = EP2 * Math.cos(latRad) ** 2;
    const R = A * (1 - E) / (1 - E * Math.sin(latRad) ** 2) ** 1.5;
    const D = (lon - meridiano_central) * rad;
    
    const M = A * (
        (1 - E/4 - 3*E2/64 - 5*E*E2/256) * latRad -
        (3*E/8 + 3*E2/32 + 45*E*E2/1024) * Math.sin(2*latRad) +
        (15*E2/256 + 45*E*E2/1024) * Math.sin(4*latRad) -
        (35*E*E2/3072) * Math.sin(6*latRad)
    );
    
    const easting = K0 * N * (D + (1 - T + C) * D**3/6 + (5 - 18*T + T**2 + 72*C - 58*EP2) * D**5/120) + 500000;
    const northing = K0 * (M + N * Math.tan(latRad) * (D**2/2 + (5 - T + 9*C + 4*C**2) * D**4/24 + (61 - 58*T + T**2 + 600*C - 330*EP2) * D**6/720));
    
    if (lat < 0) {
        return { x: Math.round(easting), y: Math.round(northing + 10000000), zona: zona };
    }
    return { x: Math.round(easting), y: Math.round(northing), zona: zona };
}

function exibirCoordenadasUTM(lat, lng) {
    const utmSpan = document.getElementById('coordenadas-utm');
    if (!utmSpan) return;
    
    // Determinar zona UTM baseado na longitude
    const zona = Math.floor((lng + 180) / 6) + 1;
    
    try {
        const utm = wgs84ParaUtm(lng, lat, zona);
        utmSpan.textContent = `UTM: ${zona}K | X: ${utm.x} | Y: ${utm.y}`;
        utmSpan.className = 'coordenadas-utm ativo';
    } catch (e) {
        utmSpan.className = 'coordenadas-utm';
    }
}

// ============================================
// FOTO
// ============================================

function handleFoto(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('preview-foto').innerHTML = 
                `<img src="${event.target.result}" alt="Foto capturada">`;
        };
        reader.readAsDataURL(file);
    }
}

// ============================================
// DADOS LOCAIS (localStorage)
// ============================================

function carregarDadosLocais() {
    const dados = localStorage.getItem('agf_dados');
    if (dados) {
        App.dadosLocais = JSON.parse(dados);
    }
}

function salvarDadosLocais() {
    const dadosLimpos = {};
    for (const projeto of Object.keys(App.dadosLocais)) {
        dadosLimpos[projeto] = App.dadosLocais[projeto].map(dado => {
            const { _marcador, ...resto } = dado;
            return resto;
        });
    }
    localStorage.setItem('agf_dados', JSON.stringify(dadosLimpos));
}

// ============================================
// GPS
// ============================================

function iniciarGPS() {
    if ('geolocation' in navigator) {
        App.positionWatch = navigator.geolocation.watchPosition(
            (position) => {
                App.currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                
                // Atualizar marcador no mapa
                if (mapa) {
                    adicionarMarcadorPosicao(App.currentPosition);
                }
            },
            (error) => {
                console.error('Erro GPS:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 5000
            }
        );
    }
}

// ============================================
// UTILIDADES
// ============================================

function gerarId() {
    return 'ponto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function mostrarToast(mensagem, tipo = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.className = `toast ${tipo} ativo`;
    
    setTimeout(() => {
        toast.classList.remove('ativo');
    }, 3000);
}

// ============================================
// LIMPAR DADOS LOCAIS
// ============================================

function limparDadosLocaisBackup() {
    // Funcao movida para sync.js
}

// ============================================
// FILA DE SINCRONIZACAO OFFLINE
// ============================================

const FilaSync = {
    itens: [],
    
    adicionar(dado) {
        this.itens.push({
            id: dado.id,
            timestamp: Date.now(),
            dados: dado,
            status: 'pendente'
        });
        this.salvar();
    },
    
    obterPendentes() {
        return this.itens.filter(i => i.status === 'pendente');
    },
    
    marcarSincronizado(id) {
        const item = this.itens.find(i => i.id === id);
        if (item) {
            item.status = 'sincronizado';
            item.syncEm = new Date().toISOString();
        }
        this.salvar();
    },
    
    salvar() {
        const itensLimpos = this.itens.map(item => {
            if (item.dados && item.dados._marcador) {
                const { _marcador, ...dadosLimpos } = item.dados;
                return { ...item, dados: dadosLimpos };
            }
            return item;
        });
        localStorage.setItem('agf_fila_sync', JSON.stringify(itensLimpos));
    },
    
    carregar() {
        const dados = localStorage.getItem('agf_fila_sync');
        if (dados) {
            this.itens = JSON.parse(dados);
        }
    },
    
    obterCountPendentes() {
        return this.obterPendentes().length;
    }
};

// Carregar fila ao iniciar
FilaSync.carregar();

// ============================================
// PAINEL DE CAMADAS (INVENTARIO)
// ============================================

const CamadasConfig = {
    cores: {
        'Censo': '#27AE60',
        'Parcela_Arboreo': '#3498DB',
        'Parcela_Arbustivo': '#E67E22',
        'Parcela_Herbaceo': '#F1C40F',
        'Parcela_Arbustivo_CR': '#E74C3C',
        'Parcela_Herbaceo_CR': '#9B59B6',
        'Caracterizacao_FESD': '#1ABC9C',
        'Caracterizacao_Cerrado': '#34495E',
        'Caracterizacao_CR': '#95A5A6',
        'Floristica_Caminhamento_CR': '#E91E63'
    },
    visiveis: {},
    camadaAtiva: null
};

function inicializarPainelCamadas() {
    if (typeof DADOS_CONFIG_INVENTARIO === 'undefined') return;
    
    const container = document.getElementById('lista-camadas');
    if (!container) return;
    
    container.innerHTML = '';
    
    const camadas = DADOS_CONFIG_INVENTARIO.camadas;
    
    Object.keys(camadas).forEach(nomeCamada => {
        const cor = CamadasConfig.cores[nomeCamada] || '#999';
        if (CamadasConfig.visiveis[nomeCamada] === undefined) {
            CamadasConfig.visiveis[nomeCamada] = true;
        }
        
        const isAtiva = CamadasConfig.camadaAtiva === nomeCamada;
        
        const item = document.createElement('div');
        item.className = 'camada-item' + (isAtiva ? ' camada-ativa' : '');
        item.dataset.camada = nomeCamada;
        
        item.innerHTML = `
            <input type="checkbox" ${CamadasConfig.visiveis[nomeCamada] ? 'checked' : ''} data-camada="${nomeCamada}">
            <span class="camada-cor" style="background: ${cor}"></span>
            <span class="camada-nome">${camadas[nomeCamada].nome}</span>
            <span class="camada-contador" id="contador-camada-${nomeCamada}">0</span>
            <button class="btn-editar-camada" title="Editar esta camada" data-camada="${nomeCamada}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>
        `;
        
        // Event listener para checkbox (visibilidade)
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            CamadasConfig.visiveis[nomeCamada] = e.target.checked;
            filtrarCamadasNoMapa();
        });
        
        // Event listener para botão de editar
        const btnEditar = item.querySelector('.btn-editar-camada');
        btnEditar.addEventListener('click', (e) => {
            e.stopPropagation();
            selecionarCamadaParaEdicao(nomeCamada);
        });
        
        container.appendChild(item);
    });
}

function abrirPainelCamadas() {
    const painel = document.getElementById('painel-camadas');
    const btn = document.getElementById('btn-camadas');
    if (painel) {
        painel.style.display = 'flex';
        if (btn) btn.style.display = 'none';
        inicializarPainelCamadas();
    }
}

function fecharPainelCamadas() {
    const painel = document.getElementById('painel-camadas');
    const btn = document.getElementById('btn-camadas');
    if (painel) {
        painel.style.display = 'none';
        if (btn) btn.style.display = 'flex';
    }
}

function selecionarCamadaParaEdicao(nomeCamada) {
    const btnColetar = document.getElementById('btn-coletar');
    const crosshair = document.getElementById('crosshair');
    const coordenadasMapa = document.getElementById('coordenadas-mapa');
    
    // Se já está ativa, desativar
    if (CamadasConfig.camadaAtiva === nomeCamada) {
        CamadasConfig.camadaAtiva = null;
        mostrarToast('Edicao desativada', 'info');
        
        // Esconder botão de coleta e crosshair
        if (btnColetar) btnColetar.style.display = 'none';
        if (crosshair) crosshair.style.display = 'none';
        if (coordenadasMapa) coordenadasMapa.textContent = '';
    } else {
        CamadasConfig.camadaAtiva = nomeCamada;
        const nomeAmigavel = DADOS_CONFIG_INVENTARIO.camadas[nomeCamada]?.nome || nomeCamada;
        mostrarToast(`Editando: ${nomeAmigavel}`, 'sucesso');
        
        // Mostrar botão de coleta com cor da camada
        if (btnColetar) {
            const cor = CamadasConfig.cores[nomeCamada] || '#0D4A35';
            btnColetar.style.display = 'flex';
            btnColetar.style.background = cor;
        }
        
        // Mostrar crosshair
        if (crosshair) crosshair.style.display = 'block';
        
        // Atualizar coordenadas no cabecalho do mapa
        atualizarCoordenadasMapa();
    }
    
    // Atualizar visual do painel
    atualizarVisualCamadaAtiva();
    
    // Fechar painel
    fecharPainelCamadas();
}

function atualizarCoordenadasMapa() {
    const coordenadasMapa = document.getElementById('coordenadas-mapa');
    if (!coordenadasMapa || !mapa) return;
    
    if (CamadasConfig.camadaAtiva) {
        const center = mapa.getCenter();
        const zona = Math.floor((center.lng + 180) / 6) + 1;
        const utm = wgs84ParaUtm(center.lng, center.lat, zona);
        coordenadasMapa.textContent = `Lat: ${center.lat.toFixed(6)} | Lon: ${center.lng.toFixed(6)} | UTM: ${zona}K | X: ${utm.x} | Y: ${utm.y}`;
    } else {
        coordenadasMapa.textContent = '';
    }
}

function atualizarVisualCamadaAtiva() {
    // Atualizar itens no painel
    const itens = document.querySelectorAll('.camada-item');
    itens.forEach(item => {
        if (item.dataset.camada === CamadasConfig.camadaAtiva) {
            item.classList.add('camada-ativa');
        } else {
            item.classList.remove('camada-ativa');
        }
    });
    
    // Atualizar indicador no mapa (se houver)
    atualizarIndicadorCamadaAtiva();
}

function atualizarIndicadorCamadaAtiva() {
    // Remover indicador anterior
    const indicadorAnterior = document.getElementById('indicador-camada-ativa');
    if (indicadorAnterior) indicadorAnterior.remove();
    
    if (!CamadasConfig.camadaAtiva) return;
    
    // Criar indicador visual no mapa
    const indicador = document.createElement('div');
    indicador.id = 'indicador-camada-ativa';
    indicador.className = 'indicador-camada-ativa';
    
    const cor = CamadasConfig.cores[CamadasConfig.camadaAtiva] || '#999';
    const nome = DADOS_CONFIG_INVENTARIO.camadas[CamadasConfig.camadaAtiva]?.nome || '';
    
    indicador.innerHTML = `
        <span class="indicador-cor" style="background: ${cor}"></span>
        <span class="indicador-nome">${nome}</span>
    `;
    
    // Adicionar ao container do mapa
    const mapaContainer = document.getElementById('mapa');
    if (mapaContainer) {
        mapaContainer.appendChild(indicador);
    }
}

function filtrarCamadasNoMapa() {
    if (!mapa || !layerPontos) return;
    
    layerPontos.eachLayer(marker => {
        const camada = marker.camada;
        if (camada && CamadasConfig.visiveis.hasOwnProperty(camada)) {
            if (CamadasConfig.visiveis[camada]) {
                marker.addTo(mapa);
            } else {
                mapa.removeLayer(marker);
            }
        }
    });
}

// Event listeners para o painel de camadas
document.addEventListener('DOMContentLoaded', () => {
    const btnCamadas = document.getElementById('btn-camadas');
    const btnFechar = document.getElementById('btn-fechar-camadas');
    
    if (btnCamadas) {
        btnCamadas.addEventListener('click', abrirPainelCamadas);
    }
    
    if (btnFechar) {
        btnFechar.addEventListener('click', fecharPainelCamadas);
    }
    
    // Fechar painel ao clicar fora dele
    document.addEventListener('click', (e) => {
        const painel = document.getElementById('painel-camadas');
        const btn = document.getElementById('btn-camadas');
        if (painel && painel.style.display === 'flex') {
            if (!painel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                fecharPainelCamadas();
            }
        }
    });
});
