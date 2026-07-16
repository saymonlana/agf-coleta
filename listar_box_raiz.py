import requests
import json

TOKEN = input("Cole o Developer Token do Box: ").strip()

headers = {
    'Authorization': f'Bearer {TOKEN}'
}

# Listar itens na raiz
resp = requests.get('https://api.box.com/2.0/folders/0', headers=headers)
if resp.status_code == 200:
    root = resp.json()
    print(f"\n=== Pasta Raiz: {root['name']} ===\n")
    
    resp2 = requests.get(f'https://api.box.com/2.0/folders/0/items?fields=name,id,type,size', headers=headers)
    items = resp2.json().get('entries', [])
    for item in items:
        tipo = '📁' if item['type'] == 'folder' else '📄'
        tamanho = f" ({item.get('size', 0)} bytes)" if item['type'] == 'file' else ''
        print(f"  {tipo} {item['name']} [ID: {item['id']}]{tamanho}")
else:
    print(f"Erro: {resp.status_code} - {resp.text}")
