/* ============================================
   AGF COLETA - Sincronizacao com Box
   ============================================ */

const Sync = {
    client_id: '20om9jnc36mv71x8y9a7tqb',
    client_secret: 'wOtEYKq0NSxRN07GZioYnuRQ5F1Nxb0J',
    access_token: null,
    token_expira: null,
    refresh_token: null,
    pasta_coleta_id: null,
    conectado: false,
    redirect_uri: 'agfcoleta://box-callback'
};

// ============================================
// PROXY PARA BOX API (evita CORS)
// ============================================

const PROXY_URL = (location.protocol === 'file:' || location.hostname === '')
    ? 'https://agf-coleta.onrender.com/proxy/box'
    : '/proxy/box';

async function boxFetch(url, options = {}) {
    const resp = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: url,
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body || null
        })
    });
    const data = await resp.json();
    if (!resp.ok) {
        const err = new Error(data.detail || data.error || 'Erro na API Box');
        err.status = resp.status;
        throw err;
    }
    return data;
}

async function boxUploadFile(url, formData) {
    const formEntries = [];
    for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
            const reader = new FileReader();
            const base64 = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(value);
            });
            formEntries.push({ key, value: base64, filename: value.filename, type: 'file' });
        } else {
            formEntries.push({ key, value, type: 'text' });
        }
    }
    
    const resp = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: url,
            method: 'POST',
            headers: {},
            form: formEntries
        })
    });
    return resp.json();
}

// ============================================
// TOKEN DO BOX (Developer Token)
// ============================================

function obterTokenSalvo() {
    const token = localStorage.getItem('agf_box_token');
    const expira = localStorage.getItem('agf_box_token_expira');
    
    if (token && expira && Date.now() < parseInt(expira)) {
        return { token, expira: parseInt(expira) };
    }
    return null;
}

function salvarToken(token, expiraEm = 3600) {
    const expira = Date.now() + (expiraEm * 1000);
    localStorage.setItem('agf_box_token', token);
    localStorage.setItem('agf_box_token_expira', expira.toString());
    localStorage.setItem('agf_box_token_input', token);
    Sync.access_token = token;
    Sync.token_expira = expira;
    Sync.conectado = true;
}

// ============================================
// AUTENTICACAO
// ============================================

async function autenticarBox() {
    console.log('Autenticando com Box...');
    
    // 1. Verificar se tem token OAuth valido
    const tokenType = localStorage.getItem('agf_box_token_type');
    if (tokenType === 'oauth') {
        const salvo = obterTokenSalvo();
        if (salvo) {
            Sync.access_token = salvo.token;
            Sync.token_expira = salvo.expira;
            Sync.conectado = true;
            console.log('Token OAuth valido, expira em', new Date(salvo.expira).toLocaleTimeString());
            return true;
        }
        
        // Token expirado, tentar renovar
        const renovado = await renovarTokenOAuth();
        if (renovado) {
            return true;
        }
    }
    
    // 2. Verificar se tem token manual salvo
    const salvo = obterTokenSalvo();
    if (salvo) {
        Sync.access_token = salvo.token;
        Sync.token_expira = salvo.expira;
        Sync.conectado = true;
        console.log('Token reutilizado, expira em', new Date(salvo.expira).toLocaleTimeString());
        return true;
    }
    
    // 3. Verificar se tem token de input
    const tokenInput = localStorage.getItem('agf_box_token_input');
    if (tokenInput) {
        salvarToken(tokenInput);
        console.log('Token do usuario ativado');
        return true;
    }
    
    console.log('Nenhum token valido encontrado');
    Sync.conectado = false;
    return false;
}

async function verificarToken() {
    if (Sync.access_token && Date.now() < Sync.token_expira) {
        return true;
    }
    return await autenticarBox();
}

// ============================================
// VERIFICAR CONEXAO COM BOX
// ============================================

async function testarConexaoBox() {
    if (!await verificarToken()) return false;
    
    try {
        const data = await boxFetch('https://api.box.com/2.0/users/me', {
            headers: { 'Authorization': 'Bearer ' + Sync.access_token }
        });
        
        console.log('Conectado como:', data.name);
        return true;
    } catch (e) {
        console.log('Erro ao testar conexao:', e.message);
        if (e.status === 401) {
            localStorage.removeItem('agf_box_token');
            localStorage.removeItem('agf_box_token_expira');
            Sync.conectado = false;
        }
        return false;
    }
}

// ============================================
// CRIAR PASTA DE COLETA NO BOX
// ============================================

async function garantirPastaColeta() {
    if (Sync.pasta_coleta_id) return Sync.pasta_coleta_id;
    
    if (!await verificarToken()) return null;
    
    const nomePasta = 'AGF_COLETA';
    const pastaRaiz = '0';
    
    try {
        const data = await boxFetch(
            `https://api.box.com/2.0/folders/${pastaRaiz}/items?limit=1000&fields=name,id`,
            { headers: { 'Authorization': 'Bearer ' + Sync.access_token } }
        );
        
        const existente = data.entries.find(
            e => e.type === 'folder' && e.name === nomePasta
        );
        
        if (existente) {
            Sync.pasta_coleta_id = existente.id;
            console.log('Pasta encontrada:', existente.id);
            return existente.id;
        }
        
        const nova = await boxFetch('https://api.box.com/2.0/folders', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + Sync.access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: nomePasta,
                parent: { id: pastaRaiz }
            })
        });
        
        Sync.pasta_coleta_id = nova.id;
        console.log('Pasta criada:', nova.id);
        return nova.id;
        
    } catch (e) {
        console.log('Erro ao buscar/criar pasta:', e.message);
        return null;
    }
}

