"""
AGF Coleta - Re-exportar geodatabase com pyproj
"""
import requests
import json
import sys
import tempfile
import shutil
import fiona
import time
from pathlib import Path
from pyproj import Transformer

sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'eJAp8NlKWQmsbtZhXXYclWECzC8fQRfk'
headers = {'Authorization': f'Bearer {TOKEN}'}

PASTA_BOX_ID = '399502324229'
PASTA_DADOS = Path(__file__).parent / 'dados'
PASTA_DADOS.mkdir(exist_ok=True)

transformer = Transformer.from_crs('EPSG:31983', 'EPSG:4326', always_xy=True)

def converter_geom(geom):
    if not geom or not geom.get('coordinates'):
        return geom
    tipo = geom['type']
    coords = geom['coordinates']
    if tipo == 'Point' and len(coords) >= 2:
        lon, lat = transformer.transform(coords[0], coords[1])
        geom['coordinates'] = [round(lon, 6), round(lat, 6)]
    return geom

print('🚀 AGF Coleta - Re-exportar com pyproj')
print('=' * 60)

# Verificar token
resp = requests.get('https://api.box.com/2.0/users/me', headers=headers)
if resp.status_code != 200:
    print(f'❌ Token invalido: {resp.status_code}')
    sys.exit(1)
print(f'✅ Token valido: {resp.json().get("name")}')

# Listar arquivos
resp = requests.get(f'https://api.box.com/2.0/folders/{PASTA_BOX_ID}/items?limit=1000', headers=headers)
itens = resp.json()['entries']
arquivos = [i for i in itens if i['type'] == 'file']
print(f'📦 {len(arquivos)} arquivos na geodatabase')

# Baixar com retry
temp_gdb = Path(tempfile.mkdtemp()) / 'temp.gdb'
temp_gdb.mkdir()

sucesso = 0
falha = 0
session = requests.Session()

for i, item in enumerate(arquivos):
    caminho = temp_gdb / item['name']
    
    for tentativa in range(3):
        try:
            url = f"https://api.box.com/2.0/files/{item['id']}/content"
            resp = session.get(url, headers=headers, allow_redirects=True, timeout=60)
            
            if resp.status_code == 200:
                with open(caminho, 'wb') as f:
                    f.write(resp.content)
                sucesso += 1
                break
            elif resp.status_code == 429:
                print(f'   ⏳ Rate limit, aguardando 15s...')
                time.sleep(15)
            else:
                falha += 1
                break
        except Exception as e:
            if tentativa < 2:
                time.sleep(3)
            else:
                falha += 1
    
    if (i + 1) % 20 == 0:
        print(f'   ... {i + 1}/{len(arquivos)} (✅ {sucesso}, ❌ {falha})')

print(f'✅ Download: {sucesso}/{len(arquivos)} (❌ {falha})')

if sucesso < 10:
    print('❌ Muitos arquivos falharam, abortando')
    shutil.rmtree(temp_gdb.parent)
    sys.exit(1)

# Listar camadas
print('\n🔍 Identificando camadas...')
camadas = fiona.listlayers(str(temp_gdb))
print(f'   {len(camadas)} camadas')

# Exportar camadas de coleta
camadas_coleta = [
    'Questionario_PAEBM_SAG',
    'Moradores_PAEBM_SAG',
    'Animais_Domesticos_PAEBM_SAG',
    'Animais_Silvestres_Exoticos_PAEBM_SAG',
    'Producao_Agropecuaria_PAEBM_SAG'
]

total = 0
for nome_camada in camadas_coleta:
    if nome_camada not in camadas:
        print(f'\n⚠️ {nome_camada} nao encontrada')
        continue
    
    print(f'\n🔄 {nome_camada}...')
    
    try:
        with fiona.open(str(temp_gdb), layer=nome_camada) as src:
            features = []
            for feature in src:
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
            
            output_file = PASTA_DADOS / f'{nome_camada}.json'
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'nome': nome_camada,
                    'total_registros': len(features),
                    'features': features
                }, f, ensure_ascii=False, indent=2)
            
            print(f'   ✅ {len(features)} registros')
            if features and features[0].get('geometry'):
                c = features[0]['geometry']['coordinates']
                print(f'   📍 Coordenada: Lat={c[1]:.4f}, Lon={c[0]:.4f}')
            total += len(features)
    except Exception as e:
        print(f'   ❌ {e}')

# Atualizar projetos.json
with open(PASTA_DADOS / 'projetos.json', 'w', encoding='utf-8') as f:
    json.dump({
        'projetos': [{
            'id': 'paebm',
            'nome': 'PAEBM - Agua e Esgoto',
            'arquivo': 'Questionario_PAEBM_SAG.json',
            'total_registros': total,
            'camadas': camadas_coleta
        }]
    }, f, ensure_ascii=False, indent=2)

shutil.rmtree(temp_gdb.parent)

print('\n' + '=' * 60)
print(f'✅ CONCLUIDO! {total} registros exportados')
