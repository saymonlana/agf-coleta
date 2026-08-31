// ============================================
// EXCEL EXPORT - Gerar planilha a partir do Box
// ============================================

const ExcelExport = {
    nomeArquivo: 'Planilha Dados Aplicativo.xlsx',
    camadas: [
        'Censo',
        'Parcela_Arboreo',
        'Parcela_Arbustivo',
        'Parcela_Herbaceo',
        'Parcela_Arbustivo_CR',
        'Parcela_Herbaceo_CR',
        'Caracterizacao_FESD',
        'Caracterizacao_Cerrado',
        'Caracterizacao_CR',
        'Floristica_Caminhamento_CR'
    ],
    camposIgnorar: ['_id', '_data_coleta', '_tecnico', '_editado', '_editado_em', 'status']
};

// ============================================
// OBTER CAMPOS DA CAMADA (ordem do config)
// ============================================

function obterCamposCamada(nomeCamada) {
    const config = DADOS_CONFIG_INVENTARIO.camadas[nomeCamada];
    if (!config) return [];
    const camposConfig = config.campos
        .filter(c => !ExcelExport.camposIgnorar.includes(c.nome))
        .map(c => c.nome);
    return ['ID', ...camposConfig, 'Tecnico', 'Data Coleta'];
}

// ============================================
// OBTER LABELS DA CAMADA
// ============================================

function obterLabelsCamada(nomeCamada) {
    const config = DADOS_CONFIG_INVENTARIO.camadas[nomeCamada];
    if (!config) return [];
    const labelsConfig = config.campos
        .filter(c => !ExcelExport.camposIgnorar.includes(c.nome))
        .map(c => c.label || c.nome);
    return ['ID', ...labelsConfig, 'Técnico', 'Data Coleta'];
}

// ============================================
// OBTER CAMPOS DE ESTRATO (PARCELA)
// ============================================

function obterCamposEstrato(estrato) {
    const config = DADOS_CONFIG_INVENTARIO;
    if (!config) return [];
    
    let campos = [];
    
    if (estrato === 'arvoreo') {
        campos = [
            { nome: 'NUMERO', label: 'Nº' },
            { nome: 'NOME_VULGAR', label: 'Nome Vulgar' },
            { nome: 'NOME_CIENTIFICO', label: 'Nome Científico' },
            { nome: 'FAMILIA', label: 'Família' },
            { nome: 'ALTURA', label: 'Altura (m)' },
            { nome: 'CAP', label: 'CAP (cm)' },
            { nome: 'COPA_D1', label: 'Copa D1 (m)' },
            { nome: 'COPA_D2', label: 'Copa D2 (m)' }
        ];
        if (config.campos && config.campos.arvoreo) {
            campos = config.campos.arvoreo.map(c => ({ nome: c.nome, label: c.label || c.nome }));
        }
    } else if (estrato === 'arbustivo') {
        campos = [
            { nome: 'NUMERO', label: 'Nº' },
            { nome: 'NOME_VULGAR', label: 'Nome Vulgar' },
            { nome: 'NOME_CIENTIFICO', label: 'Nome Científico' },
            { nome: 'FAMILIA', label: 'Família' },
            { nome: 'ALTURA', label: 'Altura (m)' },
            { nome: 'CAP', label: 'CAP (cm)' }
        ];
        if (config.campos && config.campos.arbustivo) {
            campos = config.campos.arbustivo.map(c => ({ nome: c.nome, label: c.label || c.nome }));
        }
    } else if (estrato === 'herbaceo') {
        campos = [
            { nome: 'NUMERO', label: 'Nº' },
            { nome: 'NOME_VULGAR', label: 'Nome Vulgar' },
            { nome: 'NOME_CIENTIFICO', label: 'Nome Científico' },
            { nome: 'FAMILIA', label: 'Família' },
            { nome: 'NUM_INDIVIDUOS', label: 'Nº Indivíduos' }
        ];
        if (config.campos && config.campos.herbaceo) {
            campos = config.campos.herbaceo.map(c => ({ nome: c.nome, label: c.label || c.nome }));
        }
    }
    
    return campos;
}