// ID da pasta AGF_COLETA no Box (ja criada)
Sync.pasta_coleta_id = '399962735568';

// ============================================
// UPLOAD DE ARQUIVO PARA O BOX
// ============================================

async function subirArquivoBox(nomeArquivo, conteudo, pastaId) {
    if (!await verificarToken()) return null;
    
    try {
        const conteudoStr = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo, null, 2);
        const attributes = JSON.stringify({
            name: nomeArquivo,
            parent: { id: pastaId }
        });
        const base64 = btoa(unescape(encodeURIComponent(conteudoStr)));
        
        const resp = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://upload.box.com/api/2.0/files/content',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + Sync.access_token },
                upload: true,
                attributes: attributes,
                fileBase64: base64,
                fileName: nomeArquivo
            })
        });
        
        const data = await resp.json();
        if (resp.ok && data.entries) {
            console.log('Arquivo enviado:', data.entries[0].name);
            return data.entries[0];
        }
        
        console.log('Erro upload:', resp.status, data);
        return null;
        
    } catch (e) {
        console.log('Erro no upload:', e.message);
        return null;
    }
}

// ============================================
// SUBSTITUIR ARQUIVO NO BOX
// ============================================

async function subistituirArquivoBox(fileId, conteudo) {
    if (!await verificarToken()) return null;
    
    try {
        const resp = await fetch(
            `https://upload.box.com/api/2.0/files/${fileId}/content`,
            {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + Sync.access_token },
                body: (() => {
                    const fd = new FormData();
                    fd.append('attributes', JSON.stringify({ name: 'update' }));
                    fd.append('file', new Blob(
                        [typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo, null, 2)],
                        { type: 'application/json' }
                    ));
                    return fd;
                })()
            }
        );
        
        if (resp.ok) {
            const data = await resp.json();
            console.log('Arquivo atualizado:', data.entries[0].name);
            return data.entries[0];
        }
        
        return null;
    } catch (e) {
        console.log('Erro ao atualizar:', e.message);
        return null;
    }
}

// ============================================
// LISTAR ARQUIVOS NA PASTA
// ============================================

async function listarArquivosBox(pastaId) {
    if (!await verificarToken()) return [];
    
    try {
        const data = await boxFetch(
            `https://api.box.com/2.0/folders/${pastaId}/items?limit=1000&fields=name,id,size,modified_at`,
            { headers: { 'Authorization': 'Bearer ' + Sync.access_token } }
        );
        return data.entries || [];
    } catch (e) {
        return [];
    }
}

// ============================================
// BAIXAR ARQUIVO DO BOX
// ============================================

async function baixarArquivoBox(fileId) {
    if (!await verificarToken()) return null;
    
    try {
        const resp = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: `https://api.box.com/2.0/files/${fileId}/content`,
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + Sync.access_token }
            })
        });
        
        if (resp.redirected) {
            const data = await fetch(resp.url);
            return await data.json();
        }
        
        if (resp.ok) {
            return await resp.json();
        }
        return null;
    } catch (e) {
        return null;
    }
}

// ============================================
// SINCRONIZACAO PRINCIPAL
// ============================================

