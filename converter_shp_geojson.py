import shapefile
import json
import os

def shp_para_geojson(pasta_shp, nome):
    shp_path = os.path.join(pasta_shp, f'{nome}.shp')
    sf = shapefile.Reader(shp_path)
    
    fields = [f[0] for f in sf.fields[1:]]
    
    features = []
    for sr in sf.iterShapeRecords():
        geom = sr.shape.__geo_interface__
        props = dict(zip(fields, sr.record))
        
        for k, v in props.items():
            if isinstance(v, bytes):
                props[k] = v.decode('latin-1', errors='replace')
            elif isinstance(v, float) and v != v:
                props[k] = None
        
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": props
        })
    
    geojson = {
        "type": "FeatureCollection",
        "name": nome,
        "features": features
    }
    
    return geojson

pasta_base = os.path.join(os.path.dirname(__file__), 'Inventario_Florestal')

for nome in ['Propriedades_NES', 'Quadrantes']:
    pasta = os.path.join(pasta_base, nome)
    print(f'Convertendo {nome}...')
    geojson = shp_para_geojson(pasta, nome)
    saida = os.path.join(pasta_base, f'{nome}.geojson')
    with open(saida, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    print(f'  -> {saida} ({len(geojson["features"])} features)')
