"""
Testar diferentes metodos de autenticacao Box
"""
import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

CLIENT_ID = 'zrwn71x250kre6dgmyob6o3dr1903jys'
CLIENT_SECRET = 'IaMJywu1K9P7pZtIiN5YFhE5hjNG29M5'

print('Testando metodos de autenticacao Box...')
print('=' * 60)

# 1. Client Credentials (ja testou - falhou)
print('\n1. Client Credentials:')
url = 'https://api.box.com/oauth2/token'
data = {
    'grant_type': 'client_credentials',
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET
}
response = requests.post(url, data=data)
print(f'   Status: {response.status_code}')
print(f'   Resposta: {response.json().get("error", "OK")}')
if 'error' in response.json():
    print(f'   Descricao: {response.json().get("error_description", "")}')

# 2. Authorization Code (precisa de redirect_uri)
print('\n2. Authorization Code (precisa de redirect_uri configurado):')
print('   Precisa configurar no Box Developer Console')
print('   Redirect URI: http://localhost:8080')

# 3. Retornar o erro
print('\n' + '=' * 60)
print('PROBLEMA IDENTIFICADO:')
print('=' * 60)
print('O app Box precisa ter o grant_type "Client Credentials" habilitado.')
print('Para isso, va em:')
print('1. Box Developer Console > Auth > Application Type')
print('2. Selecione "Client Credentials with Client Secret"')
print('3. Ou configure "Authorization Code" com redirect_uri')
print()
print('Alternativa: Use o token de usuario (expira a cada 1h)')
print('Para obter: Box > Account Settings > Developer > Create Token')
