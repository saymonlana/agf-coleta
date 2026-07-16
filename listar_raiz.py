import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'teXdxJAmqHRlCthPYbqqo9W8YHg1iLWt'
headers = {'Authorization': f'Bearer {TOKEN}'}

# Listar pasta raiz
print('PASTA RAIZ DO BOX:')
print('=' * 60)

url = 'https://api.box.com/2.0/folders/0/items?limit=1000'
response = requests.get(url, headers=headers)

if response.status_code == 200:
    itens = response.json()['entries']
    for item in itens:
        tipo = '📁' if item['type'] == 'folder' else '📄'
        print(f'{tipo} {item["name"]} (ID: {item["id"]})')
else:
    print(f'Erro: {response.status_code}')
