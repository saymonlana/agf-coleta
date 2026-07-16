"""
AGF Coleta - Gerar config.json a partir da geodatabase
Le a estrutura dos campos de cada camada e gera configuracao para o app.
"""
import requests
import json
import sys
import tempfile
import shutil
import fiona
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'RDB4ApBJe172q0aG9msFyavSM4yu31lq'
headers = {'Authorization': f'Bearer {TOKEN}'}

PASTA_BOX_ID = '399502324229'
PASTA_DADOS = Path(__file__).parent / 'dados'
PASTA_DADOS.mkdir(exist_ok=True)

# Mapeamento de tipos Fiona para tipos de formulario
TIPOS_FORMULARIO = {
    'str': 'texto',
    'int': 'numero',
    'float': 'numero',
    'date': 'data',
    'datetime': 'data_hora',
    'time': 'hora',
    'bool': 'checkbox',
}

# Campos que devem ser listas suspensas (dropdown)
CAMPOS_LISTA = {
    'STATUS_DA_PESQUISA': ['Aplicado', 'Ausente', 'Recusado', 'Ainda Voltar'],
    'TIPO_DE_USO_DO_IMOVEL': ['Residencial', 'Comercial', 'Misto', 'Outro'],
    'AREA_URBANA_OU_ZONA_RURAL_DECLARADA': ['Zona Urbana', 'Zona Rural'],
    'AREA_URBANA_OU_ZONA_RURAL': ['Area Urbana', 'Area Rural'],
    'GENERO': ['Masculino', 'Feminino', 'Outro'],
    'ESTADO_CIVIL': ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viuvo(a)', 'Outro'],
    'AGUA_TRATADA': ['Sim', 'Nao'],
    'COLETA_DE_RESIDUOS_SOLIDOS': ['Sim', 'Nao'],
    'ANIMAL_DOMESTICO': ['Sim', 'Nao'],
    'ANIMAIS_SILVESTRES_E_EXOTICOS': ['Sim', 'Nao'],
    'PRODUCAO_AGROPECIARIA': ['Sim', 'Nao'],
    'BARRAGEM': ['Sim', 'Nao'],
    'PARTICIPA_DE_GRUPO_DE_FOLIA_DE_MINAS': ['Sim', 'Nao'],
    'TOCA_VIOLA_DE_10_CORDAS_VIOLA_CAIPIRA': ['Sim', 'Nao'],
    'PARTICIPA_DE_FESTAS_DOS_REINADOS_OU_CONGADOS': ['Sim', 'Nao'],
    'PARTICIPA_DA_BANDA_DE_MUSICA': ['Sim', 'Nao'],
    'TEM_CASA_DE_FARINHA_OU_PRODUZ_FUBA': ['Sim', 'Nao'],
}

# Campos que sao textos longos (textarea)
CAMPOS_TEXTAREA = [
    'ENDERECO_COMPLETO',
    'OBSERVACOES',
    'OBSERVACOES__',
    '_OBSERVACOES',
    'DESCRICAO_DA_OCUPACAO',
    'ESPECIFICACAO_DA_DIFICULDADE_DE_LOCOMOCAO',
    'ESPECIFICACAO_DA_COMORBIDADE',
    'DESCRICAO_DA_ATIVIDADE',
    '_QUANDO_FALTA_AGUA_COMO_FAZ_O_ABASTECIMENTO',
]

def obter_tipo_campo(nome_campo, tipo_fiona):
    """Determinar tipo de campo do formulario"""
    if nome_campo in CAMPOS_LISTA:
        return 'lista'
    elif nome_campo in CAMPOS_TEXTAREA:
        return 'textarea'
    elif tipo_fiona in ('int', 'int64', 'int32'):
        return 'numero'
    elif tipo_fiona in ('float', 'float64', 'float32'):
        return 'numero_decimal'
    elif 'date' in str(tipo_fiona).lower():
        return 'data'
    else:
        return 'texto'

def gerar_config_camada(nome_camada, src):
    """Gerar configuracao de uma camada"""
    schema = src.schema
    campos = []
    
    for nome_campo, tipo_fiona in schema['properties'].items():
        tipo_form = obter_tipo_campo(nome_campo, tipo_fiona)
        
        campo = {
            'nome': nome_campo,
            'label': nome_campo.replace('_', ' ').title(),
            'tipo': tipo_form,
            'obrigatorio': False
        }
        
        # Adicionar opcoes se for lista
        if nome_campo in CAMPOS_LISTA:
            campo['opcoes'] = CAMPOS_LISTA[nome_campo]
        
        # Tornar obrigatorio alguns campos importantes
        if nome_campo in ['CODIGO', 'STATUS_DA_PESQUISA', 'NOME_DO_ENTREVISTADO', 'ENDERECO_COMPLETO']:
            campo['obrigatorio'] = True
        
        campos.append(campo)
    
    return {
        'nome': nome_camada,
        'campos': campos,
        'total_campos': len(campos),
        'geometria': schema.get('geometry', None),
        'src': str(src.crs) if src.crs else None
    }

