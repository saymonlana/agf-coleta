"""
Testar credenciais corretas do Box
"""
import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

CLIENT_ID = 'opkrlf3vqj5dj8vwlenqm166n6sc9e57'
CLIENT_SECRET = 'PRyfgVC1ZHZOZiC9udt9IHcBw4YlpVus'

print('🔑 Testando credenciais corretas...')
print('=' * 60)

# Testar Client Credentials
url = 'https://api.box.com/oauth2/token'
data = {
    'grant_type': 'client_credentials',
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET
}

response = requests.post(url, data=data)
print(f'Status: {response.status_code}')

if response.status_code == 200:
    token = response.json()['access_token']
    print(f'✅ Client Credentials funcionou!')
    print(f'Token: {token[:30]}...')
    
    # Testar listar pasta
    headers = {'Authorization': f'Bearer {token}'}
    resp = requests.get('https://api.box.com/2.0/folders/399502324229/items?limit=5', headers=headers)
    print(f'\nListar pasta 399502324229: {resp.status_code}')
    
    if resp.status_code == 200:
        itens = resp.json()['entries']
        print(f'✅ Pasta acessivel! {len(itens)} itens')
        for item in itens[:5]:
            print(f'  - {item["name"]} ({item["type"]})')
    else:
        print(f'❌ Erro ao acessar pasta: {resp.text}')
else:
    print(f'❌ Client Credentials falhou: {response.text}')

# Agora testar com o Developer Token
print('\n' + '=' * 60)
print('🔑 Testando Developer Token...')
DEV_TOKEN = 'RDB4ApBJe172q0aG9msFyavSM4yu31lq'
headers = {'Authorization': f'Bearer {DEV_TOKEN}'}

resp = requests.get('https://api.box.com/2.0/users/me', headers=headers)
print(f'Verificar usuario: {resp.status_code}')

if resp.status_code == 200:
    user = resp.json()
    print(f'✅ Developer Token valido!')
    print(f'Usuario: {user.get("name")}')
    
    # Testar listar pasta
    resp = requests.get('https://api.box.com/2.0/folders/399502324229/items?limit=5', headers=headers)
    print(f'\nListar pasta 399502324229: {resp.status_code}')
    
    if resp.status_code == 200:
        itens = resp.json()['entries']
        print(f'✅ Pasta acessivel! {len(itens)} itens')
        for item in itens[:5]:
            print(f'  - {item["name"]} ({item["type"]})')
else:
    print(f'❌ Developer Token invalido: {resp.text}')
