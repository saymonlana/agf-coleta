import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'teXdxJAmqHRlCthPYbqqo9W8YHg1iLWt'
headers = {'Authorization': f'Bearer {TOKEN}'}

# Verificar pasta Questionarios
print('Verificando pasta "Questionários"...')
print('=' * 60)

url = 'https://api.box.com/2.0/folders/382488025943/items?limit=1000'
response = requests.get(url, headers=headers)

if response.status_code == 200:
    itens = response.json()['entries']
    for item in itens:
        if item['type'] == 'folder' and 'uestion' in item['name']:
            print(f'\n📁 {item["name"]} (ID: {item["id"]})')
            
            # Listar conteudo
            url2 = f'https://api.box.com/2.0/folders/{item["id"]}/items?limit=1000'
            response2 = requests.get(url2, headers=headers)
            
            if response2.status_code == 200:
                itens2 = response2.json()['entries']
                for item2 in itens2:
                    tipo = '📁' if item2['type'] == 'folder' else '📄'
                    print(f'  {tipo} {item2["name"]} (ID: {item2["id"]})')
                    
                    # Se for pasta, verificar se tem .gdb
                    if item2['type'] == 'folder':
                        url3 = f'https://api.box.com/2.0/folders/{item2["id"]}/items?limit=1000'
                        response3 = requests.get(url3, headers=headers)
                        if response3.status_code == 200:
                            for item3 in response3.json()['entries']:
                                print(f'    📄 {item3["name"]}')
