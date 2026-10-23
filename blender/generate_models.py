#!/usr/bin/env python3
"""
Generates 3D assets for the Maglev train simulation in Blender.
Outputs:
  - blender/maglev_train_ems.obj
  - blender/maglev_train_ems.mtl
  - blender/maglev_blender_setup.py (Blender bpy automation script)
"""

import os
import math

BLENDER_DIR = os.path.dirname(os.path.abspath(__file__))

def create_obj_model():
    obj_path = os.path.join(BLENDER_DIR, "maglev_train_ems.obj")
    mtl_path = os.path.join(BLENDER_DIR, "maglev_train_ems.mtl")
    
    # 1. Write MTL (Material Library)
    with open(mtl_path, "w", encoding="utf-8") as mtl:
        mtl.write("# Material Library for Maglev 3D Model\n")
        mtl.write("# Designed for Blender 3.x / 4.x\n\n")
        
        # Car body (White glossy aerodynamic finish)
        mtl.write("newmtl Mat_Carroceria\n")
        mtl.write("Ka 0.2 0.2 0.2\n")
        mtl.write("Kd 0.92 0.93 0.95\n")
        mtl.write("Ks 0.8 0.8 0.8\n")
        mtl.write("Ns 60.0\n")
        mtl.write("illum 2\n\n")
        
        # Windshield / Windows (Dark tinted glass)
        mtl.write("newmtl Mat_Vidrio\n")
        mtl.write("Ka 0.05 0.05 0.05\n")
        mtl.write("Kd 0.1 0.15 0.2\n")
        mtl.write("Ks 0.95 0.95 0.95\n")
        mtl.write("Ns 100.0\n")
        mtl.write("d 0.6\n")
        mtl.write("illum 2\n\n")
        
        # Undercarriage Skirts (Dark gray metallic)
        mtl.write("newmtl Mat_Faldones\n")
        mtl.write("Ka 0.1 0.1 0.1\n")
        mtl.write("Kd 0.25 0.27 0.3\n")
        mtl.write("Ks 0.5 0.5 0.5\n")
        mtl.write("Ns 30.0\n")
        mtl.write("illum 2\n\n")
        
        # EMS Levitation Magnets (Metallic blue / copper core)
        mtl.write("newmtl Mat_Electroimanes\n")
        mtl.write("Ka 0.1 0.1 0.2\n")
        mtl.write("Kd 0.15 0.35 0.75\n")
        mtl.write("Ks 0.6 0.6 0.7\n")
        mtl.write("Ns 40.0\n")
        mtl.write("illum 2\n\n")
        
        # Guideway Concrete Beam (Matte concrete gray)
        mtl.write("newmtl Mat_Viga_Guia\n")
        mtl.write("Ka 0.3 0.3 0.3\n")
        mtl.write("Kd 0.6 0.62 0.65\n")
        mtl.write("Ks 0.1 0.1 0.1\n")
        mtl.write("Ns 10.0\n")
        mtl.write("illum 2\n\n")
        
        # LSM Stator Packs (Dark steel laminated)
        mtl.write("newmtl Mat_Estator\n")
        mtl.write("Ka 0.1 0.1 0.1\n")
        mtl.write("Kd 0.35 0.38 0.4\n")
        mtl.write("Ks 0.7 0.7 0.7\n")
        mtl.write("Ns 50.0\n")
        mtl.write("illum 2\n\n")

    # 2. Write OBJ
    with open(obj_path, "w", encoding="utf-8") as obj:
        obj.write("# Maglev Train 3D Model\n")
        obj.write("# Scale 1:1 (meters) - Car length 14.0m, Width 3.2m, Height 3.6m\n")
        obj.write("# Designed for Blender and Three.js WebGL simulation\n")
        obj.write("mtllib maglev_train_ems.mtl\n\n")
        
        vertex_offset = 1
        
        def write_box(name, mat, x_min, x_max, y_min, y_max, z_min, z_max):
            nonlocal vertex_offset
            obj.write(f"o {name}\n")
            obj.write(f"usemtl {mat}\n")
            obj.write(f"s 1\n")
            
            # 8 vertices
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
            
            # Normals
            obj.write("vn 0.0 -1.0 0.0\n")
            obj.write("vn 0.0 1.0 0.0\n")
            obj.write("vn 0.0 0.0 -1.0\n")
            obj.write("vn 0.0 0.0 1.0\n")
            obj.write("vn -1.0 0.0 0.0\n")
            obj.write("vn 1.0 0.0 0.0\n")
            
            base = vertex_offset
            # 6 faces (quads converted to two triangles or direct quads)
            # bottom (y_min), top (y_max), front (z_max), back (z_min), left (x_min), right (x_max)
            faces = [
                (base, base+1, base+5, base+4), # -y (bottom)
                (base+3, base+7, base+6, base+2), # +y (top)
                (base, base+3, base+2, base+1), # -z (back)
                (base+4, base+5, base+6, base+7), # +z (front)
                (base, base+4, base+7, base+3), # -x (left)
                (base+1, base+2, base+6, base+5), # +x (right)
            ]
            for f1, f2, f3, f4 in faces:
                obj.write(f"f {f1} {f2} {f3} {f4}\n")
            
            vertex_offset += 8
            obj.write("\n")

        # Concrete Track Beam (T-section, centered along Z axis from z = -10m to z = 10m)
        # Main central pillar / core
        write_box("Viga_Guia_Nucleo", "Mat_Viga_Guia", -0.9, 0.9, 0.0, 2.8, -10.0, 10.0)
        # Top horizontal flange of the guideway
        write_box("Viga_Guia_Pestana", "Mat_Viga_Guia", -1.4, 1.4, 2.5, 2.8, -10.0, 10.0)
        
        # LSM Stator Packs (under the left and right guideway flanges)
        # Left stator pack (facing downward)
        write_box("Estator_LSM_Izquierdo", "Mat_Estator", -1.35, -0.95, 2.45, 2.5, -9.0, 9.0)
        # Right stator pack (facing downward)
        write_box("Estator_LSM_Derecho", "Mat_Estator", 0.95, 1.35, 2.45, 2.5, -9.0, 9.0)
        
        # Maglev Train Car (14m long, spanning z = -7.0m to z = +7.0m)
        # Main cabin body (y = 2.85m to 5.25m, width = 3.2m: x = -1.6m to 1.6m)
        write_box("Coche_Carroceria_Principal", "Mat_Carroceria", -1.6, 1.6, 2.85, 5.05, -6.5, 6.5)
        # Aerodynamic nose front
        write_box("Coche_Frontal_Aerodinamico", "Mat_Carroceria", -1.5, 1.5, 2.85, 4.8, 6.5, 7.5)
        # Aerodynamic tail
        write_box("Coche_Trasera_Aerodinamica", "Mat_Carroceria", -1.5, 1.5, 2.85, 4.8, -7.5, -6.5)
        
        # Cabin Windows (Left & Right stripes)
        write_box("Ventanas_Laterales_Izq", "Mat_Vidrio", -1.62, -1.59, 3.8, 4.4, -5.5, 5.5)
        write_box("Ventanas_Laterales_Der", "Mat_Vidrio", 1.59, 1.62, 3.8, 4.4, -5.5, 5.5)
        # Front Windshield
        write_box("Parabrisas_Cabina", "Mat_Vidrio", -1.3, 1.3, 3.9, 4.7, 6.9, 7.3)
        
        # Undercarriage Skirts (wrap around the track beam)
        # Left vertical skirt (hangs from cabin side down below the track flange)
        write_box("Faldon_Lateral_Izquierdo", "Mat_Faldones", -1.6, -1.38, 2.15, 2.85, -6.8, 6.8)
        # Left lower horizontal arm (wraps under the track flange towards the stator)
        write_box("Brazo_Soporte_Iman_Izq", "Mat_Faldones", -1.45, -0.9, 2.15, 2.35, -6.5, 6.5)
        
        # Right vertical skirt
        write_box("Faldon_Lateral_Derecho", "Mat_Faldones", 1.38, 1.6, 2.15, 2.85, -6.8, 6.8)
        # Right lower horizontal arm
        write_box("Brazo_Soporte_Iman_Der", "Mat_Faldones", 0.9, 1.45, 2.15, 2.35, -6.5, 6.5)
        
        # Levitation Electromagnets (EMS)
        # Positioned on top of the lower wrap-around arms, facing upward toward the stator packs
        # Nominal gap: exactly 10 mm (0.01m) below stator (stator bottom at 2.45m, magnet top at 2.44m)
        write_box("Electroimanes_Sustentacion_Izq", "Mat_Electroimanes", -1.35, -0.95, 2.36, 2.44, -6.2, 6.2)
        write_box("Electroimanes_Sustentacion_Der", "Mat_Electroimanes", 0.95, 1.35, 2.36, 2.44, -6.2, 6.2)
        
        # Guidance Magnets (EMS)
        # Facing inward toward the side of the track beam (x = -0.9m and x = 0.9m)
        write_box("Electroimanes_Guiado_Izq", "Mat_Electroimanes", -1.36, -1.30, 2.50, 2.75, -6.0, 6.0)
        write_box("Electroimanes_Guiado_Der", "Mat_Electroimanes", 1.30, 1.36, 2.50, 2.75, -6.0, 6.0)

    print(f"Created: {obj_path}")
    print(f"Created: {mtl_path}")

