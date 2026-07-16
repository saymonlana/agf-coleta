"""
Verificar coordenadas originais da geodatabase do Box
"""
import requests
import json
import sys
import tempfile
import shutil
import fiona
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'KQIejvs1X0egEnylO7sNt1bD1wdcsc3v'
headers = {'Authorization': f'Bearer {TOKEN}'}

# Baixar geodatabase do Box
print('Baixando geodatabase do Box...')
resp = requests.get(f'https://api.box.com/2.0/folders/399502324229/items?limit=1000', headers=headers)
itens = resp.json()['entries']

# Criar pasta temporaria
temp_gdb = Path(tempfile.mkdtemp()) / 'temp.gdb'
temp_gdb.mkdir()

# Baixar arquivos
for item in itens:
    if item['type'] == 'file':
        url = f"https://api.box.com/2.0/files/{item['id']}/content"
        resp = requests.get(url, headers=headers, allow_redirects=True)
        if resp.status_code == 200:
            caminho = temp_gdb / item['name']
            with open(caminho, 'wb') as f:
                f.write(resp.content)

print(f'Arquivos baixados: {len(list(temp_gdb.iterdir()))}')

# Abrir e verificar coordenadas
print()
print('Abrindo Questionario_PAEBM_SAG...')
with fiona.open(str(temp_gdb), layer='Questionario_PAEBM_SAG') as src:
    print(f'SRC: {src.crs}')
    print(f'Total: {len(src)} registros')
    
    # Pegar primeiro registro
    feature = next(iter(src))
    geom = feature.get('geometry')
    props = feature.get('properties', {})
    
    print()
    print('Primeiro registro:')
    print(f'  CODIGO: {props.get("CODIGO")}')
    print(f'  MUNICIPIO: {props.get("MUNICIPIO")}')
    print(f'  Geometria tipo: {geom["type"] if geom else "N/A"}')
    print(f'  Coordenadas raw: {geom["coordinates"] if geom else "N/A"}')
    
    # Verificar formato
    if geom:
        coords = geom['coordinates']
        print()
        print('Analise:')
        print(f'  Valor X: {coords[0]}')
        print(f'  Valor Y: {coords[1]}')
        
        # UTM Zona 23S (EPSG:31983)
        if coords[0] > 100000:  # UTM Easting
            print('  -> Formato UTM (Easting/Northing)')
            print('  -> Precisa converter para WGS84')
        elif -180 < coords[0] < 180 and -90 < coords[1] < 90:
            print('  -> Formato WGS84 (Longitude/Latitude)')
            print('  -> Ja esta convertido')

# Limpar
shutil.rmtree(temp_gdb.parent)
