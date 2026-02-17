# Revisor de Preguntas ISO

Herramienta con interfaz gráfica para detectar y corregir problemas en el banco de preguntas ISO.

## Características

✅ **Detecta códigos malformados**: Identifica preguntas con códigos que no siguen el formato estándar (BC02-L3-Q01 o 3BC7-L11-Q01)

✅ **Encuentra duplicados**: Compara preguntas similares basándose en:
   - Similitud del texto de la pregunta (configurable, por defecto 85%)
   - Igualdad de la respuesta correcta

✅ **Interfaz gráfica intuitiva**: 
   - Vista lado a lado de preguntas similares
   - Selección fácil de qué pregunta mantener
   - Vista previa del resultado antes de guardar
   - Tema oscuro para mayor comodidad

## Instalación

No requiere instalación de dependencias adicionales, solo Python 3.x con tkinter (incluido por defecto).

## Uso

### Opción 1: Doble clic en el archivo batch
```
Ejecutar_Revisor.bat
```

### Opción 2: Desde la línea de comandos
```bash
python revisor_preguntas.py
```

## Flujo de trabajo

1. **Cargar archivo**: Haz clic en "Cargar Archivo" y selecciona `preguntas_ISO.txt`

2. **Revisar estadísticas**: 
   - Total de preguntas cargadas
   - Número de duplicados encontrados
   - Códigos malformados detectados

3. **Revisar duplicados** (Pestaña "Duplicados"):
   - Se muestran grupos de preguntas similares
   - Para cada grupo, selecciona la pregunta que deseas mantener
   - O elimina todas las preguntas del grupo si ninguna es válida
   - Navega con "Anterior" y "Siguiente"

4. **Revisar códigos malformados** (Pestaña "Códigos Malformados"):
   - Lista de preguntas con códigos incorrectos
   - Muestra el formato esperado
   - Indica la línea del archivo donde se encuentra

5. **Generar archivo limpio**:
   - Haz clic en "Generar Archivo Limpio"
   - Revisa la vista previa en la pestaña "Resultado"
   - Confirma y guarda el archivo

## Formato esperado de preguntas

```
BC02-L3-Q01- Pregunta: ¿Texto de la pregunta?
A. Opción A.
B. Opción B.
C. Opción C.
D. Opción D.
ANSWER: A

```

## Criterios de detección

### Códigos malformados
Se consideran inválidos los códigos que no sigan el patrón:
- `[LETRAS/NÚMEROS]-L[NÚMERO]-Q[NÚMERO]`
- Ejemplos válidos: `BC02-L3-Q01`, `3BC7-L11-Q14`
- Ejemplos inválidos: `3BC7-L11-Q14-` (guión extra), `BC02L3Q01` (sin separadores)

### Duplicados
Dos preguntas se consideran duplicadas si:
- La similitud del texto es ≥ 85% (configurable en el código)
- Tienen la misma respuesta correcta

## Personalización

Puedes ajustar el umbral de similitud editando el archivo `revisor_preguntas.py`:

```python
# Línea 137
if p1.es_similar(p2, umbral=0.85):  # Cambia 0.85 por tu umbral deseado
```

Valores recomendados:
- `0.90`: Más estricto, solo preguntas muy similares
- `0.85`: Recomendado, balance entre precisión y recall
- `0.80`: Más permisivo, detecta más posibles duplicados

## Resolución de problemas

### "No se puede ejecutar Python"
- Asegúrate de tener Python instalado: `python --version`
- Descarga desde: https://www.python.org/downloads/

### "No module named 'tkinter'"
- En Windows: Reinstala Python marcando "tcl/tk and IDLE"
- En Linux: `sudo apt-get install python3-tk`

### La ventana se ve muy pequeña/grande
- Edita línea 123: `self.root.geometry("1400x900")` 
- Ajusta los números a tu resolución de pantalla

## Salida

El archivo generado (`preguntas_ISO_limpio.txt`) contendrá:
- ✅ Todas las preguntas únicas (duplicados eliminados según tus decisiones)
- ✅ Mismo formato que el archivo original
- ✅ Listo para usar en el simulador

## Siguiente paso

Después de generar el archivo limpio:
1. Revisa manualmente las preguntas con códigos malformados
2. Corrige los códigos directamente en el archivo
3. Ejecuta de nuevo el revisor para verificar que no quedan problemas
4. Actualiza el archivo `preguntas_ISO.txt` con la versión limpia

## Autor

Herramienta creada para el curso ISO - Universidad de Castilla-La Mancha