async function sincronizarDados() {
    // Para o Inventário, usar sincronização específica
    if (App.projetoAtual === 'inventario') {
        return await sincronizarInventario();
    }
    
    const modal = document.getElementById('modal-sync');
    const titulo = document.getElementById('sync-titulo');
    const status = document.getElementById('sync-status');
    const progress = document.getElementById('sync-progress');
    const btnFechar = document.getElementById('btn-fechar-sync');
    
    modal.classList.add('ativo');
    btnFechar.style.display = 'none';
    progress.style.backgroundColor = '#27AE60';
    
    try {
        titulo.textContent = 'Conectando ao Box...';
        status.textContent = 'Verificando token...';
        progress.style.width = '10%';
        
        if (!await testarConexaoBox()) {
            throw new Error('Token invalido ou expirado. Gere um novo token no Box Developer Console e configure no app.');
        }
        
        titulo.textContent = 'Preparando dados...';
        status.textContent = 'Identificando dados novos...';
        progress.style.width = '25%';
        
        const dadosLocais = App.dadosLocais[App.projetoAtual] || [];
        const dadosNovos = dadosLocais.filter(d => d.status === 'novo');
        
        if (dadosNovos.length === 0) {
            titulo.textContent = 'Nada para sincronizar';
            status.textContent = 'Todos os dados ja foram enviados';
            progress.style.width = '100%';
            btnFechar.style.display = 'block';
            return;
        }
        
        titulo.textContent = 'Criando pasta no Box...';
        status.textContent = 'Verificando pasta AGF_COLETA...';
        progress.style.width = '35%';
        
        const pastaId = await garantirPastaColeta();
        if (!pastaId) {
            throw new Error('Nao foi possivel criar/acessar a pasta AGF_COLETA no Box');
        }
        
        titulo.textContent = 'Enviando dados...';
        status.textContent = `Enviando ${dadosNovos.length} pontos...`;
        progress.style.width = '50%';
        
        const agora = new Date();
        const dataStr = agora.toISOString().split('T')[0];
        const horaStr = agora.toTimeString().split(' ')[0].replace(/:/g, '');
        const nomeArquivo = `coleta_${App.usuario.nome}_${dataStr}_${horaStr}.json`;
        
        const dadosParaEnviar = {
            projeto: App.projetoAtual,
            tecnico: App.usuario.email,
            dataSync: agora.toISOString(),
            totalPontos: dadosNovos.length,
            pontos: dadosNovos.map(d => ({
                codigo: d.codigo,
                latitude: d.latitude,
                longitude: d.longitude,
                dados: d.campos || d.dados
            }))
        };
        
        progress.style.width = '70%';
        
        const resultado = await subirArquivoBox(nomeArquivo, dadosParaEnviar, pastaId);
        
        if (!resultado) {
            throw new Error('Falha ao enviar arquivo para o Box');
        }
        
        titulo.textContent = 'Finalizando...';
        status.textContent = 'Atualizando status local...';
        progress.style.width = '90%';
        
        dadosNovos.forEach(dado => {
            dado.status = 'sincronizado';
            dado.syncEm = agora.toISOString();
            dado.syncArquivo = nomeArquivo;
            FilaSync.marcarSincronizado(dado.id);
        });
        
        salvarDadosLocais();
        
        titulo.textContent = 'Sincronizacao concluida!';
        status.textContent = `${dadosNovos.length} pontos enviados para AGF_COLETA/${nomeArquivo}`;
        progress.style.width = '100%';
        btnFechar.style.display = 'block';
        
        atualizarContadorPontos();
        carregarPontosNoMapa();
        mostrarToast(`${dadosNovos.length} pontos sincronizados!`, 'sucesso');
        
    } catch (error) {
        console.error('Erro na sincronizacao:', error);
        titulo.textContent = 'Erro na sincronizacao';
        status.textContent = error.message;
        progress.style.width = '100%';
        progress.style.backgroundColor = '#E74C3C';
        btnFechar.style.display = 'block';
        mostrarToast('Erro ao sincronizar: ' + error.message, 'erro');
    }
}

// ============================================
// SALVAR TOKEN PELO APP
// ============================================

function configurarTokenBox(token) {
    if (!token || token.length < 10) {
        mostrarToast('Token invalido', 'erro');
        return false;
    }
    
    localStorage.removeItem('agf_box_token_type');
    localStorage.removeItem('agf_box_refresh_token');
    localStorage.setItem('agf_box_token_input', token);
    salvarToken(token);
    mostrarToast('Token do Box configurado!', 'sucesso');
    return true;
}

function limparTokenBox() {
    localStorage.removeItem('agf_box_token_input');
    localStorage.removeItem('agf_box_token');
    localStorage.removeItem('agf_box_token_expira');
    localStorage.removeItem('agf_box_token_type');
    localStorage.removeItem('agf_box_refresh_token');
    Sync.access_token = null;
    Sync.token_expira = null;
    Sync.conectado = false;
    mostrarToast('Token removido', 'info');
    atualizarStatusToken();
}

// ============================================
// OAUTH 2.0 - LOGIN COM BOX
// ============================================

const OAuth = {
    state: null,
    code_verifier: null,
    code_challenge: null
};

function gerarState() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function gerarCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function gerarCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function iniciarLoginBox() {
    // Verificar se esta em file:// (navegador) ou em servidor/APK
    if (window.location.protocol === 'file:') {
        mostrarToast('No navegador, cole o Developer Token no painel de projetos', 'aviso');
        return;
    }
    
    // Fluxo OAuth para servidor ou APK
    OAuth.state = gerarState();
    OAuth.code_verifier = await gerarCodeVerifier();
    OAuth.code_challenge = await gerarCodeChallenge(OAuth.code_verifier);
    
    localStorage.setItem('agf_oauth_state', OAuth.state);
    localStorage.setItem('agf_oauth_verifier', OAuth.code_verifier);
    
    const redirectUri = Sync.redirect_uri || 'https://localhost';
    const authUrl = `https://account.box.com/api/oauth2/authorize?` +
        `response_type=code` +
        `&client_id=${Sync.client_id}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${OAuth.state}`;
    
    console.log('Abrindo login do Box:', authUrl);
    window.location.href = authUrl;
}

