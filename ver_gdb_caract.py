import fiona
import sys
sys.stdout.reconfigure(encoding='utf-8')

gdb = 'C:/AGF_Coleta/Inventario_Florestal/Inventario_Florestal_GDB/Inventario_Florestal.gdb'

# Verificar schema das camadas de caracterização
for layer_name in ['Caracterizacao_FESD', 'Caracterizacao_Cerrado', 'Caracterizacao_CR', 'Floristica_Caminhamento_CR']:
    print(f"\n=== {layer_name} ===")
    with fiona.open(gdb, layer=layer_name) as src:
        schema = src.schema
        print(f"Geometry: {schema.get('geometry')}")
        print("Campos:")
        for field_name, field_type in schema['properties'].items():
            print(f"  {field_name}: {field_type}")
