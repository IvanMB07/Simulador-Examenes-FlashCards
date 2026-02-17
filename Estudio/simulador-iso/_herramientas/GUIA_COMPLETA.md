# 📋 Guía Completa - Revisor de Preguntas ISO

## 🎯 Resumen del Análisis

### Estado Actual del Archivo `preguntas_ISO.txt`:
- ✅ **283 preguntas** cargadas correctamente
- ✅ **0 códigos malformados** (ya corregidos)
- ⚠️ **10 grupos de duplicados** detectados que requieren revisión manual

### Problemas Encontrados y Corregidos Automáticamente:
1. ~~`3BC7-L11-Q14-` con guión extra~~ → **CORREGIDO** ✅
2. ~~`B05-L21-Q24--` con guión doble~~ → **CORREGIDO** ✅

---

## 🛠️ Herramientas Disponibles

### 1. **Revisor con GUI** (Recomendado)
**Archivo:** `revisor_preguntas.py`

**Cómo usar:**
```bash
# Opción 1: Doble clic en
Iniciar_Revisor_GUI.bat

# Opción 2: Desde terminal
python revisor_preguntas.py
```

**Características:**
- ✨ Interfaz gráfica intuitiva con tema oscuro
- 📊 3 pestañas: Duplicados | Códigos Malformados | Resultado
- 🔍 Vista lado a lado de preguntas similares con % de similitud
- ✅ Selección fácil con radio buttons
- 🗑️ Opción de eliminar grupos completos
- 💾 Vista previa antes de guardar
- 📝 Genera archivo limpio en formato original

### 2. **Análisis Rápido** (Genera Reporte)
**Archivo:** `analisis_rapido.py`

**Cómo usar:**
```bash
python analisis_rapido.py preguntas_ISO.txt
```

**Salida:**
- 📄 Genera `reporte_analisis.txt` con:
  - Resumen de estadísticas
  - Lista completa de duplicados con % similitud
  - Estadísticas por lección (L3, L4, L5, etc.)

---

## 🔄 Flujo de Trabajo Recomendado

### Paso 1: Revisar el Reporte
```bash
python analisis_rapido.py preguntas_ISO.txt
```
Abre `reporte_analisis.txt` y revisa los 10 grupos de duplicados.

### Paso 2: Usar la GUI para Decidir
```bash
python revisor_preguntas.py
```

1. Clic en "**Cargar Archivo**"
2. Selecciona `preguntas_ISO.txt`
3. Navega por los duplicados con "Siguiente" / "Anterior"
4. Para cada grupo:
   - Compara las preguntas lado a lado
   - Mira el % de similitud
   - Selecciona la pregunta que quieres **mantener**
   - O haz clic en "**Eliminar TODAS**" si ninguna es válida
5. Cuando termines, clic en "**Generar Archivo Limpio**"
6. Revisa la vista previa en la pestaña "**Resultado**"
7. Guarda como `preguntas_ISO_limpio.txt`

### Paso 3: Reemplazar el Archivo Original
```bash
# Hacer backup del original
copy preguntas_ISO.txt preguntas_ISO_backup.txt

# Reemplazar con la versión limpia
copy preguntas_ISO_limpio.txt preguntas_ISO.txt
```

### Paso 4: Verificar
```bash
python analisis_rapido.py preguntas_ISO.txt
```
Debería mostrar **0 duplicados**.

---

## 📊 Detalles de los 10 Grupos de Duplicados Encontrados

### 🟡 GRUPO 1 (87.4% similitud)
**Diferentes preguntas con respuesta similar:**
- `BC02-L5-Q07`: ¿En qué consisten las pruebas de **regresión**?
- `BC02-L5-Q13`: ¿En qué consisten las pruebas de **aceptación**?
**→ Acción:** Estas son **diferentes**, mantener ambas.

### 🔴 GRUPO 2 (85.1% similitud)
**Preguntas diferentes:**
- `BC02-L11-Q02`: Desventaja del modelo **incremental**
- `B01-L11-Q21`: Ventaja del Modelo **Espiral**
**→ Acción:** Son **diferentes**, mantener ambas.

### 🟡 GRUPO 3 (87.1% similitud)
**Preguntas similares sobre metodologías:**
- `BC02-L11-Q07`: Características de Metodología de Desarrollo
- `BC02-L11-Q019`: Características deseables de metodologías
**→ Acción:** Revisar manualmente, posible duplicado.

