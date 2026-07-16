import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'teXdxJAmqHRlCthPYbqqo9W8YHg1iLWt'
headers = {'Authorization': f'Bearer {TOKEN}'}

def listar_pasta(pasta_id, nivel=0):
    """Listar arquivos e pastas"""
    url = f'https://api.box.com/2.0/folders/{pasta_id}/items?limit=1000'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        itens = response.json()['entries']
        for item in itens:
            tipo = 'PASTA' if item['type'] == 'folder' else 'ARQUIVO'
            indent = '  ' * nivel
            print(f'{indent}{tipo}: {item["name"]} (ID: {item["id"]})')
            
            if item['type'] == 'folder':
                listar_pasta(item['id'], nivel + 1)
        return itens
    else:
        print(f'Erro: {response.status_code} - {response.text[:200]}')
        return []

# Pasta do report
PASTA_ID = '390407109580'

print('Conectando ao Box...')
print('=' * 60)
print()

# Primeiro, ver info da pasta
url_pasta = f'https://api.box.com/2.0/folders/{PASTA_ID}'
resp_pasta = requests.get(url_pasta, headers=headers)

if resp_pasta.status_code == 200:
    pasta = resp_pasta.json()
    print(f'PASTA RAIZ: {pasta["name"]}')
    print(f'ID: {pasta["id"]}')
    print()
    print('CONTEUDO:')
    print('-' * 60)
    listar_pasta(PASTA_ID)
else:
    print(f'Erro ao acessar pasta: {resp_pasta.status_code}')
    print(resp_pasta.text[:200])