// ============================================
// MONTAR DADOS DE PARCELA PARA EXCEL
// ============================================

function montarDadosParcelaParaExcel(parcelas) {
    const abas = {
        'Caracterização': [],
        'Arbóreo': [],
        'Arbustivo': [],
        'Herbáceo': []
    };
    
    let idCaract = 1;
    let idArv = 1;
    let idArb = 1;
    let idHerb = 1;
    
    parcelas.forEach(parcela => {
        const props = parcela.properties || parcela;
        const nome = props.nome || 'Parcela';
        const fisionomia = props.fisionomia || '';
        const responsavel = props.responsavel || props.tecnico || '';
        const dataColeta = props.dataColeta || props.data_coleta || '';
        
        // Caracterização
        const caract = {
            'ID': idCaract,
            'Parcela': nome,
            'Fisionomia': fisionomia,
            'Latitude': props.latitude || '',
            'Longitude': props.longitude || '',
            'Responsável': responsavel,
            'Data Coleta': dataColeta,
            'Arbóreo': (props.arvoreo || []).length,
            'Arbustivo': (props.arbustivo || []).length,
            'Herbáceo': (props.herbaceo || []).length
        };
        
        // Adicionar campos de caracterização se existirem
        if (props.caracterizacao) {
            Object.keys(props.caracterizacao).forEach(key => {
                if (!caract[key]) caract[key] = props.caracterizacao[key];
            });
        }
        
        abas['Caracterização'].push(caract);
        idCaract++;
        
        // Arbóreo
        if (props.arvoreo && props.arvoreo.length > 0) {
            props.arvoreo.forEach(ind => {
                const arv = {
                    'ID': idArv,
                    'Parcela': nome,
                    'Fisionomia': fisionomia
                };
                
                // Adicionar campos do indivíduo
                Object.keys(ind).forEach(key => {
                    if (key === 'fustes') {
                        // Handle fustes
                        if (ind.fustes && ind.fustes.length > 0) {
                            ind.fustes.forEach((fuste, idx) => {
                                arv[`Fuste ${idx + 1} - Altura`] = fuste.ALTURA || '';
                                arv[`Fuste ${idx + 1} - CAP`] = fuste.CAP || '';
                                arv[`Fuste ${idx + 1} - Copa D1`] = fuste.COPA_D1 || '';
                                arv[`Fuste ${idx + 1} - Copa D2`] = fuste.COPA_D2 || '';
                            });
                        }
                    } else {
                        arv[key] = ind[key] !== undefined ? ind[key] : '';
                    }
                });
                
                abas['Arbóreo'].push(arv);
                idArv++;
            });
        }
        
        // Arbustivo
        if (props.arbustivo && props.arbustivo.length > 0) {
            props.arbustivo.forEach(ind => {
                const arb = {
                    'ID': idArb,
                    'Parcela': nome,
                    'Fisionomia': fisionomia
                };
                
                Object.keys(ind).forEach(key => {
                    arb[key] = ind[key] !== undefined ? ind[key] : '';
                });
                
                abas['Arbustivo'].push(arb);
                idArb++;
            });
        }
        
        // Herbáceo
        if (props.herbaceo && props.herbaceo.length > 0) {
            props.herbaceo.forEach(ind => {
                const herb = {
                    'ID': idHerb,
                    'Parcela': nome,
                    'Fisionomia': fisionomia
                };
                
                Object.keys(ind).forEach(key => {
                    herb[key] = ind[key] !== undefined ? ind[key] : '';
                });
                
                abas['Herbáceo'].push(herb);
                idHerb++;
            });
        }
    });
    
    return abas;
}

// ============================================
// BAIXAR DADOS DE UMA CAMADA DO BOX
// ============================================

