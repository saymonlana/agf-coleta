import shapefile
import json
import os
from pyproj import Transformer

transformer = Transformer.from_crs("EPSG:31983", "EPSG:4326", always_xy=True)

def transformar_geometria(geom):
    t = geom['type']
    c = geom['coordinates']
    
    if t == 'Point':
        x, y = transformer.transform(c[0], c[1])
        return {"type": "Point", "coordinates": [x, y]}
    
    elif t == 'Polygon':
        rings = []
        for ring in c:
            novo_ring = []
            for pt in ring:
                x, y = transformer.transform(pt[0], pt[1])
                novo_ring.append([x, y])
            rings.append(novo_ring)
        return {"type": "Polygon", "coordinates": rings}
    
    elif t == 'MultiPolygon':
        polys = []
        for poly in c:
            rings = []
            for ring in poly:
                novo_ring = []
                for pt in ring:
                    x, y = transformer.transform(pt[0], pt[1])
                    novo_ring.append([x, y])
                rings.append(novo_ring)
            polys.append(rings)
        return {"type": "MultiPolygon", "coordinates": polys}
    
    elif t == 'MultiPoint':
        pts = []
        for pt in c:
            x, y = transformer.transform(pt[0], pt[1])
            pts.append([x, y])
        return {"type": "MultiPoint", "coordinates": pts}
    
    elif t == 'MultiLineString':
        lines = []
        for line in c:
            nova_line = []
            for pt in line:
                x, y = transformer.transform(pt[0], pt[1])
                nova_line.append([x, y])
            lines.append(nova_line)
        return {"type": "MultiLineString", "coordinates": lines}
    
    elif t == 'LineString':
        pts = []
        for pt in c:
            x, y = transformer.transform(pt[0], pt[1])
            pts.append([x, y])
        return {"type": "LineString", "coordinates": pts}
    
    return geom

pasta_base = os.path.join(os.path.dirname(__file__), 'Inventario_Florestal')

for nome in ['Propriedades_NES', 'Quadrantes']:
    pasta = os.path.join(pasta_base, nome)
    shp_path = os.path.join(pasta, f'{nome}.shp')
    print(f'Convertendo {nome} com reprojeção...')
    
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
        
        geom_wgs84 = transformar_geometria(geom)
        
        features.append({
            "type": "Feature",
            "geometry": geom_wgs84,
            "properties": props
        })
    
    geojson = {
        "type": "FeatureCollection",
        "name": nome,
        "features": features
    }
    
    # Salvar GeoJSON
    geojson_path = os.path.join(pasta_base, f'{nome}.geojson')
    with open(geojson_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    # Salvar JS
    js_path = os.path.join(pasta_base, f'{nome}.js')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(f'var DADOS_{nome} = {json.dumps(geojson, ensure_ascii=False)};')
    
    # Verificar primeira feature
    if features:
        coords = features[0]['geometry']['coordinates']
        if features[0]['geometry']['type'] == 'Polygon':
            primeiro_pt = coords[0][0]
        else:
            primeiro_pt = coords
        print(f'  -> {len(features)} features, primeiro ponto: {primeiro_pt}')
