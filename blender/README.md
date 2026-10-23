# Pipeline de Modelado 3D en Blender (Maglev Simulation)

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
