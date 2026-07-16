import json

# Verificar coordenadas dos Questionarios Realizados
d = json.load(open('dados/Questionarios_Realizados_AGF_PAEBM_SAG.json', encoding='utf-8'))

print('Analisando coordenadas...')
print()

# Coletar todas as coordenadas
coordenadas = []
for f in d['features']:
    if f.get('geometry') and f['geometry'].get('coordinates'):
        coords = f['geometry']['coordinates']
        coordenadas.append(coords)

print(f'Total de coordenadas: {len(coordenadas)}')
print()

# Estatisticas
lons = [c[0] for c in coordenadas]
lats = [c[1] for c in coordenadas]

print(f'Longitude: min={min(lons):.6f}, max={max(lons):.6f}')
print(f'Latitude: min={min(lats):.6f}, max={max(lats):.6f}')
print()

# Primeiros 5 registros
print('Primeiros 5 registros:')
for i, c in enumerate(coordenadas[:5]):
    print(f'  {i+1}. Lon={c[0]:.6f}, Lat={c[1]:.6f}')

# Verificar se estao em Minas Gerais
print()
print('Verificando se estao em MG (lat ~ -20, lon ~ -44)...')
for i, c in enumerate(coordenadas[:10]):
    lon, lat = c[0], c[1]
    if -45 < lon < -43 and -21 < lat < -19:
        print(f'  {i+1}. SIM - MG: Lon={lon:.6f}, Lat={lat:.6f}')
    else:
        print(f'  {i+1}. NAO: Lon={lon:.6f}, Lat={lat:.6f}')
