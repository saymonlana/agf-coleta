import requests
import sys
sys.stdout.reconfigure(encoding='utf-8')

TOKEN = '2eKET34NFIwWUMDVJ2wRjGe0NvBTry66'
FOLDER_ID = '400201285976'

headers = {'Authorization': f'Bearer {TOKEN}'}

# Primeiro ver o que tem na pasta
resp = requests.get(f'https://api.box.com/2.0/folders/{FOLDER_ID}/items?fields=name,id,type,size', headers=headers)
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Total itens: {len(data.get('entries', []))}")

for item in data.get('entries', []):
    tipo = item['type']
    nome = item['name']
    item_id = item['id']
    if tipo == 'folder':
        print(f"  [PASTA] {nome} [ID: {item_id}]")
        
        # Listar dentro da subpasta
        resp2 = requests.get(f'https://api.box.com/2.0/folders/{item_id}/items?fields=name,id,type,size', headers=headers)
        for sub in resp2.json().get('entries', []):
            if sub['type'] == 'folder':
                print(f"      [PASTA] {sub['name']}")
            else:
                tam = sub.get('size', 0)
                print(f"      [ARQ] {sub['name']} ({tam} bytes)")
    else:
        tam = item.get('size', 0)
        print(f"  [ARQ] {nome} ({tam} bytes)")
