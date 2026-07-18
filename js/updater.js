/* ============================================
   AGF COLETA - Atualizador Remoto
   Verifica e baixa atualizacoes do servidor
   ============================================ */

const Updater = {
    STORAGE_KEY: 'agf_webapp_cache',
    VERSION_KEY: 'agf_webapp_version',
    BASE_URL: 'https://agf-coleta.onrender.com',
    checking: false
};

async function verificarAtualizacao() {
    if (Updater.checking) return;
    Updater.checking = true;
    
    try {
        const versaoLocal = localStorage.getItem(Updater.VERSION_KEY);
        
        const resp = await fetch(Updater.BASE_URL + '/version.json?t=' + Date.now());
        if (!resp.ok) return;
        
        const remoto = await resp.json();
        
        if (!versaoLocal || parseInt(versaoLocal) < remoto.version) {
            console.log('Atualizacao disponivel:', versaoLocal || 'nenhuma', '->', remoto.version);
            await baixarAtualizacao(remoto);
        } else {
            console.log('App ja esta atualizado. Versao:', versaoLocal);
        }
    } catch (e) {
        console.log('Erro ao verificar atualizacao:', e.message);
    } finally {
        Updater.checking = false;
    }
}

async function baixarAtualizacao(info) {
    const cache = {};
    let erros = 0;
    
    for (const arquivo of info.files) {
        try {
            const resp = await fetch(Updater.BASE_URL + '/' + arquivo + '?t=' + Date.now());
            if (resp.ok) {
                cache[arquivo] = await resp.text();
                console.log('Baixado:', arquivo);
            } else {
                erros++;
            }
        } catch (e) {
            erros++;
        }
    }
    
    if (erros === 0 || Object.keys(cache).length > info.files.length / 2) {
        localStorage.setItem(Updater.STORAGE_KEY, JSON.stringify(cache));
        localStorage.setItem(Updater.VERSION_KEY, info.version.toString());
        console.log('Atualizacao concluida! Versao:', info.version);
        
        if (typeof mostrarToast === 'function') {
            mostrarToast('App atualizado para versao ' + info.version, 'sucesso');
        }
    }
}

function obterCacheLocal(arquivo) {
    try {
        const cache = JSON.parse(localStorage.getItem(Updater.STORAGE_KEY) || '{}');
        return cache[arquivo] || null;
    } catch (e) {
        return null;
    }
}

function temCacheLocal() {
    return localStorage.getItem(Updater.STORAGE_KEY) !== null;
}
