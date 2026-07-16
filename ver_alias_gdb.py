import fiona
import sys
sys.stdout.reconfigure(encoding='utf-8')

gdb = 'C:/AGF_Coleta/Inventario_Florestal/Inventario_Florestal_GDB/Inventario_Florestal.gdb'

# Verificar schema completo de uma camada
with fiona.open(gdb, layer='Censo') as src:
    schema = src.schema
    print("=== Schema completo da camada Censo ===")
    print(f"Geometry: {schema.get('geometry')}")
    print(f"\nProperties:")
    for field_name, field_type in schema['properties'].items():
        print(f"  {field_name}: {field_type}")

# Tentar ver se tem metadados adicionais
print("\n=== Verificando metadados ===")
print(f"Schema keys: {schema.keys()}")
print(f"Schema items: {list(schema.items())[:5]}")
