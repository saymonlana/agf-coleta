"""
Listar conteudo da pasta 399502324229
"""
import requests
import sys

sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'KQIejvs1X0egEnylO7sNt1bD1wdcsc3v'
headers = {'Authorization': f'Bearer {TOKEN}'}

# Listar pasta 399502324229
url = 'https://api.box.com/2.0/folders/399502324229/items?limit=1000'
resp = requests.get(url, headers=headers)

if resp.status_code == 200:
    itens = resp.json()['entries']
    print(f'Pasta 399502324229: {len(itens)} itens')
    print()
    
    # Separar por tipo
    pastas = [i for i in itens if i['type'] == 'folder']
    arquivos = [i for i in itens if i['type'] == 'file']
    
    print(f'Pastas: {len(pastas)}')
    for p in pastas:
        print(f'  📁 {p["name"]} (ID: {p["id"]})')
    
    print()
    print(f'Arquivos: {len(arquivos)}')
    
    # Agrupar por extensao
    extensoes = {}
    for a in arquivos:
        ext = a['name'].split('.')[-1] if '.' in a['name'] else 'sem_ext'
        if ext not in extensoes:
            extensoes[ext] = []
        extensoes[ext].append(a['name'])
    
    for ext, nomes in sorted(extensoes.items()):
        print(f'  .{ext}: {len(nomes)} arquivos')
else:
    print(f'Erro: {resp.status_code}')
