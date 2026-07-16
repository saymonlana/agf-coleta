"""
AGF Coleta - Exportar dados do Box para JSON
Usa o token de usuario para acessar o Box e exportar geodatabases.
Salva como JSON para o app ler no navegador.
"""
import requests
import json
import sys
import os
import tempfile
import shutil
import fiona
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

# Token de usuario (expira a cada 1h, precisa atualizar)
USER_TOKEN = 'teXdxJAmqHRlCthPYbqqo9W8YHg1iLWt'
headers = {'Authorization': f'Bearer {USER_TOKEN}'}

PASTA_DADOS = Path(__file__).parent / 'dados'
PASTA_DADOS.mkdir(exist_ok=True)

# =============================================
# CONVERSOR UTM -> WGS84
# =============================================

def utm_para_wgs84(x, y, zona=23):
    """Converter coordenadas UTM para WGS84"""
    import math
    
    K0 = 0.9996
    E = 0.00669438
    E2 = E * E
    EP2 = E / (1 - E)
    A = 6378137.0
    
    meridiano_central = (zona * 6 - 183)
    
    y_ajustado = y + 10000000
    
    M = y_ajustado / K0
    mu = M / (A * (1 - E/4 - 3*E2/64 - 5*E*E2/256))
    
    phi1 = mu + (3*E/2 - 27*E*E2/32) * (2*mu/57.29577951)
    phi2 = phi1 + (21*E*E/16 - 55*E*E2*E/32) * (2*mu/57.29577951)
    
    N1 = A / (1 - E * ((phi1+phi2)/2)**2)**0.5
    T = (phi1+phi2)/2
    T2 = T * T
    C = EP2 * (phi1+phi2)/2
    C2 = C * C
    
    D = x / (N1 * K0)
    D2 = D * D
    
    lat = ((phi1+phi2)/2) - (N1 * (T/(A * (1 - E * ((phi1+phi2)/2)**2)**1.5)) * (D2/2 - (5 + 10*T2 - 9*C2 + 4*C2*C2) * D2*D2/24)) * 57.29577951
    lon = meridiano_central + (D - (1 + 2*T2 + C2) * D*D*D/6) * 57.29577951
    
    return round(lon, 6), round(lat, 6)

# =============================================
# FUNCOES BOX
# =============================================

def listar_pasta(pasta_id):
    """Listar itens de uma pasta do Box"""
    url = f'https://api.box.com/2.0/folders/{pasta_id}/items?limit=1000'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return response.json()['entries']
    else:
        print(f'  ❌ Erro ao listar pasta {pasta_id}: {response.status_code}')
        return []

def baixar_arquivo(file_id, caminho_local):
    """Baixar arquivo do Box"""
    url = f'https://api.box.com/2.0/files/{file_id}/content'
    response = requests.get(url, headers=headers, allow_redirects=True)
    
    if response.status_code == 200:
        with open(caminho_local, 'wb') as f:
            f.write(response.content)
        return True
    else:
        print(f'  ❌ Erro ao baixar: {response.status_code}')
        return False

def converter_gdb_para_geojson(gdb_path):
    """Converter geodatabase para GeoJSON com conversao de coordenadas"""
    features_geojson = []
    
    try:
        with fiona.open(str(gdb_path)) as src:
            print(f'  📊 Total de registros: {len(src)}')
            print(f'  📐 SRC original: {src.crs}')
            
            for feature in src:
                geom = feature.get('geometry', None)
                props = feature.get('properties', {})
                
                # Converter coordenadas UTM para WGS84
                if geom and geom.get('coordinates'):
                    geom = converter_coordenadas(geom)
                
                feature_out = {
                    'type': 'Feature',
                    'geometry': geom,
                    'properties': props
                }
                features_geojson.append(feature_out)
            
            return features_geojson
    except Exception as e:
        print(f'  ❌ Erro ao converter: {e}')
        return []

def converter_coordenadas(geom):
    """Converter coordenadas de UTM para WGS84"""
    tipo = geom['type']
    coords = geom.get('coordinates', [])
    
    if tipo == 'Point':
        if len(coords) >= 2:
            lon, lat = utm_para_wgs84(coords[0], coords[1])
            geom['coordinates'] = [lon, lat]
    elif tipo == 'MultiPoint' or tipo == 'LineString':
        new_coords = []
        for coord in coords:
            if len(coord) >= 2:
                lon, lat = utm_para_wgs84(coord[0], coord[1])
                new_coords.append([lon, lat])
        geom['coordinates'] = new_coords
    elif tipo == 'Polygon':
        new_coords = []
        for ring in coords:
            new_ring = []
            for coord in ring:
                if len(coord) >= 2:
                    lon, lat = utm_para_wgs84(coord[0], coord[1])
                    new_ring.append([lon, lat])
            new_coords.append(new_ring)
        geom['coordinates'] = new_coords
    
    return geom

