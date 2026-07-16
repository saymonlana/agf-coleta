"""
Testar autenticacao Box com detalhes de erro
"""
import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

CLIENT_ID = 'zrwn71x250kre6dgmyob6o3dr1903jys'
CLIENT_SECRET = 'IaMJywu1K9P7pZtIiN5YFhE5hjNG29M5'

url = 'https://api.box.com/oauth2/token'
data = {
    'grant_type': 'client_credentials',
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET
}

print('Testando autenticacao Box...')
print(f'URL: {url}')
print(f'Client ID: {CLIENT_ID}')

response = requests.post(url, data=data)

print(f'Status: {response.status_code}')
print(f'Resposta: {response.text}')
