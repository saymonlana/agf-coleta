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
    } else {
        history.replaceState({ tela: 'tela-login' }, '', '');
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
            App.dadosBox['paebm_sag'] = DADOS_QUESTIONARIO.features || [];
            App.dadosBox['paebm'] = App.dadosBox['paebm_sag'];
            console.log(`  Questionario: ${App.dadosBox['paebm_sag'].length} registros`);
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
// CACHE DO CMD (localStorage)
// ============================================

function salvarCacheCmd(dados) {
    try {
        const cache = {
            dados: dados,
            timestamp: Date.now()
        };
        localStorage.setItem('agf_cmd_cache', JSON.stringify(cache));
        console.log('Cache CMD salvo:', dados.length, 'registros');
    } catch (e) {
        console.error('Erro ao salvar cache CMD:', e);
    }
}

function carregarCacheCmd() {
    try {
        const raw = localStorage.getItem('agf_cmd_cache');
        if (!raw) return null;
        
        const cache = JSON.parse(raw);
        const idadeHoras = (Date.now() - cache.timestamp) / (1000 * 60 * 60);
        console.log('Cache CMD encontrado:', cache.dados.length, 'registros,', idadeHoras.toFixed(1), 'horas atras');
        
        return cache.dados;
    } catch (e) {
        console.error('Erro ao carregar cache CMD:', e);
        return null;
    }
}

function carregarCacheCmdTimestamp() {
    try {
        const raw = localStorage.getItem('agf_cmd_cache');
        if (!raw) return null;
        return JSON.parse(raw).timestamp || null;
    } catch (e) {
        return null;
    }
}

function limparCacheCmd() {
    localStorage.removeItem('agf_cmd_cache');
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
        mostrarToast(`Dados do cache (${cache.length} registros) - atualizando...`, 'info');
    }
    
    // 2. Buscar do Box em background
    if (!await verificarToken()) {
        console.log('Sem token Box, usando cache');
        if (!cache || cache.length === 0) {
            mostrarToast('Sem conexao com Box. Dados locais apenas.', 'aviso');
        } else {
            mostrarToast('Sem token Box. Usando dados do cache.', 'aviso');
        }
        return;
    }
    
    try {
        // Mostrar toast persistente (sem auto-hide)
        const toast = document.getElementById('toast-persistente');
        toast.innerHTML = '<span class="spinner"></span>Baixando dados do Box...';
        toast.className = 'toast-persistente ativo';
        
        await listarGeoJSONInventario();
        
        const camadas = Object.keys(InventarioSync.file_ids);
        console.log('Camadas:', camadas);
        
        if (camadas.length === 0) {
            console.log('Nenhum GeoJSON encontrado no Box');
            toast.className = 'toast-persistente';
            if (cache && cache.length > 0) {
                mostrarToast('Nenhum dado no Box. Usando dados do cache.', 'aviso');
            }
            return;
        }
        
        const novosDados = [];
        const resultados = await Promise.all(camadas.map(camada => baixarGeoJSON(camada)));
        
        let downloadFalhou = false;
        resultados.forEach((geojson, i) => {
            if (geojson && geojson.features) {
                geojson.features.forEach(f => {
                    f._camada = camadas[i];
                    novosDados.push(f);
                });
                console.log(`  ${camadas[i]}: ${geojson.features.length} registros`);
            } else {
                downloadFalhou = true;
            }
        });
        
        if (downloadFalhou && novosDados.length === 0) {
            toast.className = 'toast-persistente';
            mostrarToast('Erro ao baixar dados do Box. Usando dados do cache.', 'erro');
            return;
        }
        
        // 3. Salvar no cache
        App.dadosBox['inventario'] = novosDados;
        salvarCacheInventario(novosDados);
        
        console.log(`Total do Box: ${novosDados.length} registros`);
        
        // 4. Atualizar mapa
        if (mapa && App.projetoAtual === 'inventario') {
            carregarPontosNoMapa();
        }
        
        // 5. Esconder toast e mostrar sucesso
        toast.className = 'toast-persistente';
        if (cache && cache.length !== novosDados.length) {
            mostrarToast(`${novosDados.length} registros atualizados do Box`, 'sucesso');
        } else if (!cache || cache.length === 0) {
            mostrarToast(`${novosDados.length} registros carregados do Box`, 'sucesso');
        }
        
    } catch (e) {
        console.error('Erro ao carregar inventario do Box:', e);
        const toast = document.getElementById('toast-persistente');
        toast.className = 'toast-persistente';
        if (!cache || cache.length === 0) {
            mostrarToast('Erro ao carregar do Box', 'erro');
        } else {
            mostrarToast('Erro ao atualizar do Box. Usando dados do cache.', 'erro');
        }
    }
}

// ============================================
// CARREGAR CMD DO BOX
// ============================================

async function carregarCmdDoBox() {
    console.log('Iniciando carregamento CMD do Box...');
    
    const cache = carregarCacheCmd();
    const cacheTimestamp = carregarCacheCmdTimestamp();
    const cacheRecente = cacheTimestamp && (Date.now() - cacheTimestamp) < (60 * 60 * 1000);
    
    if (cache && cache.length > 0) {
        App.dadosBox['cmd'] = cache;
        console.log('CMD carregado do cache:', cache.length, 'registros');
        if (mapa && App.projetoAtual === 'paebm') {
            carregarPontosNoMapa();
            atualizarContadorPontos();
        }
        if (cacheRecente) {
            console.log('Cache recente (<1h), pulando download do Box');
            return;
        }
        mostrarToast(`Atualizando dados do Box...`, 'info');
    }
    
    try {
        await _sincronizarCmdDoBox(cache);
    } catch (e) {
        console.error('Erro ao carregar CMD do Box:', e);
        if (!cache || cache.length === 0) {
            mostrarToast('Erro ao carregar CMD do Box', 'erro');
        }
    }
}

async function _sincronizarCmdDoBox(cache) {
    if (!await verificarToken()) {
        console.log('Sem token Box, usando cache');
        return;
    }
    
    await listarGeoJSONCmd();
    
    const arquivos = Object.keys(CmdSync.file_ids);
    console.log('Arquivos CMD GeoJSON:', arquivos);
    
    if (arquivos.length === 0) {
        console.log('Nenhum GeoJSON CMD encontrado no Box');
        return;
    }
    
    const novosDados = [];
    const resultados = await Promise.all(arquivos.map(nome => baixarGeoJSONCmd(nome)));
    
    resultados.forEach((geojson, i) => {
        if (geojson && geojson.features) {
            geojson.features.forEach(f => {
                f._camada = 'Questionario_FAUNA_ERRANTE_CMD';
                novosDados.push(f);
            });
            console.log(`  ${arquivos[i]}: ${geojson.features.length} registros`);
        }
    });
    
    if (novosDados.length === 0) return;
    
    App.dadosBox['cmd'] = novosDados;
    salvarCacheCmd(novosDados);
    
    console.log(`Total CMD do Box: ${novosDados.length} registros`);
    
    if (mapa && App.projetoAtual === 'paebm') {
        carregarPontosNoMapa();
        atualizarContadorPontos();
    }
    
    if (cache && cache.length !== novosDados.length) {
        mostrarToast(`${novosDados.length} registros CMD atualizados do Box`, 'sucesso');
    } else if (!cache || cache.length === 0) {
        mostrarToast(`${novosDados.length} registros CMD carregados do Box`, 'sucesso');
    }
}

