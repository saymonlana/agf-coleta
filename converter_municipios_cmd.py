import json
import os
from pyproj import Transformer

transformer = Transformer.from_crs('EPSG:31983', 'EPSG:4326', always_xy=True)

ORIGEM = os.path.join(os.path.dirname(__file__), 'Municipios_PAEBM_CMD_JSON', 'Municipios_PAEBM_CMD_JSON.json')
DESTINO_JS = os.path.join(os.path.dirname(__file__), 'dados', 'Municipios_PAEBM_CMD.js')
VAR_NAME = 'DADOS_MUNICIPIOS_CMD'

with open(ORIGEM, 'r', encoding='utf-8') as f:
    dados = json.load(f)

features = []

for feat in dados['features']:
    attrs = feat['attributes']
    rings = feat['geometry'].get('rings', [])

    poligonos = []
    for ring in rings:
        anel = []
        for ponto in ring:
            lon, lat = transformer.transform(ponto[0], ponto[1])
            anel.append([round(lon, 5), round(lat, 5)])
        poligonos.append(anel)

    geometry = {"type": "Polygon", "coordinates": poligonos}

    props = {}
    for chave in attrs:
        valor = attrs[chave]
        if isinstance(valor, str):
            props[chave] = valor.strip()
        else:
            props[chave] = valor

    features.append({
        "type": "Feature",
        "geometry": geometry,
        "properties": props
    })

geojson = {
    "type": "FeatureCollection",
    "name": "Municipios_PAEBM_CMD",
    "features": features
}

js = 'var ' + VAR_NAME + ' = ' + json.dumps(geojson, ensure_ascii=False) + ';\n'
with open(DESTINO_JS, 'w', encoding='utf-8') as f:
    f.write(js)

tamanho = os.path.getsize(DESTINO_JS)
total_pontos = sum(len(ring) for feat in features for ring in feat['geometry']['coordinates'])
print(f'{os.path.basename(DESTINO_JS)} criado: {tamanho//1024}KB, {len(features)} municipios, {total_pontos} pontos')
for feat in features:
    primeiro = feat['geometry']['coordinates'][0][0]
    print(f"  {feat['properties']['nome']}: {primeiro}")