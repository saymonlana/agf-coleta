"""
AGF Coleta - Converter KML/KMZ da pasta KML_Base para JS (GeoJSON embutido)
Saida: dados/Manchas_RC_PAEBM.js e dados/Acessos_Secundarios.js
"""
import json
import os
import sys
import zipfile
from lxml import etree
from shapely.geometry import mapping, shape

sys.stdout.reconfigure(encoding='utf-8')

# Tolerancia de simplificacao em graus (~10m)
SIMPLES_AREA = 0.0001
SIMPLES_LINHA = 0.00005

BASE = os.path.dirname(os.path.abspath(__file__))
KML_BASE = os.path.join(BASE, 'KML_Base')
DADOS = os.path.join(BASE, 'dados')

NS = {
    'kml': 'http://www.opengis.net/kml/2.2',
    'gx': 'http://www.google.com/kml/ext/2.2',
}

KML_FILES = [
    {
        'kmz': 'Manchas_RC_PAEBM.kmz',
        'var_name': 'DADOS_MANCHAS_RC_PAEBM',
        'nome_camada': 'Manchas_RC_PAEBM',
        'saida': 'Manchas_RC_PAEBM.js',
    },
    {
        'kmz': 'ACESSOS_SECUNDARIOS (1).kmz',
        'var_name': 'DADOS_ACESSOS_SECUNDARIOS',
        'nome_camada': 'ACESSOS_SECUNDARIOS',
        'saida': 'Acessos_Secundarios.js',
    },
]


def extrair_doc_kml(kmz_path, destino_dir):
    os.makedirs(destino_dir, exist_ok=True)
    with zipfile.ZipFile(kmz_path) as z:
        kml_name = next(n for n in z.namelist() if n.lower().endswith('.kml'))
        z.extract(kml_name, destino_dir)
        return os.path.join(destino_dir, kml_name)


def texto(el):
    if el is None or el.text is None:
        return ''
    return el.text.strip()


def parse_coords(text):
    pontos = []
    if not text:
        return pontos
    for parte in text.replace('\n', ' ').split():
        coords = parte.split(',')
        if len(coords) < 2:
            continue
        try:
            lon = round(float(coords[0]), 5)
            lat = round(float(coords[1]), 5)
        except ValueError:
            continue
        pontos.append([lon, lat])
    return pontos


def fechar_anel(anel):
    if len(anel) >= 3 and anel[0] != anel[-1]:
        anel.append(anel[0])
    return anel


def parse_polygon(poly_el):
    outers = poly_el.findall('.//kml:outerBoundaryIs/kml:LinearRing', NS)
    inners = poly_el.findall('.//kml:innerBoundaryIs/kml:LinearRing', NS)
    rings = []
    for ring_el in outers:
        coord_el = ring_el.find('kml:coordinates', NS)
        anel = fechar_anel(parse_coords(texto(coord_el)))
        if len(anel) >= 4:
            rings.append(anel)
    if not rings:
        return None
    for ring_el in inners:
        coord_el = ring_el.find('kml:coordinates', NS)
        anel = fechar_anel(parse_coords(texto(coord_el)))
        if len(anel) >= 4:
            rings.append(anel)
    return {'type': 'Polygon', 'coordinates': rings}


def parse_linestring(ls_el):
    coord_el = ls_el.find('kml:coordinates', NS)
    pts = parse_coords(texto(coord_el))
    if len(pts) < 2:
        return None
    return {'type': 'LineString', 'coordinates': pts}


def parse_point(pt_el):
    coord_el = pt_el.find('kml:coordinates', NS)
    pts = parse_coords(texto(coord_el))
    if not pts:
        return None
    return {'type': 'Point', 'coordinates': pts[0]}


def parse_geometry(el):
    """Converte um elemento de geometria (ou MultiGeometry) em geometria GeoJSON."""
    tag = etree.QName(el).localname

    if tag == 'Polygon':
        return parse_polygon(el)
    if tag == 'LineString':
        return parse_linestring(el)
    if tag == 'Point':
        return parse_point(el)

    if tag == 'MultiGeometry':
        poligonos = []
        linhas = []
        pontos = []
        for child in el:
            child_tag = etree.QName(child).localname
            if child_tag in ('Polygon', 'LineString', 'Point', 'MultiGeometry'):
                geom = parse_geometry(child)
                if geom is None:
                    continue
                if geom['type'] == 'Polygon':
                    poligonos.append(geom['coordinates'])
                elif geom['type'] == 'MultiPolygon':
                    poligonos.extend(geom['coordinates'])
                elif geom['type'] == 'LineString':
                    linhas.append(geom['coordinates'])
                elif geom['type'] == 'MultiLineString':
                    linhas.extend(geom['coordinates'])
                elif geom['type'] == 'Point':
                    pontos.append(geom['coordinates'])

        if len(poligonos) == 1 and not linhas and not pontos:
            return {'type': 'Polygon', 'coordinates': poligonos[0]}
        if poligonos and not linhas and not pontos:
            return {'type': 'MultiPolygon', 'coordinates': poligonos}
        if linhas and not poligonos and not pontos:
            if len(linhas) == 1:
                return {'type': 'LineString', 'coordinates': linhas[0]}
            return {'type': 'MultiLineString', 'coordinates': linhas}
        if pontos and not poligonos and not linhas:
            if len(pontos) == 1:
                return {'type': 'Point', 'coordinates': pontos[0]}
            return {'type': 'MultiPoint', 'coordinates': pontos}

        # Geometrias mistas: retorna a mais representativa
        if poligonos:
            return {'type': 'MultiPolygon', 'coordinates': poligonos}
        if linhas:
            return {'type': 'MultiLineString', 'coordinates': linhas}
        if pontos:
            return {'type': 'MultiPoint', 'coordinates': pontos}
        return None

    return None