async function trocarCodePorToken(code) {
    console.log('Trocando code por token...');
    
    const redirectUri = Sync.redirect_uri || 'https://localhost';
    
    try {
        const resp = await fetch('https://api.box.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: Sync.client_id,
                client_secret: Sync.client_secret,
                redirect_uri: redirectUri
            })
        });
        
        if (resp.ok) {
            const data = await resp.json();
            salvarTokenOAuth(data);
            mostrarToast('Login com Box realizado com sucesso!', 'sucesso');
            atualizarStatusToken();
            return true;
        } else {
            const erro = await resp.json();
            console.error('Erro ao trocar code:', erro);
            mostrarToast('Erro ao autenticar: ' + (erro.error_description || erro.error), 'erro');
            return false;
        }
    } catch (e) {
        console.error('Erro na requisicao:', e);
        mostrarToast('Erro de conexao ao autenticar', 'erro');
        return false;
    }
}

function salvarTokenOAuth(data) {
    Sync.access_token = data.access_token;
    Sync.refresh_token = data.refresh_token;
    Sync.token_expira = Date.now() + (data.expires_in * 1000);
    Sync.conectado = true;
    
    localStorage.setItem('agf_box_token', data.access_token);
    localStorage.setItem('agf_box_token_expira', Sync.token_expira.toString());
    localStorage.setItem('agf_box_refresh_token', data.refresh_token);
    localStorage.setItem('agf_box_token_type', 'oauth');
    
    console.log('Token OAuth salvo, expira em', data.expires_in, 'segundos');
}

async function renovarTokenOAuth() {
    const refreshToken = localStorage.getItem('agf_box_refresh_token');
    if (!refreshToken) {
        console.log('Nenhum refresh_token encontrado');
        return false;
    }
    
    console.log('Renovando token...');
    
    try {
        const resp = await fetch('https://api.box.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: Sync.client_id,
                client_secret: Sync.client_secret
            })
        });
        
        if (resp.ok) {
            const data = await resp.json();
            salvarTokenOAuth(data);
            console.log('Token renovado com sucesso');
            return true;
        } else {
            console.log('Erro ao renovar token');
            return false;
        }
    } catch (e) {
        console.error('Erro ao renovar token:', e);
        return false;
    }
}

function logoutBox() {
    Sync.access_token = null;
    Sync.token_expira = null;
    Sync.refresh_token = null;
    Sync.conectado = false;
    
    localStorage.removeItem('agf_box_token');
    localStorage.removeItem('agf_box_token_expira');
    localStorage.removeItem('agf_box_refresh_token');
    localStorage.removeItem('agf_box_token_type');
    localStorage.removeItem('agf_oauth_state');
    localStorage.removeItem('agf_oauth_verifier');
    
    mostrarToast('Desconectado do Box', 'info');
    atualizarStatusToken();
}

function verificarCallbackOAuth() {
    // Verificar se houve callback via URL (para redirect flow)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
        const stateSalvo = localStorage.getItem('agf_oauth_state');
        if (state === stateSalvo) {
            trocarCodePorToken(code);
            // Limpar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            mostrarToast('Erro de seguranca: state invalido', 'erro');
        }
    }
}

// ============================================
// INVENTARIO FLORESTAL - SINCRONIZACAO COM BOX
// ============================================

const InventarioSync = {
    folder_id: '400201285976',
    geojson_folder_id: '400216557385',
    file_ids: {},
    kml_file_ids: {}
};

async function listarGeoJSONInventario() {
    if (!await verificarToken()) return [];
    
    try {
        const data = await boxFetch(
            `https://api.box.com/2.0/folders/${InventarioSync.geojson_folder_id}/items?limit=1000&fields=name,id,size,extension`,
            { headers: { 'Authorization': 'Bearer ' + Sync.access_token } }
        );
        InventarioSync.file_ids = {};
        InventarioSync.kml_file_ids = {};
        (data.entries || []).forEach(item => {
            if (item.type === 'file') {
                if (item.name.endsWith('.kml')) {
                    InventarioSync.kml_file_ids[item.name.replace('.kml', '')] = item.id;
                } else {
                    const nome = item.name.replace('.geojson', '').replace('.json', '');
                    InventarioSync.file_ids[nome] = item.id;
                }
            }
        });
        return data.entries || [];
    } catch (e) {
        console.error('Erro ao listar GeoJSON:', e);
        return [];
    }
}

async function baixarGeoJSON(nomeArquivo) {
    if (!await verificarToken()) return null;
    
    if (!InventarioSync.file_ids[nomeArquivo]) {
        await listarGeoJSONInventario();
    }
    
    const fileId = InventarioSync.file_ids[nomeArquivo];
    if (!fileId) {
        console.log('Arquivo nao encontrado:', nomeArquivo);
        return null;
    }
    
    try {
        const resp = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: `https://api.box.com/2.0/files/${fileId}/content`,
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + Sync.access_token }
            })
        });
        
        const data = await resp.json();
        if (resp.ok) return data;
        
        if (data.location) {
            const resp2 = await fetch(data.location);
            if (resp2.ok) return await resp2.json();
        }
        return null;
    } catch (e) {
        console.error('Erro ao baixar GeoJSON:', e);
        return null;
    }
}

