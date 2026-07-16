import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'teXdxJAmqHRlCthPYbqqo9W8YHg1iLWt'
headers = {'Authorization': f'Bearer {TOKEN}'}

def ver_pasta(pasta_id, nome, nivel=0):
    """Ver conteudo de uma pasta"""
    indent = '  ' * nivel
    print(f'{indent}📁 {nome}')
    
    url = f'https://api.box.com/2.0/folders/{pasta_id}/items?limit=1000'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        itens = response.json()['entries']
        for item in itens:
            if item['type'] == 'folder':
                if '.gdb' in item['name'].lower():
                    print(f'{indent}  🗄️ {item["name"]} <<<< GEODATABASE!')
                else:
                    ver_pasta(item['id'], item['name'], nivel + 1)
            else:
                ext = item['name'].split('.')[-1].lower()
                if ext in ['gdb', 'gpkg', 'shp', 'xls', 'xlsx']:
                    print(f'{indent}  📄 {item["name"]} <<<< ARQUIVO DADOS')
    else:
        print(f'{indent}  Erro: {response.status_code}')

# Verificar subpasta Questionarios
print('PROCURANDO GEODATABASES...')
print('=' * 60)

# Pasta PAEBM 2024 > Questionarios
ver_pasta('382488025943', 'PAEBM 2024')
