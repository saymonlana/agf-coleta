import json

# Verificar Questionarios_Realizados (EPSG:9707)
d = json.load(open('dados/Questionarios_Realizados_AGF_PAEBM_SAG.json', encoding='utf-8'))
print(f'Questionarios Realizados AGF: {d["total_registros"]} registros')
print(f'SRC: EPSG:9707 (SIRGAS 2000 / Brazil Polyconic)')

# Verificar geometrias
features_com_geom = [f for f in d['features'] if f.get('geometry')]
print(f'Features com geometria: {len(features_com_geom)}')

if features_com_geom:
    f = features_com_geom[0]
    print(f'Tipo geometria: {f["geometry"]["type"]}')
    print(f'Coordenadas (primeiro ponto): {f["geometry"]["coordinates"][:2]}')
    print(f'Propriedades: {list(f["properties"].keys())[:10]}...')
