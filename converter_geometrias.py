import json
import os
from pyproj import Transformer

transformer = Transformer.from_crs('EPSG:31983', 'EPSG:4326', always_xy=True)

def simplificar_ring(ring, max_pontos=40):
    if len(ring) <= max_pontos:
        return ring
    fator = len(ring) // max_pontos
    simp = [ring[i] for i in range(0, len(ring), fator)]
    if simp[-1] != ring[-1]:
        simp.append(ring[-1])
    return simp

for nome, var_name in [
    ('Zona_de_Seguranca_Secundaria_ZSS', 'DADOS_ZSS'),
    ('Zona_de_Autossalvamento_ZAS', 'DADOS_ZAS')
]:
    caminho_json = f'C:/AGF_Coleta/dados/{nome}.json'
    caminho_js = f'C:/AGF_Coleta/dados/{nome}.js'
    
    with open(caminho_json, 'r', encoding='utf-8') as f:
        dados = json.load(f)
    
    geom = dados['features'][0]['geometry']
    coords = geom['coordinates']
    
    novo_coords = []
    for poly in coords:
        novo_poly = []
        for ring in poly:
            anel = []
            for ponto in ring:
                lon, lat = transformer.transform(ponto[0], ponto[1])
                anel.append([round(lon, 5), round(lat, 5)])
            anel_simp = simplificar_ring(anel, 40)
            novo_poly.append(anel_simp)
        pontos = sum(len(r) for r in novo_poly)
        if pontos >= 4:
            novo_coords.append(novo_poly)
    
    geom['coordinates'] = novo_coords
    dados['features'][0]['geometry'] = geom
    dados['features'] = [dados['features'][0]]
    
    js = f'var {var_name} = {json.dumps(dados, ensure_ascii=False)};\n'
    with open(caminho_js, 'w', encoding='utf-8') as f:
        f.write(js)
    
    size = os.path.getsize(caminho_js)
    total = sum(sum(len(r) for r in poly) for poly in novo_coords)
    print(f'{nome}: {size//1024}KB, {len(novo_coords)} poligonos, {total} pontos')

# Centro Urbano - remover Z
with open('C:/AGF_Coleta/dados/Centro_Urbano.json', 'r', encoding='utf-8') as f:
    dados = json.load(f)

for feat in dados['features']:
    geom = feat['geometry']
    coords = geom['coordinates']
    novo_coords = []
    for poly in coords:
        novo_poly = []
        for ring in poly:
            novo_poly.append([[p[0], p[1]] for p in ring])
        novo_coords.append(novo_poly)
    geom['coordinates'] = novo_coords

js = 'var DADOS_CENTRO_URBANO = ' + json.dumps(dados, ensure_ascii=False) + ';\n'
with open('C:/AGF_Coleta/dados/Centro_Urbano.js', 'w', encoding='utf-8') as f:
    f.write(js)

size = os.path.getsize('C:/AGF_Coleta/dados/Centro_Urbano.js')
print(f'Centro Urbano: {size//1024}KB')
print('Pronto!')
