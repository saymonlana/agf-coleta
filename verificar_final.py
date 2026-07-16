import json

# Verificar dados exportados
d = json.load(open('dados/Questionario_PAEBM_SAG.json', encoding='utf-8'))
print(f'Total: {d["total_registros"]} registros')
print()

# Verificar primeiros 5 registros
for i, f in enumerate(d['features'][:5]):
    props = f['properties']
    geom = f.get('geometry', {})
    coords = geom.get('coordinates', [0, 0])
    
    print(f'Registro {i+1}:')
    print(f'  CODIGO: {props.get("CODIGO")}')
    print(f'  STATUS: {props.get("STATUS_DA_PESQUISA")}')
    print(f'  NOME: {props.get("NOME_DO_ENTREVISTADO")}')
    print(f'  ENDERECO: {props.get("ENDERECO_COMPLETO")}')
    print(f'  COORDENADAS: Lat={coords[1]:.4f}, Lon={coords[0]:.4f}')
    print()

# Verificar se coordenadas estao em MG
lats = [f['geometry']['coordinates'][1] for f in d['features'] if f.get('geometry')]
lons = [f['geometry']['coordinates'][0] for f in d['features'] if f.get('geometry')]

print(f'Latitude: min={min(lats):.4f}, max={max(lats):.4f}')
print(f'Longitude: min={min(lons):.4f}, max={max(lons):.4f}')

em_mg = sum(1 for lat, lon in zip(lats, lons) if -22 < lat < -19 and -45 < lon < -43)
print(f'Pontos em MG: {em_mg}/{len(lats)}')
