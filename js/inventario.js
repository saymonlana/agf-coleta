/* ============================================
   AGF COLETA - Modulo de Inventario Florestal
   Port do modulo Flutter do colega para JS
   ============================================ */

// ============================================
// MODELOS DE DADOS
// ============================================

const InventarioDB = {
    _keys: {
        parcelas: 'agf_inv_parcelas',
        individuos: 'agf_inv_individuos',
        fustes: 'agf_inv_fustes',
        caracterizacoes: 'agf_inv_caracterizacoes',
        censoSubParcelas: 'agf_inv_censo_subparcelas'
    },

    _load(key) {
        try {
            const raw = localStorage.getItem(this._keys[key]);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error(`Erro ao carregar ${key}:`, e);
            return [];
        }
    },

    _save(key, data) {
        try {
            localStorage.setItem(this._keys[key], JSON.stringify(data));
        } catch (e) {
            console.error(`Erro ao salvar ${key}:`, e);
        }
    },

    _genId() {
        return 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    },

    // ==========================================
    // PARCELAS
    // ==========================================

    getParcelas() {
        const list = this._load('parcelas');
        list.sort((a, b) => (b.dataColeta || '').localeCompare(a.dataColeta || ''));
        return list;
    },

    getParcela(id) {
        return this._load('parcelas').find(p => p.id === id) || null;
    },

    insertParcela(parcela) {
        const list = this._load('parcelas');
        parcela.id = parcela.id || this._genId();
        parcela.criadoEm = parcela.criadoEm || new Date().toISOString();
        list.push(parcela);
        this._save('parcelas', list);
        return parcela;
    },

    updateParcela(parcela) {
        const list = this._load('parcelas');
        const idx = list.findIndex(p => p.id === parcela.id);
        if (idx >= 0) {
            list[idx] = { ...list[idx], ...parcela, atualizadoEm: new Date().toISOString() };
            this._save('parcelas', list);
            return list[idx];
        }
        return null;
    },

    deleteParcela(id) {
        // Exclusao em cascata
        const individuos = this.getIndividuosByParcela(id);
        individuos.forEach(ind => this.deleteIndividuo(ind.id));
        this.deleteCaracterizacaoByParcela(id);
        this.deleteCensoSubParcelasByParcela(id);

        const list = this._load('parcelas').filter(p => p.id !== id);
        this._save('parcelas', list);
    },

    // ==========================================
    // INDIVIDUOS
    // ==========================================

    getIndividuos() {
        return this._load('individuos');
    },

    getIndividuosByParcela(parcelaId) {
        const list = this._load('individuos').filter(i => i.parcelaId === parcelaId);
        list.sort((a, b) => (a.numero || 0) - (b.numero || 0));
        return list;
    },

    getIndividuosByParcelaEstrato(parcelaId, estrato) {
        return this.getIndividuosByParcela(parcelaId).filter(i => i.estrato === estrato);
    },

    getIndividuosByParcelaEstratoSubParcela(parcelaId, estrato, subParcela) {
        return this.getIndividuosByParcela(parcelaId)
            .filter(i => i.estrato === estrato && (i.subParcela || 1) === subParcela);
    },

    getIndividuo(id) {
        return this._load('individuos').find(i => i.id === id) || null;
    },

    insertIndividuo(individuo) {
        const list = this._load('individuos');
        individuo.id = individuo.id || this._genId();
        individuo.criadoEm = new Date().toISOString();
        list.push(individuo);
        this._save('individuos', list);
        return individuo;
    },

    updateIndividuo(individuo) {
        const list = this._load('individuos');
        const idx = list.findIndex(i => i.id === individuo.id);
        if (idx >= 0) {
            list[idx] = { ...list[idx], ...individuo, atualizadoEm: new Date().toISOString() };
            this._save('individuos', list);
            return list[idx];
        }
        return null;
    },

    deleteIndividuo(id) {
        // Exclusao em cascata dos fustes
        this.deleteFustesByIndividuo(id);
        const list = this._load('individuos').filter(i => i.id !== id);
        this._save('individuos', list);
    },

    getNextIndividuoNumero(parcelaId, estrato) {
        const nums = this.getIndividuosByParcelaEstrato(parcelaId, estrato)
            .map(i => i.numero || 0);
        return nums.length > 0 ? Math.max(...nums) + 1 : 1;
    },

    getNextNumeroGps(parcelaId, estrato) {
        const nums = this.getIndividuosByParcelaEstrato(parcelaId, estrato)
            .filter(i => i.numeroGps != null)
            .map(i => i.numeroGps);
        return nums.length > 0 ? Math.max(...nums) + 1 : 1;
    },

    // ==========================================
    // FUSTES
    // ==========================================

    getFustesByIndividuo(individuoId) {
        const list = this._load('fustes').filter(f => f.individuoId === individuoId);
        list.sort((a, b) => (a.numeroFuste || 0) - (b.numeroFuste || 0));
        return list;
    },

    getFuste(id) {
        return this._load('fustes').find(f => f.id === id) || null;
    },

    insertFuste(fuste) {
        const list = this._load('fustes');
        fuste.id = fuste.id || this._genId();
        list.push(fuste);
        this._save('fustes', list);
        return fuste;
    },

    updateFuste(fuste) {
        const list = this._load('fustes');
        const idx = list.findIndex(f => f.id === fuste.id);
        if (idx >= 0) {
            list[idx] = { ...list[idx], ...fuste };
            this._save('fustes', list);
            return list[idx];
        }
        return null;
    },

    deleteFuste(id) {
        const list = this._load('fustes').filter(f => f.id !== id);
        this._save('fustes', list);
    },

    deleteFustesByIndividuo(individuoId) {
        const list = this._load('fustes').filter(f => f.individuoId !== individuoId);
        this._save('fustes', list);
    },

    // ==========================================
    // CARACTERIZACAO
    // ==========================================

    getCaracterizacaoByParcela(parcelaId) {
        return this._load('caracterizacoes').find(c => c.parcelaId === parcelaId) || null;
    },

    insertCaracterizacao(caract) {
        const list = this._load('caracterizacoes');
        caract.id = caract.id || this._genId();
        // Upsert: uma caracterizacao por parcela
        const idx = list.findIndex(c => c.parcelaId === caract.parcelaId);
        if (idx >= 0) {
            list[idx] = { ...list[idx], ...caract };
        } else {
            list.push(caract);
        }
        this._save('caracterizacoes', list);
        return caract;
    },

    deleteCaracterizacaoByParcela(parcelaId) {
        const list = this._load('caracterizacoes').filter(c => c.parcelaId !== parcelaId);
        this._save('caracterizacoes', list);
    },

    // ==========================================
    // CENSO SUB-PARCELAS
    // ==========================================

    getCensoSubParcelas(parcelaId, estrato) {
        const list = this._load('censoSubParcelas')
            .filter(sp => sp.parcelaId === parcelaId && sp.estrato === estrato);
        list.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
        return list;
    },

    insertCensoSubParcela(subParcela) {
        const list = this._load('censoSubParcelas');
        subParcela.id = subParcela.id || this._genId();
        list.push(subParcela);
        this._save('censoSubParcelas', list);
        return subParcela;
    },

    updateCensoSubParcela(subParcela) {
        const list = this._load('censoSubParcelas');
        const idx = list.findIndex(sp => sp.id === subParcela.id);
        if (idx >= 0) {
            list[idx] = { ...list[idx], ...subParcela };
            this._save('censoSubParcelas', list);
            return list[idx];
        }
        return null;
    },

    deleteCensoSubParcela(id) {
        const list = this._load('censoSubParcelas').filter(sp => sp.id !== id);
        this._save('censoSubParcelas', list);
    },

    deleteCensoSubParcelasByParcela(parcelaId) {
        const list = this._load('censoSubParcelas').filter(sp => sp.parcelaId !== parcelaId);
        this._save('censoSubParcelas', list);
    },

    // ==========================================
    // AUTOCOMPLETE
    // ==========================================

    getNomesComuns() {
        const nomes = new Set(this._load('individuos').map(i => i.nomeComum).filter(Boolean));
        return [...nomes].sort();
    },

    getNomesCientificos() {
        const nomes = new Set(this._load('individuos').map(i => i.nomeCientifico).filter(Boolean));
        return [...nomes].sort();
    },

    getFamilias() {
        const nomes = new Set(this._load('individuos').map(i => i.familia).filter(Boolean));
        return [...nomes].sort();
    },

    getResponsaveis() {
        const nomes = new Set(this._load('parcelas').map(p => p.responsavel).filter(Boolean));
        return [...nomes].sort();
    },

    getIdentificadores() {
        const nomes = new Set(this._load('parcelas').map(p => p.identificadorCampo).filter(Boolean));
        return [...nomes].sort();
    }
};

// ============================================
// ESTADO DA TELA DE INVENTARIO
// ============================================

const InventarioState = {
    parcelaAtual: null,
    individuoAtual: null,
    estratoAtual: null,
    subParcelaAtual: null,
    modoEdicao: false,
    editandoIndividuo: false,
    telaAnterior: null,
    pontoTemp: null,
    parcelaExpandidaId: null,
    criandoParcela: false,
    subParcelaEditando: null,
    parcelaDataPendente: null,
    criandoIndividuo: false,
    individuoPendente: null,
    gpsIndividuoPendente: null
};

// ============================================
// FISIONOMIAS E ESTRATOS
// ============================================

const FISIONOMIAS = ['Floresta Estacional Semidecidual', 'Cerrado', 'Campo Rupestre', 'Árvores isoladas'];

const METODOS = ['Parcela', 'Censo', 'Florística caminhamento'];

const ESTRATOS_POR_METODO = {
    'Parcela': ['Arbóreo', 'Arbustivo', 'Herbáceo'],
    'Censo': ['Censo', 'Arbustivo', 'Herbáceo'],
    'Florística caminhamento': ['Florística']
};

const EMOJI_FISIONOMIA = {
    'Floresta Estacional Semidecidual': '🌲',
    'Cerrado': '🌾',
    'Campo Rupestre': '⛰️',
    'Árvores isoladas': '🌳',
    'Outros': '🌿'
};

const EMOJI_ESTRATO = {
    'Arbóreo': '🌲',
    'Arbustivo': '🌿',
    'Herbáceo': '🌱',
    'Censo': '🌳',
    'Florística': '🌸'
};

function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
}

// ============================================
// VALIDACAO POR FISIONOMIA/ESTRATO
// ============================================

function validarIndividuo(individuo, fisionomia) {
    const erros = [];
    const estrato = individuo.estrato;

    // Pelo menos um nome deve ser preenchido
    if (!individuo.nomeComum && !individuo.nomeCientifico && !individuo.familia) {
        erros.push('Preencha pelo menos Nome Comum, Cientifico ou Familia');
    }

    if (estrato === 'Florística') return erros; // Florística não tem fustes

    // Validacoes por estrato
    const fustes = individuo.fustes || [];
    if (fustes.length === 0 && estrato !== 'Herbáceo') {
        erros.push('Adicione pelo menos um fuste');
    }

    fustes.forEach((f, idx) => {
        const cap = parseFloat(f.cap);
        const altura = parseFloat(f.altura);

        if (estrato === 'Arbóreo' || estrato === 'Censo') {
            if (!isNaN(cap) && cap < 15) {
                erros.push(`Fuste ${idx + 1}: CAP deve ser >= 15cm (arvoreo)`);
            }
            if (!isNaN(altura) && altura < 2) {
                erros.push(`Fuste ${idx + 1}: Altura deve ser >= 2m (arvoreo)`);
            }
        }

        if (estrato === 'Arbustivo') {
            if (!isNaN(cap) && cap >= 15) {
                erros.push(`Fuste ${idx + 1}: CAP deve ser < 15cm (arbustivo)`);
            }
            if (!isNaN(altura) && altura < 1.5) {
                erros.push(`Fuste ${idx + 1}: Altura deve ser >= 1.5m`);
            }
        }
    });

    // Diametro de copa obrigatorio para certas fisionomias/estratos
    const copaObrigatoria =
        (fisionomia === 'Cerrado' && estrato === 'Arbóreo') ||
        (fisionomia === 'Campo Rupestre' && (estrato === 'Arbóreo' || estrato === 'Arbustivo')) ||
        (fisionomia === 'Árvores isoladas' && estrato === 'Arbóreo');
    if (copaObrigatoria) {
        if (!individuo.diametroCopa1 && !individuo.diametroCopa2) {
            erros.push('Diametro de copa obrigatorio para esta fisionomia/estrato');
        }
    }

    return erros;
}

function calcularDap(cap) {
    if (!cap || isNaN(cap)) return 0;
    return (parseFloat(cap) / Math.PI).toFixed(2);
}

// ============================================
// TELA INICIAL DO INVENTARIO (HOME)
// ============================================

function abrirTelaInventario() {
    InventarioState.parcelaAtual = null;
    InventarioState.individuoAtual = null;
    InventarioState.estratoAtual = null;
    InventarioState.parcelaExpandidaId = null;

    renderizarListaParcelas();
    mostrarTela('tela-inventario-home');
}