// ============================================
// ATUALIZAR LISTA DE PROJETOS
// ============================================

function atualizarListaProjetos() {
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
                abrirTelaCliente(projeto);
            } else {
                mostrarToast('Projeto em configuracao', 'aviso');
            }
        });
    });
    
    // Botao voltar (mapa -> projetos do cliente)
    try { document.getElementById('btn-voltar').addEventListener('click', () => { 
        history.back();
    }); } catch(e) {}
    
    // Botao voltar (cliente -> projetos)
    try { document.getElementById('btn-voltar-projetos').addEventListener('click', () => { 
        history.back();
    }); } catch(e) {}
    
    // Clientes
    document.querySelectorAll('.projeto-card[data-cliente]').forEach(card => {
        card.addEventListener('click', () => {
            const cliente = card.dataset.cliente;
            mostrarProjetosDoCliente(cliente);
        });
    });
    
    // Botao coletar
    try { document.getElementById('btn-coletar').addEventListener('click', () => { abrirFormularioColeta(); }); } catch(e) {}
    
    // Botao salvar
    try { document.getElementById('btn-salvar').addEventListener('click', handleSalvar); } catch(e) {}
    
    // Botao voltar do mapa (coleta -> mapa)
    try { document.getElementById('btn-voltar-mapa').addEventListener('click', () => { 
        // Restaurar projeto anterior se estava editando
        if (AppEditando && AppEditando.projetoAnterior) {
            App.projetoAtual = AppEditando.projetoAnterior;
            App.projetoClienteAtual = AppEditando.projetoClienteAnterior;
        }
        restaurarTituloProjeto(); 
        mostrarTela('tela-mapa', false); 
    }); } catch(e) {}
    
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
    
    // Botao exportar Excel
    try {
        document.getElementById('btn-exportar-excel').addEventListener('click', () => {
            downloadExcel();
        });
    } catch(e) {}
    
    // Botao foto
    try { document.getElementById('btn-tirar-foto').addEventListener('click', () => { document.getElementById('input-foto').click(); }); } catch(e) {}
    try { document.getElementById('btn-galeria').addEventListener('click', () => { document.getElementById('input-galeria').click(); }); } catch(e) {}
    
    // Input foto
    try { document.getElementById('input-foto').addEventListener('change', handleFoto); } catch(e) {}
    try { document.getElementById('input-galeria').addEventListener('change', handleFoto); } catch(e) {}
    
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

function mostrarTela(telaId, pushHistory) {
    document.querySelectorAll('.tela').forEach(tela => {
        tela.classList.remove('ativa');
    });
    document.getElementById(telaId).classList.add('ativa');
    
    if (pushHistory !== false) {
        history.pushState({ tela: telaId }, '', '');
    }
    
    if (telaId === 'tela-mapa') {
        setTimeout(() => {
            if (mapa) {
                mapa.invalidateSize();
            }
        }, 200);
    }
}

function voltarTelaCliente() {
    document.getElementById('lista-clientes').style.display = 'block';
    document.getElementById('lista-projetos-cliente').style.display = 'none';
    document.getElementById('titulo-cliente').textContent = 'Selecionar Cliente';
    document.getElementById('subtitulo-cliente').textContent = 'Escolha o cliente deste trabalho';
}

window.addEventListener('popstate', function(e) {
    const state = e.state;
    if (!state || !state.tela) return;
    
    const telaAtiva = document.querySelector('.tela.ativa');
    const telaAtual = telaAtiva ? telaAtiva.id : '';
    
    if (state.tela === telaAtual) {
        if (state.tela === 'tela-cliente') {
            voltarTelaCliente();
        }
        return;
    }
    
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById(state.tela).classList.add('ativa');
    
    if (state.tela === 'tela-cliente') {
        if (state.sub === 'projetos') {
            const nomesClientes = { 'vale': 'Vale', 'samarco': 'Samarco', 'gerdau': 'Gerdau', 'anglo': 'Anglo American' };
            document.getElementById('lista-clientes').style.display = 'none';
            document.getElementById('lista-projetos-cliente').style.display = 'block';
            document.getElementById('titulo-cliente').textContent = nomesClientes[App.clienteAtual] || App.clienteAtual;
            document.getElementById('subtitulo-cliente').textContent = 'Escolha o projeto';
        } else {
            voltarTelaCliente();
        }
    }
    
    if (state.tela === 'tela-mapa') {
        setTimeout(() => { if (mapa) mapa.invalidateSize(); }, 200);
    }
});

// ============================================
// TELA DE CLIENTES
// ============================================

function abrirTelaCliente(projetoId) {
    App.projetoAtual = projetoId;
    
    const projeto = App.projetos.find(p => p.id === projetoId);
    const nomeProjeto = projeto ? projeto.nome : 'Projeto';
    
    document.getElementById('titulo-cliente').textContent = `Selecionar Cliente`;
    document.getElementById('subtitulo-cliente').textContent = `${nomeProjeto} - Escolha o cliente`;
    
    voltarTelaCliente();
    mostrarTela('tela-cliente');
}

function mostrarProjetosDoCliente(clienteId) {
    App.clienteAtual = clienteId;
    
    document.getElementById('lista-clientes').style.display = 'none';
    document.getElementById('lista-projetos-cliente').style.display = 'block';
    
    history.pushState({ tela: 'tela-cliente', sub: 'projetos' }, '', '');
    
    const container = document.getElementById('projetos-do-cliente');
    container.innerHTML = '';
    
    const nomesClientes = {
        'vale': 'Vale',
        'samarco': 'Samarco',
        'gerdau': 'Gerdau',
        'anglo': 'Anglo American'
    };
    
    document.getElementById('titulo-cliente').textContent = nomesClientes[clienteId] || clienteId;
    document.getElementById('subtitulo-cliente').textContent = 'Escolha o projeto';
    
    // Lista de projetos por cliente e por tipo de projeto
    const projetosPorClienteEProjeto = {
        'paebm': {
            'vale': [],
            'samarco': [],
            'gerdau': [],
            'anglo': [
                { id: 'anglo_projeto1', nome: '2284_023 PAEBM - SAG', descricao: 'Em configuracao' },
                { id: 'anglo_projeto2', nome: '2348 PAEBM - CMD', descricao: 'Em configuracao' }
            ]
        },
        'inventario': {
            'vale': [],
            'samarco': [],
            'gerdau': [],
            'anglo': [
                { id: 'anglo_inv1', nome: '2341 - Serpentina', descricao: 'Em configuracao' }
            ]
        },
        'fauna': {
            'vale': [],
            'samarco': [],
            'gerdau': [],
            'anglo': []
        }
    };
    
    const projetosPorCliente = projetosPorClienteEProjeto[App.projetoAtual] || {};
    const projetos = projetosPorCliente[clienteId] || [];
    
    if (projetos.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">Nenhum projeto configurado para este cliente</p>';
        return;
    }
    
    projetos.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'projeto-card';
        card.dataset.projetoCliente = proj.id;
        card.innerHTML = `
            <div class="projeto-icone">📋</div>
            <div class="projeto-info">
                <h3>${proj.nome}</h3>
                <p>${proj.descricao}</p>
            </div>
            <div class="projeto-seta">›</div>
        `;
        card.addEventListener('click', () => {
            App.projetoClienteAtual = proj;
            abrirProjeto(App.projetoAtual);
        });
        container.appendChild(card);
    });
}

