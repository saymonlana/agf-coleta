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
    return config.campos
        .filter(c => !ExcelExport.camposIgnorar.includes(c.nome))
        .map(c => c.nome);
}

// ============================================
// OBTER LABELS DA CAMADA
// ============================================

function obterLabelsCamada(nomeCamada) {
    const config = DADOS_CONFIG_INVENTARIO.camadas[nomeCamada];
    if (!config) return [];
    return config.campos
        .filter(c => !ExcelExport.camposIgnorar.includes(c.nome))
        .map(c => c.label || c.nome);
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

function montarDadosParaExcel(features, campos) {
    return features.map(feature => {
        const props = feature.properties || {};
        const row = {};
        campos.forEach(campo => {
            let valor = props[campo] !== undefined ? props[campo] : '';
            if (valor === null || valor === undefined) valor = '';
            row[campo] = String(valor);
        });
        return row;
    });
}

// ============================================
// GERAR WORKBOOK EXCEL
// ============================================

async function gerarExcel(progresso) {
    if (typeof XLSX === 'undefined') {
        throw new Error('Biblioteca XLSX nao carregada.');
    }

    const wb = XLSX.utils.book_new();
    let totalRegistros = 0;

    for (let i = 0; i < ExcelExport.camadas.length; i++) {
        const camada = ExcelExport.camadas[i];

        if (progresso) {
            progresso(`Baixando ${camada}...`, Math.round((i / ExcelExport.camadas.length) * 80));
        }

        const features = await baixarDadosCamadaParaExcel(camada);
        const campos = obterCamposCamada(camada);
        const labels = obterLabelsCamada(camada);

        if (features.length === 0) {
            const wsVazio = XLSX.utils.aoa_to_sheet([labels]);
            XLSX.utils.book_append_sheet(wb, wsVazio, camada.substring(0, 31));
            continue;
        }

        const dados = montarDadosParaExcel(features, campos);
        const ws = XLSX.utils.json_to_sheet(dados, { header: campos });

        ws['!cols'] = campos.map(() => ({ wch: 20 }));

        XLSX.utils.book_append_sheet(wb, ws, camada.substring(0, 31));
        totalRegistros += features.length;
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
// ENVIAR EXCEL PARA O BOX
// ============================================

async function enviarExcelParaBox() {
    try {
        const { wb, totalRegistros } = await gerarExcel();

        const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

        if (!await verificarToken()) return null;

        const fileId = InventarioSync.excel_file_id || null;
        const attributes = {
            name: ExcelExport.nomeArquivo,
            parent: { id: InventarioSync.geojson_folder_id }
        };

        const url = fileId
            ? `https://upload.box.com/api/2.0/files/${fileId}/content`
            : 'https://upload.box.com/api/2.0/files/content';

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
                fileName: ExcelExport.nomeArquivo
            })
        });

        const data = await resp.json();
        if (resp.ok && data.entries) {
            InventarioSync.excel_file_id = data.entries[0].id;
            try { localStorage.setItem('agf_excel_file_id', data.entries[0].id); } catch(e) {}
            console.log('Excel salvo no Box:', ExcelExport.nomeArquivo, `(${totalRegistros} registros)`);
            return data.entries[0];
        }

        console.error('Erro ao salvar Excel no Box:', data);
        return null;
    } catch (e) {
        console.error('Erro ao enviar Excel para Box:', e);
        return null;
    }
}
