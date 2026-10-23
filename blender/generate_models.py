#!/usr/bin/env python3
"""
generador de modelos 3d del tren maglev para blender.
salidas:
  - blender/maglev_train_ems.obj
  - blender/maglev_train_ems.mtl
  - blender/maglev_blender_setup.py
"""

import os
import math

BLENDER_DIR = os.path.dirname(os.path.abspath(__file__))

def create_obj_model():
    obj_path = os.path.join(BLENDER_DIR, "maglev_train_ems.obj")
    mtl_path = os.path.join(BLENDER_DIR, "maglev_train_ems.mtl")
    
    # 1. escribe biblioteca de materiales mtl
    with open(mtl_path, "w", encoding="utf-8") as mtl:
        mtl.write("# biblioteca de materiales para blender\n")
        mtl.write("# modelo 3d tren maglev\n\n")
        
        # carroceria (blanco brillante aerodinamico)
        mtl.write("newmtl Mat_Carroceria\n")
        mtl.write("Ka 0.2 0.2 0.2\n")
        mtl.write("Kd 0.92 0.93 0.95\n")
        mtl.write("Ks 0.8 0.8 0.8\n")
        mtl.write("Ns 60.0\n")
        mtl.write("illum 2\n\n")
        
        # parabrisas y ventanas (vidrio oscuro tintado)
        mtl.write("newmtl Mat_Vidrio\n")
        mtl.write("Ka 0.05 0.05 0.05\n")
        mtl.write("Kd 0.1 0.15 0.2\n")
        mtl.write("Ks 0.95 0.95 0.95\n")
        mtl.write("Ns 100.0\n")
        mtl.write("d 0.6\n")
        mtl.write("illum 2\n\n")
        
        # faldones inferiores (metalico gris grafito)
        mtl.write("newmtl Mat_Faldones\n")
        mtl.write("Ka 0.1 0.1 0.1\n")
        mtl.write("Kd 0.25 0.27 0.3\n")
        mtl.write("Ks 0.5 0.5 0.5\n")
        mtl.write("Ns 30.0\n")
        mtl.write("illum 2\n\n")
        
        # electroimanes de sustentacion ems (azul metalizado)
        mtl.write("newmtl Mat_Electroimanes\n")
        mtl.write("Ka 0.1 0.1 0.2\n")
        mtl.write("Kd 0.15 0.35 0.75\n")
        mtl.write("Ks 0.6 0.6 0.7\n")
        mtl.write("Ns 40.0\n")
        mtl.write("illum 2\n\n")
        
        # viga guia de hormigon (gris mate)
        mtl.write("newmtl Mat_Viga_Guia\n")
        mtl.write("Ka 0.3 0.3 0.3\n")
        mtl.write("Kd 0.6 0.62 0.65\n")
        mtl.write("Ks 0.1 0.1 0.1\n")
        mtl.write("Ns 10.0\n")
        mtl.write("illum 2\n\n")
        
        # estator lineal lsm (acero laminado oscuro)
        mtl.write("newmtl Mat_Estator\n")
        mtl.write("Ka 0.1 0.1 0.1\n")
        mtl.write("Kd 0.35 0.38 0.4\n")
        mtl.write("Ks 0.7 0.7 0.7\n")
        mtl.write("Ns 50.0\n")
        mtl.write("illum 2\n\n")

    # 2. escribe archivo obj
    with open(obj_path, "w", encoding="utf-8") as obj:
        obj.write("# modelo 3d del tren maglev\n")
        obj.write("# escala 1:1 (metros) - coche: 14 m, ancho: 3.2 m, altura: 3.6 m\n")
        obj.write("# diseno para blender y visualizacion webgl\n")
        obj.write("mtllib maglev_train_ems.mtl\n\n")
        
        vertex_offset = 1
        
        def write_box(name, mat, x_min, x_max, y_min, y_max, z_min, z_max):
            nonlocal vertex_offset
            obj.write(f"o {name}\n")
            obj.write(f"usemtl {mat}\n")
            obj.write(f"s 1\n")
            
            # 8 vertices del prisma
            v = [
                (x_min, y_min, z_min),
                (x_max, y_min, z_min),
                (x_max, y_max, z_min),
                (x_min, y_max, z_min),
                (x_min, y_min, z_max),
                (x_max, y_min, z_max),
                (x_max, y_max, z_max),
                (x_min, y_max, z_max),
            ]
            for vx, vy, vz in v:
                obj.write(f"v {vx:.4f} {vy:.4f} {vz:.4f}\n")
            
            # normales perpendiculares
            obj.write("vn 0.0 -1.0 0.0\n")
            obj.write("vn 0.0 1.0 0.0\n")
            obj.write("vn 0.0 0.0 -1.0\n")
            obj.write("vn 0.0 0.0 1.0\n")
            obj.write("vn -1.0 0.0 0.0\n")
            obj.write("vn 1.0 0.0 0.0\n")
            
            base = vertex_offset
            # 6 caras rectangulares
            faces = [
                (base, base+1, base+5, base+4), # inferior
                (base+3, base+7, base+6, base+2), # superior
                (base, base+3, base+2, base+1), # trasera
                (base+4, base+5, base+6, base+7), # delantera
                (base, base+4, base+7, base+3), # lateral izquierda
                (base+1, base+2, base+6, base+5), # lateral derecha
            ]
            for f1, f2, f3, f4 in faces:
                obj.write(f"f {f1} {f2} {f3} {f4}\n")
            
            vertex_offset += 8
            obj.write("\n")

        # viga guia de hormigon
        write_box("Viga_Guia_Nucleo", "Mat_Viga_Guia", -0.9, 0.9, 0.0, 2.8, -10.0, 10.0)
        write_box("Viga_Guia_Pestana", "Mat_Viga_Guia", -1.4, 1.4, 2.5, 2.8, -10.0, 10.0)
        
        # paquetes de estator lineal lsm
        write_box("Estator_LSM_Izquierdo", "Mat_Estator", -1.35, -0.95, 2.45, 2.5, -9.0, 9.0)
        write_box("Estator_LSM_Derecho", "Mat_Estator", 0.95, 1.35, 2.45, 2.5, -9.0, 9.0)
        
        # vehiculo maglev (coche de 14 m)
        write_box("Coche_Carroceria_Principal", "Mat_Carroceria", -1.6, 1.6, 2.85, 5.05, -6.5, 6.5)
        write_box("Coche_Frontal_Aerodinamico", "Mat_Carroceria", -1.5, 1.5, 2.85, 4.8, 6.5, 7.5)
        write_box("Coche_Trasera_Aerodinamica", "Mat_Carroceria", -1.5, 1.5, 2.85, 4.8, -7.5, -6.5)
        
        # franjas de ventanas y parabrisas
        write_box("Ventanas_Laterales_Izq", "Mat_Vidrio", -1.62, -1.59, 3.8, 4.4, -5.5, 5.5)
        write_box("Ventanas_Laterales_Der", "Mat_Vidrio", 1.59, 1.62, 3.8, 4.4, -5.5, 5.5)
        write_box("Parabrisas_Cabina", "Mat_Vidrio", -1.3, 1.3, 3.9, 4.7, 6.9, 7.3)
        
        # faldones laterales y brazos envolventes
        write_box("Faldon_Lateral_Izquierdo", "Mat_Faldones", -1.6, -1.38, 2.15, 2.85, -6.8, 6.8)
        write_box("Brazo_Soporte_Iman_Izq", "Mat_Faldones", -1.45, -0.9, 2.15, 2.35, -6.5, 6.5)
        write_box("Faldon_Lateral_Derecho", "Mat_Faldones", 1.38, 1.6, 2.15, 2.85, -6.8, 6.8)
        write_box("Brazo_Soporte_Iman_Der", "Mat_Faldones", 0.9, 1.45, 2.15, 2.35, -6.5, 6.5)
        
        # electroimanes de sustentacion ems (entrehierro nominal de 10 mm bajo estator)
        write_box("Electroimanes_Sustentacion_Izq", "Mat_Electroimanes", -1.35, -0.95, 2.36, 2.44, -6.2, 6.2)
        write_box("Electroimanes_Sustentacion_Der", "Mat_Electroimanes", 0.95, 1.35, 2.36, 2.44, -6.2, 6.2)
        
        # electroimanes de guiado lateral ems
        write_box("Electroimanes_Guiado_Izq", "Mat_Electroimanes", -1.36, -1.30, 2.50, 2.75, -6.0, 6.0)
        write_box("Electroimanes_Guiado_Der", "Mat_Electroimanes", 1.30, 1.36, 2.50, 2.75, -6.0, 6.0)

    print(f"creado: {obj_path}")
    print(f"creado: {mtl_path}")

