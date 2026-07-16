import requests
import sys
sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'k6KcGHqPBuPnn8IDxsRY5hMnEnGqu8IV'
FOLDER_ID = '400201285976'

headers = {
    'Authorization': f'Bearer {TOKEN}'
}

def listar_pasta(folder_id, indent=0):
    url = f'https://api.box.com/2.0/folders/{folder_id}/items?fields=name,id,type,size'
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        items = resp.json().get('entries', [])
        for item in items:
            espaco = '  ' * indent
            if item['type'] == 'folder':
                print(f"{espaco}[PASTA] {item['name']} [ID: {item['id']}]")
                listar_pasta(item['id'], indent + 1)
            else:
                tamanho = item.get('size', 0)
                if tamanho > 1024*1024:
                    tam_str = f"{tamanho/(1024*1024):.1f} MB"
                elif tamanho > 1024:
                    tam_str = f"{tamanho/1024:.1f} KB"
                else:
                    tam_str = f"{tamanho} B"
                print(f"{espaco}[ARQ] {item['name']} ({tam_str}) [ID: {item['id']}]")
    else:
        print(f"Erro: {resp.status_code} - {resp.text}")

print("=== Conteudo da pasta ===\n")
listar_pasta(FOLDER_ID)
