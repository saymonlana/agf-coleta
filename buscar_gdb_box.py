import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'teXdxJAmqHRlCthPYbqqo9W8YHg1iLWt'
headers = {'Authorization': f'Bearer {TOKEN}'}

def buscar_gdb(pasta_id, caminho=''):
    """Buscar .gdb recursivamente"""
    url = f'https://api.box.com/2.0/folders/{pasta_id}/items?limit=1000'
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        return []
    
    itens = response.json()['entries']
    encontrados = []
    
    for item in itens:
        nome = item['name']
        item_id = item['id']
        caminho_atual = f'{caminho}/{nome}' if caminho else nome
        
        if item['type'] == 'folder':
            # Verificar se é .gdb ou .gpkg
            if '.gdb' in nome.lower() or '.gpkg' in nome.lower():
                print(f'  [ENCONTRADO] {caminho_atual} (ID: {item_id})')
                encontrados.append({'nome': nome, 'id': item_id, 'caminho': caminho_atual})
            else:
                # Buscar subpasta
                sub = buscar_gdb(item_id, caminho_atual)
                encontrados.extend(sub)
    
    return encontrados

# Buscar a partir da raiz (ID 0)
print('Buscando geodatabases no Box...')
print('=' * 60)
print()

encontrados = buscar_gdb('0')

print()
print(f'Total de .gdb/.gpkg encontrados: {len(encontrados)}')

# Agora acessar a pasta REPORT_13 para ver os detalhes
print()
print('=' * 60)
print('Detalhes do REPORT_13:')
print('=' * 60)

PASTA_REPORT = '390407109580'
url = f'https://api.box.com/2.0/folders/{PASTA_REPORT}/items?limit=1000'
response = requests.get(url, headers=headers)

if response.status_code == 200:
    itens = response.json()['entries']
    for item in itens:
        print(f'  {item["name"]}')
        print(f'    ID: {item["id"]}')
        print(f'    Tamanho: {item.get("size", "N/A")} bytes')
        print(f'    Modificado: {item.get("modified_at", "N/A")}')
        print()
