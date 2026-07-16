import sys
sys.stdout.reconfigure(encoding='utf-8')

try:
    from osgeo import ogr, osr
    print("GDAL/OGR disponível!")
    
    gdb = 'C:/AGF_Coleta/Inventario_Florestal/Inventario_Florestal_GDB/Inventario_Florestal.gdb'
    
    # Abrir com OGR
    drv = ogr.GetDriverByName('GPKG')
    ds = ogr.Open(gdb)
    
    if ds is None:
        # Tentar como FileGDB
        ds = ogr.Open(gdb)
    
    if ds:
        print(f"Layers: {ds.GetLayerCount()}")
        for i in range(ds.GetLayerCount()):
            layer = ds.GetLayerByIndex(i)
            print(f"\n=== {layer.GetName()} ===")
            
            layerDefn = layer.GetLayerDefn()
            for j in range(layerDefn.GetFieldCount()):
                fieldDefn = layerDefn.GetFieldDefn(j)
                name = fieldDefn.GetName()
                alias = fieldDefn.GetAlternativeName()
                typeCode = fieldDefn.GetType()
                width = fieldDefn.GetWidth()
                precision = fieldDefn.GetPrecision()
                
                print(f"  {name}:")
                print(f"    Alias: '{alias}'")
                print(f"    Tipo: {typeCode}, Largura: {width}")
    else:
        print("Não conseguiu abrir o GDB")
        
except ImportError:
    print("GDAL não instalado")
except Exception as e:
    print(f"Erro: {e}")
