import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'teXdxJAmqHRlCthPYbqqo9W8YHg1iLWt'
headers = {'Authorization': f'Bearer {TOKEN}'}

# Buscar arquivos .gdb e .gpkg no Box inteiro
print('Buscando geodatabases no Box...')
print('=' * 60)

# Usar busca do Box
url = 'https://api.box.com/2.0/search?query=extension:gdb&limit=50'
response = requests.get(url, headers=headers)

if response.status_code == 200:
    resultados = response.json().get('entries', [])
    print(f'Arquivos .gdb encontrados: {len(resultados)}')
    for r in resultados:
        print(f'  - {r["name"]} (ID: {r["id"]})')
else:
    print(f'Erro na busca: {response.status_code}')
    print(response.text[:200])

print()

# Buscar .gpkg
url2 = 'https://api.box.com/2.0/search?query=extension:gpkg&limit=50'
response2 = requests.get(url2, headers=headers)

if response2.status_code == 200:
    resultados2 = response2.json().get('entries', [])
    print(f'Arquivos .gpkg encontrados: {len(resultados2)}')
    for r in resultados2:
        print(f'  - {r["name"]} (ID: {r["id"]})')
else:
    print(f'Erro na busca: {response2.status_code}')

print()

# Buscar arquivos com "tablet" no nome
url3 = 'https://api.box.com/2.0/search?query=tablet&limit=50'
response3 = requests.get(url3, headers=headers)

if response3.status_code == 200:
    resultados3 = response3.json().get('entries', [])
    print(f'Arquivos com "tablet": {len(resultados3)}')
    for r in resultados3:
        print(f'  - {r["name"]} (ID: {r["id"]})')
else:
    print(f'Erro na busca: {response3.status_code}')

print()

# Buscar arquivos com "PAEBM" no nome
url4 = 'https://api.box.com/2.0/search?query=PAEBM&limit=50'
response4 = requests.get(url4, headers=headers)

if response4.status_code == 200:
    resultados4 = response4.json().get('entries', [])
    print(f'Arquivos com "PAEBM": {len(resultados4)}')
    for r in resultados4:
        print(f'  - {r["name"]} (ID: {r["id"]})')
else:
    print(f'Erro na busca: {response4.status_code}')
