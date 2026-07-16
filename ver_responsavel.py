import fiona
import sys
sys.stdout.reconfigure(encoding='utf-8')

gdb = 'C:/AGF_Coleta/Inventario_Florestal/Inventario_Florestal_GDB/Inventario_Florestal.gdb'

layers = ['Censo', 'Parcela_Arboreo', 'Parcela_Arbustivo', 'Parcela_Herbaceo', 
          'Parcela_Arbustivo_CR', 'Parcela_Herbaceo_CR', 
          'Caracterizacao_FESD', 'Caracterizacao_Cerrado', 'Caracterizacao_CR', 
          'Floristica_Caminhamento_CR']

for layer_name in layers:
    try:
        with fiona.open(gdb, layer=layer_name) as src:
            campos = list(src.schema['properties'].keys())
            tem_responsavel = 'RESPONSAVEL_DE_CAMPO' in campos
            print(f"{layer_name}: {'✅ TEM' if tem_responsavel else '❌ NÃO TEM'} campo RESPONSAVEL_DE_CAMPO")
    except Exception as e:
        print(f"{layer_name}: Erro - {e}")
