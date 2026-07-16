import fiona
import sys
import json
sys.stdout.reconfigure(encoding='utf-8')

gdb_path = r'C:\AGF_Coleta\QUESTIONARIOS_APLICADOS.gdb'
layer_name = 'DADOS_COMPILADOS_PAEBM_SAG'

print(f'Camada: {layer_name}')
print('=' * 60)

with fiona.open(gdb_path, layer=layer_name) as src:
    print(f'Total de registros: {len(src)}')
    print()
    print('ESTRUTURA DOS CAMPOS:')
    print('-' * 60)
    
    for field_name, field_type in src.schema['properties'].items():
        print(f'  {field_name}: {field_type}')
    
    print()
    geom_type = src.schema.get('geometry', 'N/A')
    crs = src.crs
    print(f'Tipo geometria: {geom_type}')
    print(f'SRC: {crs}')
    
    print()
    print('REGISTRO DE EXEMPLO:')
    print('-' * 60)
    
    for i, feature in enumerate(src):
        if feature['properties']:
            print(f'Registro #{i+1}:')
            print('Propriedades:')
            for key, value in feature['properties'].items():
                val_str = str(value) if value is not None else '(vazio)'
                if len(val_str) > 80:
                    val_str = val_str[:80] + '...'
                print(f'  {key}: {val_str}')
            
            print()
            print('Geometria:')
            geom = feature.get('geometry', {})
            if geom:
                print(f'  Tipo: {geom.get("type", "N/A")}')
                coords = geom.get('coordinates', [])
                if coords:
                    print(f'  X (Leste): {coords[0]}')
                    print(f'  Y (Norte): {coords[1]}')
            else:
                print('  Sem geometria')
            break