async function salvarGeoJSON(nomeArquivo, dados) {
    if (!await verificarToken()) return null;
    
    const fileId = InventarioSync.file_ids[nomeArquivo];
    const nomeCompleto = nomeArquivo.endsWith('.geojson') ? nomeArquivo : nomeArquivo + '.geojson';
    const conteudo = JSON.stringify(dados, null, 2);
    const attributes = { name: nomeCompleto, parent: { id: InventarioSync.geojson_folder_id } };
    
    const url = fileId
        ? `https://upload.box.com/api/2.0/files/${fileId}/content`
        : 'https://upload.box.com/api/2.0/files/content';
    
    try {
        const base64 = btoa(unescape(encodeURIComponent(conteudo)));
        
        const resp = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + Sync.access_token },
                upload: true,
                attributes: JSON.stringify(attributes),
                fileBase64: base64,
                fileName: nomeArquivo
            })
        });
        
        const data = await resp.json();
        if (resp.ok && data.entries) {
            if (!fileId) {
                InventarioSync.file_ids[nomeArquivo] = data.entries[0].id;
            }
            console.log('GeoJSON salvo:', nomeArquivo);
            return data.entries[0];
        }
        console.error('Erro ao salvar GeoJSON:', data);
    } catch (e) {
        console.error('Erro ao salvar GeoJSON:', e);
    }
    
    return null;
}

// ============================================
// MODAL DE REVISAO
// ============================================

function mostrarRevisao(dadosNovos) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-revisao');
        const lista = document.getElementById('revisao-lista');
        const resumo = document.getElementById('revisao-resumo');
        
        const porCamada = {};
        dadosNovos.forEach(d => {
            const camada = d.camada || 'Sem camada';
            porCamada[camada] = (porCamada[camada] || 0) + 1;
        });
        
        const resumoTexto = Object.entries(porCamada)
            .map(([camada, qtd]) => `${qtd} ${camada}`)
            .join(', ');
        resumo.textContent = `${dadosNovos.length} ponto(s) para enviar: ${resumoTexto}`;
        
        lista.innerHTML = '';
        dadosNovos.forEach(dado => {
            const cor = (typeof CamadasConfig !== 'undefined' && CamadasConfig.cores[dado.camada]) || '#3498DB';
            let nomeCamada = dado.camada || 'Sem camada';
            if (typeof DADOS_CONFIG_INVENTARIO !== 'undefined' && DADOS_CONFIG_INVENTARIO.camadas[dado.camada]) {
                nomeCamada = DADOS_CONFIG_INVENTARIO.camadas[dado.camada].nome;
            }
            const campos = dado.campos || {};
            const nome = campos.nome_proprietario || campos.NOME_DO_ENTREVISTADO || campos.NOME || 'Sem nome';
            const endereco = campos.endereco || campos.ENDERECO_COMPLETO || '';
            const data = dado.dataColeta ? new Date(dado.dataColeta).toLocaleDateString('pt-BR') : '';
            
            const tipoLabel = dado._tipoRevisao === 'editado' ? 'Editado' : 'Novo';
            const tipoClass = dado._tipoRevisao === 'editado' ? 'editado' : 'novo';
            
            const item = document.createElement('div');
            item.className = 'revisao-item';
            item.innerHTML = `
                <div class="revisao-cor" style="background-color: ${cor}"></div>
                <div class="revisao-info">
                    <div class="revisao-nome">${nome}</div>
                    <div class="revisao-detalhes">${nomeCamada}${endereco ? ' - ' + endereco : ''}${data ? ' - ' + data : ''}</div>
                </div>
                <span class="revisao-status ${tipoClass}">${tipoLabel}</span>
            `;
            lista.appendChild(item);
        });
        
        const btnConfirmar = document.getElementById('btn-confirmar-sync');
        const btnCancelar = document.getElementById('btn-cancelar-revisao');
        
        const cleanup = () => {
            modal.classList.remove('ativo');
            btnConfirmar.removeEventListener('click', onConfirmar);
            btnCancelar.removeEventListener('click', onCancelar);
        };
        
        const onConfirmar = () => { cleanup(); resolve(true); };
        const onCancelar = () => { cleanup(); resolve(false); };
        
        btnConfirmar.addEventListener('click', onConfirmar);
        btnCancelar.addEventListener('click', onCancelar);
        
        modal.classList.add('ativo');
    });
}