### 🔴 GRUPO 4 (100% similitud) **DUPLICADO EXACTO**
- `BC02-L11-Q010`: Proceso entre cliente y empresa
- `BC02-L11-Q011`: Proceso entre cliente y empresa
**→ Acción:** Eliminar `BC02-L11-Q011` (es un duplicado exacto).

### 🔴 GRUPO 5 (100% similitud) **DUPLICADO EXACTO**
- `B01-L31-Q04`: Propósito norma ISO 25040
- `B01-L31-Q25`: Propósito norma ISO 25040
**→ Acción:** Eliminar `B01-L31-Q25`.

### 🔴 GRUPO 6 (100% similitud) **DUPLICADO EXACTO**
- `B01-L31-Q06`: Característica ISO 25010 - rapidez
- `B01-L31-Q26`: Característica ISO 25010 - rapidez
**→ Acción:** Eliminar `B01-L31-Q26`.

### 🔴 GRUPO 7 (100% similitud) **DUPLICADO EXACTO**
- `B01-L31-Q07`: Atributo Capacidad de Uso
- `B01-L31-Q27`: Atributo Capacidad de Uso
**→ Acción:** Eliminar `B01-L31-Q27`.

### 🔴 GRUPO 8 (100% similitud) **DUPLICADO EXACTO**
- `B01-L31-Q13`: Objetivo ISO 33000
- `B01-L31-Q30`: Objetivo ISO 33000
**→ Acción:** Eliminar `B01-L31-Q30`.

### 🟡 GRUPO 9 y 10
Revisar en el reporte completo.

---

## 📈 Resultado Esperado

Después de eliminar los duplicados exactos:
- **Antes:** 283 preguntas
- **Duplicados a eliminar:** ~7-10 preguntas
- **Después:** ~273-276 preguntas únicas

---

## ⚙️ Configuración Avanzada

### Ajustar Umbral de Similitud

Edita `revisor_preguntas.py` línea 137:

```python
# Más estricto (solo duplicados muy obvios)
if p1.es_similar(p2, umbral=0.95):

# Menos estricto (detecta más posibles duplicados)
if p1.es_similar(p2, umbral=0.75):
```

### Cambiar Tamaño de Ventana

Edita línea 123:

```python
self.root.geometry("1600x1000")  # Para pantallas grandes
self.root.geometry("1200x800")   # Para pantallas pequeñas
```

---

## 🐛 Solución de Problemas

### Error: "No module named 'tkinter'"
```bash
# Windows: Reinstalar Python con "tcl/tk" marcado
# Linux:
sudo apt-get install python3-tk
```

### La GUI no se ve bien
- Ajusta el tamaño de ventana (ver sección anterior)
- Usa zoom del sistema: `Ctrl` + `+` o `Ctrl` + `-`

### No encuentra el archivo
- Asegúrate de estar en el directorio correcto
- Usa el botón "Cargar Archivo" para navegar

---

## 📁 Archivos Generados

| Archivo | Descripción |
|---------|-------------|
| `reporte_analisis.txt` | Reporte detallado de todos los problemas encontrados |
| `preguntas_ISO_limpio.txt` | Archivo final sin duplicados (generado por la GUI) |
| `preguntas_ISO_backup.txt` | Backup del original (crear manualmente) |

---

## ✅ Checklist Final

- [ ] Ejecutar análisis rápido
- [ ] Revisar reporte generado
- [ ] Abrir GUI y cargar archivo
- [ ] Revisar los 10 grupos de duplicados
- [ ] Tomar decisiones para cada grupo
- [ ] Generar archivo limpio
- [ ] Hacer backup del original
- [ ] Reemplazar con versión limpia
- [ ] Verificar con nuevo análisis (0 duplicados)
- [ ] Actualizar el simulador si es necesario

---

## 🎓 Notas Importantes

1. **Los duplicados al 100%** son claramente errores y se deben eliminar.

2. **Los duplicados al 85-90%** pueden ser:
   - Preguntas similares pero diferentes (mantener ambas)
   - Misma pregunta con ligeras variaciones (eliminar duplicado)
   - **Revisar manualmente cada caso**

3. **Respaldo:** Siempre haz backup antes de reemplazar archivos.

4. **Formato:** El archivo generado mantiene el formato original para compatibilidad con el simulador.

5. **Actualizaciones futuras:** Ejecuta el análisis periódicamente cuando agregues nuevas preguntas.

---

## 📞 Ayuda

Si encuentras problemas o tienes dudas:
1. Revisa la sección "Solución de Problemas"
2. Consulta el `README_REVISOR.md` para más detalles
3. Revisa el código fuente (está bien documentado)

---

**¡Buena suerte con la revisión! 🚀**
