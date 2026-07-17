import json
import os

pasta = os.path.join(os.path.dirname(__file__), 'Inventario_Florestal')

for nome in ['Propriedades_NES', 'Quadrantes']:
    geojson_path = os.path.join(pasta, f'{nome}.geojson')
    with open(geojson_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    js_path = os.path.join(pasta, f'{nome}.js')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(f'var DADOS_{nome} = {json.dumps(data, ensure_ascii=False)};')
    
    print(f'{nome}.js criado ({len(data["features"])} features)')