async function sincronizarInventario() {
    const dadosLocais = App.dadosLocais['inventario'] || [];
    const dadosNovos = dadosLocais.filter(d => d.status === 'novo');
    
    const dadosEditadosBox = JSON.parse(localStorage.getItem('agf_inventario_editados') || '[]');
    
    if (dadosNovos.length === 0 && dadosEditadosBox.length === 0) {
        mostrarToast('Nenhum dado novo para sincronizar', 'aviso');
        return;
    }
    
    const itensRevisao = [
        ...dadosNovos.map(d => ({...d, _tipoRevisao: d.editado ? 'editado' : 'novo'})),
        ...dadosEditadosBox.map(d => ({id: d._id, camada: d._camada, campos: d.properties, _tipoRevisao: 'editado'}))
    ];
    
    const aprovado = await mostrarRevisao(itensRevisao);
    if (!aprovado) return;
    
    const modal = document.getElementById('modal-sync');
    const titulo = document.getElementById('sync-titulo');
    const status = document.getElementById('sync-status');
    const progress = document.getElementById('sync-progress');
    const btnFechar = document.getElementById('btn-fechar-sync');
    
    modal.classList.add('ativo');
    btnFechar.style.display = 'none';
    progress.style.backgroundColor = '#27AE60';
    
    try {
        titulo.textContent = 'Conectando ao Box...';
        status.textContent = 'Verificando token...';
        progress.style.width = '10%';
        
        if (!await testarConexaoBox()) {
            throw new Error('Token invalido ou expirado.');
        }
        
        titulo.textContent = 'Listando arquivos GeoJSON...';
        status.textContent = 'Buscando dados no Box...';
        progress.style.width = '20%';
        
        await listarGeoJSONInventario();
        
        const dadosParaSync = dadosLocais.filter(d => d.status === 'novo' || d.status === 'sincronizado');
        
        if (dadosNovos.length === 0 && dadosParaSync.length === 0 && dadosEditadosBox.length === 0) {
            titulo.textContent = 'Nada para sincronizar';
            status.textContent = 'Todos os dados ja foram enviados';
            progress.style.width = '100%';
            btnFechar.style.display = 'block';
            return;
        }
        
        if (dadosNovos.length === 0 && dadosParaSync.length > 0) {
            titulo.textContent = 'Re-sincronizando dados...';
            status.textContent = 'Verificando dados no Box...';
        }
        
        // Agrupar por camada
        const porCamada = {};
        dadosParaSync.forEach(dado => {
            const camada = dado.camada || 'Censo';
            if (!porCamada[camada]) porCamada[camada] = [];
            porCamada[camada].push(dado);
        });
        
        // Incluir camadas de dados editados no Box
        dadosEditadosBox.forEach(editado => {
            const camada = editado._camada || 'Censo';
            if (!porCamada[camada]) porCamada[camada] = [];
        });
        
        const camadas = Object.keys(porCamada);
        let enviados = 0;
        let novosAdicionados = 0;
        
        for (const camada of camadas) {
            titulo.textContent = `Sincronizando ${camada}...`;
            status.textContent = `Enviando ${porCamada[camada].length} registros...`;
            const totalItens = dadosParaSync.length || dadosEditadosBox.length;
            progress.style.width = `${20 + (enviados / totalItens) * 70}%`;
            
            // Baixar a versao MAIS RECENTE do Box
            let geojson = await baixarGeoJSON(camada);
            if (!geojson) {
                geojson = {
                    type: 'FeatureCollection',
                    name: camada,
                    features: []
                };
            }
            
            // Collect existing IDs to avoid duplicates
            const idsExistentes = new Set();
            (geojson.features || []).forEach(f => {
                const id = f.properties && f.properties._id;
                if (id) idsExistentes.add(id);
            });
            
            const totalAntes = geojson.features ? geojson.features.length : 0;
            
            // Adicionar novos pontos e atualizar editados
            let adicionadosCamada = 0;
            let atualizadosCamada = 0;
            porCamada[camada].forEach(dado => {
                if (idsExistentes.has(dado.id)) {
                    if (dado.editado) {
                        const idx = geojson.features.findIndex(f => f.properties && f.properties._id === dado.id);
                        if (idx !== -1) {
                            geojson.features[idx].properties = {
                                ...geojson.features[idx].properties,
                                ...dado.campos,
                                _editado: true,
                                _editado_em: dado.editadoEm
                            };
                            atualizadosCamada++;
                        }
                    }
                } else {
                    const feature = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [dado.longitude, dado.latitude, 0]
                        },
                        properties: {
                            ...dado.campos,
                            _id: dado.id,
                            _data_coleta: dado.dataColeta,
                            _tecnico: dado.tecnico
                        }
                    };
                    geojson.features.push(feature);
                    idsExistentes.add(dado.id);
                    adicionadosCamada++;
                }
            });
            
            // Atualizar pontos editados no Box
            const dadosEditados = JSON.parse(localStorage.getItem('agf_inventario_editados') || '[]');
            dadosEditados.forEach(editado => {
                if (editado._camada === camada) {
                    const idx = geojson.features.findIndex(f => f.properties && f.properties._id === editado._id);
                    if (idx !== -1) {
                        geojson.features[idx].properties = {
                            ...geojson.features[idx].properties,
                            ...editado.properties
                        };
                        atualizadosCamada++;
                    }
                }
            });
            
            novosAdicionados += adicionadosCamada;
            
            // Salvar GeoJSON no Box
            await salvarGeoJSON(camada, geojson);
            
            // Gerar e salvar KML
            titulo.textContent = `Gerando KML de ${camada}...`;
            const conteudoKml = geojsonParaKml(geojson, camada);
            await salvarKml(camada, conteudoKml);
            
            status.textContent = `${camada}: ${adicionadosCamada} novos, ${atualizadosCamada} atualizados (${geojson.features.length} total)`;
            enviados += porCamada[camada].length;
        }
        
        // Marcar como sincronizados
        const agora = new Date();
        dadosParaSync.forEach(dado => {
            dado.status = 'sincronizado';
            dado.syncEm = agora.toISOString();
            FilaSync.marcarSincronizado(dado.id);
        });
        
        salvarDadosLocais();
        
        localStorage.removeItem('agf_inventario_editados');
        
        titulo.textContent = 'Sincronizacao concluida!';
        status.textContent = `${novosAdicionados} novos pontos em ${camadas.length} camada(s) + KML gerado`;
        progress.style.width = '100%';
        btnFechar.style.display = 'block';
        
        atualizarContadorPontos();
        carregarPontosNoMapa();
        mostrarToast(`${novosAdicionados} novos + editados sincronizados + KML!`, 'sucesso');
        
    } catch (error) {
        console.error('Erro na sincronizacao:', error);
        titulo.textContent = 'Erro na sincronizacao';
        status.textContent = error.message;
        progress.style.width = '100%';
        progress.style.backgroundColor = '#E74C3C';
        btnFechar.style.display = 'block';
        mostrarToast('Erro ao sincronizar: ' + error.message, 'erro');
    }
}

