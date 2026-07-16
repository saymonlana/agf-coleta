import fiona

gdb = 'C:/AGF_Coleta/Inventario_Florestal/Inventario_Florestal_GDB/Inventario_Florestal.gdb'

# Verificar dados das camadas principais
layers_to_check = ['Parcela_Arboreo', 'Parcela_Arbustivo_CR', 'Censo', 'Caracterizacao_CR', 'Floristica_Caminhamento_CR']

for layer_name in layers_to_check:
    with fiona.open(gdb, layer=layer_name) as src:
        print(f'\n=== {layer_name} ({len(src)} registros) ===')
        for i, feature in enumerate(src):
            if i >= 3:  # Mostrar só 3 exemplos
                print(f'  ... mais {len(src) - 3} registros')
                break
            props = feature['properties']
            geom = feature['geometry']
            print(f'  Registro {i+1}:')
            print(f'    Geometria: {geom["type"] if geom else "N/A"}')
            for k, v in list(props.items())[:8]:
                print(f'    {k}: {v}')
            print()
