import json
c = json.load(open('dados/config.json', encoding='utf-8'))
print('Projeto:', c['projeto']['nome'])
print('Camadas coleta:', list(c['camadas_coleta'].keys()))
print('Camada principal:', c['camada_principal'])
q = c['camadas_coleta']['Questionario_PAEBM_SAG']
print(f'Questionario: {q["total_campos"]} campos')
print()
print('Campos do Questionario:')
for campo in q['campos']:
    print(f'  - {campo["nome"]} ({campo["tipo"]})')