// ============================================
// PROJETOS
// ============================================

async function abrirProjeto(projetoId) {
    App.projetoAtual = projetoId;
    
    const projeto = App.projetos.find(p => p.id === projetoId);
    const nomeProjeto = App.projetoClienteAtual ? App.projetoClienteAtual.nome : (projeto ? projeto.nome : 'Projeto');
    
    document.getElementById('titulo-projeto').textContent = nomeProjeto;
    atualizarContadorPontos();
    
    // Verificar se é o projeto CMD (mapa em branco)
    const isCmd = App.projetoClienteAtual && App.projetoClienteAtual.id === 'anglo_projeto2';
    
    const btnCamadas = document.getElementById('btn-camadas');
    if (btnCamadas) {
        btnCamadas.style.display = projetoId === 'inventario' ? 'flex' : 'none';
    }
    
    const btnColetar = document.getElementById('btn-coletar');
    const crosshair = document.getElementById('crosshair');
    if (btnColetar) {
        if (projetoId === 'inventario') {
            btnColetar.style.display = 'flex';
            btnColetar.style.background = '#0D4A35';
            if (crosshair) crosshair.style.display = 'block';
            CamadasConfig.camadaAtiva = null;
        } else if (isCmd) {
            btnColetar.style.display = 'flex';
            btnColetar.style.background = '#0D4A35';
            if (crosshair) crosshair.style.display = 'block';
        } else {
            btnColetar.style.display = 'flex';
            if (crosshair) crosshair.style.display = 'none';
        }
    }
    
    mostrarTela('tela-mapa');
    
    if (!mapa) {
        if (isCmd) {
            inicializarMapa(-19.036886, -43.424913);
        } else {
            inicializarMapa();
        }
    } else {
        setTimeout(() => {
            mapa.invalidateSize();
            if (isCmd) {
                mapa.setView([-19.036886, -43.424913], 13);
                limparMarcadores();
            } else if (projetoId === 'inventario') {
                // Remover flag para permitir recarregar camadas e refocar
                camadasInventarioCarregadas = false;
                carregarCamadasInventario();
            } else {
                mapa.setView([-20.3132, -42.6067], 13);
            }
        }, 300);
    }
    
    if (projetoId === 'inventario') {
        carregarInventarioDoBox();
        carregarCamadasInventario();
    } else if (isCmd) {
        carregarCmdDoBox();
    } else {
        removerCamadasInventario();
    }
    
    carregarPontosNoMapa();
    atualizarContadorPontos();
}

function restaurarTituloProjeto() {
    const projeto = App.projetos.find(p => p.id === App.projetoAtual);
    const nomeProjeto = App.projetoClienteAtual ? App.projetoClienteAtual.nome : (projeto ? projeto.nome : 'Projeto');
    document.getElementById('titulo-projeto').textContent = nomeProjeto;
}

function atualizarContadorPontos() {
    const isCmd = App.projetoClienteAtual && App.projetoClienteAtual.id === 'anglo_projeto2';
    const camadaFiltro = isCmd ? 'Questionario_FAUNA_ERRANTE_CMD' : null;
    
    const chaveBox = isCmd ? 'cmd' : App.projetoAtual;
    const dadosBox = App.dadosBox[chaveBox] || [];
    const totalBox = dadosBox.length;
    
    const dadosLocais = App.dadosLocais[App.projetoAtual] || [];
    
    // Para CMD: total = Box + locais novos (evita duplicar com sincronizados)
    // Para SAG: total = Box + todos locais
    const dadosLocaisNovos = camadaFiltro 
        ? dadosLocais.filter(d => (!d.camada || d.camada === camadaFiltro) && d.status === 'novo')
        : dadosLocais.filter(d => d.status === 'novo');
    
    const totalLocal = camadaFiltro 
        ? dadosLocaisNovos.length
        : dadosLocais.length;
    
    const totalLocalPendentes = dadosLocaisNovos.length;
    
    const dadosEditados = JSON.parse(localStorage.getItem('agf_inventario_editados') || '[]');
    const editadosBox = dadosEditados.length;
    
    const totalPendentes = totalLocalPendentes + editadosBox;
    const totalRegistros = totalBox + totalLocal;
    
    let texto = `${totalRegistros} registros`;
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
    // Novo fluxo: Inventario usa sistema de parcelas
    if (App.projetoAtual === 'inventario') {
        abrirCriarParcela();
        return;
    }
    
    const isCmd = App.projetoClienteAtual && App.projetoClienteAtual.id === 'anglo_projeto2';
    
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
    } else if (isCmd && mapa) {
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
    mostrarTela('tela-coleta', false);
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
    
    // Verificar se é o projeto CMD (Fauna Errante)
    const isCmd = App.projetoClienteAtual && App.projetoClienteAtual.id === 'anglo_projeto2';
    
    // Buscar campos do config.json (PAEBM)
    if (App.config && App.config.camadas_coleta) {
        const nomeCamada = isCmd ? 'Questionario_FAUNA_ERRANTE_CMD' : 'Questionario_PAEBM_SAG';
        const questionario = App.config.camadas_coleta[nomeCamada];
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
            // Preencher data automaticamente
            if (campo.nome === 'DATA_REGISTRO') {
                input.value = new Date().toISOString().split('T')[0];
            }
        } else if (campo.tipo === 'hora') {
            input = document.createElement('input');
            input.type = 'time';
            // Preencher hora automaticamente
            if (campo.nome === 'HORA_REGISTRO') {
                const agora = new Date();
                input.value = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');
            }
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `Digite ${campo.label.toLowerCase()}...`;
            
            // Preencher coordenadas automaticamente
            const posicao = App.currentPosition || App.crosshairPosition;
            if (posicao) {
                if (campo.nome === 'E_UTC') {
                    const utm = wgs84ParaUtm(posicao.lng, posicao.lat);
                    input.value = utm.x;
                } else if (campo.nome === 'N_UTC') {
                    const utm = wgs84ParaUtm(posicao.lng, posicao.lat);
                    input.value = utm.y;
                } else if (campo.nome === 'LATITUDE') {
                    input.value = posicao.lat.toFixed(6);
                } else if (campo.nome === 'LONGITUDE') {
                    input.value = posicao.lng.toFixed(6);
                }
            }
            
            // Bloquear campos de coordenadas
            if (['E_UTC', 'N_UTC', 'LATITUDE', 'LONGITUDE'].includes(campo.nome)) {
                input.readOnly = true;
                input.style.backgroundColor = '#f0f0f0';
                input.style.cursor = 'not-allowed';
            }
        }
        
        input.name = campo.nome;
        input.required = campo.obrigatorio;
        
        // Preencher tecnico automaticamente e bloquear
        if (campo.nome === 'TECNICO' && App.usuario) {
            input.value = App.usuario.email;
            input.readOnly = true;
            input.style.backgroundColor = '#f0f0f0';
            input.style.cursor = 'not-allowed';
        }
        
        div.appendChild(input);
        
        container.appendChild(div);
    });
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

    const campos = camada.campos;
    const temFusteGrupo = campos.some(c => c.tipo === 'fuste_grupo');
    const camposFuste = campos.filter(c => c.tipo === 'fuste_campo');
    const temResponsavel = campos.some(c => c.nome === 'RESPONSAVEL_DE_CAMPO');
    const idxFuste = campos.findIndex(c => c.tipo === 'fuste_grupo');
    let fusteInserido = false;

    campos.forEach((campo, idx) => {
        if (campo.nome === 'DATA') return;
        if (campo.nome === 'RESPONSAVEL_DE_CAMPO' && temResponsavel) return;
        if (campo.tipo === 'fuste_campo') return;

        if (campo.tipo === 'fuste_grupo' && temFusteGrupo) {
            const divWrapper = document.createElement('div');
            divWrapper.className = 'campo-formulario';
            
            const labelGrupo = document.createElement('label');
            labelGrupo.innerHTML = 'Fuste (ex: 1 de 3) <span class="obrigatorio">*</span>';
            labelGrupo.style.display = 'block';
            labelGrupo.style.fontSize = '12px';
            labelGrupo.style.fontWeight = '600';
            labelGrupo.style.color = '#333';
            labelGrupo.style.marginBottom = '6px';
            labelGrupo.style.textTransform = 'uppercase';
            labelGrupo.style.letterSpacing = '0.5px';
            divWrapper.appendChild(labelGrupo);

            const inputGrupo = document.createElement('input');
            inputGrupo.type = 'text';
            inputGrupo.id = 'input-fuste-grupo';
            inputGrupo.placeholder = 'Digite: 1 de 3';
            inputGrupo.required = true;
            inputGrupo.style.width = '100%';
            inputGrupo.style.boxSizing = 'border-box';
            inputGrupo.style.padding = '14px 16px';
            inputGrupo.style.fontSize = '16px';
            inputGrupo.style.border = '2px solid #e0e0e0';
            inputGrupo.style.borderRadius = '8px';
            inputGrupo.style.background = 'white';
            inputGrupo.style.color = '#333';
            divWrapper.appendChild(inputGrupo);

            container.appendChild(divWrapper);

            const divBlocos = document.createElement('div');
            divBlocos.id = 'fuste-blocos';
            container.appendChild(divBlocos);

            inputGrupo.addEventListener('input', function() {
                gerarBlocosFustes(this.value, camposFuste, divBlocos);
            });

            fusteInserido = true;
            return;
        }

        container.appendChild(criarCampoFormulario(campo));
    });

    if (!fusteInserido && temFusteGrupo) {
        const divWrapper = document.createElement('div');
        divWrapper.className = 'campo-formulario';
        
        const labelGrupo = document.createElement('label');
        labelGrupo.innerHTML = 'Fuste (ex: 1 de 3) <span class="obrigatorio">*</span>';
        labelGrupo.style.display = 'block';
        labelGrupo.style.fontSize = '12px';
        labelGrupo.style.fontWeight = '600';
        labelGrupo.style.color = '#333';
        labelGrupo.style.marginBottom = '6px';
        labelGrupo.style.textTransform = 'uppercase';
        labelGrupo.style.letterSpacing = '0.5px';
        divWrapper.appendChild(labelGrupo);

        const inputGrupo = document.createElement('input');
        inputGrupo.type = 'text';
        inputGrupo.id = 'input-fuste-grupo';
        inputGrupo.placeholder = 'Digite: 1 de 3';
        inputGrupo.required = true;
        inputGrupo.style.width = '100%';
        inputGrupo.style.boxSizing = 'border-box';
        inputGrupo.style.padding = '14px 16px';
        inputGrupo.style.fontSize = '16px';
        inputGrupo.style.border = '2px solid #e0e0e0';
        inputGrupo.style.borderRadius = '8px';
        inputGrupo.style.background = 'white';
        inputGrupo.style.color = '#333';
        divWrapper.appendChild(inputGrupo);

        container.appendChild(divWrapper);

        const divBlocos = document.createElement('div');
        divBlocos.id = 'fuste-blocos';
        container.appendChild(divBlocos);

        inputGrupo.addEventListener('input', function() {
            gerarBlocosFustes(this.value, camposFuste, divBlocos);
        });
    }

    const temObservacao = campos.some(c => c.nome === 'OBSERVACOES' || c.nome === 'OBSERVACAO');
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