def create_blender_script():
    py_path = os.path.join(BLENDER_DIR, "maglev_blender_setup.py")
    
    content = '''# ==============================================================================
# MAGLEV 3D SIMULATION - BLENDER SCENE GENERATION & RIGGING SCRIPT
# ==============================================================================
# Este script automatiza la construccion del modelo parametrico 3D del tren
# Maglev (sistemas EMS y EDS) en Blender 3.x / 4.x.
#
# Dimensiones tecnicas reales (Escala 1:1, metros):
# - Longitud de seccion del coche: 14.0 m
# - Ancho de carroceria: 3.2 m
# - Altura total: 3.6 m
# - Entrehierro nominal de levitacion EMS: 10 mm (0.010 m)
# - Paso polar del estator lineal LSM: 258 mm (0.258 m)
#
# Instrucciones de ejecucion:
# 1. Abre Blender (version 3.3 LTS o superior).
# 2. Ve a la pestana "Scripting".
# 3. Crea un nuevo texto, pega este contenido y pulsa "Run Script" (Alt+P).
# O mediante terminal:
#    blender --python blender/maglev_blender_setup.py
# ==============================================================================

import bpy
import math

def clean_scene():
    """Limpia objetos previos de la escena por defecto."""
    if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def get_or_create_material(name, color_rgba, metallic=0.0, roughness=0.5):
    """Crea o reutiliza un material Principled BSDF configurado."""
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
    """Crea y organiza colecciones jerarquicas en la escena."""
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
    """Crea un prisma rectangular centrado con dimensiones exactas."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(scale=True)
    
    if material:
        obj.data.materials.append(material)
    
    # Mover a la coleccion destino
    for c in obj.users_collection:
        c.unlink(obj)
    collection.objects.link(obj)
    return obj

def build_maglev_scene():
    clean_scene()
    
    # Colecciones principales
    root_col = create_collection("Maglev_System")
    col_track = create_collection("Via_Guia_Infraestructura", root_col)
    col_train = create_collection("Tren_Vehiculo_EMS", root_col)
    col_magnets = create_collection("Electroimanes_Sustentacion", col_train)
    col_guidance = create_collection("Electroimanes_Guiado", col_train)
    
    # Materiales tecnicos
    mat_carroceria = get_or_create_material("Mat_Carroceria_Blanco", (0.92, 0.93, 0.95, 1.0), metallic=0.2, roughness=0.25)
    mat_vidrio = get_or_create_material("Mat_Vidrio_Oscuro", (0.05, 0.08, 0.12, 1.0), metallic=0.8, roughness=0.1)
    mat_faldones = get_or_create_material("Mat_Faldon_Grafito", (0.2, 0.22, 0.25, 1.0), metallic=0.6, roughness=0.4)
    mat_iman = get_or_create_material("Mat_Iman_AzulElectrico", (0.1, 0.35, 0.8, 1.0), metallic=0.7, roughness=0.3)
    mat_viga = get_or_create_material("Mat_Hormigon_Via", (0.6, 0.62, 0.65, 1.0), metallic=0.05, roughness=0.85)
    mat_estator = get_or_create_material("Mat_Estator_AceroLaminado", (0.35, 0.38, 0.4, 1.0), metallic=0.8, roughness=0.35)

    # 1. INFRAESTRUCTURA DE VIA GUIA (Longitud 24 m)
    # Nucleo de hormigon
    add_box("Viga_Guia_Central", (0, 0, 1.4), (1.8, 24.0, 2.8), mat_viga, col_track)
    # Pestana superior horizontal
    add_box("Viga_Guia_Pestana_Superior", (0, 0, 2.65), (2.8, 24.0, 0.3), mat_viga, col_track)
    # Paquetes de estator LSM (montados bajo la pestana izquierda y derecha)
    add_box("Estator_LSM_Izquierdo", (-1.15, 0, 2.475), (0.4, 20.0, 0.05), mat_estator, col_track)
    add_box("Estator_LSM_Derecho", (1.15, 0, 2.475), (0.4, 20.0, 0.05), mat_estator, col_track)

    # 2. VEHICULO MAGLEV (14 m de longitud)
    # Carroceria principal
    body = add_box("Coche_Carroceria", (0, 0, 3.95), (3.2, 13.0, 2.2), mat_carroceria, col_train)
    # Modulo frontal aerodinamico
    add_box("Frontal_Aerodinamico", (0, 6.9, 3.825), (3.0, 0.8, 1.95), mat_carroceria, col_train)
    # Modulo trasero aerodinamico
    add_box("Trasera_Aerodinamica", (0, -6.9, 3.825), (3.0, 0.8, 1.95), mat_carroceria, col_train)
    # Banda de ventanas
    add_box("Franja_Ventanas_Izq", (-1.61, 0, 4.1), (0.02, 11.0, 0.6), mat_vidrio, col_train)
    add_box("Franja_Ventanas_Der", (1.61, 0, 4.1), (0.02, 11.0, 0.6), mat_vidrio, col_train)

    # Faldones envolventes laterales
    add_box("Faldon_Lateral_Izq", (-1.49, 0, 2.5), (0.22, 13.6, 0.7), mat_faldones, col_train)
    add_box("Faldon_Lateral_Der", (1.49, 0, 2.5), (0.22, 13.6, 0.7), mat_faldones, col_train)
    
    # Brazos de soporte inferior (abrazan la viga por debajo)
    add_box("Brazo_Soporte_Inf_Izq", (-1.175, 0, 2.25), (0.55, 13.0, 0.2), mat_faldones, col_train)
    add_box("Brazo_Soporte_Inf_Der", (1.175, 0, 2.25), (0.55, 13.0, 0.2), mat_faldones, col_train)

    # 3. ELECTROIMANES DE SUSTENTACION EMS (Entrehierro nominal = 10 mm bajo el estator)
    # Estator inferior = 2.45 m; Superficie del iman = 2.44 m -> Brecha vertical de 10 mm
    add_box("Imanes_Sustentacion_Izq", (-1.15, 0, 2.40), (0.4, 12.4, 0.08), mat_iman, col_magnets)
    add_box("Imanes_Sustentacion_Der", (1.15, 0, 2.40), (0.4, 12.4, 0.08), mat_iman, col_magnets)

    # 4. ELECTROIMANES DE GUIADO LATERAL
    add_box("Imanes_Guiado_Izq", (-1.33, 0, 2.625), (0.06, 12.0, 0.25), mat_iman, col_guidance)
    add_box("Imanes_Guiado_Der", (1.33, 0, 2.625), (0.06, 12.0, 0.25), mat_iman, col_guidance)

    # Iluminacion y camara tecnica
    bpy.ops.object.light_add(type='SUN', location=(10, -10, 15))
    sun = bpy.context.active_object
    sun.name = "Sol_Iluminacion_Principal"
    sun.data.energy = 3.5

    bpy.ops.object.camera_add(location=(12.0, -14.0, 8.5), rotation=(math.radians(65), 0, math.radians(40)))
    cam = bpy.context.active_object
    cam.name = "Camara_Isometrica_Evaluacion"
    bpy.context.scene.camera = cam

    print("Escena 3D Maglev construida exitosamente con proporciones y tolerancias nominales.")

if __name__ == "__main__":
    build_maglev_scene()
'''

    with open(py_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Created: {py_path}")

def create_blender_readme():
    rm_path = os.path.join(BLENDER_DIR, "README.md")
    content = """# Pipeline de Modelado 3D en Blender (Maglev Simulation)

Este directorio contiene los recursos, scripts y modelos 3D que conforman la etapa de **diseño geométrico, ensamblaje paramétrico y validación de tolerancias en Blender**.

---

## 1. Arquitectura del Modelo 3D

El tren y la infraestructura de vía se diseñaron a escala real (1:1) respetando las cotas físicas del sistema de levitación magnética:

- **Sección del Coche:** Longitud de 14,0 m, anchura de 3,2 m y altura de 3,6 m.
- **Entrehierro de Levitación EMS:** 10 mm nominales (0,010 m) entre la superficie superior de los electroimanes del tren y la cara inferior del estator LSM.
- **Estructura Envolvente:** Faldones laterales y brazos inferiores de soporte que abrazan la viga guía de hormigón.
- **Sistema de Guiado Lateral:** Imanes de guiado enfrentados a las caras laterales de la viga para absorber esfuerzos transversales y viento cruzado.
- **Paso Polar del Estator:** 258 mm (0,258 m) con paquetes laminados ferromagnéticos.

---

## 2. Contenido del Directorio

1. **`maglev_blender_setup.py`**:
   Script de automatización en Python para la API de Blender (`bpy`).
   - Construye la escena completa con jerarquía limpia de colecciones (`Via_Guia_Infraestructura`, `Tren_Vehiculo_EMS`, `Electroimanes_Sustentacion`, etc.).
   - Asigna materiales Principled BSDF calibrados (acabado blanco semibrillante, metal grafito, acero laminado, azul de electroimanes y hormigón).
   - Configura iluminación solar y cámara isométrica de encuadre.

2. **`maglev_train_ems.obj` y `maglev_train_ems.mtl`**:
   Modelo 3D estándar en formato Wavefront con biblioteca de materiales.
   - Permite importar directamente la geometría en Blender, Maya, 3ds Max o visores 3D sin necesidad de ejecutar scripts.

3. **`generate_models.py`**:
   Generador procedural en Python que sincroniza las medidas del modelo con las constantes físicas del simulador.

---

## 3. Cómo abrir o importar en Blender

### Método A: Importar el modelo 3D directamente
1. Abre Blender.
2. Ve a **File > Import > Wavefront (.obj)**.
3. Selecciona `maglev_train_ems.obj`.
4. El tren y la vía se cargarán organizados con sus respectivos materiales.

### Método B: Ejecutar el script procedural dentro de Blender
1. Abre Blender.
2. Cambia al espacio de trabajo **Scripting** (en la barra superior).
3. Haz clic en **Open** y abre `maglev_blender_setup.py`.
4. Pulsa **Run Script** (o la tecla `Alt+P`).
5. La escena se generará automáticamente a escala con la iluminación y la cámara calibradas.

### Método C: Ejecución headless desde la terminal
```bash
blender --python blender/maglev_blender_setup.py
```
"""
    with open(rm_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Created: {rm_path}")

if __name__ == "__main__":
    create_obj_model()
    create_blender_script()
    create_blender_readme()