def main():
    print('🚀 AGF Coleta - Gerar config.json')
    print('=' * 60)
    
    # Verificar token
    print('🔑 Verificando token...')
    resp = requests.get('https://api.box.com/2.0/users/me', headers=headers)
    if resp.status_code != 200:
        print(f'❌ Token invalido: {resp.status_code}')
        return
    print(f'✅ Token valido')
    
    # Baixar geodatabase do Box
    print(f'\n📦 Baixando geodatabase do Box...')
    resp = requests.get(f'https://api.box.com/2.0/folders/{PASTA_BOX_ID}/items?limit=1000', headers=headers)
    itens = resp.json()['entries']
    print(f'   {len(itens)} arquivos encontrados')
    
    # Criar pasta temporaria
    temp_gdb = Path(tempfile.mkdtemp()) / 'temp.gdb'
    temp_gdb.mkdir()
    
    # Baixar arquivos (com controle de taxa)
    import time
    print('⬇️ Baixando arquivos...')
    erros = 0
    for i, item in enumerate(itens):
        if item['type'] == 'file':
            try:
                url = f"https://api.box.com/2.0/files/{item['id']}/content"
                resp = requests.get(url, headers=headers, allow_redirects=True, timeout=30)
                if resp.status_code == 200:
                    caminho = temp_gdb / item['name']
                    with open(caminho, 'wb') as f:
                        f.write(resp.content)
                elif resp.status_code == 429:
                    print(f'   ⏳ Rate limit, aguardando 10s...')
                    time.sleep(10)
                    resp = requests.get(url, headers=headers, allow_redirects=True, timeout=30)
                    if resp.status_code == 200:
                        caminho = temp_gdb / item['name']
                        with open(caminho, 'wb') as f:
                            f.write(resp.content)
                else:
                    erros += 1
            except Exception as e:
                erros += 1
                time.sleep(2)
            if (i + 1) % 20 == 0:
                print(f'   ... {i + 1}/{len(itens)} arquivos')
    print(f'✅ {len(itens) - erros}/{len(itens)} arquivos baixados ({erros} erros)')
    
    # Listar camadas
    print('\n🔍 Identificando camadas...')
    camadas = fiona.listlayers(str(temp_gdb))
    print(f'   {len(camadas)} camadas encontradas')
    
    # Camadas de coleta (formularios)
    camadas_coleta = [
        'Questionario_PAEBM_SAG',
        'Moradores_PAEBM_SAG',
        'Animais_Domesticos_PAEBM_SAG',
        'Animais_Silvestres_Exoticos_PAEBM_SAG',
        'Producao_Agropecuaria_PAEBM_SAG'
    ]
    
    # Camadas de visualizacao
    camadas_visualizacao = [
        'Limite_SAG',
        'Limite_MG',
        'Zona_de_Seguranca_Secundaria_ZSS',
        'Zona_de_Autossalvamento_ZAS',
        'Centro_Urbano',
        'Pontos_Questionario_PAEBM_SAG',
        'Questionarios_Realizados_AGF_PAEBM_SAG'
    ]
    
    config = {
        'projeto': {
            'id': 'paebm',
            'nome': 'PAEBM - Agua e Esgoto',
            'descricao': 'Pesquisa sobre Abastecimento de Agua e Esgoto de Base Municipal',
            'municipio': 'Santo Antonio do Grama - MG',
            'criado_em': '2026-07-13'
        },
        'camadas_coleta': {},
        'camadas': {},
        'camadas_visualizacao': [],
        'camada_principal': 'Questionario_PAEBM_SAG',
        'campo_vinculacao': 'CODIGO'
    }
    
    # Processar camadas de coleta
    for nome_camada in camadas_coleta:
        if nome_camada in camadas:
            print(f'\n🔄 Processando {nome_camada}...')
            try:
                with fiona.open(str(temp_gdb), layer=nome_camada) as src:
                    config_camada = gerar_config_camada(nome_camada, src)
                    config['camadas_coleta'][nome_camada] = config_camada
                    print(f'   ✅ {config_camada["total_campos"]} campos')
            except Exception as e:
                print(f'   ❌ Erro: {e}')
    
    # Processar camadas de visualizacao
    for nome_camada in camadas_visualizacao:
        if nome_camada in camadas:
            config['camadas_visualizacao'].append(nome_camada)
    
    # Gerar campos do formulario principal (Questionario)
    questionario = config['camadas_coleta'].get('Questionario_PAEBM_SAG', {})
    if questionario:
        config['camadas']['questionario'] = {
            'arquivo': 'Questionario_PAEBM_SAG.json',
            'nome': 'Questionario PAEBM',
            'campos_principais': [
                'CODIGO', 'STATUS_DA_PESQUISA', 'MUNICIPIO', 'ENDERECO_COMPLETO',
                'NOME_DO_ENTREVISTADO', 'NOME_DO_PROPRIETARIO', 'TIPO_DE_USO_DO_IMOVEL',
                'QUANTAS_PESSOAS_MORAM_NA_RESIDENCIA', 'ENTREVISTADOR', 'DATA'
            ],
            'campos_formulario': questionario['campos']
        }
    
    # Salvar config.json
    config_file = PASTA_DADOS / 'config.json'
    with open(config_file, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    
    print('\n' + '=' * 60)
    print(f'✅ config.json gerado!')
    print(f'📁 {config_file}')
    print(f'📊 Camadas de coleta: {len(config["camadas_coleta"])}')
    print(f'📊 Camadas de visualizacao: {len(config["camadas_visualizacao"])}')
    
    # Limpar
    shutil.rmtree(temp_gdb.parent)

if __name__ == '__main__':
    main()