# =============================================
# PASTAS CONHECIDAS NO BOX
# =============================================

PASTAS_BOX = {
    'QField_PAEBM_SAG_gdb': {
        'id': '399500267987',
        'descricao': 'Template vazio da geodatabase PAEBM'
    },
    'SAYMON_NAILA': {
        'id': '399494596147',
        'descricao': 'Dados coletados por Saymon e Naila'
    },
    'ROSSI_LELIS': {
        'id': '399495734339',
        'descricao': 'Dados coletados por Rossi e Lelis'
    }
}

# =============================================
# EXPORTACAO PRINCIPAL
# =============================================

def exportar_gdb(pasta_id, nome_projeto):
    """Exportar uma geodatabase do Box para JSON"""
    print(f'\n📦 Exportando: {nome_projeto}')
    print('=' * 50)
    
    # Listar arquivos da pasta
    itens = listar_pasta(pasta_id)
    
    # Encontrar subpastas .gdb
    gdb_folders = []
    for item in itens:
        if item['type'] == 'folder' and '.gdb' in item['name'].lower():
            gdb_folders.append(item)
            print(f'  🗄️ Encontrado: {item["name"]}')
    
    if not gdb_folders:
        print('  ⚠️ Nenhuma geodatabase encontrada')
        return []
    
    todos_features = []
    
    for gdb_folder in gdb_folders:
        print(f'\n  📂 Processando {gdb_folder["name"]}...')
        
        # Criar pasta temporaria
        temp_dir = Path(tempfile.mkdtemp())
        
        # Listar arquivos da geodatabase
        itens_gdb = listar_pasta(gdb_folder['id'])
        
        # Baixar todos os arquivos
        print(f'  ⬇️ Baixando {len(itens_gdb)} arquivos...')
        for item in itens_gdb:
            if item['type'] == 'file':
                caminho = temp_dir / item['name']
                baixar_arquivo(item['id'], caminho)
        
        # Converter para GeoJSON
        print(f'  🔄 Convertendo para GeoJSON...')
        features = converter_gdb_para_geojson(temp_dir)
        
        if features:
            # Salvar JSON
            output_file = PASTA_DADOS / f'{nome_projeto}.json'
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'nome': nome_projeto,
                    'fonte': gdb_folder['name'],
                    'total_registros': len(features),
                    'features': features
                }, f, ensure_ascii=False, indent=2)
            
            print(f'  ✅ Salvo: {output_file.name} ({len(features)} registros)')
            todos_features.extend(features)
        
        # Limpar pasta temporaria
        shutil.rmtree(temp_dir)
    
    return todos_features

def main():
    print('🚀 AGF Coleta - Exportar dados do Box')
    print('=' * 60)
    
    # Verificar token
    print(f'\n🔑 Verificando token...')
    response = requests.get('https://api.box.com/2.0/users/me', headers=headers)
    if response.status_code != 200:
        print(f'❌ Token invalido ou expirado! Erro: {response.status_code}')
        print('   Atualize o token em baixar_dados_box.py')
        return
    
    user = response.json()
    print(f'✅ Autenticado como: {user.get("name", "N/A")}')
    
    # Exportar cada pasta
    total_registros = 0
    projetos_exportados = []
    
    for nome, info in PASTAS_BOX.items():
        features = exportar_gdb(info['id'], nome)
        if features:
            total_registros += len(features)
            projetos_exportados.append(nome)
    
    # Criar indice de projetos
    indice = {
        'projetos': []
    }
    
    for nome in projetos_exportados:
        json_file = PASTA_DADOS / f'{nome}.json'
        if json_file.exists():
            with open(json_file, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            
            indice['projetos'].append({
                'id': nome,
                'nome': nome.replace('_', ' ').title(),
                'arquivo': f'{nome}.json',
                'total_registros': dados['total_registros'],
                'campos': list(dados['features'][0]['properties'].keys()) if dados['features'] else []
            })
    
    # Salvar indice
    indice_file = PASTA_DADOS / 'projetos.json'
    with open(indice_file, 'w', encoding='utf-8') as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)
    
    print('\n' + '=' * 60)
    print('✅ EXPORTACAO CONCLUIDA!')
    print(f'📊 Total de registros: {total_registros}')
    print(f'📁 Projetos exportados: {len(projetos_exportados)}')
    print(f'📁 Arquivos salvos em: {PASTA_DADOS}')
    print(f'📋 Indice: {indice_file}')

if __name__ == '__main__':
    main()
