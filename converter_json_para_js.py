"""
AGF Coleta - Converter JSONs para JS (compatibilidade com file://)
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

PASTA_DADOS = Path(__file__).parent / 'dados'

def converter_json_para_js(nome_json, nome_variavel):
    """Converter arquivo JSON para JS com variavel global"""
    json_file = PASTA_DADOS / f'{nome_json}.json'
    js_file = PASTA_DADOS / f'{nome_json}.js'
    
    if not json_file.exists():
        print(f'  [OK] {json_file} nao encontrado')
        return False
    
    with open(json_file, 'r', encoding='utf-8') as f:
        dados = json.load(f)
    
    # Gerar JS
    js_content = f'// Dados gerados automaticamente - NAO EDITAR\n'
    js_content += f'// Fonte: {nome_json}.json\n'
    js_content += f'var {nome_variavel} = {json.dumps(dados, ensure_ascii=False)};\n'
    
    with open(js_file, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f'  [OK] {js_file.name} ({len(dados.get("features", []))} registros)')
    return True

print('Convertendo JSONs para JS...')
print('=' * 60)

# Converter arquivos de dados
arquivos = [
    ('Questionario_PAEBM_SAG', 'DADOS_QUESTIONARIO'),
    ('Animais_Domesticos_PAEBM_SAG', 'DADOS_ANIMAIS'),
    ('Moradores_PAEBM_SAG', 'DADOS_MORADORES'),
    ('Animais_Silvestres_Exoticos_PAEBM_SAG', 'DADOS_SILVESTRES'),
    ('Producao_Agropecuaria_PAEBM_SAG', 'DADOS_PRODUCAO'),
    ('projetos', 'DADOS_PROJETOS'),
    ('config', 'DADOS_CONFIG'),
]

for nome_json, nome_var in arquivos:
    converter_json_para_js(nome_json, nome_var)

print('\nConversao concluida!')
print(f'Arquivos JS salvos em: {PASTA_DADOS}')