async function baixarDadosCamadaParaExcel(nomeCamada) {
    const geojson = await baixarGeoJSON(nomeCamada);
    if (!geojson || !geojson.features) return [];
    return geojson.features;
}

// ============================================
// MONTAR DADOS PARA EXCEL
// ============================================

function montarDadosParaExcel(features, campos, nomeCamada) {
    const config = DADOS_CONFIG_INVENTARIO.camadas[nomeCamada];
    const temFuste = config && config.campos.some(c => c.tipo === 'fuste_grupo');
    const camposFuste = temFuste ? config.campos.filter(c => c.tipo === 'fuste_campo').map(c => c.nome) : [];
    const linhas = [];
    let idContador = 1;

    features.forEach(feature => {
        const props = feature.properties || {};
        const fustes = props.fustes;

        if (temFuste && Array.isArray(fustes) && fustes.length > 0) {
            fustes.forEach(fuste => {
                const row = {};
                row['ID'] = idContador;
                campos.forEach(campo => {
                    if (campo === 'FUSTE') {
                        row['FUSTE'] = fuste.numero + ' de ' + fuste.de;
                    } else if (camposFuste.includes(campo)) {
                        row[campo] = fuste[campo] !== undefined ? String(fuste[campo]) : '';
                    } else {
                        let valor = props[campo] !== undefined ? props[campo] : '';
                        if (valor === null || valor === undefined) valor = '';
                        row[campo] = String(valor);
                    }
                });
                row['Tecnico'] = props._tecnico || '';
                row['Data Coleta'] = props._data_coleta ? new Date(props._data_coleta).toLocaleDateString('pt-BR') : '';
                linhas.push(row);
                idContador++;
            });
        } else {
            const row = {};
            row['ID'] = idContador;
            campos.forEach(campo => {
                let valor = props[campo] !== undefined ? props[campo] : '';
                if (valor === null || valor === undefined) valor = '';
                row[campo] = String(valor);
            });
            row['Tecnico'] = props._tecnico || '';
            row['Data Coleta'] = props._data_coleta ? new Date(props._data_coleta).toLocaleDateString('pt-BR') : '';
            linhas.push(row);
            idContador++;
        }
    });

    return linhas;
}

// ============================================
// GERAR WORKBOOK EXCEL
// ============================================

async function gerarExcel(progresso, dadosPreCarregados) {
    if (typeof XLSX === 'undefined') {
        throw new Error('Biblioteca XLSX nao carregada.');
    }

    const wb = XLSX.utils.book_new();
    let totalRegistros = 0;

    // Processar camadas normais
    for (let i = 0; i < ExcelExport.camadas.length; i++) {
        const camada = ExcelExport.camadas[i];

        if (progresso) {
            progresso(`Processando ${camada}...`, Math.round((i / ExcelExport.camadas.length) * 80));
        }

        let features;
        if (dadosPreCarregados && dadosPreCarregados[camada]) {
            features = dadosPreCarregados[camada];
        } else {
            features = await baixarDadosCamadaParaExcel(camada);
        }
        const campos = obterCamposCamada(camada);
        const labels = obterLabelsCamada(camada);

        if (features.length === 0) {
            const wsVazio = XLSX.utils.aoa_to_sheet([labels]);
            XLSX.utils.book_append_sheet(wb, wsVazio, camada.substring(0, 31));
            continue;
        }

        const dados = montarDadosParaExcel(features, campos, camada);
        const ws = XLSX.utils.json_to_sheet(dados, { header: campos });

        ws['!cols'] = campos.map(() => ({ wch: 20 }));

        XLSX.utils.book_append_sheet(wb, ws, camada.substring(0, 31));
        totalRegistros += dados.length;
    }

    // Processar parcelas locais se existirem
    if (progresso) {
        progresso('Processando parcelas...', 85);
    }
    
    const dadosLocais = App.dadosLocais[App.projetoAtual] || [];
    const parcelas = dadosLocais.filter(d => d.tipo === 'parcela');
    
    if (parcelas.length > 0) {
        const abasParcela = montarDadosParcelaParaExcel(parcelas);
        
        // Adicionar abas de parcela
        Object.keys(abasParcela).forEach(nomeAba => {
            const dados = abasParcela[nomeAba];
            if (dados.length > 0) {
                const campos = Object.keys(dados[0]);
                const ws = XLSX.utils.json_to_sheet(dados, { header: campos });
                ws['!cols'] = campos.map(() => ({ wch: 20 }));
                XLSX.utils.book_append_sheet(wb, ws, nomeAba.substring(0, 31));
                totalRegistros += dados.length;
            }
        });
    }

    if (progresso) {
        progresso('Concluído!', 100);
    }

    return { wb, totalRegistros };
}

