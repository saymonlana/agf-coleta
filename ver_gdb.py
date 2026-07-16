import fiona

gdb = 'C:/AGF_Coleta/Inventario_Florestal/Inventario_Florestal_GDB/Inventario_Florestal.gdb'
layers = fiona.listlayers(gdb)

for layer_name in layers:
    with fiona.open(gdb, layer=layer_name) as src:
        props = list(src.schema['properties'].keys())
        print(f'=== {layer_name} ({len(src)} registros) ===')
        print(f'  Geometria: {src.schema.get("geometry", "N/A")}')
        print(f'  Campos ({len(props)}): {props}')
        print()
