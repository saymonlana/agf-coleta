"""
Listar todas as pastas no Box para encontrar dados coletados
"""
import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'KQIejvs1X0egEnylO7sNt1bD1wdcsc3v'
headers = {'Authorization': f'Bearer {TOKEN}'}

def listar_pasta(pasta_id, nome='', nivel=0):
    """Listar conteudo de uma pasta"""
    indent = '  ' * nivel
    url = f'https://api.box.com/2.0/folders/{pasta_id}/items?limit=1000'
    resp = requests.get(url, headers=headers)
    
    if resp.status_code != 200:
        return
    
    itens = resp.json()['entries']
    for item in itens:
        if item['type'] == 'folder':
            print(f'{indent}📁 {item["name"]} (ID: {item["id"]})')
            # Listar subpasta se tiver "dados" no nome
            if nivel < 2:
                listar_pasta(item['id'], item['name'], nivel + 1)

# Listar raiz
print('📂 Estrutura de pastas no Box:')
print('=' * 60)
listar_pasta('0', 'Raiz')