// ============================================
// DOWNLOAD NO TABLET
// ============================================

async function downloadExcel() {
    try {
        mostrarToast('Baixando dados do Box...', 'info');

        const { wb, totalRegistros } = await gerarExcel((msg) => {
            mostrarToast(msg, 'info');
        });

        XLSX.writeFile(wb, ExcelExport.nomeArquivo);

        mostrarToast(`Planilha gerada: ${totalRegistros} registros`, 'sucesso');
        return true;
    } catch (e) {
        console.error('Erro ao gerar Excel:', e);
        mostrarToast('Erro ao gerar planilha: ' + e.message, 'erro');
        return false;
    }
}

// ============================================
// ENVIAR EXCEL PARA O BOX (gera no servidor)
// ============================================

const EXCEL_API_URL = (location.protocol === 'file:' || location.hostname === '')
    ? 'https://agf-coleta.onrender.com/upload-excel'
    : '/upload-excel';

async function enviarExcelParaBox(dadosPreCarregados) {
    try {
        console.log('[EXCEL] Iniciando geracao...');
        if (!await verificarToken()) {
            console.error('[EXCEL] Token invalido');
            return null;
        }

        console.log('[EXCEL] Dados pre-carregados:', dadosPreCarregados ? Object.keys(dadosPreCarregados) : 'nenhum');
        mostrarToast('Preparando dados para planilha...', 'info');

        const { wb, totalRegistros } = await gerarExcel((msg) => {
            mostrarToast(msg, 'info');
        }, dadosPreCarregados);

        console.log('[EXCEL] Workbook gerado:', totalRegistros, 'registros');
        mostrarToast(`Enviando ${totalRegistros} registros para o Box...`, 'info');

        const fileId = InventarioSync.excel_file_id || null;
        console.log('[EXCEL] File ID:', fileId, '| Folder ID:', InventarioSync.geojson_folder_id);

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        console.log('[EXCEL] Tamanho do arquivo:', wbout.length, 'bytes');

        const resp = await fetch(EXCEL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'X-Token': Sync.access_token,
                'X-Folder-Id': InventarioSync.geojson_folder_id,
                'X-File-Id': fileId || ''
            },
            body: new Uint8Array(wbout)
        });

        console.log('[EXCEL] Resposta HTTP:', resp.status, resp.statusText);
        const data = await resp.json();
        console.log('[EXCEL] Resposta Box:', JSON.stringify(data).substring(0, 500));
        
        if (resp.ok && data.entries) {
            InventarioSync.excel_file_id = data.entries[0].id;
            try { localStorage.setItem('agf_excel_file_id', data.entries[0].id); } catch(e) {}
            console.log('[EXCEL] Salvo com sucesso! ID:', data.entries[0].id);
            mostrarToast('Planilha Excel enviada ao Box!', 'sucesso');
            return data.entries[0];
        }

        console.error('[EXCEL] Falha no upload:', data);
        mostrarToast('Erro ao salvar planilha: ' + (data.error || JSON.stringify(data)), 'erro');
        return null;
    } catch (e) {
        console.error('[EXCEL] Excecao:', e);
        mostrarToast('Erro ao gerar planilha: ' + e.message, 'erro');
        return null;
    }
}