// ============================================
// CONVERSOR GEOJSON -> KML
// ============================================

function geojsonParaKml(geojson, nomeCamada) {
    let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
    kml += '<Document>\n';
    kml += `  <name>${nomeCamada}</name>\n`;
    
    const estilos = {};
    
    (geojson.features || []).forEach(feature => {
        const props = feature.properties || {};
        const coords = feature.geometry ? feature.geometry.coordinates : null;
        if (!coords) return;
        
        const lon = coords[0];
        const lat = coords[1];
        const alt = coords[2] || 0;
        
        const nome = props.NOME || props.NOME_DO_ENTREVISTADO || props.nome || '';
        const tecnico = props._tecnico || '';
        const data = props._data_coleta || '';
        
        kml += '  <Placemark>\n';
        if (nome) {
            kml += `    <name>${escapeXml(String(nome))}</name>\n`;
        }
        
        let desc = '';
        Object.keys(props).forEach(key => {
            if (key.startsWith('_')) return;
            const valor = props[key];
            if (valor !== undefined && valor !== null && valor !== '') {
                desc += `${key}: ${escapeXml(String(valor))}\\n`;
            }
        });
        if (tecnico) desc += `Tecnico: ${escapeXml(tecnico)}\\n`;
        if (data) desc += `Data: ${escapeXml(data)}`;
        
        if (desc) {
            kml += `    <description><![CDATA[${desc.replace(/\\n/g, '<br/>')}]]></description>\n`;
        }
        
        kml += '    <Point>\n';
        kml += `      <coordinates>${lon},${lat},${alt}</coordinates>\n`;
        kml += '    </Point>\n';
        kml += '  </Placemark>\n';
    });
    
    kml += '</Document>\n';
    kml += '</kml>';
    
    return kml;
}

function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ============================================
// UPLOAD KML PARA BOX
// ============================================

async function salvarKml(nomeArquivo, conteudoKml) {
    if (!await verificarToken()) return null;
    
    const fileId = InventarioSync.kml_file_ids[nomeArquivo];
    const nomeCompleto = nomeArquivo.endsWith('.kml') ? nomeArquivo : nomeArquivo + '.kml';
    const attributes = { name: nomeCompleto, parent: { id: InventarioSync.geojson_folder_id } };
    
    const url = fileId
        ? `https://upload.box.com/api/2.0/files/${fileId}/content`
        : 'https://upload.box.com/api/2.0/files/content';
    
    try {
        const base64 = btoa(unescape(encodeURIComponent(conteudoKml)));
        
        const resp = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + Sync.access_token },
                upload: true,
                attributes: JSON.stringify(attributes),
                fileBase64: base64,
                fileName: nomeCompleto
            })
        });
        
        const data = await resp.json();
        if (resp.ok && data.entries) {
            if (!fileId) {
                InventarioSync.kml_file_ids[nomeArquivo] = data.entries[0].id;
            }
            console.log('KML salvo:', nomeCompleto);
            return data.entries[0];
        }
    } catch (e) {
        console.error('Erro ao salvar KML:', e);
    }
    
    return null;
}

// ============================================
// LISTAR KMLs NO BOX
// ============================================

async function listarKmlsInventario() {
    if (!await verificarToken()) return [];
    
    try {
        const data = await boxFetch(
            `https://api.box.com/2.0/folders/${InventarioSync.geojson_folder_id}/items?limit=1000&fields=name,id,size,extension`,
            { headers: { 'Authorization': 'Bearer ' + Sync.access_token } }
        );
        InventarioSync.kml_file_ids = {};
        (data.entries || []).forEach(item => {
            if (item.type === 'file' && item.name.endsWith('.kml')) {
                const nome = item.name.replace('.kml', '');
                InventarioSync.kml_file_ids[nome] = item.id;
            }
        });
        return data.entries || [];
    } catch (e) {
        console.error('Erro ao listar KMLs:', e);
        return [];
    }
}

// ============================================
// VERIFICAR CONEXAO
// ============================================

function verificarConexao() {
    if (navigator.onLine) {
        console.log('Conectado a internet');
    } else {
        console.log('Modo offline');
    }
}

