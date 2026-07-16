import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'teXdxJAmqHRlCthPYbqqo9W8YHg1iLWt'
headers = {'Authorization': f'Bearer {TOKEN}'}

def listar_pasta(pasta_id, nome_pasta, nivel=0):
    """Listar conteudo de uma pasta"""
    indent = '  ' * nivel
    print(f'{indent}📁 {nome_pasta}/')
    
    url = f'https://api.box.com/2.0/folders/{pasta_id}/items?limit=1000'
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f'{indent}  Erro: {response.status_code}')
        return []
    
    itens = response.json()['entries']
    for item in itens:
        tipo = '📁' if item['type'] == 'folder' else '📄'
        ext = item['name'].split('.')[-1].lower() if '.' in item['name'] else ''
        
        if item['type'] == 'folder':
            if '.gdb' in item['name'].lower():
                print(f'{indent}  🗄️ {item["name"]} (ID: {item["id"]}) <<<< GEODATABASE')
            else:
                listar_pasta(item['id'], item['name'], nivel + 1)
        else:
            if ext in ['gdb', 'gpkg', 'shp', 'xls', 'xlsx', 'kmz', 'kml']:
                print(f'{indent}  {tipo} {item["name"]} <<<< RELEVANTE')
    
    return itens

# Pasta principal
PASTA_ID = '122319885126'
PASTA_NOME = 'G1 - AGF ESTUDOS E PRODUTOS'

print('ANALISANDO PASTA DO BOX:')
print('=' * 60)
listar_pasta(PASTA_ID, PASTA_NOME)