def create_blender_script():
    py_path = os.path.join(BLENDER_DIR, "maglev_blender_setup.py")
    
    content = '''# script de automatizacion y armado de escena maglev en blender
# medidas reales a escala 1:1 (metros):
# coche: 14 m, ancho: 3.2 m, altura: 3.6 m
# entrehierro nominal ems: 10 mm (0.010 m)
# paso polar estator lsm: 258 mm (0.258 m)

import bpy
import math

def clean_scene():
    # limpia objetos previos de la escena
    if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def get_or_create_material(name, color_rgba, metallic=0.0, roughness=0.5):
    # crea o devuelve un material principled bsdf
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs['Base Color'].default_value = color_rgba
            bsdf.inputs['Metallic'].default_value = metallic
            bsdf.inputs['Roughness'].default_value = roughness
    return mat

def create_collection(name, parent_collection=None):
    # crea colecciones jerarquicas
    if name in bpy.data.collections:
        col = bpy.data.collections[name]
    else:
        col = bpy.data.collections.new(name)
        if parent_collection:
            parent_collection.children.link(col)
        else:
            bpy.context.scene.collection.children.link(col)
    return col

def add_box(name, location, dimensions, material, collection):
    # crea un prisma rectangular con dimensiones exactas
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(scale=True)
    
    if material:
        obj.data.materials.append(material)
    
    for c in obj.users_collection:
        c.unlink(obj)
    collection.objects.link(obj)
    return obj

def build_maglev_scene():
    clean_scene()
    
    # colecciones principales
    root_col = create_collection("Maglev_System")
    col_track = create_collection("Via_Guia_Infraestructura", root_col)
    col_train = create_collection("Tren_Vehiculo_EMS", root_col)
    col_magnets = create_collection("Electroimanes_Sustentacion", col_train)
    col_guidance = create_collection("Electroimanes_Guiado", col_train)
    
    # materiales de la escena
    mat_carroceria = get_or_create_material("Mat_Carroceria_Blanco", (0.92, 0.93, 0.95, 1.0), metallic=0.2, roughness=0.25)
    mat_vidrio = get_or_create_material("Mat_Vidrio_Oscuro", (0.05, 0.08, 0.12, 1.0), metallic=0.8, roughness=0.1)
    mat_faldones = get_or_create_material("Mat_Faldon_Grafito", (0.2, 0.22, 0.25, 1.0), metallic=0.6, roughness=0.4)
    mat_iman = get_or_create_material("Mat_Iman_AzulElectrico", (0.1, 0.35, 0.8, 1.0), metallic=0.7, roughness=0.3)
    mat_viga = get_or_create_material("Mat_Hormigon_Via", (0.6, 0.62, 0.65, 1.0), metallic=0.05, roughness=0.85)
    mat_estator = get_or_create_material("Mat_Estator_AceroLaminado", (0.35, 0.38, 0.4, 1.0), metallic=0.8, roughness=0.35)

    # 1. via guia de hormigon (longitud 24 m)
    add_box("Viga_Guia_Central", (0, 0, 1.4), (1.8, 24.0, 2.8), mat_viga, col_track)
    add_box("Viga_Guia_Pestana_Superior", (0, 0, 2.65), (2.8, 24.0, 0.3), mat_viga, col_track)
    add_box("Estator_LSM_Izquierdo", (-1.15, 0, 2.475), (0.4, 20.0, 0.05), mat_estator, col_track)
    add_box("Estator_LSM_Derecho", (1.15, 0, 2.475), (0.4, 20.0, 0.05), mat_estator, col_track)

    # 2. vehiculo maglev (coche de 14 m)
    body = add_box("Coche_Carroceria", (0, 0, 3.95), (3.2, 13.0, 2.2), mat_carroceria, col_train)
    add_box("Frontal_Aerodinamico", (0, 6.9, 3.825), (3.0, 0.8, 1.95), mat_carroceria, col_train)
    add_box("Trasera_Aerodinamica", (0, -6.9, 3.825), (3.0, 0.8, 1.95), mat_carroceria, col_train)
    add_box("Franja_Ventanas_Izq", (-1.61, 0, 4.1), (0.02, 11.0, 0.6), mat_vidrio, col_train)
    add_box("Franja_Ventanas_Der", (1.61, 0, 4.1), (0.02, 11.0, 0.6), mat_vidrio, col_train)

    # faldones laterales y brazos inferiores
    add_box("Faldon_Lateral_Izq", (-1.49, 0, 2.5), (0.22, 13.6, 0.7), mat_faldones, col_train)
    add_box("Faldon_Lateral_Der", (1.49, 0, 2.5), (0.22, 13.6, 0.7), mat_faldones, col_train)
    add_box("Brazo_Soporte_Inf_Izq", (-1.175, 0, 2.25), (0.55, 13.0, 0.2), mat_faldones, col_train)
    add_box("Brazo_Soporte_Inf_Der", (1.175, 0, 2.25), (0.55, 13.0, 0.2), mat_faldones, col_train)

    # 3. electroimanes de sustentacion ems (entrehierro nominal de 10 mm)
    add_box("Imanes_Sustentacion_Izq", (-1.15, 0, 2.40), (0.4, 12.4, 0.08), mat_iman, col_magnets)
    add_box("Imanes_Sustentacion_Der", (1.15, 0, 2.40), (0.4, 12.4, 0.08), mat_iman, col_magnets)

    # 4. electroimanes de guiado lateral
    add_box("Imanes_Guiado_Izq", (-1.33, 0, 2.625), (0.06, 12.0, 0.25), mat_iman, col_guidance)
    add_box("Imanes_Guiado_Der", (1.33, 0, 2.625), (0.06, 12.0, 0.25), mat_iman, col_guidance)

    # iluminacion y camara
    bpy.ops.object.light_add(type='SUN', location=(10, -10, 15))
    sun = bpy.context.active_object
    sun.name = "Sol_Iluminacion_Principal"
    sun.data.energy = 3.5

    bpy.ops.object.camera_add(location=(12.0, -14.0, 8.5), rotation=(math.radians(65), 0, math.radians(40)))
    cam = bpy.context.active_object
    cam.name = "Camara_Isometrica_Evaluacion"
    bpy.context.scene.camera = cam

if __name__ == "__main__":
    build_maglev_scene()
'''

    with open(py_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"creado: {py_path}")

if __name__ == "__main__":
    create_obj_model()
    create_blender_script()
