import json

# Verificar coordenadas originais (antes da conversao)
d = json.load(open('dados/Questionario_PAEBM_SAG.json', encoding='utf-8'))

# Pegar primeira feature
f = d['features'][0]
geom = f['geometry']

print('Geometria original:')
print(f'  Tipo: {geom["type"]}')
print(f'  Coordenadas: {geom["coordinates"]}')
print()

# Verificar propriedades
props = f['properties']
print('Propriedades:')
for k, v in list(props.items())[:10]:
    print(f'  {k}: {v}')

# Verificar se as coordenadas fazem sentido para MG
# UTM Zona 23S: X (Easting) ~ 400000-500000, Y (Northing) ~ 7500000-7800000
coords = geom['coordinates']
print()
print('Analise das coordenadas:')
print(f'  X (Easting): {coords[0]}')
print(f'  Y (Northing): {coords[1]}')
print()

if 300000 < coords[0] < 600000:
    print('  X parece ser UTM Easting valido')
else:
    print('  X NAO parece ser UTM Easting')

if 7000000 < coords[1] < 9000000:
    print('  Y parece ser UTM Northing valido')
else:
    print('  Y NAO parece ser UTM Northing')
