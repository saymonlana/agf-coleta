import json

# Verificar Questionario_PAEBM_SAG (coordenadas convertidas)
d = json.load(open('dados/Questionario_PAEBM_SAG.json', encoding='utf-8'))
print(f'Questionario PAEBM SAG: {d["total_registros"]} registros')

features_com_geom = [f for f in d['features'] if f.get('geometry')]
print(f'Features com geometria: {len(features_com_geom)}')

# Coordenadas
coordenadas = []
for f in features_com_geom:
    coords = f['geometry']['coordinates']
    if f['geometry']['type'] == 'Point':
        coordenadas.append(coords)

print(f'Pontos: {len(coordenadas)}')

lons = [c[0] for c in coordenadas if c]
lats = [c[1] for c in coordenadas if c]

print(f'Longitude: min={min(lons):.6f}, max={max(lons):.6f}')
print(f'Latitude: min={min(lats):.6f}, max={max(lats):.6f}')

# Primeiros 5
print()
print('Primeiros 5 pontos:')
for i, c in enumerate(coordenadas[:5]):
    print(f'  {i+1}. Lon={c[0]:.6f}, Lat={c[1]:.6f}')

# Verificar MG
print()
em_mg = sum(1 for lon, lat in coordenadas if -45 < lon < -43 and -21 < lat < -19)
print(f'Pontos em MG: {em_mg}/{len(coordenadas)}')