window.addEventListener('online', () => {
    console.log('Conexao restaurada');
    const pendentes = FilaSync.obterCountPendentes();
    
    if (pendentes > 0) {
        mostrarToast(`Conexao restaurada! ${pendentes} itens para sincronizar.`, 'info');
        setTimeout(() => sincronizarDados(), 2000);
    }
});

window.addEventListener('offline', () => {
    console.log('Conexao perdida');
    mostrarToast('Sem conexao. Dados salvos localmente.', 'aviso');
});

// ============================================
// MODAL DE EXCLUSAO
// ============================================

function limparDadosLocais() {
    const dadosLocais = App.dadosLocais[App.projetoAtual] || [];
    const dadosNaoSync = dadosLocais.filter(d => d.status === 'novo');
    
    if (dadosNaoSync.length === 0) {
        mostrarToast('Nenhum dado pendente para excluir', 'aviso');
        return;
    }
    
    abrirExclusao(dadosNaoSync);
}

function abrirExclusao(dadosNaoSync) {
    const modal = document.getElementById('modal-exclusao');
    const lista = document.getElementById('exclusao-lista');
    const resumo = document.getElementById('exclusao-resumo');
    const marcarTodos = document.getElementById('exclusao-marcar-todos');
    
    marcarTodos.checked = true;
    
    const porCamada = {};
    dadosNaoSync.forEach(d => {
        const camada = d.camada || 'Sem camada';
        porCamada[camada] = (porCamada[camada] || 0) + 1;
    });
    
    const resumoTexto = Object.entries(porCamada)
        .map(([camada, qtd]) => `${qtd} ${camada}`)
        .join(', ');
    resumo.textContent = `${dadosNaoSync.length} ponto(s) pendente(s): ${resumoTexto}`;
    
    lista.innerHTML = '';
    dadosNaoSync.forEach(dado => {
        const cor = (typeof CamadasConfig !== 'undefined' && CamadasConfig.cores[dado.camada]) || '#3498DB';
        let nomeCamada = dado.camada || 'Sem camada';
        if (typeof DADOS_CONFIG_INVENTARIO !== 'undefined' && DADOS_CONFIG_INVENTARIO.camadas[dado.camada]) {
            nomeCamada = DADOS_CONFIG_INVENTARIO.camadas[dado.camada].nome;
        }
        const nome = dado.campos.nome_proprietario || dado.campos.NOME_DO_ENTREVISTADO || 'Sem nome';
        const endereco = dado.campos.endereco || dado.campos.ENDERECO_COMPLETO || '';
        const data = new Date(dado.dataColeta).toLocaleDateString('pt-BR');
        
        const item = document.createElement('div');
        item.className = 'revisao-item-checkbox';
        item.innerHTML = `
            <input type="checkbox" checked data-id="${dado.id}">
            <div class="revisao-cor" style="background-color: ${cor}"></div>
            <div class="revisao-info">
                <div class="revisao-nome">${nome}</div>
                <div class="revisao-detalhes">${nomeCamada}${endereco ? ' - ' + endereco : ''} - ${data}</div>
            </div>
        `;
        lista.appendChild(item);
    });
    
    modal.classList.add('ativo');
}

function fecharExclusao() {
    document.getElementById('modal-exclusao').classList.remove('ativo');
}

function confirmarExclusao() {
    const checkboxes = document.querySelectorAll('#exclusao-lista input[type="checkbox"]:checked');
    const idsParaExcluir = Array.from(checkboxes).map(cb => cb.dataset.id);
    
    if (idsParaExcluir.length === 0) {
        mostrarToast('Nenhum ponto selecionado', 'aviso');
        return;
    }
    
    if (!confirm(`Excluir ${idsParaExcluir.length} ponto(s) selecionado(s)?`)) {
        return;
    }
    
    const dadosLocais = App.dadosLocais[App.projetoAtual] || [];
    App.dadosLocais[App.projetoAtual] = dadosLocais.filter(d => !idsParaExcluir.includes(d.id));
    salvarDadosLocais();
    
    if (typeof FilaSync !== 'undefined') {
        FilaSync.itens = FilaSync.itens.filter(i => !idsParaExcluir.includes(i.id));
        FilaSync.salvar();
    }
    
    App.pontoMarcado = null;
    App.marcandoPonto = false;
    if (typeof marcadorMarcado !== 'undefined' && marcadorMarcado && mapa) {
        mapa.removeLayer(marcadorMarcado);
        marcadorMarcado = null;
    }
    
    fecharExclusao();
    atualizarContadorPontos();
    carregarPontosNoMapa();
    
    mostrarToast(`${idsParaExcluir.length} ponto(s) excluido(s)`, 'sucesso');
}

// ============================================
// INICIALIZACAO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    verificarConexao();
    
    try { document.getElementById('btn-cancelar-exclusao').addEventListener('click', fecharExclusao); } catch(e) {}
    try { document.getElementById('btn-confirmar-exclusao').addEventListener('click', confirmarExclusao); } catch(e) {}
    try {
        document.getElementById('exclusao-marcar-todos').addEventListener('change', (e) => {
            document.querySelectorAll('#exclusao-lista input[type="checkbox"]').forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
    } catch(e) {}
});
