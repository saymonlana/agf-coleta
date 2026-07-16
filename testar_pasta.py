import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

CLIENT_ID = 'zrwn71x250kre6dgmyob6o3dr1903jys'
CLIENT_SECRET = 'IaMJywu1K9P7pZtIiN5YFhE5hjNG29M5'

# Tentar client credentials
url = 'https://api.box.com/oauth2/token'
data = {
    'grant_type': 'client_credentials',
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET
}

response = requests.post(url, data=data)
print(f'Client Credentials: {response.status_code}')
print(json.dumps(response.json(), indent=2))

# Tentar com pasta especifica
if response.status_code == 200:
    token = response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Listar pasta 399502324229
    url_pasta = f'https://api.box.com/2.0/folders/399502324229/items?limit=100'
    resp = requests.get(url_pasta, headers=headers)
    print(f'\nListar pasta: {resp.status_code}')
    if resp.status_code == 200:
        itens = resp.json()['entries']
        for item in itens:
            print(f'  {item["type"]}: {item["name"]} (ID: {item["id"]})')