function renderizarListaParcelas() {
    const container = document.getElementById('inventario-lista-parcelas');
    const parcelas = InventarioDB.getParcelas();

    if (parcelas.length === 0) {
        container.innerHTML = `
            <div class="inventario-empty">
                <div class="inventario-empty-icon">🌳</div>
                <h3>Nenhum registro cadastrado</h3>
                <p>Toque no botao + para criar um novo registro</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    parcelas.forEach(parcela => {
        const individuos = InventarioDB.getIndividuosByParcela(parcela.id);
        const temCarac = InventarioDB.getCaracterizacaoByParcela(parcela.id) != null;
        const emoji = EMOJI_FISIONOMIA[parcela.fisionomia] || '🌿';
        const metodo = parcela.metodo || 'Parcela';
        const fisionomia = parcela.fisionomia || 'Floresta Estacional Semidecidual';
        const estratos = ESTRATOS_POR_METODO[metodo] || ['Arbóreo', 'Arbustivo', 'Herbáceo'];
        const isParcela = InventarioState.parcelaExpandidaId === parcela.id;

        const div = document.createElement('div');
        div.className = `inventario-parcela-card ${isParcela ? 'expandida' : ''}`;

        // Header da parcela
        const header = document.createElement('div');
        header.className = 'inventario-parcela-header';
        header.innerHTML = `
            <div class="inventario-parcela-avatar">${emoji}</div>
            <div class="inventario-parcela-info">
                <h3>${parcela.nomeParcela || 'Sem nome'}</h3>
                <span class="inventario-parcela-meta">
                    ${emoji} ${parcela.fisionomia || ''}
                </span>
            </div>
            <div class="inventario-parcela-menu">
                <button class="inventario-btn-menu" onclick="event.stopPropagation(); mostrarMenuParcela('${parcela.id}')">⋮</button>
                <span class="inventario-parcela-seta ${isParcela ? 'girar' : ''}">▾</span>
            </div>`;
        header.addEventListener('click', () => toggleAccordionParcela(parcela.id));
        div.appendChild(header);

        // Conteudo expandivel (accordion)
        const conteudo = document.createElement('div');
        conteudo.className = `inventario-parcela-conteudo ${isParcela ? 'aberto' : ''}`;
        conteudo.id = `parcela-conteudo-${parcela.id}`;

        if (isParcela) {
            renderizarConteudoAccordion(conteudo, parcela, individuos, temCarac, estratos, metodo);
        }

        div.appendChild(conteudo);
        container.appendChild(div);
    });
}

function toggleAccordionParcela(parcelaId) {
    if (InventarioState.parcelaExpandidaId === parcelaId) {
        InventarioState.parcelaExpandidaId = null;
    } else {
        InventarioState.parcelaExpandidaId = parcelaId;
    }
    renderizarListaParcelas();
}

function renderizarConteudoAccordion(container, parcela, individuos, temCarac, estratos, metodo) {
    const parcelaId = parcela.id;

    // Caracterizacao
    const itemCarac = document.createElement('div');
    itemCarac.className = 'inventario-item-detalhe';
    itemCarac.innerHTML = `
        <div class="inventario-item-icone caract">📋</div>
        <div class="inventario-item-info">
            <h4>Caracterizacao</h4>
            <p class="${temCarac ? 'status-ok' : 'status-pendente'}">${temCarac ? '✓ Preenchida' : '○ Nao preenchida'}</p>
        </div>
        <div class="inventario-item-seta">›</div>`;
    itemCarac.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirFormCaracterizacaoInv(parcelaId);
    });
    container.appendChild(itemCarac);

    // Estratos
    estratos.forEach(estrato => {
        const count = individuos.filter(i => i.estrato === estrato).length;
        const isCensoSubParcela = metodo === 'Censo' && (estrato === 'Arbustivo' || estrato === 'Herbáceo');

        const item = document.createElement('div');
        item.className = 'inventario-item-detalhe';
        item.innerHTML = `
            <div class="inventario-item-icone ${estrato.toLowerCase()}">${EMOJI_ESTRATO[estrato] || '🌿'}</div>
            <div class="inventario-item-info">
                <h4>${EMOJI_ESTRATO[estrato] || ''} ${estrato}</h4>
                <p>${isCensoSubParcela ? 'Toque para gerenciar sub-parcelas' : `${count} individuo${count !== 1 ? 's' : ''}`}</p>
            </div>
            <div class="inventario-item-seta">›</div>`;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isCensoSubParcela) {
                abrirCensoSubParcelas(parcelaId, estrato);
            } else {
                abrirListaIndividuosInv(parcelaId, estrato);
            }
        });
        container.appendChild(item);
    });
}

function mostrarMenuParcela(parcelaId) {
    const parcela = InventarioDB.getParcela(parcelaId);
    if (!parcela) return;

    const modal = document.getElementById('modal-inventario-menu');
    const lista = document.getElementById('inventario-menu-opcoes');
    lista.innerHTML = '';

    const opcoes = [
        { icone: '✏️', texto: 'Editar', acao: () => { fecharModalInventario(); editarParcelaInv(parcelaId); } },
        { icone: '🗑️', texto: 'Excluir', classe: 'menu-item-perigo', acao: () => { fecharModalInventario(); confirmarExcluirParcela(parcelaId); } },
        { icone: '📋', texto: 'Exportar CSV', acao: () => { fecharModalInventario(); exportarParcelaCSV(parcelaId); } }
    ];

    opcoes.forEach(op => {
        const btn = document.createElement('button');
        btn.className = `inventario-menu-item ${op.classe || ''}`;
        btn.innerHTML = `${op.icone} ${op.texto}`;
        btn.addEventListener('click', op.acao);
        lista.appendChild(btn);
    });

    modal.classList.add('ativo');
}

function fecharModalInventario() {
    document.querySelectorAll('.inventario-modal.ativo').forEach(m => m.classList.remove('ativo'));
}

function confirmarExcluirParcela(parcelaId) {
    const parcela = InventarioDB.getParcela(parcelaId);
    if (!parcela) return;

    const modal = document.getElementById('modal-inventario-confirmar');
    document.getElementById('inventario-confirmar-titulo').textContent = 'Excluir registro';
    document.getElementById('inventario-confirmar-texto').textContent =
        `Deseja excluir "${parcela.nomeParcela}"?\nTodos os individuos e dados tambem serao excluidos.`;

    const btnConfirmar = document.getElementById('inventario-btn-confirmar');
    btnConfirmar.onclick = () => {
        InventarioDB.deleteParcela(parcelaId);
        fecharModalInventario();
        renderizarListaParcelas();
        mostrarToast('Registro excluido', 'sucesso');
    };

    modal.classList.add('ativo');
}

// ============================================
// CRIAR / EDITAR PARCELA
// ============================================

function abrirCriarParcela() {
    InventarioState.modoEdicao = false;
    InventarioState.parcelaAtual = null;
    InventarioState.pontoTemp = App.currentPosition ? { lat: App.currentPosition.lat, lng: App.currentPosition.lng } : null;

    renderizarFormParcela(null);
    mostrarTela('tela-criar-parcela-inv');
}

function abrirMapaParaInventario() {
    // Salvar que estamos no modo inventario
    InventarioState.criandoParcela = true;

    // Mostrar botao coletar e mira
    const btnColetar = document.getElementById('btn-coletar');
    const crosshair = document.getElementById('crosshair');
    if (btnColetar) {
        btnColetar.style.display = 'flex';
        btnColetar.style.background = '#0D4A35';
    }
    if (crosshair) crosshair.style.display = 'block';

    // Abrir tela do mapa
    mostrarTela('tela-mapa');

    // Inicializar mapa se necessario
    setTimeout(() => {
        if (!mapa) {
            if (typeof inicializarMapa === 'function') {
                inicializarMapa(-19.056, -43.374);
            }
        } else {
            mapa.invalidateSize();
            // Focar na area da Serpentina
            mapa.setView([-19.056, -43.374], 15);
            // Resetar flag para recarregar camadas
            if (typeof camadasInventarioCarregadas !== 'undefined') {
                camadasInventarioCarregadas = false;
            }
        }

        // Carregar camadas de fundo (Propriedades NES, Quadrantes)
        if (typeof carregarCamadasInventario === 'function') {
            carregarCamadasInventario();
        }

        // Carregar pontos do Box no mapa
        if (typeof carregarPontosNoMapa === 'function') {
            carregarPontosNoMapa();
        }

        // Se ja tem posicao, usar; senao aguardar GPS
        if (App.currentPosition) {
            document.getElementById('coordenadas-mapa').textContent =
                `Lat: ${App.currentPosition.lat.toFixed(6)} | Lon: ${App.currentPosition.lng.toFixed(6)}`;
        }
    }, 300);
}

function editarParcelaInv(parcelaId) {
    const parcela = InventarioDB.getParcela(parcelaId);
    if (!parcela) return;

    InventarioState.modoEdicao = true;
    InventarioState.parcelaAtual = parcela;
    InventarioState.pontoTemp = { lat: parcela.latitude, lng: parcela.longitude };

    renderizarFormParcela(parcela);
    mostrarTela('tela-criar-parcela-inv');
}

function renderizarFormParcela(parcelaExistente) {
    const container = document.getElementById('campos-criar-parcela-inv');
    container.innerHTML = '';
    const parcela = parcelaExistente || {};

    const metodoAtual = parcela.metodo || 'Parcela';
    const fisionomiaAtual = parcela.fisionomia || 'Floresta Estacional Semidecidual';
    const dataAtual = parcela.dataColeta || new Date().toISOString().split('T')[0];

    // 1. Metodo (primeiro campo, obrigatorio)
    addCampoSelect(container, 'metodo', 'Metodo', METODOS, metodoAtual, true, (val) => {
        atualizarCamposCondicionaisParcela(container, val, fisionomiaAtual);
    }, '📋');

    // 2. Campos condicionais ao Metodo = 'Parcela'
    const wrapperParcela = document.createElement('div');
    wrapperParcela.id = 'inv-parcela-campos-metodo';
    wrapperParcela.style.display = metodoAtual === 'Parcela' ? 'block' : 'none';
    container.appendChild(wrapperParcela);

    addCampoTexto(wrapperParcela, 'nomeParcela', 'Codigo da Parcela', parcela.nomeParcela || '', true, 'Ex: PC-01', '🏷️');
    addCampoNumero(wrapperParcela, 'tamanhoParcelaArboreo', 'Tamanho da Parcela - Arboreo (m2)', parcela.tamanhoParcelaArboreo || '', 'Ex: 400', '🌲');
    addCampoNumero(wrapperParcela, 'tamanhoParcelaArbustivo', 'Tamanho da Parcela - Arbustivo (m2)', parcela.tamanhoParcelaArbustivo || '', 'Ex: 100', '🌿');
    addCampoNumero(wrapperParcela, 'tamanhoParcelaHerbaceo', 'Tamanho da Parcela - Herbaceo (m2)', parcela.tamanhoParcelaHerbaceo || '', 'Ex: 25', '🌱');

    // 3. Fisionomia (obrigatorio)
    addCampoSelect(container, 'fisionomia', 'Fisionomia', FISIONOMIAS, fisionomiaAtual, true, (val) => {
        atualizarCamposCondicionaisParcela(container, metodoAtual, val);
    }, '⛰️');

    // 4. Estagio Sucessional (apenas para Floresta Estacional Semidecidual)
    const wrapperEstagio = document.createElement('div');
    wrapperEstagio.id = 'inv-parcela-campos-estagio';
    wrapperEstagio.className = 'mat-field';
    wrapperEstagio.style.display = fisionomiaAtual === 'Floresta Estacional Semidecidual' ? 'block' : 'none';
    wrapperEstagio.innerHTML = `
        <div class="mat-field-outline">
            <span class="mat-field-icone">🌿</span>
            <label class="mat-field-label">Estagio Sucessional</label>
            <select id="inv-campo-estagioSucessional">
                <option value="Inicial" ${parcela.estagioSucessional === 'Inicial' ? 'selected' : ''}>Inicial</option>
                <option value="Medio" ${parcela.estagioSucessional === 'Medio' ? 'selected' : ''}>Medio</option>
                <option value="Avancado" ${parcela.estagioSucessional === 'Avancado' ? 'selected' : ''}>Avancado</option>
            </select>
        </div>`;
    container.appendChild(wrapperEstagio);

    // 5. Localidade (nao obrigatoria)
    addCampoTexto(container, 'localidade', 'Localidade', parcela.localidade || '', false, 'Ex: Cachoeira, Trilha, etc.', '📍');

    // 6. Identificador de Campo (nao obrigatorio)
    addCampoTextoAutocomplete(container, 'identificadorCampo', 'Identificador de Campo', parcela.identificadorCampo || '', 'identificadores', 'Ex: Marcio Edinei, Josimar, Maria, etc.', '🔲');

    // 7. Responsavel (nao obrigatorio)
    addCampoTextoAutocomplete(container, 'responsavel', 'Responsavel', parcela.responsavel || '', 'responsaveis', 'Nome de quem coletou', '👤');

    // 8. Data com botao "Hoje" + DatePicker
    addCampoData(container, 'dataColeta', dataAtual, '📅');

    // 9. Observacoes
    addCampoTextarea(container, 'observacoes', 'Observacoes', parcela.observacoes || '', 'Notas adicionais', '📝');

    // Atualizar coordenadas
    const pos = InventarioState.pontoTemp;
    if (pos) {
        document.getElementById('coordenadas-parcela-gps-inv').textContent =
            `Lat: ${pos.lat.toFixed(6)} | Lon: ${pos.lng.toFixed(6)}`;
    }

    document.getElementById('form-parcela-inv-titulo').textContent =
        InventarioState.modoEdicao ? 'Editar Registro' : 'Novo Registro';
}

function addCampoSelect(container, nome, label, opcoes, valor, obrigatorio, onChange, icone) {
    const div = document.createElement('div');
    div.className = 'mat-field';
    const optionsHtml = opcoes.map(op =>
        `<option value="${op}" ${valor === op ? 'selected' : ''}>${op}</option>`
    ).join('');
    div.innerHTML = `
        <div class="mat-field-outline ${obrigatorio ? 'mat-field-obrigatorio' : ''}">
            <span class="mat-field-icone">${icone || '📋'}</span>
            <label class="mat-field-label">${label}</label>
            <select id="inv-campo-${nome}" ${obrigatorio ? 'required' : ''}>${optionsHtml}</select>
        </div>`;
    container.appendChild(div);
    if (onChange) {
        div.querySelector('select').addEventListener('change', (e) => onChange(e.target.value));
    }
}

function addCampoTexto(container, nome, label, valor, obrigatorio, placeholder, icone) {
    const div = document.createElement('div');
    div.className = 'mat-field';
    div.innerHTML = `
        <div class="mat-field-outline ${obrigatorio ? 'mat-field-obrigatorio' : ''}">
            <span class="mat-field-icone">${icone || '📝'}</span>
            <label class="mat-field-label">${label}</label>
            <input type="text" id="inv-campo-${nome}" value="${valor}" placeholder="${placeholder || ''}" ${obrigatorio ? 'required' : ''}>
        </div>`;
    container.appendChild(div);
}

function addCampoTextoAutocomplete(container, nome, label, valor, tipoAutocomplete, placeholder, icone) {
    const div = document.createElement('div');
    div.className = 'mat-field';
    div.innerHTML = `
        <div class="mat-field-outline">
            <span class="mat-field-icone">${icone || '📝'}</span>
            <label class="mat-field-label">${label}</label>
            <input type="text" id="inv-campo-${nome}" value="${valor}" placeholder="${placeholder || ''}">
        </div>`;
    container.appendChild(div);
    setTimeout(() => {
        const input = div.querySelector('input');
        if (input) configurarAutocomplete(input, tipoAutocomplete);
    }, 100);
}

function addCampoNumero(container, nome, label, valor, placeholder, icone) {
    const div = document.createElement('div');
    div.className = 'mat-field';
    div.innerHTML = `
        <div class="mat-field-outline">
            <span class="mat-field-icone">${icone || '🔢'}</span>
            <label class="mat-field-label">${label}</label>
            <input type="number" step="0.01" id="inv-campo-${nome}" value="${valor}" placeholder="${placeholder || ''}">
        </div>`;
    container.appendChild(div);
}

function addCampoData(container, nome, valor, icone) {
    const div = document.createElement('div');
    div.className = 'mat-field';
    const dataFormatada = valor ? formatarDataBrasil(valor) : formatarDataBrasil(new Date().toISOString().split('T')[0]);
    div.innerHTML = `
        <div class="mat-data-row">
            <div class="mat-data-display">
                <span class="mat-data-icone">${icone || '📅'}</span>
                <span class="mat-data-label mat-data-label-obrigatorio">Data da Coleta</span>
                <span id="inv-campo-${nome}-display">${dataFormatada}</span>
                <input type="hidden" id="inv-campo-${nome}" value="${valor || new Date().toISOString().split('T')[0]}">
            </div>
            <button type="button" class="mat-btn-hoje" onclick="invSetarDataHoje('${nome}')">📅 Hoje</button>
            <button type="button" class="mat-btn-calendario" onclick="invAbrirDatePicker('${nome}')">📆</button>
        </div>`;
    container.appendChild(div);
}

function formatarDataBrasil(dataStr) {
    if (!dataStr) return '';
    const parts = dataStr.split('-');
    if (parts.length !== 3) return dataStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function invSetarDataHoje(campoNome) {
    const hoje = new Date().toISOString().split('T')[0];
    const input = document.getElementById(`inv-campo-${campoNome}`);
    const display = document.getElementById(`inv-campo-${campoNome}-display`);
    if (input) input.value = hoje;
    if (display) display.textContent = formatarDataBrasil(hoje);
}

function invAbrirDatePicker(campoNome) {
    const input = document.getElementById(`inv-campo-${campoNome}`);
    if (!input) return;
    const picker = document.createElement('input');
    picker.type = 'date';
    picker.value = input.value || new Date().toISOString().split('T')[0];
    picker.style.position = 'absolute';
    picker.style.opacity = '0';
    picker.style.height = '0';
    picker.style.width = '0';
    document.body.appendChild(picker);
    picker.addEventListener('change', () => {
        input.value = picker.value;
        const display = document.getElementById(`inv-campo-${campoNome}-display`);
        if (display) display.textContent = formatarDataBrasil(picker.value);
        document.body.removeChild(picker);
    });
    picker.click();
}

function addCampoTextarea(container, nome, label, valor, placeholder, icone) {
    const div = document.createElement('div');
    div.className = 'mat-field';
    div.innerHTML = `
        <div class="mat-field-outline">
            <span class="mat-field-icone">${icone || '📝'}</span>
            <label class="mat-field-label">${label}</label>
            <textarea id="inv-campo-${nome}" class="mat-field-textarea" placeholder="${placeholder || ''}">${valor}</textarea>
        </div>`;
    container.appendChild(div);
}

function atualizarCamposCondicionaisParcela(container, metodo, fisionomia) {
    const wrapperMetodo = document.getElementById('inv-parcela-campos-metodo');
    const wrapperEstagio = document.getElementById('inv-parcela-campos-estagio');
    if (wrapperMetodo) wrapperMetodo.style.display = metodo === 'Parcela' ? 'block' : 'none';
    if (wrapperEstagio) wrapperEstagio.style.display = fisionomia === 'Floresta Estacional Semidecidual' ? 'block' : 'none';
}

function handleSalvarParcelaInv() {
    const campos = {};
    ['metodo', 'nomeParcela', 'fisionomia', 'estagioSucessional', 'localidade', 'identificadorCampo',
     'responsavel', 'dataColeta', 'tamanhoParcelaArboreo', 'tamanhoParcelaArbustivo', 'tamanhoParcelaHerbaceo',
     'observacoes'].forEach(nome => {
        const el = document.getElementById(`inv-campo-${nome}`);
        if (el) {
            campos[nome] = el.value;
            if (['tamanhoParcelaArboreo', 'tamanhoParcelaArbustivo', 'tamanhoParcelaHerbaceo'].includes(nome)) {
                campos[nome] = el.value ? parseFloat(el.value) : null;
            }
        }
    });

    // Validacao basica
    if (!campos.nomeParcela) {
        if (campos.metodo === 'Censo' || campos.metodo === 'Florística caminhamento') {
            const agora = new Date();
            const h = String(agora.getHours()).padStart(2, '0');
            const m = String(agora.getMinutes()).padStart(2, '0');
            const prefixo = campos.metodo === 'Censo' ? 'Censo' : 'Florística';
            campos.nomeParcela = `${prefixo} - ${campos.dataColeta || agora.toISOString().split('T')[0]} ${h}:${m}`;
        } else {
            mostrarToast('Preencha o codigo da parcela', 'erro');
            return;
        }
    }
    if (!campos.fisionomia) {
        mostrarToast('Selecione a fisionomia', 'erro');
        return;
    }
    if (!campos.metodo) {
        mostrarToast('Selecione o metodo', 'erro');
        return;
    }

    if (InventarioState.modoEdicao && InventarioState.parcelaAtual) {
        // Atualizar
        const pos = InventarioState.pontoTemp;
        InventarioDB.updateParcela({
            ...InventarioState.parcelaAtual,
            ...campos,
            latitude: pos ? pos.lat : null,
            longitude: pos ? pos.lng : null
        });
        mostrarToast('Parcela atualizada', 'sucesso');
        InventarioState.criandoParcela = false;
        abrirTelaInventario();
    } else if (campos.metodo === 'Parcela') {
        // Parcela: salvar dados pendentes e abrir mapa para coletar GPS
        InventarioState.parcelaDataPendente = campos;
        InventarioState.criandoParcela = true;
        mostrarToast('Agora colete o ponto GPS da parcela', 'info');
        abrirMapaParaInventario();
    } else {
        // Censo / Floristica: salvar sem GPS (GPS sera coletado por individuo)
        const novaParcela = {
            ...campos,
            latitude: null,
            longitude: null,
            projetoId: App.projetoClienteAtual ? App.projetoClienteAtual.id : null
        };
        InventarioDB.insertParcela(novaParcela);
        mostrarToast('Parcela criada', 'sucesso');
        InventarioState.criandoParcela = false;
        abrirTelaInventario();
    }
}

// ============================================
// DETALHE DA PARCELA
// ============================================

function abrirDetalheParcelaInv(parcelaId) {
    const parcela = InventarioDB.getParcela(parcelaId);
    if (!parcela) return;

    InventarioState.parcelaAtual = parcela;
    InventarioState.estratoAtual = null;

    document.getElementById('inventario-parcela-nome-titulo').textContent = parcela.nomeParcela || 'Parcela';
    document.getElementById('inventario-parcela-fisionomia-sub').textContent =
        `${EMOJI_FISIONOMIA[parcela.fisionomia] || ''} ${parcela.fisionomia || ''} - ${parcela.metodo || 'Parcela'}`;

    const lista = document.getElementById('inventario-detalhe-lista');
    lista.innerHTML = '';

    const fisionomia = parcela.fisionomia || 'Floresta Estacional Semidecidual';
    const metodo = parcela.metodo || 'Parcela';
    const individuos = InventarioDB.getIndividuosByParcela(parcelaId);
    const temCarac = InventarioDB.getCaracterizacaoByParcela(parcelaId) != null;

    const estratos = ESTRATOS_POR_METODO[metodo] || ['Arbóreo', 'Arbustivo', 'Herbáceo'];

    // Caracterizacao
    const itemCarac = document.createElement('div');
    itemCarac.className = 'inventario-item-detalhe';
    itemCarac.innerHTML = `
        <div class="inventario-item-icone caract">📋</div>
        <div class="inventario-item-info">
            <h4>Caracterizacao</h4>
            <p>${temCarac ? 'Preenchida' : 'Nao preenchida'}</p>
        </div>
        <div class="inventario-item-seta">›</div>
    `;
    itemCarac.addEventListener('click', () => abrirFormCaracterizacaoInv(parcelaId));
    lista.appendChild(itemCarac);

    // Estratos
    estratos.forEach(estrato => {
        const count = individuos.filter(i => i.estrato === estrato).length;
        const isCensoSubParcela = metodo === 'Censo' && (estrato === 'Arbustivo' || estrato === 'Herbáceo');

        const item = document.createElement('div');
        item.className = 'inventario-item-detalhe';
        item.innerHTML = `
            <div class="inventario-item-icone ${estrato.toLowerCase()}">${EMOJI_ESTRATO[estrato] || '🌿'}</div>
            <div class="inventario-item-info">
                <h4>${EMOJI_ESTRATO[estrato] || ''} ${estrato}</h4>
                <p>${isCensoSubParcela ? 'Toque para gerenciar sub-parcelas' : `${count} individuo${count !== 1 ? 's' : ''}`}</p>
            </div>
            <div class="inventario-item-seta">›</div>
        `;
        item.addEventListener('click', () => {
            if (isCensoSubParcela) {
                abrirCensoSubParcelas(parcelaId, estrato);
            } else {
                abrirListaIndividuosInv(parcelaId, estrato);
            }
        });
        lista.appendChild(item);
    });

    // Botao exportar
    const btnExport = document.getElementById('inventario-btn-exportar-detalhe');
    if (btnExport) {
        btnExport.onclick = () => exportarParcelaCSV(parcelaId);
    }

    mostrarTela('tela-inventario-detalhe');
}

// ============================================
// LISTA DE INDIVIDUOS POR ESTRATO
// ============================================

function abrirListaIndividuosInv(parcelaId, estrato) {
    const parcela = InventarioDB.getParcela(parcelaId);
    if (!parcela) return;

    InventarioState.parcelaAtual = parcela;
    InventarioState.estratoAtual = estrato;

    document.getElementById('inventario-estrato-titulo').textContent = estrato;
    document.getElementById('inventario-estrato-parcela-nome').textContent = parcela.nomeParcela || '';

    const fisionomia = parcela.fisionomia || 'Floresta Estacional Semidecidual';
    const metodo = parcela.metodo || 'Parcela';
    const isHerbaceo = estrato === 'Herbáceo';
    const isFloristica = estrato === 'Florística';
    const showFustes = !isHerbaceo && !isFloristica;
    const requiresDiametroCopa =
        (fisionomia === 'Cerrado' && estrato === 'Arbóreo') ||
        (fisionomia === 'Campo Rupestre' && (estrato === 'Arbóreo' || estrato === 'Arbustivo')) ||
        (fisionomia === 'Árvores isoladas' && estrato === 'Arbóreo');

    const container = document.getElementById('inventario-spreadsheet-scroll');
    const individuos = InventarioDB.getIndividuosByParcelaEstrato(parcelaId, estrato);

    const displayRows = [];
    individuos.forEach(ind => {
        if (showFustes) {
            const fustes = InventarioDB.getFustesByIndividuo(ind.id);
            if (fustes.length > 0) {
                fustes.forEach((f, fi) => {
                    displayRows.push({ ind, fuste: f, isFirstFuste: fi === 0 });
                });
            } else {
                displayRows.push({ ind, fuste: null, isFirstFuste: true });
            }
        } else {
            displayRows.push({ ind, fuste: null, isFirstFuste: true });
        }
    });

    let html = '<table class="inv-sheet">';

    html += '<thead><tr class="inv-sheet-header">';
    if (showFustes) html += '<th class="inv-col-num">Nº</th>';
    if (showFustes) html += '<th class="inv-col-fuste">Fuste</th>';
    if (isHerbaceo) html += '<th class="inv-col-num">Nº</th>';
    html += '<th class="inv-col-nome">Nome Comum</th>';
    html += '<th class="inv-col-nome">Nome Científico</th>';
    html += '<th class="inv-col-fam">Família</th>';
    if (isHerbaceo) html += `<th class="inv-col-num">${fisionomia === 'Campo Rupestre' ? '% Cobertura' : 'Nº Indiv.'}</th>`;
    if (isHerbaceo && fisionomia === 'Campo Rupestre') html += '<th class="inv-col-num">Nº Indiv. Esp.</th>';
    if (showFustes) html += '<th class="inv-col-med">Altura (m)</th>';
    if (showFustes) html += '<th class="inv-col-med">CAP (cm)</th>';
    if (requiresDiametroCopa) html += '<th class="inv-col-med">Copa 1 (m)</th>';
    if (requiresDiametroCopa) html += '<th class="inv-col-med">Copa 2 (m)</th>';
    if (showFustes && estrato === 'Arbóreo') html += '<th class="inv-col-epif">Epífitas</th>';
    html += '<th class="inv-col-data">Data</th>';
    html += '<th class="inv-col-acao"></th>';
    html += '</tr></thead>';

    html += '<tbody>';

    if (displayRows.length === 0) {
        const totalCols = (showFustes ? 2 : 0) + (isHerbaceo ? 1 : 0) + 3 + (isHerbaceo ? 1 : 0) + (isHerbaceo && fisionomia === 'Campo Rupestre' ? 1 : 0) + (showFustes ? 2 : 0) + (requiresDiametroCopa ? 2 : 0) + (showFustes && estrato === 'Arbóreo' ? 1 : 0) + 2;
        html += `<tr><td colspan="${totalCols}" class="inv-sheet-empty">
            <div class="inv-sheet-empty-content">
                <div class="inv-sheet-empty-icon">${EMOJI_ESTRATO[estrato] || '🌿'}</div>
                <div>Nenhum indivíduo registrado</div>
                <div class="inv-sheet-empty-hint">Clique em + para adicionar</div>
            </div>
        </td></tr>`;
    }

    displayRows.forEach((row, idx) => {
        const { ind, fuste, isFirstFuste } = row;
        const bgClass = idx % 2 === 0 ? '' : ' inv-row-alt';

        html += `<tr class="inv-sheet-row${bgClass}" data-id="${ind.id}">`;

        if (showFustes) {
            html += `<td class="inv-cell inv-cell-num" contenteditable="true" data-field="numero" data-id="${ind.id}" data-type="individuo">${ind.numero}</td>`;
            html += `<td class="inv-cell inv-cell-fuste">${fuste ? fuste.numeroFuste : ''}</td>`;
        }
        if (isHerbaceo) {
            html += `<td class="inv-cell inv-cell-num" contenteditable="true" data-field="numero" data-id="${ind.id}" data-type="individuo">${ind.numero}</td>`;
        }
        html += `<td class="inv-cell inv-cell-nome" contenteditable="true" data-field="nomeComum" data-id="${ind.id}" data-type="individuo">${ind.nomeComum || ''}</td>`;
        html += `<td class="inv-cell inv-cell-nome" contenteditable="true" data-field="nomeCientifico" data-id="${ind.id}" data-type="individuo" style="font-style:italic">${ind.nomeCientifico || ''}</td>`;
        html += `<td class="inv-cell inv-cell-fam" contenteditable="true" data-field="familia" data-id="${ind.id}" data-type="individuo">${ind.familia || ''}</td>`;

        if (isHerbaceo) {
            html += `<td class="inv-cell inv-cell-med" contenteditable="true" data-field="numeroIndividuos" data-id="${ind.id}" data-type="individuo">${ind.numeroIndividuos != null ? ind.numeroIndividuos : ''}</td>`;
        }
        if (isHerbaceo && fisionomia === 'Campo Rupestre') {
            html += `<td class="inv-cell inv-cell-med" contenteditable="true" data-field="numeroIndividuosEspecie" data-id="${ind.id}" data-type="individuo">${ind.numeroIndividuosEspecie != null ? ind.numeroIndividuosEspecie : ''}</td>`;
        }

        if (showFustes) {
            const altVal = fuste && fuste.altura > 0 ? fuste.altura.toString().replace('.', ',') : '';
            const capVal = fuste && fuste.cap > 0 ? fuste.cap.toString().replace('.', ',') : '';
            html += `<td class="inv-cell inv-cell-med" contenteditable="true" data-field="altura" data-id="${fuste ? fuste.id : ''}" data-type="fuste">${altVal}</td>`;
            html += `<td class="inv-cell inv-cell-med" contenteditable="true" data-field="cap" data-id="${fuste ? fuste.id : ''}" data-type="fuste">${capVal}</td>`;
        }

        if (requiresDiametroCopa) {
            if (isFirstFuste) {
                const c1 = ind.diametroCopa1 != null ? ind.diametroCopa1.toString().replace('.', ',') : '';
                const c2 = ind.diametroCopa2 != null ? ind.diametroCopa2.toString().replace('.', ',') : '';
                html += `<td class="inv-cell inv-cell-med" contenteditable="true" data-field="diametroCopa1" data-id="${ind.id}" data-type="individuo">${c1}</td>`;
                html += `<td class="inv-cell inv-cell-med" contenteditable="true" data-field="diametroCopa2" data-id="${ind.id}" data-type="individuo">${c2}</td>`;
            } else {
                html += '<td class="inv-cell inv-cell-med inv-cell-disabled"></td>';
                html += '<td class="inv-cell inv-cell-med inv-cell-disabled"></td>';
            }
        }

        if (showFustes && estrato === 'Arbóreo') {
            html += `<td class="inv-cell inv-cell-epif" contenteditable="true" data-field="epifitasDetalhes" data-id="${ind.id}" data-type="individuo">${ind.epifitasDetalhes || ''}</td>`;
        }

        const dataStr = ind.dataColeta ? formatDateBR(ind.dataColeta) : '';
        html += `<td class="inv-cell inv-cell-data">${dataStr}</td>`;

        html += `<td class="inv-cell inv-cell-acao">
            <button class="inv-btn-acao" onclick="event.stopPropagation(); abrirFormIndividuoInv('${parcelaId}', '${estrato}', '${ind.id}')" title="Editar detalhes">✎</button>
            <button class="inv-btn-acao inv-btn-del" onclick="event.stopPropagation(); confirmarExcluirIndividuo('${ind.id}')" title="Excluir">×</button>
        </td>`;

        html += '</tr>';
    });

    html += '</tbody>';

    html += '<tfoot><tr class="inv-sheet-footer">';
    if (showFustes) html += `<td class="inv-cell inv-cell-add"><button class="inv-btn-add-inline" onclick="event.stopPropagation(); invAcaoNovoIndividuo('${parcelaId}', '${estrato}', '${fisionomia}')" title="Novo individuo">⊕</button></td>`;
    if (showFustes) html += `<td class="inv-cell inv-cell-add"><button class="inv-btn-add-inline" onclick="event.stopPropagation(); invAcaoNovoFuste('${parcelaId}', '${estrato}', '${fisionomia}')" title="Novo fuste">⊕</button></td>`;
    if (isHerbaceo) html += `<td class="inv-cell inv-cell-add"><button class="inv-btn-add-inline" onclick="event.stopPropagation(); invAcaoNovoIndividuo('${parcelaId}', '${estrato}', '${fisionomia}')" title="Novo individuo">⊕</button></td>`;
    const footCols = (showFustes ? 2 : 0) + (isHerbaceo ? 1 : 0) + 5 + (requiresDiametroCopa ? 2 : 0) + (showFustes && estrato === 'Arbóreo' ? 1 : 0);
    for (let i = 0; i < footCols; i++) html += '<td class="inv-cell inv-cell-add"></td>';
    html += '</tr></tfoot>';

    html += '</table>';

    container.innerHTML = html;

    configuraEventosSpreadsheet(container, parcelaId, estrato, fisionomia);

    document.getElementById('inventario-btn-novo-individuo').onclick = () => {
        const metodo = parcela.metodo || 'Parcela';
        if (metodo === 'Censo' || metodo === 'Florística caminhamento') {
            InventarioState.criandoIndividuo = true;
            InventarioState.individuoPendente = { parcelaId, estrato, fisionomia };
            mostrarToast('Colete o GPS do individuo', 'info');
            abrirMapaParaIndividuo();
        } else {
            adicionarIndividuoNaPlanilha(parcelaId, estrato, fisionomia);
        }
    };

    mostrarTela('tela-inventario-lista-individuos');
}

function adicionarIndividuoNaPlanilha(parcelaId, estrato, fisionomia) {
    const proxNum = InventarioDB.getNextIndividuoNumero(parcelaId, estrato);
    const isHerbaceo = estrato === 'Herbáceo';
    const showFustes = !isHerbaceo && estrato !== 'Florística';

    const gpsIndividuo = InventarioState.gpsIndividuoPendente;
    InventarioState.gpsIndividuoPendente = null;
    InventarioState.criandoIndividuo = false;
    InventarioState.individuoPendente = null;

    const individuo = {
        id: InventarioDB._genId(),
        parcelaId: parcelaId,
        numero: proxNum,
        estrato: estrato,
        nomeComum: '',
        nomeCientifico: '',
        familia: '',
        observacoes: '',
        fotos: [],
        epifitas: null,
        epifitasDetalhes: '',
        diametroCopa1: null,
        diametroCopa2: null,
        subParcela: 1,
        numeroGps: null,
        numeroIndividuos: null,
        numeroIndividuosEspecie: null,
        latitude: gpsIndividuo ? gpsIndividuo.lat : null,
        longitude: gpsIndividuo ? gpsIndividuo.lng : null,
        dataColeta: new Date().toISOString().split('T')[0]
    };
    InventarioDB.insertIndividuo(individuo);

    if (showFustes) {
        InventarioDB.insertFuste({
            id: InventarioDB._genId(),
            individuoId: individuo.id,
            numeroFuste: 1,
            altura: 0,
            cap: 0
        });
    }

    abrirListaIndividuosInv(parcelaId, estrato);

    requestAnimationFrame(() => {
        const wrapper = document.getElementById('inventario-spreadsheet-scroll');
        const firstInput = wrapper.querySelector('.inv-cell[contenteditable]');
        if (firstInput) firstInput.focus();
    });
}

function configuraEventosSpreadsheet(container, parcelaId, estrato, fisionomia) {
    const cells = container.querySelectorAll('.inv-cell[contenteditable]');
    cells.forEach(cell => {
        cell.addEventListener('blur', () => {
            const field = cell.dataset.field;
            const id = cell.dataset.id;
            const type = cell.dataset.type;
            if (!field || !id) return;

            let val = cell.textContent.trim();

            if (type === 'individuo') {
                const ind = InventarioDB.getIndividuo(id);
                if (!ind) return;
                if (field === 'numero') {
                    const newNum = parseInt(val);
                    if (!isNaN(newNum) && newNum >= 1) ind.numero = newNum;
                    cell.textContent = ind.numero;
                } else if (field === 'nomeComum') {
                    ind.nomeComum = val;
                } else if (field === 'nomeCientifico') {
                    ind.nomeCientifico = val;
                } else if (field === 'familia') {
                    ind.familia = val;
                } else if (field === 'numeroIndividuos') {
                    ind.numeroIndividuos = val !== '' ? parseInt(val) : null;
                    cell.textContent = ind.numeroIndividuos != null ? ind.numeroIndividuos : '';
                } else if (field === 'numeroIndividuosEspecie') {
                    ind.numeroIndividuosEspecie = val !== '' ? parseInt(val) : null;
                    cell.textContent = ind.numeroIndividuosEspecie != null ? ind.numeroIndividuosEspecie : '';
                } else if (field === 'diametroCopa1') {
                    ind.diametroCopa1 = val !== '' ? parseFloat(val.replace(',', '.')) : null;
                    cell.textContent = ind.diametroCopa1 != null ? ind.diametroCopa1.toString().replace('.', ',') : '';
                } else if (field === 'diametroCopa2') {
                    ind.diametroCopa2 = val !== '' ? parseFloat(val.replace(',', '.')) : null;
                    cell.textContent = ind.diametroCopa2 != null ? ind.diametroCopa2.toString().replace('.', ',') : '';
                } else if (field === 'epifitasDetalhes') {
                    ind.epifitasDetalhes = val;
                }
                InventarioDB.updateIndividuo(ind);
            } else if (type === 'fuste') {
                const fuste = InventarioDB.getFuste(id);
                if (!fuste) return;
                if (field === 'altura') {
                    fuste.altura = val !== '' ? parseFloat(val.replace(',', '.')) : 0;
                    cell.textContent = fuste.altura > 0 ? fuste.altura.toString().replace('.', ',') : '';
                } else if (field === 'cap') {
                    fuste.cap = val !== '' ? parseFloat(val.replace(',', '.')) : 0;
                    cell.textContent = fuste.cap > 0 ? fuste.cap.toString().replace('.', ',') : '';
                }
                InventarioDB.updateFuste(fuste);
            }
        });

        cell.addEventListener('focus', () => {
            if (cell.dataset.type === 'fuste' && cell.dataset.field === 'altura') {
                const val = cell.textContent.trim();
                if (val.endsWith(',')) cell.textContent = val.replace(',', '.');
            }
        });

        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                cell.blur();
                const allCells = Array.from(container.querySelectorAll('.inv-cell[contenteditable]'));
                const idx = allCells.indexOf(cell);
                const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
                if (nextIdx >= 0 && nextIdx < allCells.length) {
                    allCells[nextIdx].focus();
                }
            }
        });
    });
}

function invAcaoNovoIndividuo(parcelaId, estrato, fisionomia) {
    const parcela = InventarioDB.getParcela(parcelaId);
    if (!parcela) return;
    const metodo = parcela.metodo || 'Parcela';
    if (metodo === 'Censo' || metodo === 'Florística caminhamento') {
        InventarioState.criandoIndividuo = true;
        InventarioState.individuoPendente = { parcelaId, estrato, fisionomia };
        mostrarToast('Colete o GPS do individuo', 'info');
        abrirMapaParaIndividuo();
    } else {
        adicionarIndividuoNaPlanilha(parcelaId, estrato, fisionomia);
    }
}

function invAcaoNovoFuste(parcelaId, estrato, fisionomia) {
    const individuos = InventarioDB.getIndividuosByParcelaEstrato(parcelaId, estrato);
    if (individuos.length === 0) {
        mostrarToast('Adicione um individuo primeiro', 'aviso');
        return;
    }
    const ultimoInd = individuos[individuos.length - 1];
    const fustes = InventarioDB.getFustesByIndividuo(ultimoInd.id);
    const proximoNum = fustes.length + 1;
    InventarioDB.insertFuste({
        id: InventarioDB._genId(),
        individuoId: ultimoInd.id,
        numeroFuste: proximoNum,
        altura: 0,
        cap: 0
    });
    abrirListaIndividuosInv(parcelaId, estrato);
}

// ============================================
// FORMULARIO DE INDIVIDUO
// ============================================

function abrirFormIndividuoInv(parcelaId, estrato, individuoId) {
    const parcela = InventarioDB.getParcela(parcelaId);
    if (!parcela) return;

    InventarioState.parcelaAtual = parcela;
    InventarioState.estratoAtual = estrato;

    const isFloristica = estrato === 'Florística';
    const isHerbaceo = estrato === 'Herbáceo';
    const isEdicao = !!individuoId;
    InventarioState.editandoIndividuo = isEdicao;

    const fisionomia = parcela.fisionomia || 'Floresta Estacional Semidecidual';
    const metodo = parcela.metodo || 'Parcela';

    const requiresDiametroCopa =
        (fisionomia === 'Cerrado' && estrato === 'Arbóreo') ||
        (fisionomia === 'Campo Rupestre' && (estrato === 'Arbóreo' || estrato === 'Arbustivo')) ||
        (fisionomia === 'Árvores isoladas' && estrato === 'Arbóreo');
    const capObrigatorio = !(estrato === 'Arbustivo' && fisionomia === 'Campo Rupestre');

    let individuo = null;
    let fustes = [];

    if (isEdicao) {
        individuo = InventarioDB.getIndividuo(individuoId);
        fustes = InventarioDB.getFustesByIndividuo(individuoId);
        InventarioState.individuoAtual = individuo;
    } else {
        const proxNum = InventarioDB.getNextIndividuoNumero(parcelaId, estrato);
        individuo = {
            numero: proxNum,
            estrato: estrato,
            parcelaId: parcelaId,
            nomeComum: '',
            nomeCientifico: '',
            familia: '',
            observacoes: '',
            fotos: [],
            epifitas: null,
            epifitasDetalhes: '',
            diametroCopa1: null,
            diametroCopa2: null,
            subParcela: 1,
            numeroGps: null,
            numeroIndividuos: null,
            numeroIndividuosEspecie: null,
            dataColeta: new Date().toISOString().split('T')[0]
        };
        InventarioState.individuoAtual = individuo;
    }

    // Titulo
    const titulo = isFloristica
        ? (isEdicao ? 'Editar Especie' : 'Nova Especie')
        : (isEdicao ? 'Editar Individuo' : 'Novo Individuo');

    document.getElementById('inventario-form-individuo-titulo').textContent = titulo;
    document.getElementById('inventario-form-individuo-estrato').textContent = estrato;

    const container = document.getElementById('campos-form-individuo-inv');
    container.innerHTML = '';

    // 1. Numero do Individuo
    addCampoNumero(container, 'numero-ind', 'Numero do Individuo', individuo.numero, '', '🔢');

    // 2. Numero do GPS (apenas Censo/Censo)
    if (metodo === 'Censo' && estrato === 'Censo') {
        addCampoNumero(container, 'numeroGps', 'Numero GPS', individuo.numeroGps || '', '', '📡');
    }

    // 3. Numero de individuos da especie (Herbáceo + Campo Rupestre)
    if (isHerbaceo && fisionomia === 'Campo Rupestre') {
        addCampoNumero(container, 'numeroIndividuosEspecie', 'Numero de individuos da especie', individuo.numeroIndividuosEspecie || '', 'Quantidade total desta especie', '👥');
    }

    // 4. % Cobertura da especie (Herbáceo) ou Nº de Individuos (Herbáceo)
    if (isHerbaceo) {
        if (fisionomia === 'Campo Rupestre') {
            addCampoNumero(container, 'numeroIndividuos', '% Cobertura da especie', individuo.numeroIndividuos || '', 'Ex: 25', '📊');
        } else {
            addCampoNumero(container, 'numeroIndividuos', 'No de Individuos', individuo.numeroIndividuos || '', 'Quantidade desta especie', '👥');
        }
    }

    // 5. Nome Comum (autocomplete)
    addCampoTextoAutocomplete(container, 'nomeComum', 'Nome Comum', individuo.nomeComum || '', 'nomesComuns', 'Ex: Ipe Amarelo', '🌿');

    // 6. Nome Cientifico (autocomplete)
    addCampoTextoAutocomplete(container, 'nomeCientifico', 'Nome Cientifico', individuo.nomeCientifico || '', 'nomesCientificos', 'Ex: Handroanthus albus', '🔬');

    // 7. Familia (autocomplete)
    addCampoTextoAutocomplete(container, 'familia', 'Familia', individuo.familia || '', 'familias', 'Ex: Bignoniaceae', '🏷️');

    // 8. Data com botao "Hoje"
    addCampoData(container, 'dataColeta-ind', individuo.dataColeta || new Date().toISOString().split('T')[0], '📅');

    // 9. CARD: FUSTES (se nao for herbaceo e nao for floristica)
    if (!isFloristica && !isHerbaceo) {
        const cardFustes = criarCardFormulario('FUSTES', 'content_copy');
        const containerFustes = document.createElement('div');
        containerFustes.id = 'inventario-fustes-container';
        renderizarFustes(containerFustes, fustes, estrato, capObrigatorio);
        cardFustes.querySelector('.inv-card-body').appendChild(containerFustes);

        const btnAddFuste = document.createElement('button');
        btnAddFuste.type = 'button';
        btnAddFuste.className = 'inv-btn-outline';
        btnAddFuste.innerHTML = '+ Adicionar Fuste';
        btnAddFuste.addEventListener('click', () => {
            fustes.push({ numeroFuste: fustes.length + 1, altura: '', cap: '' });
            renderizarFustes(containerFustes, fustes, estrato, capObrigatorio);
        });
        cardFustes.querySelector('.inv-card-body').appendChild(btnAddFuste);
        container.appendChild(cardFustes);
    }

    // 10. CARD: DIAMETRO DE COPA (se requerido)
    if (requiresDiametroCopa) {
        const cardCopa = criarCardFormulario('DIAMETRO DE COPA', 'scatter_plot');
        const rowCopa = document.createElement('div');
        rowCopa.className = 'mat-fuste-campos';
        rowCopa.innerHTML = `
            <div class="mat-field">
                <div class="mat-field-outline">
                    <label class="mat-field-label">Diametro de Copa 1 (m)</label>
                    <input type="number" step="0.01" id="inv-ind-diametroCopa1" value="${individuo.diametroCopa1 || ''}">
                </div>
            </div>
            <div class="mat-field">
                <div class="mat-field-outline">
                    <label class="mat-field-label">Diametro de Copa 2 (m)</label>
                    <input type="number" step="0.01" id="inv-ind-diametroCopa2" value="${individuo.diametroCopa2 || ''}">
                </div>
            </div>`;
        cardCopa.querySelector('.mat-card-body').appendChild(rowCopa);
        container.appendChild(cardCopa);
    }

    // 11. CARD: FOTOS
    const cardFotos = criarCardFormulario('FOTOS' + (individuo.fotos?.length > 0 ? ` (${individuo.fotos.length})` : ''), 'camera_alt');
    const descFotos = document.createElement('p');
    descFotos.className = 'mat-card-desc';
    descFotos.textContent = 'Opcional - fotos para identificacao do individuo';
    cardFotos.querySelector('.mat-card-body').appendChild(descFotos);

    const fotosScroll = document.createElement('div');
    fotosScroll.id = 'inventario-fotos-container';
    fotosScroll.className = 'mat-fotos-scroll';
    cardFotos.querySelector('.mat-card-body').appendChild(fotosScroll);

    const botoesFoto = document.createElement('div');
    botoesFoto.className = 'mat-fotos-botoes';
    botoesFoto.innerHTML = `
        <button type="button" class="mat-btn-outline" onclick="inventarioTirarFoto()">📷 Tirar Foto</button>
        <button type="button" class="mat-btn-outline" onclick="inventarioAbrirGaleria()">🖼️ Galeria</button>`;
    cardFotos.querySelector('.mat-card-body').appendChild(botoesFoto);

    const inputFoto = document.createElement('input');
    inputFoto.type = 'file';
    inputFoto.id = 'inventario-input-foto';
    inputFoto.accept = 'image/*';
    inputFoto.capture = 'environment';
    inputFoto.style.display = 'none';
    cardFotos.querySelector('.mat-card-body').appendChild(inputFoto);

    const inputGaleria = document.createElement('input');
    inputGaleria.type = 'file';
    inputGaleria.id = 'inventario-input-galeria';
    inputGaleria.accept = 'image/*';
    inputGaleria.multiple = true;
    inputGaleria.style.display = 'none';
    cardFotos.querySelector('.mat-card-body').appendChild(inputGaleria);

    container.appendChild(cardFotos);

    // 12. CARD: EPÍFITAS (se nao for herbaceo e nao for floristica)
    if (!isHerbaceo && !isFloristica) {
        const cardEpifitas = criarCardFormulario('EPÍFITAS', 'eco');
        const rowEpifitas = document.createElement('div');
        rowEpifitas.className = 'mat-chip-row';
        rowEpifitas.innerHTML = `
            <span class="mat-chip-label">Presenca de epifitas: </span>
            <button type="button" class="mat-chip ${individuo.epifitas === true ? 'selecionado' : ''}"
                onclick="invSelecionarEpifitas(true, this)">Sim</button>
            <button type="button" class="mat-chip ${individuo.epifitas === false ? 'selecionado' : ''}"
                onclick="invSelecionarEpifitas(false, this)">Nao</button>`;
        cardEpifitas.querySelector('.mat-card-body').appendChild(rowEpifitas);

        const detalhesDiv = document.createElement('div');
        detalhesDiv.id = 'inv-epifitas-detalhes';
        detalhesDiv.style.display = individuo.epifitas === true ? 'block' : 'none';
        detalhesDiv.innerHTML = `
            <div class="mat-field">
                <div class="mat-field-outline">
                    <span class="mat-field-icone">📝</span>
                    <label class="mat-field-label">Quais epifitas?</label>
                    <textarea id="inv-ind-epifitasDetalhes" class="mat-field-textarea" placeholder="Ex: Bromelia, orquidea, samambaias...">${individuo.epifitasDetalhes || ''}</textarea>
                </div>
            </div>`;
        cardEpifitas.querySelector('.mat-card-body').appendChild(detalhesDiv);
        container.appendChild(cardEpifitas);
    }

    // 13. Observacoes
    addCampoTextarea(container, 'observacoes-ind', 'Observacoes', individuo.observacoes || '', '', '📝');

    // Renderizar fotos existentes
    setTimeout(() => {
        renderizarFotosIndividuo(individuo.fotos || []);
        configurarInputsFoto();
    }, 100);

    mostrarTela('tela-inventario-form-individuo');
}

function criarCardFormulario(titulo, icone) {
    const card = document.createElement('div');
    card.className = 'mat-card';
    card.innerHTML = `
        <div class="mat-card-header">
            <span class="mat-card-header-icon">${icone}</span>
            <span class="mat-card-header-title">${titulo}</span>
        </div>
        <div class="mat-card-body"></div>`;
    return card;
}

function invSelecionarEpifitas(valor, btn) {
    InventarioState.individuoAtual = InventarioState.individuoAtual || {};
    InventarioState.individuoAtual.epifitas = valor;

    const chips = btn.parentElement.querySelectorAll('.mat-chip');
    chips.forEach(c => c.classList.remove('selecionado'));
    btn.classList.add('selecionado');

    const detalhes = document.getElementById('inv-epifitas-detalhes');
    if (detalhes) detalhes.style.display = valor ? 'block' : 'none';
}

function invSelecionarEpifitas(valor, btn) {
    InventarioState.individuoAtual = InventarioState.individuoAtual || {};
    InventarioState.individuoAtual.epifitas = valor;

    const chips = btn.parentElement.querySelectorAll('.inv-choice-chip');
    chips.forEach(c => c.classList.remove('selecionado'));
    btn.classList.add('selecionado');

    const detalhes = document.getElementById('inv-epifitas-detalhes');
    if (detalhes) detalhes.style.display = valor ? 'block' : 'none';
}

function renderizarFustes(container, fustes, estrato, capObrigatorio) {
    container.innerHTML = '';
    fustes.forEach((fuste, idx) => {
        const div = document.createElement('div');
        div.className = 'mat-fuste-card';
        div.innerHTML = `
            <div class="mat-fuste-header">
                <span class="mat-fuste-tag">Fuste ${idx + 1}</span>
                ${fustes.length > 1 ? `<button type="button" class="mat-fuste-remover" onclick="inventarioRemoverFuste(${idx})">🗑️</button>` : ''}
            </div>
            <div class="mat-fuste-campos">
                <div class="mat-field">
                    <div class="mat-field-outline">
                        <label class="mat-field-label">Altura (m) *</label>
                        <input type="number" step="0.01" value="${fuste.altura > 0 ? fuste.altura.toFixed(2).replace('.', ',') : ''}" onchange="inventarioAtualizarFuste(${idx}, 'altura', this.value)">
                    </div>
                </div>
                <div class="mat-field">
                    <div class="mat-field-outline">
                        <label class="mat-field-label">${capObrigatorio ? 'CAP (cm) *' : 'CAP (cm)'}</label>
                        <input type="number" step="0.01" value="${fuste.cap > 0 ? fuste.cap.toFixed(2).replace('.', ',') : ''}" onchange="inventarioAtualizarFuste(${idx}, 'cap', this.value)">
                    </div>
                </div>
            </div>`;
        container.appendChild(div);
    });
}

let _fustesTemp = [];
function inventarioAtualizarFuste(idx, campo, valor) {
    // Temp store - will be saved on final save
    if (!window._fustesTemp) window._fustesTemp = [];
    window._fustesTemp[idx] = window._fustesTemp[idx] || {};
    window._fustesTemp[idx][campo] = valor;
}

function inventarioRemoverFuste(idx) {
    const container = document.getElementById('inventario-fustes-container');
    const blocos = container.querySelectorAll('.mat-fuste-card');
    if (blocos[idx]) {
        blocos[idx].remove();
        container.querySelectorAll('.mat-fuste-card').forEach((b, i) => {
            b.querySelector('.mat-fuste-tag').textContent = `Fuste ${i + 1}`;
        });
    }
}

function handleSalvarIndividuoInv() {
    const parcela = InventarioState.parcelaAtual;
    const estrato = InventarioState.estratoAtual;
    if (!parcela || !estrato) return;

    const isFloristica = estrato === 'Florística';
    const isHerbaceo = estrato === 'Herbáceo';

    const individuo = {
        parcelaId: parcela.id,
        estrato: estrato,
        numero: parseInt(document.getElementById('inv-campo-numero-ind')?.value) || 1,
        nomeComum: document.getElementById('inv-campo-nomeComum')?.value || '',
        nomeCientifico: document.getElementById('inv-campo-nomeCientifico')?.value || '',
        familia: document.getElementById('inv-campo-familia')?.value || '',
        observacoes: document.getElementById('inv-campo-observacoes-ind')?.value || '',
        fotos: InventarioState.individuoAtual?.fotos || [],
        epifitas: InventarioState.individuoAtual?.epifitas,
        epifitasDetalhes: document.getElementById('inv-ind-epifitasDetalhes')?.value || '',
        diametroCopa1: parseFloat(document.getElementById('inv-ind-diametroCopa1')?.value) || null,
        diametroCopa2: parseFloat(document.getElementById('inv-ind-diametroCopa2')?.value) || null,
        subParcela: InventarioState.subParcelaAtual || 1,
        numeroGps: parseInt(document.getElementById('inv-campo-numeroGps')?.value) || null,
        numeroIndividuos: parseFloat(document.getElementById('inv-campo-numeroIndividuos')?.value) || null,
        numeroIndividuosEspecie: parseInt(document.getElementById('inv-campo-numeroIndividuosEspecie')?.value) || null,
        dataColeta: document.getElementById('inv-campo-dataColeta-ind')?.value || new Date().toISOString().split('T')[0]
    };

    // Validacao
    const erros = validarIndividuo(individuo, parcela.fisionomia);
    if (erros.length > 0) {
        mostrarToast(erros[0], 'erro');
        return;
    }

    // Salvar fustes
    if (!isFloristica && !isHerbaceo) {
        const fusteContainer = document.getElementById('inventario-fustes-container');
        const blocos = fusteContainer ? fusteContainer.querySelectorAll('.inv-fuste-card') : [];
        const fustesSalvos = [];

        blocos.forEach((bloco, idx) => {
            const inputs = bloco.querySelectorAll('input');
            const fuste = {
                numeroFuste: idx + 1,
                altura: parseFloat(inputs[0]?.value?.replace(',', '.')) || 0,
                cap: parseFloat(inputs[1]?.value?.replace(',', '.')) || 0
            };
            fustesSalvos.push(fuste);
        });

        individuo.fustes = fustesSalvos;
    }

    // Salvar individuo
    let indSalvo;
    if (InventarioState.editandoIndividuo && InventarioState.individuoAtual?.id) {
        indSalvo = InventarioDB.updateIndividuo({ id: InventarioState.individuoAtual.id, ...individuo });
    } else {
        indSalvo = InventarioDB.insertIndividuo(individuo);
    }

    // Salvar fustes separadamente
    if (indSalvo && individuo.fustes) {
        // Limpar fustes antigos
        InventarioDB.deleteFustesByIndividuo(indSalvo.id);
        individuo.fustes.forEach(f => {
            InventarioDB.insertFuste({
                individuoId: indSalvo.id,
                numeroFuste: f.numeroFuste,
                altura: f.altura,
                cap: f.cap
            });
        });
    }

    mostrarToast(isFloristica ? 'Especie salva' : 'Individuo salvo', 'sucesso');
    abrirListaIndividuosInv(parcela.id, estrato);
}

function confirmarExcluirIndividuo(individuoId) {
    const modal = document.getElementById('modal-inventario-confirmar');
    document.getElementById('inventario-confirmar-titulo').textContent = 'Excluir individuo';
    document.getElementById('inventario-confirmar-texto').textContent = 'Deseja excluir este individuo e todos os seus fustes?';

    const btnConfirmar = document.getElementById('inventario-btn-confirmar');
    btnConfirmar.onclick = () => {
        InventarioDB.deleteIndividuo(individuoId);
        fecharModalInventario();
        if (InventarioState.parcelaAtual && InventarioState.estratoAtual) {
            abrirListaIndividuosInv(InventarioState.parcelaAtual.id, InventarioState.estratoAtual);
        }
        mostrarToast('Individuo excluido', 'sucesso');
    };

    modal.classList.add('ativo');
}

// ============================================
// CARACTERIZACAO
// ============================================

function abrirFormCaracterizacaoInv(parcelaId) {
    const parcela = InventarioDB.getParcela(parcelaId);
    if (!parcela) return;

    InventarioState.parcelaAtual = parcela;
    const existente = InventarioDB.getCaracterizacaoByParcela(parcelaId) || {};

    document.getElementById('inventario-caract-parcela-nome').textContent = parcela.nomeParcela || '';

    const container = document.getElementById('campos-form-caracterizacao-inv');
    container.innerHTML = '';

    const fisionomia = parcela.fisionomia || 'Floresta Estacional Semidecidual';
    const isCampoRupestre = fisionomia === 'Campo Rupestre';
    const isCerrado = fisionomia === 'Cerrado';

    if (isCampoRupestre) {
        renderizarCaractCampoRupestre(container, existente);
    } else if (isCerrado) {
        renderizarCaractCerrado(container, existente);
    } else {
        renderizarCaractDefault(container, existente);
    }

    mostrarTela('tela-inventario-form-caracterizacao');
}

function renderizarCaractCampoRupestre(container, existente) {
    const headerLabel = document.createElement('div');
    headerLabel.className = 'inv-caract-header-label';
    headerLabel.textContent = 'Parametros - Campo Rupestre';
    container.appendChild(headerLabel);

    const card1 = criarCardFormulario('Historico de Uso', 'history');
    const descHistorico = document.createElement('p');
    descHistorico.className = 'mat-card-desc';
    descHistorico.textContent = 'Escolha uma opcao:';
    card1.querySelector('.mat-card-body').appendChild(descHistorico);

    const historicoLabels = ['<50%', '>50% a 65%', '>65% a 80%', '>80%'];
    const historicoDescs = [
        'Remanescentes de vegetacao campestre com porcao subterranea incipiente ou ausente',
        'Areas que sofreram acao antrópica com pouco ou nenhum comprometimento da parte subterranea, ou em processo de regeneracao',
        'Areas com acao antrópica moderada sem comprometimento da estrutura e fisionomia, ou que tenham evoluido a partir de estagios medios de regeneracao',
        'Vegetacao de maxima expressao local, sendo os efeitos das acoes antrópicas minimos'
    ];
    const grupoHistorico = document.createElement('div');
    grupoHistorico.className = 'mat-radiogroup';
    grupoHistorico.id = 'inv-caract-historicoUso';
    historicoLabels.forEach((label, idx) => {
        const item = document.createElement('label');
        item.className = 'mat-radio-item';
        item.innerHTML = `<input type="radio" name="historicoUso" value="${idx + 1}" ${(existente.historicoUso || 0) === idx + 1 ? 'checked' : ''}>
            <div class="mat-radio-content"><strong>${label}</strong><span>${historicoDescs[idx]}</span></div>`;
        grupoHistorico.appendChild(item);
    });
    card1.querySelector('.mat-card-body').appendChild(grupoHistorico);
    container.appendChild(card1);

    const card2 = criarCardFormulario('Cobertura vegetal viva do solo (herbacea)', 'grass');
    renderizarMatChips(card2.querySelector('.mat-card-body'), 'coberturaVegetal',
        ['<50%', '>50% a 65%', '>65% a 80%', '>80%'], existente.coberturaVegetal || 0);
    container.appendChild(card2);

    const card3 = criarCardFormulario('Tipo de Substrato', 'layers');
    renderizarMatChips(card3.querySelector('.mat-card-body'), 'tipoSubstrato',
        ['Quartzitico', 'Canga nodular', 'Canga couracada'], existente.tipoSubstrato || '');
    container.appendChild(card3);

    const card4 = criarCardFormulario('Geoambiente', 'terrain');
    renderizarMatChips(card4.querySelector('.mat-card-body'), 'geoambiente',
        ['Aberto', 'Arbustivo', 'Capao', 'Candeal'], existente.geoambiente || '');
    container.appendChild(card4);

    const card5 = criarCardFormulario('Especies Lenhosas', 'park');
    renderizarMatChips(card5.querySelector('.mat-card-body'), 'especiesLenhosas',
        ['Nenhuma', 'Poucas', 'Muitas'], existente.especiesLenhosas || '');
    container.appendChild(card5);

    addCampoTextarea(container, 'observacoes-caract', 'Observacoes', existente.observacoes || '', 'Notas adicionais', '📝');
}

function renderizarCaractCerrado(container, existente) {
    const headerLabel = document.createElement('div');
    headerLabel.className = 'inv-caract-header-label';
    headerLabel.textContent = 'Parametros - Cerrado';
    container.appendChild(headerLabel);

    const card1 = criarCardFormulario('Analise da paisagem - pressao externa', 'trending_up');
    renderizarMatChips(card1.querySelector('.mat-card-body'), 'pressaoExterna',
        ['Explicita', 'Consideravel', 'Alguna', 'Nao constatada'], existente.pressaoExterna || '', true);
    container.appendChild(card1);

    const card2 = criarCardFormulario('% Cobertura vegetal herbaceo-arbustiva', 'grass');
    renderizarMatChips(card2.querySelector('.mat-card-body'), 'coberturaHerbaceoArbustiva',
        ['< 50%', '> 50%'], existente.coberturaHerbaceoArbustiva || '', true);
    container.appendChild(card2);

    const card3 = criarCardFormulario('% Solo exposto', 'landscape');
    renderizarMatChips(card3.querySelector('.mat-card-body'), 'soloExposto',
        ['< 10%', '10 a 30%', '31 a 50%', '> 50%'], existente.soloExposto || '', true);
    container.appendChild(card3);

    const card4 = criarCardFormulario('% Cobertura do solo (serapilheira)', 'forest');
    renderizarMatChips(card4.querySelector('.mat-card-body'), 'coberturaSerapilheira',
        ['< 10%', '10 a 30%', '31 a 50%', '> 50%'], existente.coberturaSerapilheira || '', true);
    container.appendChild(card4);

    const card5 = criarCardFormulario('Antropizacao na area (tipo)', 'warning');
    renderizarMatChips(card5.querySelector('.mat-card-body'), 'antropizacaoTipo',
        ['Incendio', 'Supressao', 'Gado', 'Mineracao', 'Estrada/trilhas', 'Outro'], existente.antropizacaoTipo || '');
    const inputOutroTipo = document.createElement('div');
    inputOutroTipo.id = 'inv-caract-antropizacaoTipoOutro-wrapper';
    inputOutroTipo.style.display = existente.antropizacaoTipo === 'Outro' ? 'block' : 'none';
    inputOutroTipo.innerHTML = `<input type="text" id="inv-caract-antropizacaoTipoOutro" value="${existente.antropizacaoTipoOutro || ''}" placeholder="Descreva outro tipo de antropizacao" class="mat-input-outro">`;
    card5.querySelector('.mat-card-body').appendChild(inputOutroTipo);
    container.appendChild(card5);

    const card6 = criarCardFormulario('Antropizacao na area (intensidade)', 'assessment');
    renderizarMatChips(card6.querySelector('.mat-card-body'), 'antropizacaoIntensidade',
        ['< 10%', '10 e 30%', '30 e 50%', '> 50%'], existente.antropizacaoIntensidade || '', true);
    container.appendChild(card6);

    const card7 = criarCardFormulario('Analise da paisagem - Fitofisionomia', 'eco');
    renderizarMatChips(card7.querySelector('.mat-card-body'), 'fitofisionomia',
        ['Capao', 'Brejo', 'Lajedo', 'Campo sujo', 'Campo limpo, etc...', 'Outro'], existente.fitofisionomia || '');
    const inputOutroFito = document.createElement('div');
    inputOutroFito.id = 'inv-caract-fitofisionomiaOutro-wrapper';
    inputOutroFito.style.display = existente.fitofisionomia === 'Outro' ? 'block' : 'none';
    inputOutroFito.innerHTML = `<input type="text" id="inv-caract-fitofisionomiaOutro" value="${existente.fitofisionomiaOutro || ''}" placeholder="Descreva outra fitofisionomia" class="mat-input-outro">`;
    card7.querySelector('.mat-card-body').appendChild(inputOutroFito);
    container.appendChild(card7);

    addCampoTextarea(container, 'observacoes-caract', 'Observacoes', existente.observacoes || '', 'Notas adicionais', '📝');
}

function renderizarCaractDefault(container, existente) {
    addCampoTexto(container, 'usoPrevio', 'Uso previo', existente.usoPrevio || '', false, 'Ex: pastagem, cultivo, etc.', '📜');

    const headerLabel = document.createElement('div');
    headerLabel.className = 'inv-caract-header-label';
    headerLabel.textContent = 'Parametros';
    container.appendChild(headerLabel);

    renderizarMatChips(container, 'numeroEstratos',
        ['Ausente', 'Dossel e sub-bosque', 'Dossel, sub-dossel e sub-bosque'], existente.numeroEstratos || 0, true);

    const scaleFields = [
        { campo: 'epifitas', label: 'Epifitas' },
        { campo: 'orquideas', label: 'Orquideas' },
        { campo: 'bromelias', label: 'Bromelias' },
        { campo: 'musgosLiquens', label: 'Musgos / liquens' },
        { campo: 'serapilheira', label: 'Serapilheira' },
        { campo: 'trepadeirasLenhosas', label: 'Trepadeiras lenhosas' },
        { campo: 'trepadeirasHerbaceas', label: 'Trepadeiras herbaceas' },
        { campo: 'densidadeArbustos', label: 'Densidade de arbustos' }
    ];
    scaleFields.forEach(sf => {
        renderizarMatScaleField(container, sf.campo, sf.label, existente[sf.campo] || 0);
    });

    addCampoTexto(container, 'relevo', 'Relevo', existente.relevo || '', false, 'Ex: Topo de morro, Encosta, Fundo de vale, Aluvial', '🏔️');
    addCampoTextarea(container, 'antropizacao', 'Antropizacao', existente.antropizacao || '', 'Ex: incendio, efeito de borda, presenca de exoticas', '⚠️');
    addCampoTextarea(container, 'observacoes-caract', 'Observacoes', existente.observacoes || '', 'Notas adicionais', '📝');
}

function renderizarMatChips(container, campo, labels, valorAtual, usarIndice) {
    const div = document.createElement('div');
    div.className = 'mat-chip-group';
    div.id = `inv-caract-${campo}`;
    labels.forEach((label, idx) => {
        const val = usarIndice ? idx : label;
        const isSelected = usarIndice ? (valorAtual === idx) : (valorAtual === label);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `mat-chip ${isSelected ? 'selecionado' : ''}`;
        chip.textContent = label;
        chip.setAttribute('data-valor', val);
        chip.addEventListener('click', () => {
            div.querySelectorAll('.mat-chip').forEach(c => c.classList.remove('selecionado'));
            chip.classList.add('selecionado');
        });
        div.appendChild(chip);
    });
    container.appendChild(div);
}

function renderizarMatScaleField(container, campo, label, valorAtual) {
    const div = document.createElement('div');
    div.className = 'mat-scale-field';
    div.innerHTML = `<label>${label}</label>`;
    const row = document.createElement('div');
    row.className = 'mat-chip-group';
    row.id = `inv-caract-${campo}`;
    const scaleLabels = ['Ausente', 'Poucas', 'Moderada', 'Abundante'];
    scaleLabels.forEach((sl, idx) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `mat-chip ${(valorAtual === idx + 1) ? 'selecionado' : ''}`;
        chip.textContent = sl;
        chip.setAttribute('data-valor', idx + 1);
        chip.addEventListener('click', () => {
            row.querySelectorAll('.mat-chip').forEach(c => c.classList.remove('selecionado'));
            chip.classList.add('selecionado');
        });
        row.appendChild(chip);
    });
    div.appendChild(row);
    container.appendChild(div);
}

function handleSalvarCaracterizacaoInv() {
    const parcela = InventarioState.parcelaAtual;
    if (!parcela) return;

    const fisionomia = parcela.fisionomia || 'Floresta Estacional Semidecidual';
    const isCampoRupestre = fisionomia === 'Campo Rupestre';
    const isCerrado = fisionomia === 'Cerrado';

    const dados = { fisionomia: fisionomia };

    if (isCampoRupestre) {
        dados.historicoUso = getSelectedRadioValue('historicoUso') || 0;
        dados.coberturaVegetal = getSelectedChipValue('coberturaVegetal') || 0;
        dados.tipoSubstrato = getSelectedChipValue('tipoSubstrato') || '';
        dados.geoambiente = getSelectedChipValue('geoambiente') || '';
        dados.especiesLenhosas = getSelectedChipValue('especiesLenhosas') || '';
    } else if (isCerrado) {
        dados.pressaoExterna = getSelectedChipValue('pressaoExterna', true) || 0;
        dados.coberturaHerbaceoArbustiva = getSelectedChipValue('coberturaHerbaceoArbustiva', true) || 0;
        dados.soloExposto = getSelectedChipValue('soloExposto', true) || 0;
        dados.coberturaSerapilheira = getSelectedChipValue('coberturaSerapilheira', true) || 0;
        dados.antropizacaoTipo = getSelectedChipValue('antropizacaoTipo') || '';
        dados.antropizacaoTipoOutro = document.getElementById('inv-caract-antropizacaoTipoOutro')?.value || null;
        dados.antropizacaoIntensidade = getSelectedChipValue('antropizacaoIntensidade', true) || 0;
        dados.fitofisionomia = getSelectedChipValue('fitofisionomia') || '';
        dados.fitofisionomiaOutro = document.getElementById('inv-caract-fitofisionomiaOutro')?.value || null;
    } else {
        dados.usoPrevio = document.getElementById('inv-campo-usoPrevio')?.value || '';
        dados.numeroEstratos = getSelectedChipValue('numeroEstratos', true) || 0;
        dados.epifitas = getSelectedChipValue('epifitas', true) || 0;
        dados.orquideas = getSelectedChipValue('orquideas', true) || 0;
        dados.bromelias = getSelectedChipValue('bromelias', true) || 0;
        dados.musgosLiquens = getSelectedChipValue('musgosLiquens', true) || 0;
        dados.serapilheira = getSelectedChipValue('serapilheira', true) || 0;
        dados.trepadeirasLenhosas = getSelectedChipValue('trepadeirasLenhosas', true) || 0;
        dados.trepadeirasHerbaceas = getSelectedChipValue('trepadeirasHerbaceas', true) || 0;
        dados.densidadeArbustos = getSelectedChipValue('densidadeArbustos', true) || 0;
        dados.relevo = document.getElementById('inv-campo-relevo')?.value || '';
        dados.antropizacao = document.getElementById('inv-campo-antropizacao')?.value || '';
    }

    dados.observacoes = document.getElementById('inv-campo-observacoes-caract')?.value || '';

    InventarioDB.insertCaracterizacao({
        parcelaId: parcela.id,
        ...dados
    });

    mostrarToast('Caracterizacao salva', 'sucesso');
    abrirDetalheParcelaInv(parcela.id);
}

function getSelectedRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? parseInt(checked.value) : 0;
}

function getSelectedChipValue(campo, usarIndice) {
    const group = document.getElementById(`inv-caract-${campo}`);
    if (!group) return usarIndice ? 0 : '';
    const selected = group.querySelector('.mat-chip.selecionado');
    if (!selected) return usarIndice ? 0 : '';
    const val = selected.getAttribute('data-valor');
    return usarIndice ? parseInt(val) : val;
}

// ============================================
// CENSO SUB-PARCELAS
// ============================================

function abrirCensoSubParcelas(parcelaId, estrato) {
    const parcela = InventarioDB.getParcela(parcelaId);
    if (!parcela) return;

    InventarioState.parcelaAtual = parcela;
    InventarioState.estratoAtual = estrato;

    document.getElementById('inventario-subparcelas-titulo').textContent = `Sub-parcelas - ${estrato}`;
    document.getElementById('inventario-subparcelas-parcela-nome').textContent = parcela.nomeParcela || '';

    const container = document.getElementById('inventario-lista-subparcelas');
    const subParcelas = InventarioDB.getCensoSubParcelas(parcelaId, estrato);

    if (subParcelas.length === 0) {
        container.innerHTML = `
            <div class="inventario-empty">
                <div class="inventario-empty-icon">📋</div>
                <h3>Nenhuma sub-parcela</h3>
                <p>Crie sub-parcelas para organizar os individuos do Censo</p>
            </div>
        `;
    } else {
        container.innerHTML = '';
        subParcelas.forEach(sp => {
            const individuos = InventarioDB.getIndividuosByParcelaEstratoSubParcela(parcelaId, estrato, sp.numero);
            const div = document.createElement('div');
            div.className = 'inventario-item-detalhe';
            div.innerHTML = `
                <div class="inventario-item-icone subparcela">📋</div>
                <div class="inventario-item-info">
                    <h4>Sub-parcela ${sp.codigo}</h4>
                    <p>${individuos.length} individuo${individuos.length !== 1 ? 's' : ''} | Tamanho: ${sp.tamanhoParcela || '-'}</p>
                </div>
                <div class="inventario-item-seta">›</div>
            `;
            div.addEventListener('click', () => {
                InventarioState.subParcelaAtual = sp.numero;
                abrirListaIndividuosInv(parcelaId, estrato);
            });
            container.appendChild(div);
        });
    }

    document.getElementById('inventario-btn-nova-subparcela').onclick = () => {
        abrirFormCensoSubParcela(parcelaId, estrato, null);
    };

    mostrarTela('tela-inventario-lista-subparcelas');
}

function abrirFormCensoSubParcela(parcelaId, estrato, subParcelaId) {
    const existente = subParcelaId
        ? InventarioDB._load('censoSubParcelas').find(sp => sp.id === subParcelaId)
        : null;

    InventarioState.subParcelaEditando = existente;

    const container = document.getElementById('campos-form-subparcela-inv');
    container.innerHTML = '';

    const campos = [
        { nome: 'codigo', label: 'Codigo', tipo: 'texto', obrigatorio: true, valor: existente?.codigo || '' },
        { nome: 'tamanhoParcela', label: 'Tamanho (m²)', tipo: 'texto', obrigatorio: false, valor: existente?.tamanhoParcela || '' },
        { nome: 'data', label: 'Data', tipo: 'data', obrigatorio: true, valor: existente?.data || new Date().toISOString().split('T')[0] },
        { nome: 'observacoes', label: 'Observacoes', tipo: 'textarea', obrigatorio: false, valor: existente?.observacoes || '' }
    ];

    campos.forEach(campo => {
        const div = document.createElement('div');
        div.className = 'campo-form';
        const v = campo.valor || '';
        let inputHtml = campo.tipo === 'textarea'
            ? `<textarea id="inv-sp-${campo.nome}">${v}</textarea>`
            : `<input type="${campo.tipo}" id="inv-sp-${campo.nome}" value="${v}">`;
        div.innerHTML = `<label>${campo.label}${campo.obrigatorio ? ' *' : ''}</label>${inputHtml}`;
        container.appendChild(div);
    });

    document.getElementById('inventario-form-subparcela-titulo').textContent =
        existente ? 'Editar Sub-parcela' : 'Nova Sub-parcela';

    mostrarTela('tela-inventario-form-subparcela');
}

function handleSalvarSubParcelaInv() {
    const parcela = InventarioState.parcelaAtual;
    const estrato = InventarioState.estratoAtual;
    if (!parcela || !estrato) return;

    const dados = {
        parcelaId: parcela.id,
        estrato: estrato,
        codigo: document.getElementById('inv-sp-codigo')?.value || '',
        tamanhoParcela: document.getElementById('inv-sp-tamanhoParcela')?.value || '',
        data: document.getElementById('inv-sp-data')?.value || new Date().toISOString().split('T')[0],
        observacoes: document.getElementById('inv-sp-observacoes')?.value || ''
    };

    if (!dados.codigo) {
        mostrarToast('Preencha o codigo da sub-parcela', 'erro');
        return;
    }

    // Calcular numero baseado no codigo
    dados.numero = parseInt(dados.codigo) || (InventarioDB.getCensoSubParcelas(parcela.id, estrato).length + 1);

    if (InventarioState.subParcelaEditando?.id) {
        InventarioDB.updateCensoSubParcela({ id: InventarioState.subParcelaEditando.id, ...dados });
    } else {
        InventarioDB.insertCensoSubParcela(dados);
    }

    mostrarToast('Sub-parcela salva', 'sucesso');
    abrirCensoSubParcelas(parcela.id, estrato);
}

// ============================================
// AUTOCOMPLETE
// ============================================

function configurarAutocomplete(input, tipo) {
    let dados = [];
    switch (tipo) {
        case 'responsaveis': dados = InventarioDB.getResponsaveis(); break;
        case 'identificadores': dados = InventarioDB.getIdentificadores(); break;
        case 'nomesComuns': dados = InventarioDB.getNomesComuns(); break;
        case 'nomesCientificos': dados = InventarioDB.getNomesCientificos(); break;
        case 'familias': dados = InventarioDB.getFamilias(); break;
        default: return;
    }

    if (dados.length === 0) return;

    const containerId = `autocomplete-${tipo}`;
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'inventario-autocomplete-list';
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(container);
    }

    input.addEventListener('input', () => {
        const valor = input.value.toLowerCase();
        if (valor.length < 2) {
            container.style.display = 'none';
            return;
        }

        const filtrados = dados.filter(d => d.toLowerCase().includes(valor)).slice(0, 8);
        if (filtrados.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.innerHTML = '';
        filtrados.forEach(d => {
            const item = document.createElement('div');
            item.className = 'inventario-autocomplete-item';
            item.textContent = d;
            item.addEventListener('click', () => {
                input.value = d;
                container.style.display = 'none';
            });
            container.appendChild(item);
        });
        container.style.display = 'block';
    });

    input.addEventListener('blur', () => {
        setTimeout(() => container.style.display = 'none', 200);
    });
}

// ============================================
// FOTOS
// ============================================

function inventarioTirarFoto() {
    const input = document.getElementById('inventario-input-foto');
    if (input) input.click();
}

function inventarioAbrirGaleria() {
    const input = document.getElementById('inventario-input-galeria');
    if (input) input.click();
}

function configurarInputsFoto() {
    const inputFoto = document.getElementById('inventario-input-foto');
    const inputGaleria = document.getElementById('inventario-input-galeria');

    if (inputFoto) {
        inputFoto.onchange = (e) => {
            const arquivo = e.target.files[0];
            if (arquivo) processarFoto(arquivo);
        };
    }

    if (inputGaleria) {
        inputGaleria.onchange = (e) => {
            Array.from(e.target.files).forEach(arquivo => processarFoto(arquivo));
        };
    }
}

function processarFoto(arquivo) {
    const reader = new FileReader();
    reader.onload = (e) => {
        // Redimensionar para 1200x1200
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 1200;
            let w = img.width, h = img.height;
            if (w > maxSize || h > maxSize) {
                if (w > h) { h = h * maxSize / w; w = maxSize; }
                else { w = w * maxSize / h; h = maxSize; }
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const base64 = canvas.toDataURL('image/jpeg', 0.8);

            if (!InventarioState.individuoAtual) InventarioState.individuoAtual = {};
            if (!InventarioState.individuoAtual.fotos) InventarioState.individuoAtual.fotos = [];
            InventarioState.individuoAtual.fotos.push(base64);
            renderizarFotosIndividuo(InventarioState.individuoAtual.fotos);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(arquivo);
}

function renderizarFotosIndividuo(fotos) {
    const container = document.getElementById('inventario-fotos-container');
    if (!container) return;
    container.innerHTML = '';

    fotos.forEach((foto, idx) => {
        const div = document.createElement('div');
        div.className = 'inv-foto-item';
        div.innerHTML = `
            <img src="${foto}" alt="Foto ${idx + 1}">
            <button class="inv-foto-remover" onclick="inventarioRemoverFoto(${idx})">×</button>`;
        container.appendChild(div);
    });
}

function inventarioRemoverFoto(idx) {
    if (!InventarioState.individuoAtual?.fotos) return;
    InventarioState.individuoAtual.fotos.splice(idx, 1);
    renderizarFotosIndividuo(InventarioState.individuoAtual.fotos);
}

// ============================================
// EXPORTACAO CSV
// ============================================

function exportarParcelaCSV(parcelaId) {
    const parcela = InventarioDB.getParcela(parcelaId);
    if (!parcela) return;

    const individuos = InventarioDB.getIndividuosByParcela(parcelaId);
    const linhas = [];

    // Cabecalho
    linhas.push([
        'Parcela', 'Fisionomia', 'Metodo', 'Data', 'Responsavel', 'Identificador',
        'Localidade', 'Estrato', 'Numero', 'Nome Comum', 'Nome Cientifico', 'Familia',
        'Fuste', 'Altura (m)', 'CAP (cm)', 'DAP (cm)',
        'Copa D1 (m)', 'Copa D2 (m)', 'Epifitas', 'Observacoes', 'Latitude', 'Longitude'
    ].join(';'));

    individuos.forEach(ind => {
        const fustes = InventarioDB.getFustesByIndividuo(ind.id);

        if (fustes.length === 0) {
            linhas.push([
                parcela.nomeParcela, parcela.fisionomia, parcela.metodo,
                parcela.dataColeta, parcela.responsavel, parcela.identificadorCampo,
                parcela.localidade, ind.estrato, ind.numero,
                ind.nomeComum, ind.nomeCientifico, ind.familia,
                '', '', '', '',
                ind.diametroCopa1 || '', ind.diametroCopa2 || '',
                ind.epifitas ? 'Sim' : 'Nao', ind.observacoes,
                parcela.latitude, parcela.longitude
            ].join(';'));
        } else {
            fustes.forEach(f => {
                linhas.push([
                    parcela.nomeParcela, parcela.fisionomia, parcela.metodo,
                    parcela.dataColeta, parcela.responsavel, parcela.identificadorCampo,
                    parcela.localidade, ind.estrato, ind.numero,
                    ind.nomeComum, ind.nomeCientifico, ind.familia,
                    f.numeroFuste, f.altura, f.cap, calcularDap(f.cap),
                    ind.diametroCopa1 || '', ind.diametroCopa2 || '',
                    ind.epifitas ? 'Sim' : 'Nao', ind.observacoes,
                    parcela.latitude, parcela.longitude
                ].join(';'));
            });
        }
    });

    const csv = '\uFEFF' + linhas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${parcela.nomeParcela || 'dados'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    mostrarToast('CSV exportado com sucesso', 'sucesso');
}

function exportarTodasParcelasCSV() {
    const parcelas = InventarioDB.getParcelas();
    if (parcelas.length === 0) {
        mostrarToast('Nenhum dado para exportar', 'aviso');
        return;
    }

    const linhas = [];
    linhas.push([
        'Parcela', 'FisionOMIA', 'Metodo', 'Data', 'Responsavel', 'Identificador',
        'Localidade', 'Estrato', 'Numero', 'Nome Comum', 'Nome Cientifico', 'Familia',
        'Fuste', 'Altura (m)', 'CAP (cm)', 'DAP (cm)',
        'Copa D1 (m)', 'Copa D2 (m)', 'Epifitas', 'Observacoes', 'Latitude', 'Longitude'
    ].join(';'));

    parcelas.forEach(parcela => {
        const individuos = InventarioDB.getIndividuosByParcela(parcela.id);
        individuos.forEach(ind => {
            const fustes = InventarioDB.getFustesByIndividuo(ind.id);
            if (fustes.length === 0) {
                linhas.push([
                    parcela.nomeParcela, parcela.fisionomia, parcela.metodo,
                    parcela.dataColeta, parcela.responsavel, parcela.identificadorCampo,
                    parcela.localidade, ind.estrato, ind.numero,
                    ind.nomeComum, ind.nomeCientifico, ind.familia,
                    '', '', '', '',
                    ind.diametroCopa1 || '', ind.diametroCopa2 || '',
                    ind.epifitas ? 'Sim' : 'Nao', ind.observacoes,
                    parcela.latitude, parcela.longitude
                ].join(';'));
            } else {
                fustes.forEach(f => {
                    linhas.push([
                        parcela.nomeParcela, parcela.fisionomia, parcela.metodo,
                        parcela.dataColeta, parcela.responsavel, parcela.identificadorCampo,
                        parcela.localidade, ind.estrato, ind.numero,
                        ind.nomeComum, ind.nomeCientifico, ind.familia,
                        f.numeroFuste, f.altura, f.cap, calcularDap(f.cap),
                        ind.diametroCopa1 || '', ind.diametroCopa2 || '',
                        ind.epifitas ? 'Sim' : 'Nao', ind.observacoes,
                        parcela.latitude, parcela.longitude
                    ].join(';'));
                });
            }
        });
    });

    const csv = '\uFEFF' + linhas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_geral_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    mostrarToast('CSV completo exportado', 'sucesso');
}

// ============================================
// INTEGRACAO COM MAPA
// ============================================

// Override: quando o mapa coleta um ponto no modo inventario
function aoColetarPontoInventario(posicao) {
    if (InventarioState.criandoParcela && InventarioState.parcelaDataPendente) {
        // Parcela: dados ja preenchidos no form, salvar com GPS coletado
        const novaParcela = {
            ...InventarioState.parcelaDataPendente,
            latitude: posicao.lat,
            longitude: posicao.lng,
            projetoId: App.projetoClienteAtual ? App.projetoClienteAtual.id : null
        };
        InventarioDB.insertParcela(novaParcela);
        InventarioState.parcelaDataPendente = null;
        InventarioState.criandoParcela = false;
        mostrarToast('Parcela criada', 'sucesso');
        abrirTelaInventario();
    } else if (InventarioState.criandoIndividuo && InventarioState.individuoPendente) {
        // Individuo Censo: salvar GPS e abrir form
        InventarioState.gpsIndividuoPendente = posicao;
        const { parcelaId, estrato, fisionomia } = InventarioState.individuoPendente;
        adicionarIndividuoNaPlanilha(parcelaId, estrato, fisionomia);
    }
}

function abrirMapaParaIndividuo() {
    InventarioState.criandoParcela = false;

    const btnColetar = document.getElementById('btn-coletar');
    const crosshair = document.getElementById('crosshair');
    if (btnColetar) {
        btnColetar.style.display = 'flex';
        btnColetar.style.background = '#0D4A35';
    }
    if (crosshair) crosshair.style.display = 'block';

    mostrarTela('tela-mapa');

    setTimeout(() => {
        if (!mapa) {
            if (typeof inicializarMapa === 'function') {
                inicializarMapa(-19.056, -43.374);
            }
        } else {
            mapa.invalidateSize();
            mapa.setView([-19.056, -43.374], 15);
        }
        if (typeof carregarCamadasInventario === 'function') {
            carregarCamadasInventario();
        }
        if (typeof carregarPontosNoMapa === 'function') {
            carregarPontosNoMapa();
        }
        if (App.currentPosition) {
            document.getElementById('coordenadas-mapa').textContent =
                `Lat: ${App.currentPosition.lat.toFixed(6)} | Lon: ${App.currentPosition.lng.toFixed(6)}`;
        }
    }, 300);
}

// ============================================
// EVENT LISTENERS
// ============================================

function configurarEventListenersInventario() {
    // Botao voltar do home inventario
    document.getElementById('btn-voltar-inv-projetos')?.addEventListener('click', () => {
        history.back();
    });

    // Botao novo registro
    document.getElementById('inventario-btn-novo')?.addEventListener('click', () => {
        abrirCriarParcela();
    });

    // Botao exportar tudo
    document.getElementById('inventario-btn-exportar-tudo')?.addEventListener('click', () => {
        exportarTodasParcelasCSV();
    });

    // Botao sincronizar com Box (enviar dados coletados)
    document.getElementById('inventario-btn-sync-box')?.addEventListener('click', () => {
        if (typeof sincronizarInventario === 'function') {
            sincronizarInventario();
        } else {
            mostrarToast('Funcao de sincronizacao nao disponivel', 'erro');
        }
    });

    // Botao ver no mapa (baixa dados do Box para visualizacao)
    document.getElementById('inventario-btn-mapa')?.addEventListener('click', () => {
        InventarioState.telaAnterior = 'inventario';
        const btnColetar = document.getElementById('btn-coletar');
        const crosshair = document.getElementById('crosshair');
        if (btnColetar) btnColetar.style.display = 'none';
        if (crosshair) crosshair.style.display = 'none';
        mostrarTela('tela-mapa');
        setTimeout(() => {
            if (!mapa) {
                if (typeof inicializarMapa === 'function') {
                    inicializarMapa(-19.056, -43.374);
                }
            } else {
                mapa.invalidateSize();
                mapa.setView([-19.056, -43.374], 15);
                if (typeof camadasInventarioCarregadas !== 'undefined') {
                    camadasInventarioCarregadas = false;
                }
            }
            if (typeof carregarCamadasInventario === 'function') {
                carregarCamadasInventario();
            }
            if (typeof carregarInventarioDoBox === 'function') {
                carregarInventarioDoBox();
            }
            if (typeof carregarPontosNoMapa === 'function') {
                carregarPontosNoMapa();
            }
        }, 300);
    });

    // Salvar parcela
    document.getElementById('btn-salvar-parcela-inv')?.addEventListener('click', () => {
        handleSalvarParcelaInv();
    });

    // Voltar do form parcela
    document.getElementById('btn-voltar-form-parcela-inv')?.addEventListener('click', () => {
        InventarioState.criandoParcela = false;
        history.back();
    });

    // Voltar do detalhe
    document.getElementById('btn-voltar-detalhe-inv')?.addEventListener('click', () => {
        renderizarListaParcelas();
        history.back();
    });

    // Salvar individuo
    document.getElementById('btn-salvar-individuo-inv')?.addEventListener('click', () => {
        handleSalvarIndividuoInv();
    });

    // Voltar da lista individuos
    document.getElementById('btn-voltar-lista-ind-inv')?.addEventListener('click', () => {
        history.back();
    });

    // Voltar do form individuo
    document.getElementById('btn-voltar-form-ind-inv')?.addEventListener('click', () => {
        history.back();
    });

    // Salvar caracterizacao
    document.getElementById('btn-salvar-caract-inv')?.addEventListener('click', () => {
        handleSalvarCaracterizacaoInv();
    });

    // Voltar da caracterizacao
    document.getElementById('btn-voltar-caract-inv')?.addEventListener('click', () => {
        history.back();
    });

    // Salvar sub-parcela
    document.getElementById('btn-salvar-subparcela-inv')?.addEventListener('click', () => {
        handleSalvarSubParcelaInv();
    });

    // Voltar da lista sub-parcelas
    document.getElementById('btn-voltar-lista-subparcelas')?.addEventListener('click', () => {
        history.back();
    });

    // Voltar do form sub-parcela
    document.getElementById('btn-voltar-form-subparcela')?.addEventListener('click', () => {
        history.back();
    });

    // Fechar modais
    document.getElementById('inventario-btn-fechar-menu')?.addEventListener('click', fecharModalInventario);
    document.getElementById('inventario-btn-cancelar-confirmar')?.addEventListener('click', fecharModalInventario);
}

// ============================================
// INICIALIZACAO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(configurarEventListenersInventario, 200);
});
