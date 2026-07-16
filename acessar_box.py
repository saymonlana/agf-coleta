import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Credenciais do Box
CLIENT_ID = 'zrwn71x250kre6dgmyob6o3dr1903jys'
CLIENT_SECRET = 'IaMJywu1K9P7pZtIiN5YFhE5hjNG29M5'

# Tentar com Enterprise ID (precisa descobrir)
# Primeiro, vamos tentar listar a pasta usando o Developer Token

def listar_pasta_com_token(token, pasta_id):
    """Listar arquivos e pastas usando token"""
    url = f'https://api.box.com/2.0/folders/{pasta_id}'
    headers = {'Authorization': f'Bearer {token}'}
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f'Pasta: {data["name"]}')
        print(f'ID: {data["id"]}')
        print()
        
        # Listar itens
        url_items = f'https://api.box.com/2.0/folders/{pasta_id}/items?limit=1000'
        response_items = requests.get(url_items, headers=headers)
        
        if response_items.status_code == 200:
            itens = response_items.json()['entries']
            print(f'Total de itens: {len(itens)}')
            print()
            
            for item in itens:
                tipo = '📁' if item['type'] == 'folder' else '📄'
                tamanho = item.get('size', 'N/A')
                print(f'{tipo} {item["name"]} (ID: {item["id"]}, Tamanho: {tamanho})')
                
                # Se for pasta .gdb, listar conteúdo
                if item['type'] == 'folder' and '.gdb' in item['name'].lower():
                    print(f'   Conteúdo da geodatabase:')
                    url_conteudo = f'https://api.box.com/2.0/folders/{item["id"]}/items?limit=1000'
                    resp_conteudo = requests.get(url_conteudo, headers=headers)
                    if resp_conteudo.status_code == 200:
                        for sub in resp_conteudo.json()['entries']:
                            print(f'      - {sub["name"]}')
        
        return data
    else:
        print(f'Erro: {response.status_code}')
        print(response.text)
        return None

# Pasta do report
PASTA_ID = '390407109580'

# Solicitar Developer Token ao usuario
print('=' * 60)
print('PRECISO DO DEVELOPER TOKEN')
print('=' * 60)
print()
print('Para acessar o Box, preciso do Developer Token.')
print()
print('Como obter:')
print('1. Acesse: https://app.box.com/developers/console')
print('2. Abra o app "PAEBM Sync"')
print('3. Vá na aba "Configuration"')
print('4. Role até "Developer Token"')
print('5. Clique em "Generate Developer Token"')
print('6. Copie o token')
print()
token = input('Cole o Developer Token aqui: ').strip()

if token:
    print()
    print('Conectando ao Box...')
    print('=' * 60)
    listar_pasta_com_token(token, PASTA_ID)
