import json
d = json.load(open('dados/Questionario_PAEBM_SAG.json', encoding='utf-8'))
print(f'Total: {d["total_registros"]} registros')
props = d['features'][0]['properties']
print(f'Campos: {list(props.keys())}')
print()
print('Exemplo primeiro registro:')
for k, v in list(props.items())[:15]:
    print(f'  {k}: {v}')
