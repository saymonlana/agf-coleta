import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'teXdxJAmqHRlCthPYbqqo9W8YHg1iLWt'
headers = {'Authorization': f'Bearer {TOKEN}'}

def ver_pasta(pasta_id, nome):
    """Ver conteudo de uma pasta"""
    print(f'\n📁 {nome} (ID: {pasta_id})')
    print('-' * 50)
    
    url = f'https://api.box.com/2.0/folders/{pasta_id}/items?limit=1000'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        itens = response.json()['entries']
        for item in itens:
            tipo = '📁' if item['type'] == 'folder' else '📄'
            print(f'  {tipo} {item["name"]}')
    else:
        print(f'  Erro: {response.status_code}')

# Pastas para verificar
pastas = [
    ('382488352354', 'PAEBM (mais recente)'),
    ('382488025943', 'PAEBM 2024'),
    ('382488261128', 'SAG PAEBM ANIMAIS'),
    ('382489271606', '00_Questionários PAEBM 2024'),
    ('148743882391', 'Tablet - segunda campanha'),
    ('378574988757', 'PAEBM (outro)'),
]

for pasta_id, nome in pastas:
    ver_pasta(pasta_id, nome)
