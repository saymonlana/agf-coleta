import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Credenciais do Box
CLIENT_ID = 'zrwn71x250kre6dgmyob6o3dr1903jys'
CLIENT_SECRET = 'IaMJywu1K9P7pZtIiN5YFhE5hjNG29M5'

def autenticar_box():
    """Autenticar no Box e obter access token"""
    url = 'https://api.box.com/oauth2/token'
    data = {
        'grant_type': 'client_credentials',
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }
    
    response = requests.post(url, data=data)
    
    if response.status_code == 200:
        return response.json()['access_token']
    else:
        print(f'Erro na autenticacao: {response.status_code}')
        print(response.text)
        return None

def listar_pasta(token, pasta_id='0'):
    """Listar arquivos e pastas"""
    url = f'https://api.box.com/2.0/folders/{pasta_id}/items'
    headers = {'Authorization': f'Bearer {token}'}
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return response.json()['entries']
    else:
        print(f'Erro ao listar pasta: {response.status_code}')
        return []

def buscar_gdb(token, pasta_id='0', caminho=''):
    """Buscar arquivos .gdb recursivamente"""
    itens = listar_pasta(token, pasta_id)
    
    for item in itens:
        nome = item['name']
        item_id = item['id']
        tipo = item['type']
        
        if tipo == 'folder':
            if '.gdb' in nome.lower():
                print(f'  [ENCONTRADO] {caminho}/{nome}')
                # Listar itens dentro da .gdb
                sub_itens = listar_pasta(token, item_id)
                for sub in sub_itens:
                    print(f'    - {sub["name"]}')
            else:
                buscar_gdb(token, item_id, f'{caminho}/{nome}')
        elif tipo == 'file':
            if '.gdb' in nome.lower() or '.gpkg' in nome.lower():
                print(f'  [ARQUIVO] {caminho}/{nome} (ID: {item_id})')

# Executar
print('Conectando ao Box...')
token = autenticar_box()

if token:
    print('Autenticado com sucesso!')
    print()
    print('Buscando geodatabases...')
    print('=' * 50)
    buscar_gdb(token)
else:
    print('Falha na autenticacao')