function criarCampoFormulario(campo) {
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
    
    return div;
}

function criarBlocoFuste(numero, camposFuste, dadosExistentes) {
    const bloco = document.createElement('div');
    bloco.className = 'fuste-bloco-novo';
    
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';
    
    const label = document.createElement('span');
    label.className = 'fuste-bloco-label';
    label.textContent = `Fuste ${numero}`;
    header.appendChild(label);
    
    const btnRemover = document.createElement('button');
    btnRemover.type = 'button';
    btnRemover.className = 'fuste-bloco-remover';
    btnRemover.innerHTML = '&times;';
    btnRemover.title = 'Remover fuste';
    btnRemover.addEventListener('click', function() {
        bloco.remove();
        document.getElementById('fuste-count').textContent = 
            document.querySelectorAll('.fuste-bloco-novo').length;
    });
    
    if (numero > 1) {
        header.appendChild(btnRemover);
    }
    
    bloco.appendChild(header);
    
    const camposDiv = document.createElement('div');
    camposDiv.className = 'fuste-bloco-campos';
    
    camposFuste.forEach(campo => {
        const campoDiv = document.createElement('div');
        campoDiv.className = 'campo-formulario';
        
        const campoLabel = document.createElement('label');
        campoLabel.textContent = campo.label;
        if (campo.obrigatorio) {
            campoLabel.innerHTML += ' <span class="obrigatorio">*</span>';
        }
        campoDiv.appendChild(campoLabel);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.name = `${campo.nome}_fuste_${numero}`;
        input.placeholder = campo.label;
        input.required = campo.obrigatorio;
        
        if (dadosExistentes && dadosExistentes[campo.nome]) {
            input.value = dadosExistentes[campo.nome];
        }
        
        campoDiv.appendChild(input);
        camposDiv.appendChild(campoDiv);
    });
    
    bloco.appendChild(camposDiv);
    
    return bloco;
}

