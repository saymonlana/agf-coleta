"""
AGF Coleta - Converter geodatabase local para JSON
Le a geodatabase do PC e converte para JSON que o app pode ler.
"""
import fiona
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

GDB_PATH = Path(__file__).parent / 'QUESTIONARIOS_APLICADOS.gdb'
PASTA_DADOS = Path(__file__).parent / 'dados'
PASTA_DADOS.mkdir(exist_ok=True)

def utm_para_wgs84(x, y, zona=23):
    """Converter UTM Zona 23S para WGS84"""
    import math
    
    K0 = 0.9996
    E = 0.00669438
    E2 = E * E
    EP2 = E / (1 - E)
    A = 6378137.0
    
    meridiano_central = (zona * 6 - 183)
    y_ajustado = y + 10000000
    M = y_ajustado / K0
    mu = M / (A * (1 - E/4 - 3*E2/64 - 5*E*E2/256))
    
    phi1 = mu + (3*E/2 - 27*E*E2/32) * (2*mu/57.29577951)
    phi2 = phi1 + (21*E*E/16 - 55*E*E2*E/32) * (2*mu/57.29577951)
    
    N1 = A / (1 - E * ((phi1+phi2)/2)**2)**0.5
    T = (phi1+phi2)/2
    T2 = T * T
    C = EP2 * (phi1+phi2)/2
    C2 = C * C
    R = A * (1 - E) / (1 - E * ((phi1+phi2)/2)**2)**1.5
    
    D = x / (N1 * K0)
    D2 = D * D
    
    lat = ((phi1+phi2)/2) - (N1 * (T/R) * (D2/2 - (5 + 10*T2 - 9*C2 + 4*C2*C2) * D2*D2/24)) / 57.29577951
    lon = meridiano_central + (D - (1 + 2*T2 + C2) * D*D*D/6) * 57.29577951
    
    return round(lon, 6), round(lat, 6)

def converter_geom(geom):
    """Converter coordenadas de UTM para WGS84"""
    if not geom or not geom.get('coordinates'):
        return geom
    
    tipo = geom['type']
    coords = geom['coordinates']
    
    if tipo == 'Point':
        if len(coords) >= 2:
            lon, lat = utm_para_wgs84(coords[0], coords[1])
            geom['coordinates'] = [lon, lat]
    elif tipo in ('MultiPoint', 'LineString'):
        geom['coordinates'] = [
            utm_para_wgs84(c[0], c[1]) if len(c) >= 2 else c
            for c in coords
        ]
    elif tipo == 'Polygon':
        geom['coordinates'] = [
            [utm_para_wgs84(c[0], c[1]) if len(c) >= 2 else c for c in ring]
            for ring in coords
        ]
    
    return geom

def listar_camadas(gdb_path):
    """Listar todas as camadas da geodatabase"""
    print('📋 Listando camadas da geodatabase...')
    
    camadas = []
    with fiona.open(str(gdb_path)) as src:
        camadas.append(src.name)
        print(f'  ✅ {src.name} ({len(src)} registros)')
    
    # Tentar listar outras camadas
    try:
        for layer in fiona.listlayers(str(gdb_path)):
            if layer not in camadas:
                camadas.append(layer)
                print(f'  ✅ {layer}')
    except:
        pass
    
    return camadas

def exportar_camada(gdb_path, layer_name, output_name):
    """Exportar uma camada para GeoJSON"""
    print(f'\n🔄 Exportando {layer_name}...')
    
    features = []
    
    with fiona.open(str(gdb_path), layer=layer_name) as src:
        print(f'  📊 Total: {len(src)} registros')
        print(f'  📐 SRC: {src.crs}')
        print(f'  📝 Campos: {list(src.schema["properties"].keys())}')
        
        for i, feature in enumerate(src):
            geom = feature.get('geometry')
            props = feature.get('properties', {})
            
            # Converter geometria para dict
            if geom:
                geom_dict = dict(geom) if hasattr(geom, 'items') else geom
                # Converter coordenadas
                geom_dict = converter_geom(geom_dict)
            else:
                geom_dict = None
            
            # Limpar valores None para JSON
            props_limpos = {}
            for k, v in props.items():
                if v is not None:
                    props_limpos[k] = str(v) if not isinstance(v, (int, float, bool)) else v
            
            features.append({
                'type': 'Feature',
                'geometry': geom_dict,
                'properties': props_limpos
            })
            
            if (i + 1) % 100 == 0:
                print(f'  ... {i + 1} registros processados')
    
    # Salvar JSON
    output_file = PASTA_DADOS / f'{output_name}.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'nome': output_name,
            'camada': layer_name,
            'total_registros': len(features),
            'features': features
        }, f, ensure_ascii=False, indent=2)
    
    print(f'  ✅ Salvo: {output_file.name} ({len(features)} registros)')
    return features

def main():
    print('🚀 AGF Coleta - Converter geodatabase local')
    print('=' * 60)
    print(f'📂 Geodatabase: {GDB_PATH}')
    print(f'📁 Saida: {PASTA_DADOS}')
    
    if not GDB_PATH.exists():
        print(f'❌ Geodatabase nao encontrada: {GDB_PATH}')
        return
    
    # Listar camadas
    print('\n' + '=' * 60)
    camadas = listar_camadas(GDB_PATH)
    
    print(f'\n📊 Total de camadas: {len(camadas)}')
    
    # Exportar cada camada
    todas_features = []
    for camada in camadas:
        try:
            features = exportar_camada(GDB_PATH, camada, camada)
            todas_features.extend(features)
        except Exception as e:
            print(f'  ❌ Erro ao exportar {camada}: {e}')
    
    # Criar indice de projetos
    indice = {
        'projetos': [{
            'id': 'paebm',
            'nome': 'PAEBM - Agua e Esgoto',
            'arquivo': 'paebm.json',
            'total_registros': len(todas_features),
            'camadas': camadas
        }]
    }
    
    indice_file = PASTA_DADOS / 'projetos.json'
    with open(indice_file, 'w', encoding='utf-8') as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)
    
    print('\n' + '=' * 60)
    print('✅ CONVERSAO CONCLUIDA!')
    print(f'📊 Total de registros: {len(todas_features)}')
    print(f'📁 Arquivos salvos em: {PASTA_DADOS}')
    print(f'📋 Indice: {indice_file}')

if __name__ == '__main__':
    main()
