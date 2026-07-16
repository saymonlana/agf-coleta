"""
AGF Coleta - Baixar geodatabase do Box (pasta com arquivos internos)
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

def utm_para_wgs84(x, y, zona=23):
    """Converter UTM Zona 23S para WGS84"""
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
    R = A * (1 - E) / (1 - E * ((phi1+phi2)/2)**2)**1.5
    D = x / (N1 * K0)
    D2 = D * D
    lat = ((phi1+phi2)/2) - (N1 * (T/R) * (D2/2 - (5 + 10*T2 - 9*C2 + 4*C2*C2) * D2*D2/24)) / 57.29577951
    lon = meridiano_central + (D - (1 + 2*T2 + C2) * D*D*D/6) * 57.29577951
    return round(lon, 6), round(lat, 6)

def converter_geom(geom):
    """Converter coordenadas de UTM para WGS84"""
    if not geom or not geom.get('coordinates'):
        return geom
    tipo = geom['type']
    coords = geom['coordinates']
    if tipo == 'Point':
        if len(coords) >= 2:
            lon, lat = utm_para_wgs84(coords[0], coords[1])
            geom['coordinates'] = [lon, lat]
    elif tipo in ('MultiPoint', 'LineString'):
        geom['coordinates'] = [utm_para_wgs84(c[0], c[1]) if len(c) >= 2 else c for c in coords]
    elif tipo == 'Polygon':
        geom['coordinates'] = [[utm_para_wgs84(c[0], c[1]) if len(c) >= 2 else c for c in ring] for ring in coords]
    return geom

print('🚀 AGF Coleta - Baixar geodatabase do Box')
print('=' * 60)

# Verificar token
print('🔑 Verificando token...')
resp = requests.get('https://api.box.com/2.0/users/me', headers=headers)
if resp.status_code != 200:
    print(f'❌ Token invalido: {resp.status_code}')
    sys.exit(1)
print(f'✅ Autenticado como: {resp.json().get("name")}')

# Listar arquivos da pasta
print(f'\n📂 Baixando {PASTA_BOX_ID}...')
resp = requests.get(f'https://api.box.com/2.0/folders/{PASTA_BOX_ID}/items?limit=1000', headers=headers)
itens = resp.json()['entries']
print(f'   {len(itens)} arquivos encontrados')

# Criar pasta temporaria para a geodatabase
temp_gdb = Path(tempfile.mkdtemp()) / 'QField_PAEBM_SAG.gdb'
temp_gdb.mkdir()

# Baixar todos os arquivos
print('\n⬇️ Baixando arquivos...')
for i, item in enumerate(itens):
    if item['type'] == 'file':
        url = f"https://api.box.com/2.0/files/{item['id']}/content"
        resp = requests.get(url, headers=headers, allow_redirects=True)
        if resp.status_code == 200:
            caminho = temp_gdb / item['name']
            with open(caminho, 'wb') as f:
                f.write(resp.content)
            if (i + 1) % 20 == 0:
                print(f'   ... {i + 1}/{len(itens)} arquivos')

print(f'   ✅ {len(itens)} arquivos baixados')

# Listar camadas da geodatabase
print('\n🔍 Identificando camadas...')
try:
    camadas = fiona.listlayers(str(temp_gdb))
    print(f'   Camadas encontradas: {len(camadas)}')
    for c in camadas:
        print(f'   - {c}')
except Exception as e:
    print(f'   ❌ Erro ao listar camadas: {e}')
    camadas = []

# Exportar cada camada
todas_features = []
for nome_camada in camadas:
    print(f'\n🔄 Processando {nome_camada}...')
    
    try:
        with fiona.open(str(temp_gdb), layer=nome_camada) as src:
            print(f'   📊 {len(src)} registros')
            print(f'   📐 SRC: {src.crs}')
            
            features = []
            for i, feature in enumerate(src):
                geom = feature.get('geometry')
                props = feature.get('properties', {})
                
                if geom:
                    geom_dict = dict(geom)
                    geom_dict = converter_geom(geom_dict)
                else:
                    geom_dict = None
                
                props_limpos = {k: (str(v) if not isinstance(v, (int, float, bool)) else v) 
                               for k, v in props.items() if v is not None}
                
                features.append({
                    'type': 'Feature',
                    'geometry': geom_dict,
                    'properties': props_limpos
                })
            
            # Salvar JSON
            output_file = PASTA_DADOS / f'{nome_camada}.json'
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'nome': nome_camada,
                    'total_registros': len(features),
                    'features': features
                }, f, ensure_ascii=False, indent=2)
            
            print(f'   ✅ Salvo: {output_file.name} ({len(features)} registros)')
            todas_features.extend(features)
            
    except Exception as e:
        print(f'   ❌ Erro: {e}')

# Salvar indice
indice = {
    'projetos': [{
        'id': 'paebm',
        'nome': 'PAEBM - Agua e Esgoto',
        'arquivo': f'{camadas[0]}.json' if camadas else 'paebm.json',
        'total_registros': len(todas_features),
        'camadas': camadas
    }]
}
with open(PASTA_DADOS / 'projetos.json', 'w', encoding='utf-8') as f:
    json.dump(indice, f, ensure_ascii=False, indent=2)

# Limpar
shutil.rmtree(temp_gdb.parent)

print('\n' + '=' * 60)
print(f'✅ CONCLUIDO! {len(todas_features)} registros exportados')
print(f'📁 Dados em: {PASTA_DADOS}')