function gerarBlocosFustes(valor, camposFuste, container) {
    container.innerHTML = '';
    
    const regex = /(\d+)\s*(?:de|\/)\s*(\d+)/i;
    const match = valor.match(regex);
    
    if (!match) return;
    
    const total = parseInt(match[2]);
    const atual = parseInt(match[1]);
    
    if (total < 1 || total > 50 || atual < 1 || atual > total) return;
    
    for (let i = 1; i <= total; i++) {
        const bloco = document.createElement('div');
        bloco.className = 'fuste-bloco';
        
        const header = document.createElement('div');
        header.className = 'fuste-bloco-header';
        header.textContent = `Fuste ${i} de ${total}`;
        bloco.appendChild(header);
        
        camposFuste.forEach(campo => {
            const div = document.createElement('div');
            div.className = 'campo-formulario';
            
            const label = document.createElement('label');
            label.textContent = campo.label;
            if (campo.obrigatorio) {
                label.innerHTML += ' <span class="obrigatorio">*</span>';
            }
            div.appendChild(label);
            
            const input = document.createElement('input');
            input.type = 'text';
            input.name = `${campo.nome}_fuste_${i}`;
            input.placeholder = campo.label;
            input.required = campo.obrigatorio;
            div.appendChild(input);
            
            bloco.appendChild(div);
        });
        
        container.appendChild(bloco);
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
    // Buscar em todos os projetos
    let ponto = null;
    let projetoEncontrado = null;
    
    for (const projeto of Object.keys(App.dadosLocais)) {
        const encontrado = App.dadosLocais[projeto].find(d => d.id === id);
        if (encontrado) {
            ponto = encontrado;
            projetoEncontrado = projeto;
            break;
        }
    }
    
    if (!ponto) {
        mostrarToast('Ponto nao encontrado', 'erro');
        return;
    }
    
    AppEditando = { id: id, origem: 'local', camada: ponto.camada, projetoAnterior: App.projetoAtual, projetoClienteAnterior: App.projetoClienteAtual };
    
    App.projetoAtual = projetoEncontrado;
    
    // Se o ponto e do CMD, configurar projetoClienteAtual
    if (ponto.camada === 'Questionario_FAUNA_ERRANTE_CMD' || (!ponto.camada && App.projetoClienteAtual && App.projetoClienteAtual.id === 'anglo_projeto2')) {
        App.projetoClienteAtual = { id: 'anglo_projeto2', nome: '2348 PAEBM - CMD' };
        if (!ponto.camada) ponto.camada = 'Questionario_FAUNA_ERRANTE_CMD';
    } else {
        App.projetoClienteAtual = null;
    }
    
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
    
    // Para Inventário e CMD, usar posição do crosshair
    const isCmd = App.projetoClienteAtual && App.projetoClienteAtual.id === 'anglo_projeto2';
    if ((App.projetoAtual === 'inventario' || isCmd) && App.crosshairPosition) {
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
    
    // Para CMD, adicionar camada do questionário
    if (isCmd) {
        dados.camada = 'Questionario_FAUNA_ERRANTE_CMD';
    }
    
    // Preencher campos
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.name && input.name !== 'foto') {
            dados.campos[input.name] = input.value;
        }
    });

    // Coletar dados de fustes se existirem
    const inputFusteGrupo = document.getElementById('input-fuste-grupo');
    if (inputFusteGrupo && inputFusteGrupo.value) {
        const regex = /(\d+)\s*(?:de|\/)\s*(\d+)/i;
        const match = inputFusteGrupo.value.match(regex);
        if (match) {
            const total = parseInt(match[2]);
            dados.campos.fustes = [];
            for (let i = 1; i <= total; i++) {
                const fuste = { numero: i, de: total };
                const camposFuste = Object.keys(dados.campos).filter(k => k.includes(`_fuste_${i}`));
                camposFuste.forEach(k => {
                    const nomeOriginal = k.replace(`_fuste_${i}`, '');
                    fuste[nomeOriginal] = dados.campos[k];
                    delete dados.campos[k];
                });
                dados.campos.fustes.push(fuste);
            }
        }
    }
    
    // Salvar foto se existir
    if (App.fotoAtual) {
        dados.foto = App.fotoAtual;
        App.fotoAtual = null;
    }
    
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
            // Salvar base64 da foto nos dados
            App.fotoAtual = event.target.result;
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
    console.log('GPS: Aguardando posicionamento do dispositivo...');
    mostrarToast('Procurando sinal GPS...', 'info');
}

// Callback chamado pelo Android nativo quando GPS obtem posicao
window.onPositionFromAndroid = function(lat, lng, accuracy) {
    App.currentPosition = { lat: lat, lng: lng, accuracy: accuracy };
    console.log('GPS recebido do Android:', lat, lng, 'precisao:', accuracy + 'm');
    
    if (mapa) {
        adicionarMarcadorPosicao(App.currentPosition);
    }
    
    // Atualizar campos de coordenadas se estiverem vazios
    atualizarCamposCoordenadas(lat, lng);
};

