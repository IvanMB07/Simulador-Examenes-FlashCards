# 📚 Simulador de Exámenes ISO

## 🚀 Inicio Rápido

### Abrir el Simulador
Simplemente abre **`index.html`** en tu navegador (doble clic).

---

## 📝 Añadir Nuevas Preguntas

### Paso 1: Editar el Archivo de Preguntas
Abre `preguntas_ISO.txt` con un editor de texto y añade tus preguntas con este formato:

```
CODIGO-LXX-QXX- Pregunta: ¿Texto de la pregunta?
A. Opción A.
B. Opción B.
C. Opción C.
D. Opción D.
ANSWER: A

```

**Ejemplo:**
```
BC02-L3-Q31- Pregunta: ¿Qué es un test?
A. Un examen.
B. Una prueba de software.
C. Un procedimiento.
D. Todas las anteriores.
ANSWER: B
```

### Paso 2: Actualizar el Simulador
**OPCIÓN A - Automática (RECOMENDADA):**
Doble clic en **`Actualizar.bat`**

Esto verificará formato, buscará duplicados y actualizará automáticamente.

**OPCIÓN B - Manual:**
```bash
python reemplazar_preguntas.py preguntas_ISO.txt
```

---

## 🧹 Importar preguntas desde Moodle (texto pegado)

Si tienes un export/pegado tipo Moodle con opciones `a.`/`b.`/`c.`/`d.` y la línea
"La respuesta correcta es:", puedes convertirlo automáticamente al formato del simulador
y generar el JSON en un solo paso.

**OPCIÓN A - Pipeline único (recomendado):**
```bash
python convertir_preguntas.py export_moodle.txt --from auto --txt preguntas_ISO_COMPLETAS.txt --json preguntas.json
```

**OPCIÓN B - Mantener el flujo antiguo (2 pasos):**
```bash
python moodle_a_formato_txt.py export_moodle.txt preguntas_ISO_COMPLETAS.txt
python txt_a_json.py preguntas_ISO_COMPLETAS.txt preguntas.json
```

### Paso 3: Verificar en el Navegador
El simulador se abrirá automáticamente. Verifica que tus nuevas preguntas aparecen.

---

## 📂 Estructura

```
simulador-iso/
├── 🌐 index.html              # ← ABRE ESTO para usar el simulador
├── 📄 preguntas_ISO.txt        # ← EDITA ESTO para añadir preguntas
├── 🔧 reemplazar_preguntas.py  # ← EJECUTA ESTO después de editar (o usa Actualizar.bat)
├── 📦 Actualizar.bat           # ← DOUBLE CLICK para actualizar automáticamente
├── 📖 README.md                # Este archivo
│
└── 📁 _herramientas/           # Herramientas avanzadas de mantenimiento
    ├── revisor_preguntas.py    # GUI para detectar duplicados
    ├── analisis_rapido.py      # Análisis de calidad
    ├── test_parser.py          # Verificar formato
    ├── gestor_preguntas.py     # Añadir sin duplicar
    ├── INDICE.md               # Índice de herramientas
    ├── GUIA_COMPLETA.md        # Documentación completa
    └── [más herramientas...]
```

---

## ❓ Preguntas Frecuentes

### ¿Cómo verifico si mis preguntas tienen el formato correcto?
```bash
python _herramientas/test_parser.py
```

### ¿Cómo busco duplicados?
```bash
python _herramientas/analisis_rapido.py preguntas_ISO.txt
```

### ¿Cómo revieso preguntas de forma interactiva?
```bash
python _herramientas/revisor_preguntas.py
```

### ¿Dónde están los backups?
En la carpeta `_herramientas/` hay un backup de `index.html.backup` por si acaso.

---

## 📊 Información Actual

- **Total de preguntas:** 276
- **Preguntas únicas:** Todas (sin duplicados)
- **Formato:** Standarizado con "Pregunta:"

---

**¡Listo para usar! 🎉**

Para más información, ve a la carpeta `_herramientas/` para ver la documentación completa.
