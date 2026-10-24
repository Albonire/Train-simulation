# script de automatizacion y armado de escena maglev en blender
# medidas reales a escala 1:1 (metros):
# tren: 14 m, ancho: 3.2 m, altura: 3.6 m
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

    # 2. vehiculo maglev (seccion de tren de 14 m)
    body = add_box("Tren_Carroceria", (0, 0, 3.95), (3.2, 13.0, 2.2), mat_carroceria, col_train)
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
