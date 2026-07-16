import fiona

# Verificar coordenadas originais da geodatabase
gdb_path = 'QUESTIONARIOS_APLICADOS.gdb'

with fiona.open(gdb_path, layer='Questionario_PAEBM_SAG') as src:
    print(f'SRC original: {src.crs}')
    print(f'Total: {len(src)} registros')
    print()
    
    # Pegar primeiro registro
    feature = next(iter(src))
    geom = feature.get('geometry')
    props = feature.get('properties', {})
    
    print('Primeiro registro:')
    print(f'  Geometria: {geom}')
    print(f'  CODIGO: {props.get("CODIGO")}')
    print(f'  MUNICIPIO: {props.get("MUNICIPIO")}')
    
    # Verificar se as coordenadas sao UTM
    if geom:
        coords = geom['coordinates']
        print()
        print('Analise:')
        print(f'  X: {coords[0]}')
        print(f'  Y: {coords[1]}')
        
        if 300000 < coords[0] < 600000 and 7000000 < coords[1] < 9000000:
            print('  -> Coordenadas UTM validas para MG')
        elif -50 < coords[0] < -30 and -25 < coords[1] < -10:
            print('  -> Coordenadas WGS84 (ja convertidas?)')
        else:
            print('  -> Coordenadas em formato desconhecido')
