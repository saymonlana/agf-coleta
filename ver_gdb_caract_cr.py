import fiona
import sys
sys.stdout.reconfigure(encoding='utf-8')

gdb = 'C:/AGF_Coleta/Inventario_Florestal/Inventario_Florestal_GDB/Inventario_Florestal.gdb'

with fiona.open(gdb, layer='Caracterizacao_CR') as src:
    schema = src.schema
    print("=== Caracterizacao_CR (GDB) ===")
    print(f"Total de campos: {len(schema['properties'])}")
    for field_name, field_type in schema['properties'].items():
        print(f"  {field_name}: {field_type}")