def extrair_props(placemark):
    props = {}
    nome_el = placemark.find('kml:name', NS)
    nome = texto(nome_el)
    if nome:
        props['nome'] = nome

    desc_el = placemark.find('kml:description', NS)
    desc = texto(desc_el)
    if desc and len(desc) < 300:
        props['descricao'] = desc

    for sd in placemark.findall('.//kml:SimpleData', NS):
        chave = sd.get('name')
        if chave:
            props[chave] = texto(sd)

    return props


def geometrias_do_placemark(placemark):
    geoms = []
    for child in placemark:
        tag = etree.QName(child).localname
        if tag in ('Polygon', 'LineString', 'Point', 'MultiGeometry'):
            geom = parse_geometry(child)
            if geom:
                geoms.append(geom)
    return geoms


def consolidar_geometrias(geoms):
    if not geoms:
        return None
    if len(geoms) == 1:
        return geoms[0]

    tipos = {g['type'] for g in geoms}
    if tipos <= {'Polygon'}:
        if len(geoms) == 1:
            return geoms[0]
        return {'type': 'MultiPolygon', 'coordinates': [g['coordinates'] for g in geoms]}
    if tipos <= {'LineString'}:
        return {'type': 'MultiLineString', 'coordinates': [g['coordinates'] for g in geoms]}
    if tipos <= {'Point'}:
        return {'type': 'MultiPoint', 'coordinates': [g['coordinates'] for g in geoms]}
    # misto: junta por prioridade poligonos > linhas > pontos
    polis = [g for g in geoms if g['type'] in ('Polygon', 'MultiPolygon')]
    linhas = [g for g in geoms if g['type'] in ('LineString', 'MultiLineString')]
    if polis:
        coords = []
        for g in polis:
            if g['type'] == 'Polygon':
                coords.append(g['coordinates'])
            else:
                coords.extend(g['coordinates'])
        return {'type': 'MultiPolygon', 'coordinates': coords}
    if linhas:
        coords = []
        for g in linhas:
            if g['type'] == 'LineString':
                coords.append(g['coordinates'])
            else:
                coords.extend(g['coordinates'])
        return {'type': 'MultiLineString', 'coordinates': coords}
    return geoms[0]


def arredondar_coords(c):
    if isinstance(c[0], (int, float)):
        return [round(c[0], 5), round(c[1], 5)]
    return [arredondar_coords(x) for x in c]


def arredondar_geom(geom):
    geom['coordinates'] = arredondar_coords(geom['coordinates'])
    return geom


def simplificar_geom(geom):
    try:
        g = shape(geom)
        if not g.is_valid:
            g = g.buffer(0)
            if g.is_empty:
                return geom
        if geom['type'] in ('Point', 'MultiPoint'):
            return geom
        if 'LineString' in geom['type']:
            g = g.simplify(SIMPLES_LINHA, preserve_topology=True)
        else:
            g = g.simplify(SIMPLES_AREA, preserve_topology=True)
        if g.is_empty:
            return geom
        return mapping(g)
    except Exception:
        return geom


def converter(kml_path, cfg):
    tree = etree.parse(kml_path)
    root = tree.getroot()

    features = []
    placemarks = root.findall('.//kml:Placemark', NS)
    for pm in placemarks:
        geoms = geometrias_do_placemark(pm)
        geom = consolidar_geometrias(geoms)
        if geom is None:
            continue
        geom = simplificar_geom(geom)
        # arredonda coordenadas apos simplificar
        geom = arredondar_geom(geom)
        props = extrair_props(pm)
        features.append({
            'type': 'Feature',
            'geometry': geom,
            'properties': props,
        })

    geojson = {
        'type': 'FeatureCollection',
        'name': cfg['nome_camada'],
        'features': features,
    }

    js_path = os.path.join(DADOS, cfg['saida'])
    js = f"var {cfg['var_name']} = {json.dumps(geojson, ensure_ascii=False)};\n"
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js)

    tamanho = os.path.getsize(js_path)
    tipos = {}
    total_pts = 0
    for feat in features:
        t = feat['geometry']['type']
        tipos[t] = tipos.get(t, 0) + 1
        c = feat['geometry']['coordinates']
        if t == 'Point':
            total_pts += 1
        elif t == 'LineString':
            total_pts += len(c)
        elif t == 'Polygon':
            total_pts += sum(len(r) for r in c)
        elif t == 'MultiLineString':
            total_pts += sum(len(l) for l in c)
        elif t == 'MultiPolygon':
            total_pts += sum(len(r) for p in c for r in p)
        elif t == 'MultiPoint':
            total_pts += len(c)

    print(f"{cfg['saida']}: {tamanho // 1024}KB, {len(features)} features, {total_pts} pontos, tipos={tipos}")
    return geojson


def main():
    tmp = os.path.join(KML_BASE, 'extracted_tmp')
    for cfg in KML_FILES:
        kmz_path = os.path.join(KML_BASE, cfg['kmz'])
        if not os.path.exists(kmz_path):
            print(f'AUSENTE: {kmz_path}')
            continue
        print(f'Convertendo {cfg["kmz"]}...')
        kml_path = extrair_doc_kml(kmz_path, os.path.join(tmp, cfg['var_name']))
        converter(kml_path, cfg)
    print('Concluido!')


if __name__ == '__main__':
    main()