// Atualizar campos de coordenadas automaticamente
function atualizarCamposCoordenadas(lat, lng) {
    const form = document.getElementById('form-coleta');
    if (!form) return;
    
    const utm = wgs84ParaUtm(lng, lat);
    
    // Atualizar E_UTC
    const campoE = form.querySelector('input[name="E_UTC"]');
    if (campoE && !campoE.value) {
        campoE.value = utm.x;
    }
    
    // Atualizar N_UTC
    const campoN = form.querySelector('input[name="N_UTC"]');
    if (campoN && !campoN.value) {
        campoN.value = utm.y;
    }
    
    // Atualizar LATITUDE
    const campoLat = form.querySelector('input[name="LATITUDE"]');
    if (campoLat && !campoLat.value) {
        campoLat.value = lat.toFixed(6);
    }
    
    // Atualizar LONGITUDE
    const campoLon = form.querySelector('input[name="LONGITUDE"]');
    if (campoLon && !campoLon.value) {
        campoLon.value = lng.toFixed(6);
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
    
    const isCmd = App.projetoClienteAtual && App.projetoClienteAtual.id === 'anglo_projeto2';
    
    if (CamadasConfig.camadaAtiva || isCmd) {
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

// ============================================
// PARCELAS - ESTADO
// ============================================

const ParcelaState = {
    parcelaAtual: null,
    estratoAtual: null,
    individuoEditando: null,
    tipoForm: null
};

// ============================================
// PARCELAS - NAVIGACAO
// ============================================

function abrirCriarParcela() {
    // Limpar estado - esta criando parcela nova
    ParcelaState.parcelaAtual = null;
    
    const posicao = App.currentPosition || App.crosshairPosition || (mapa ? { lat: mapa.getCenter().lat, lng: mapa.getCenter().lng } : null);
    if (!posicao) {
        mostrarToast('Aguarde o GPS ou clique no mapa', 'aviso');
        return;
    }
    
    // Salvar posição para uso no salvar
    App.crosshairPosition = posicao;
    
    const container = document.getElementById('campos-criar-parcela');
    container.innerHTML = '';
    
    const config = DADOS_CONFIG_INVENTARIO.parcela;
    config.camposBasicos.forEach(campo => {
        container.appendChild(criarCampoFormulario(campo));
    });
    
    document.getElementById('coordenadas-parcela-gps').textContent = 
        `Lat: ${posicao.lat.toFixed(6)} | Lon: ${posicao.lng.toFixed(6)}`;
    
    mostrarTela('tela-criar-parcela');
}

function editarParcela(id) {
    const dadosLocais = App.dadosLocais['inventario'] || [];
    const parcela = dadosLocais.find(d => d.id === id);
    
    if (!parcela) {
        mostrarToast('Parcela nao encontrada', 'erro');
        return;
    }
    
    // Preencher formulario com dados existentes
    const container = document.getElementById('campos-criar-parcela');
    container.innerHTML = '';
    
    const config = DADOS_CONFIG_INVENTARIO.parcela;
    config.camposBasicos.forEach(campo => {
        const div = criarCampoFormulario(campo);
        const input = div.querySelector('input, select, textarea');
        if (input && parcela.campos[campo.nome]) {
            input.value = parcela.campos[campo.nome];
        }
        container.appendChild(div);
    });
    
    document.getElementById('coordenadas-parcela-gps').textContent = 
        `Lat: ${parcela.latitude.toFixed(6)} | Lon: ${parcela.longitude.toFixed(6)}`;
    
    // Salvar referencia para edicao
    ParcelaState.parcelaAtual = parcela;
    
    mostrarTela('tela-criar-parcela');
}

function abrirDetalheParcela(parcela) {
    ParcelaState.parcelaAtual = parcela;
    
    document.getElementById('parcela-nome-titulo').textContent = parcela.campos.NOME_PARCELA || 'Parcela';
    document.getElementById('parcela-fisionomia-sub').textContent = parcela.campos.FISIONOMIA || '';
    
    const lista = document.getElementById('parcela-detalhe-lista');
    lista.innerHTML = '';
    
    const fisionomia = parcela.campos.FISIONOMIA || 'FESD';
    const arvoreo = parcela.arvoreo || [];
    const arbustivo = parcela.arbustivo || [];
    const herbaceo = parcela.herbaceo || [];
    const temCaracterizacao = parcela.caracterizacao && Object.keys(parcela.caracterizacao).length > 0;
    
    const itens = [
        {
            classe: 'caracterizacao',
            icone: '📋',
            titulo: 'Caracterização',
            detalhe: temCaracterizacao ? 'Preenchida' : 'Não preenchida',
            acao: () => abrirFormCaracterizacao(parcela)
        },
        {
            classe: 'arvoreo',
            icone: '🌳',
            titulo: 'Arbóreo',
            detalhe: `${arvoreo.length} indivíduo${arvoreo.length !== 1 ? 's' : ''}`,
            acao: () => abrirListaIndividuos('arvoreo', fisionomia)
        },
        {
            classe: 'arbustivo',
            icone: '🌿',
            titulo: 'Arbustivo',
            detalhe: `${arbustivo.length} indivíduo${arbustivo.length !== 1 ? 's' : ''}`,
            acao: () => abrirListaIndividuos('arbustivo', fisionomia)
        },
        {
            classe: 'herbaceo',
            icone: '🌱',
            titulo: 'Herbáceo',
            detalhe: `${herbaceo.length} indivíduo${herbaceo.length !== 1 ? 's' : ''}`,
            acao: () => abrirListaIndividuos('herbaceo', fisionomia)
        }
    ];
    
    itens.forEach(item => {
        const div = document.createElement('div');
        div.className = 'parcela-item';
        div.innerHTML = `
            <div class="parcela-item-icone ${item.classe}">${item.icone}</div>
            <div class="parcela-item-info">
                <h4>${item.titulo}</h4>
                <p>${item.detalhe}</p>
            </div>
            <div class="parcela-item-seta">›</div>
        `;
        div.addEventListener('click', item.acao);
        lista.appendChild(div);
    });
    
    mostrarTela('tela-detalhe-parcela');
}

function abrirListaIndividuos(estrato, fisionomia) {
    ParcelaState.estratoAtual = estrato;
    
    const nomes = { arvoreo: 'Arbóreo', arbustivo: 'Arbustivo', herbaceo: 'Herbáceo' };
    document.getElementById('estrato-titulo').textContent = nomes[estrato] || estrato;
    document.getElementById('estrato-parcela-nome').textContent = 
        ParcelaState.parcelaAtual?.campos?.NOME_PARCELA || '';
    
    const lista = document.getElementById('lista-individuos');
    lista.innerHTML = '';
    
    const individuos = ParcelaState.parcelaAtual?.[estrato] || [];
    
    if (individuos.length === 0) {
        lista.innerHTML = `
            <div class="secao-vazia">
                <p>Nenhum indivíduo cadastrado</p>
                <p>Toque em "Novo Indivíduo" para adicionar</p>
            </div>
        `;
    } else {
        individuos.forEach((ind, idx) => {
            const card = document.createElement('div');
            card.className = 'individuo-card';
            
            const nome = ind.NOME_COMUM || ind.NOME || `Indivíduo ${idx + 1}`;
            const nomeCientifico = ind.NOME_CIENTIFICO || '';
            const familia = ind.FAMILIA || '';
            
            let detalhes = '';
            
            if (estrato === 'arvoreo' || estrato === 'arbustivo') {
                const partes = [];
                if (ind.fustes && ind.fustes.length > 0) {
                    partes.push(`Fustes: ${ind.fustes.length}`);
                    const alturas = ind.fustes.map(f => parseFloat(f.ALTURA)).filter(a => !isNaN(a));
                    const caps = ind.fustes.map(f => parseFloat(f.CAP)).filter(c => !isNaN(c));
                    if (alturas.length > 0) {
                        const mediaAltura = (alturas.reduce((a, b) => a + b, 0) / alturas.length).toFixed(1);
                        partes.push(`Altura méd: ${mediaAltura}m`);
                    }
                    if (caps.length > 0) {
                        const mediaCap = (caps.reduce((a, b) => a + b, 0) / caps.length).toFixed(1);
                        partes.push(`CAP méd: ${mediaCap}cm`);
                    }
                }
                detalhes = partes.join(' | ');
            } else if (estrato === 'herbaceo') {
                const partes = [];
                if (ind.NUM_INDIVIDUOS) partes.push(`${ind.NUM_INDIVIDUOS} indivíduos`);
                if (ind.PERCENTUAL_COBERTURA) partes.push(`${ind.PERCENTUAL_COBERTURA}% cobertura`);
                detalhes = partes.join(' | ');
            }
            
            card.innerHTML = `
                <div class="individuo-numero">${idx + 1}</div>
                <div class="individuo-info">
                    <h4>${nome}</h4>
                    ${nomeCientifico ? `<p class="individuo-cientifico"><i>${nomeCientifico}</i></p>` : ''}
                    ${familia ? `<p class="individuo-familia">Família: ${familia}</p>` : ''}
                    <p class="individuo-detalhes">${detalhes}</p>
                </div>
                <button class="individuo-menu" onclick="event.stopPropagation(); toggleMenuIndividuo(${idx})">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                    </svg>
                </button>
                <div class="individuo-menu-opcoes" id="menu-individuo-${idx}">
                    <button onclick="event.stopPropagation(); editarIndividuo(${idx})">Editar</button>
                    <button onclick="event.stopPropagation(); confirmarExcluirIndividuo(${idx})" class="btn-excluir">Excluir</button>
                </div>
            `;
            
            card.addEventListener('click', () => editarIndividuo(idx));
            lista.appendChild(card);
        });
    }
    
    const btnNovo = document.getElementById('btn-novo-individuo');
    btnNovo.onclick = () => abrirFormIndividuo(null, estrato, fisionomia);
    
    mostrarTela('tela-lista-individuos');
}

function toggleMenuIndividuo(idx) {
    const menu = document.getElementById(`menu-individuo-${idx}`);
    if (menu) {
        menu.classList.toggle('ativo');
    }
}

function confirmarExcluirIndividuo(idx) {
    if (confirm('Excluir este indivíduo?')) {
        excluirIndividuo(idx);
    }
}

// ============================================
// PARCELAS - FORMULARIO CRIAR PARCELA
// ============================================

async function handleSalvarParcela() {
    const form = document.getElementById('form-criar-parcela');
    const inputs = form.querySelectorAll('input, select, textarea');
    const campos = {};
    
    inputs.forEach(input => {
        if (input.name) {
            campos[input.name] = input.value;
        }
    });
    
    const obrigatorios = DADOS_CONFIG_INVENTARIO.parcela.camposBasicos.filter(c => c.obrigatorio);
    for (const campo of obrigatorios) {
        if (!campos[campo.nome] || campos[campo.nome].trim() === '') {
            mostrarToast(`Preencha o campo: ${campo.label}`, 'erro');
            return;
        }
    }
    
    const posicao = App.currentPosition || App.crosshairPosition || (mapa ? { lat: mapa.getCenter().lat, lng: mapa.getCenter().lng } : null);
    if (!posicao) {
        mostrarToast('GPS indisponivel', 'erro');
        return;
    }
    
    // Verificar se esta editando uma parcela existente
    if (ParcelaState.parcelaAtual && ParcelaState.parcelaAtual.id) {
        // Editar parcela existente
        ParcelaState.parcelaAtual.campos = campos;
        ParcelaState.parcelaAtual.status = 'novo';
        salvarDadosLocais();
        
        mostrarToast('Parcela atualizada com sucesso!', 'sucesso');
        carregarPontosNoMapa();
        abrirDetalheParcela(ParcelaState.parcelaAtual);
    } else {
        // Criar nova parcela
        const parcela = {
            id: 'parcela_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            tipo: 'parcela',
            status: 'novo',
            latitude: posicao.lat,
            longitude: posicao.lng,
            dataColeta: new Date().toISOString(),
            tecnico: App.usuario ? App.usuario.email : '',
            campos: campos,
            arvoreo: [],
            arbustivo: [],
            herbaceo: [],
            caracterizacao: {}
        };
        
        if (!App.dadosLocais['inventario']) {
            App.dadosLocais['inventario'] = [];
        }
        App.dadosLocais['inventario'].push(parcela);
        salvarDadosLocais();
        
        mostrarToast('Parcela criada com sucesso!', 'sucesso');
        carregarPontosNoMapa();
        abrirDetalheParcela(parcela);
    }
}

// ============================================
// PARCELAS - CARACTERIZACAO
// ============================================

function abrirFormCaracterizacao(parcela) {
    ParcelaState.parcelaAtual = parcela;
    
    const fisionomia = parcela.campos.FISIONOMIA || 'FESD';
    const configCaract = DADOS_CONFIG_INVENTARIO.parcela.caracterizacao[fisionomia];
    
    if (!configCaract) {
        mostrarToast('Caracterizacao nao configurada para esta fisionomia', 'erro');
        return;
    }
    
    document.getElementById('caract-parcela-nome').textContent = 
        parcela.campos.NOME_PARCELA || 'Parcela';
    
    const container = document.getElementById('campos-form-caracterizacao');
    container.innerHTML = '';
    
    configCaract.forEach(campo => {
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
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.placeholder = campo.placeholder || '';
        }
        
        input.name = campo.nome;
        input.required = campo.obrigatorio;
        
        if (parcela.caracterizacao && parcela.caracterizacao[campo.nome]) {
            input.value = parcela.caracterizacao[campo.nome];
        }
        
        div.appendChild(input);
        container.appendChild(div);
    });
    
    mostrarTela('tela-form-caracterizacao');
}

function handleSalvarCaracterizacao() {
    if (!ParcelaState.parcelaAtual) return;
    
    const form = document.getElementById('form-caracterizacao');
    const inputs = form.querySelectorAll('input, select, textarea');
    const dados = {};
    
    inputs.forEach(input => {
        if (input.name) {
            dados[input.name] = input.value;
        }
    });
    
    ParcelaState.parcelaAtual.caracterizacao = dados;
    
    if (ParcelaState.parcelaAtual.status !== 'novo') {
        ParcelaState.parcelaAtual.status = 'novo';
    }
    
    salvarDadosLocais();
    mostrarToast('Caracterização salva!', 'sucesso');
    history.back();
}

// ============================================
// PARCELAS - FORMULARIO INDIVIDUO
// ============================================

function abrirFormIndividuo(individuo, estrato, fisionomia) {
    ParcelaState.estratoAtual = estrato;
    // individuoEditando ja foi definido por editarIndividuo ou deve ser null para novo
    
    const nomes = { arvoreo: 'Arbóreo', arbustivo: 'Arbustivo', herbaceo: 'Herbáceo' };
    
    if (individuo) {
        document.getElementById('form-individuo-titulo').textContent = 'Editar Indivíduo';
        document.getElementById('form-individuo-estrato').textContent = nomes[estrato] || estrato;
    } else {
        document.getElementById('form-individuo-titulo').textContent = 'Novo Indivíduo';
        document.getElementById('form-individuo-estrato').textContent = nomes[estrato] || estrato;
    }
    
    const container = document.getElementById('campos-form-individuo');
    container.innerHTML = '';
    
    const configEstrato = DADOS_CONFIG_INVENTARIO.parcela[estrato];
    if (!configEstrato) return;
    
    let campos = [...configEstrato.campos];
    
    if (configEstrato.copaObrigatoria && configEstrato.copaObrigatoria.includes(fisionomia)) {
        campos = [...campos, ...configEstrato.camposCopa];
    }
    
    if (estrato === 'herbaceo' && configEstrato.coberturaObrigatoria && configEstrato.coberturaObrigatoria.includes(fisionomia)) {
        campos = [...campos, ...configEstrato.camposCobertura];
    }
    
    const temFusteGrupo = campos.some(c => c.tipo === 'fuste_grupo');
    const camposFuste = campos.filter(c => c.tipo === 'fuste_campo');
    let fusteInserido = false;
    
    campos.forEach(campo => {
        if (campo.tipo === 'fuste_campo') return;
        
        if (campo.tipo === 'fuste_grupo' && temFusteGrupo) {
            const divWrapper = document.createElement('div');
            divWrapper.className = 'fuste-secao';
            
            const dadosFustes = (individuo && individuo.fustes) ? individuo.fustes : [];
            if (dadosFustes.length === 0) {
                dadosFustes.push({ numero: 1, de: 1 });
            }
            
            const header = document.createElement('div');
            header.className = 'fuste-header';
            header.innerHTML = `<span class="fuste-icone">&#128734;</span> FUSTES (<span id="fuste-count">${dadosFustes.length}</span>)`;
            divWrapper.appendChild(header);
            
            const listaBlocos = document.createElement('div');
            listaBlocos.id = 'fuste-lista-blocos';
            listaBlocos.className = 'fuste-lista-blocos';
            
            dadosFustes.forEach((fusteExistente, idx) => {
                const bloco = criarBlocoFuste(idx + 1, camposFuste, fusteExistente);
                listaBlocos.appendChild(bloco);
            });
            
            divWrapper.appendChild(listaBlocos);
            
            const btnAdicionar = document.createElement('button');
            btnAdicionar.type = 'button';
            btnAdicionar.className = 'btn-adicionar-fuste';
            btnAdicionar.textContent = '+ Adicionar Fuste';
            btnAdicionar.addEventListener('click', function() {
                const blocos = listaBlocos.querySelectorAll('.fuste-bloco-novo');
                const novoIdx = blocos.length + 1;
                const bloco = criarBlocoFuste(novoIdx, camposFuste, null);
                listaBlocos.appendChild(bloco);
                document.getElementById('fuste-count').textContent = blocos.length + 1;
            });
            divWrapper.appendChild(btnAdicionar);
            
            container.appendChild(divWrapper);
            fusteInserido = true;
            return;
        }
        
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
        } else if (campo.tipo === 'numero') {
            input = document.createElement('input');
            input.type = 'number';
            input.placeholder = `Digite ${campo.label.toLowerCase()}...`;
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.placeholder = campo.placeholder || `Digite ${campo.label.toLowerCase()}...`;
        }
        
        input.name = campo.nome;
        input.required = campo.obrigatorio;
        
        if (individuo && individuo[campo.nome]) {
            input.value = individuo[campo.nome];
        }
        
        div.appendChild(input);
        container.appendChild(div);
    });
    
    mostrarTela('tela-form-individuo');
}

// ============================================
// VALIDACAO DE FUSTES POR FISIONOMIA/ESTRATO
// ============================================

function validarFustes(fustes, estrato, fisionomia) {
    if (!fustes || fustes.length === 0) return null;
    
    for (const fuste of fustes) {
        const altura = parseFloat(fuste.ALTURA);
        const cap = parseFloat(fuste.CAP);
        
        if (estrato === 'arvoreo') {
            if (fisionomia === 'FESD') {
                if (!isNaN(altura) && altura < 2) {
                    return `Fuste ${fuste.numero}: Altura minima para Arboreo FESD e 2m (informado: ${altura}m)`;
                }
                if (!isNaN(cap) && cap < 15) {
                    return `Fuste ${fuste.numero}: CAP minimo para Arboreo FESD e 15cm (informado: ${cap}cm)`;
                }
            } else if (fisionomia === 'Cerrado' || fisionomia === 'Campo Rupestre') {
                if (!isNaN(altura) && altura < 1.5) {
                    return `Fuste ${fuste.numero}: Altura minima para Arboreo ${fisionomia} e 1,5m (informado: ${altura}m)`;
                }
                if (!isNaN(cap) && cap < 15) {
                    return `Fuste ${fuste.numero}: CAP minimo para Arboreo ${fisionomia} e 15cm (informado: ${cap}cm)`;
                }
            }
        } else if (estrato === 'arbustivo') {
            if (fisionomia === 'FESD') {
                if (!isNaN(cap) && cap >= 15) {
                    return `Fuste ${fuste.numero}: CAP do Arbustivo FESD deve ser menor que 15cm (informado: ${cap}cm)`;
                }
                if (!isNaN(altura) && altura <= 1.5) {
                    return `Fuste ${fuste.numero}: Altura do Arbustivo FESD deve ser maior que 1,5m (informado: ${altura}m)`;
                }
            }
        }
    }
    
    return null;
}

function handleSalvarIndividuo() {
    if (!ParcelaState.parcelaAtual || !ParcelaState.estratoAtual) return;
    
    const form = document.getElementById('form-individuo');
    const inputs = form.querySelectorAll('input, select, textarea');
    const dados = {};
    
    inputs.forEach(input => {
        if (input.name && !input.name.includes('_fuste_')) {
            dados[input.name] = input.value;
        }
    });
    
    // Coletar dados dos fustes do novo formato
    const blocosFustes = document.querySelectorAll('.fuste-bloco-novo');
    if (blocosFustes.length > 0) {
        dados.fustes = [];
        blocosFustes.forEach((bloco, idx) => {
            const fuste = { numero: idx + 1, de: blocosFustes.length };
            const camposInputs = bloco.querySelectorAll('input');
            camposInputs.forEach(campoInput => {
                if (campoInput.name) {
                    const nomeCampo = campoInput.name.replace(`_fuste_${idx + 1}`, '');
                    fuste[nomeCampo] = campoInput.value;
                }
            });
            dados.fustes.push(fuste);
        });
        dados.FUSTE = `1 de ${blocosFustes.length}`;
    }
    
    // Validar regras de preenchimento por fisionomia e estrato
    const fisionomia = ParcelaState.parcelaAtual?.campos?.FISIONOMIA || '';
    const estrato = ParcelaState.estratoAtual;
    const erroValidacao = validarFustes(dados.fustes, estrato, fisionomia);
    if (erroValidacao) {
        mostrarToast(erroValidacao, 'erro');
        return;
    }
    
    if (!ParcelaState.parcelaAtual[estrato]) {
        ParcelaState.parcelaAtual[estrato] = [];
    }
    
    if (ParcelaState.individuoEditando !== null) {
        ParcelaState.parcelaAtual[estrato][ParcelaState.individuoEditando] = dados;
    } else {
        ParcelaState.parcelaAtual[estrato].push(dados);
    }
    
    if (ParcelaState.parcelaAtual.status !== 'novo') {
        ParcelaState.parcelaAtual.status = 'novo';
    }
    
    salvarDadosLocais();
    
    const acao = ParcelaState.individuoEditando !== null ? 'atualizado' : 'adicionado';
    mostrarToast(`Indivíduo ${acao} com sucesso!`, 'sucesso');
    
    ParcelaState.individuoEditando = null;
    
    // Voltar para lista atualizada
    abrirListaIndividuos(estrato, fisionomia);
}

function editarIndividuo(idx) {
    const estrato = ParcelaState.estratoAtual;
    const individuos = ParcelaState.parcelaAtual?.[estrato] || [];
    const individuo = individuos[idx];
    
    if (!individuo) return;
    
    const fisionomia = ParcelaState.parcelaAtual?.campos?.FISIONOMIA || 'FESD';
    ParcelaState.individuoEditando = idx;
    abrirFormIndividuo(individuo, estrato, fisionomia);
}

function excluirIndividuo(idx) {
    if (!ParcelaState.parcelaAtual || !ParcelaState.estratoAtual) return;
    
    const estrato = ParcelaState.estratoAtual;
    ParcelaState.parcelaAtual[estrato].splice(idx, 1);
    
    if (ParcelaState.parcelaAtual.status !== 'novo') {
        ParcelaState.parcelaAtual.status = 'novo';
    }
    
    salvarDadosLocais();
    mostrarToast('Indivíduo excluído', 'info');
    abrirListaIndividuos(estrato, ParcelaState.parcelaAtual?.campos?.FISIONOMIA || 'FESD');
}

// ============================================
// PARCELAS - EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const btnSalvarParcela = document.getElementById('btn-salvar-parcela');
    if (btnSalvarParcela) {
        btnSalvarParcela.addEventListener('click', handleSalvarParcela);
    }
    
    const btnSalvarCaracterizacao = document.getElementById('btn-salvar-caracterizacao');
    if (btnSalvarCaracterizacao) {
        btnSalvarCaracterizacao.addEventListener('click', handleSalvarCaracterizacao);
    }
    
    const btnSalvarIndividuo = document.getElementById('btn-salvar-individuo');
    if (btnSalvarIndividuo) {
        btnSalvarIndividuo.addEventListener('click', handleSalvarIndividuo);
    }
    
    const btnVoltarMapaParcela = document.getElementById('btn-voltar-mapa-parcela');
    if (btnVoltarMapaParcela) {
        btnVoltarMapaParcela.addEventListener('click', () => history.back());
    }
    
    const btnVoltarMapaDetalhe = document.getElementById('btn-voltar-mapa-detalhe');
    if (btnVoltarMapaDetalhe) {
        btnVoltarMapaDetalhe.addEventListener('click', () => history.back());
    }
    
    const btnVoltarDetalhe = document.getElementById('btn-voltar-detalhe');
    if (btnVoltarDetalhe) {
        btnVoltarDetalhe.addEventListener('click', () => history.back());
    }
    
    const btnVoltarLista = document.getElementById('btn-voltar-lista');
    if (btnVoltarLista) {
        btnVoltarLista.addEventListener('click', () => history.back());
    }
    
    const btnVoltarDetalheCaract = document.getElementById('btn-voltar-detalhe-caract');
    if (btnVoltarDetalheCaract) {
        btnVoltarDetalheCaract.addEventListener('click', () => history.back());
    }
});
