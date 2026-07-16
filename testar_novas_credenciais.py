"""
Testar novas credenciais do Box
"""
import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

CLIENT_ID = 'opkrlf3vqj5dj8vwlenqm166'
CLIENT_SECRET = 'RDB4ApBJe172q0aG9msFyavSM4yu31lq'

print('🔑 Testando novas credenciais do Box...')
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
    print(f'✅ Autenticado com sucesso!')
    print(f'Token: {token[:20]}...')
    
    # Testar listar pasta
    headers = {'Authorization': f'Bearer {token}'}
    resp = requests.get('https://api.box.com/2.0/folders/399502324229/items?limit=5', headers=headers)
    print(f'\nListar pasta 399502324229: {resp.status_code}')
    
    if resp.status_code == 200:
        itens = resp.json()['entries']
        print(f'✅ Pasta acessível! {len(itens)} itens (mostrando 5)')
        for item in itens[:5]:
            print(f'  - {item["name"]} ({item["type"]})')
    else:
        print(f'❌ Erro ao acessar pasta: {resp.text}')
else:
    print(f'❌ Erro: {response.text}')
