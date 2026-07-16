import fiona
import json
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

gdb = 'C:/AGF_Coleta/Inventario_Florestal/Inventario_Florestal_GDB/Inventario_Florestal.gdb'
output_dir = 'C:/AGF_Coleta/Inventario_Florestal/geojson'

os.makedirs(output_dir, exist_ok=True)

layers = fiona.listlayers(gdb)

for layer_name in layers:
    features = []
    with fiona.open(gdb, layer=layer_name) as src:
        schema = src.schema
        
        for feature in src:
            feat = {
                'type': 'Feature',
                'geometry': feature['geometry'],
                'properties': {}
            }
            for k, v in feature['properties'].items():
                if v is not None:
                    feat['properties'][k] = v
                else:
                    feat['properties'][k] = None
            features.append(feat)
    
    geojson = {
        'type': 'FeatureCollection',
        'name': layer_name,
        'crs': {
            'type': 'name',
            'properties': {'name': 'urn:ogc:def:crs:EPSG::4326'}
        },
        'features': features
    }
    
    output_file = os.path.join(output_dir, f'{layer_name}.geojson')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    print(f'[OK] {layer_name}: {len(features)} registros -> {output_file}')

# Salvar schema para uso no app
schemas = {}
for layer_name in layers:
    with fiona.open(gdb, layer=layer_name) as src:
        schemas[layer_name] = {
            'geometry': src.schema.get('geometry', 'None'),
            'fields': {k: str(v) for k, v in src.schema['properties'].items()}
        }

schema_file = os.path.join(output_dir, 'schemas.json')
with open(schema_file, 'w', encoding='utf-8') as f:
    json.dump(schemas, f, ensure_ascii=False, indent=2)

print(f'\nSchemas salvos em {schema_file}')
print('Pronto! Agora faca upload dos .geojson para o Box.')
