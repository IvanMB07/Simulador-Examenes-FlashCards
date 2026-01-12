# Simulador de Examen ISO - Versión Optimizada

## 📊 Comparación con la versión anterior

| Aspecto | Original | Optimizado | Reducción |
|---------|----------|-----------|-----------|
| **Tamaño HTML** | 13,789 líneas | ~200 líneas | 98.5% ↓ |
| **Tamaño total** | ~580 KB | ~165 KB (180 KB con JSON) | 69% ↓ |
| **Arquivos** | 1 megafile | 4 archivos modulares | ✅ |
| **Mantenimiento** | Difícil | Muy fácil | ✅ |
| **Performance** | Normal | Mejor | ✅ |

## 🎯 Estructura

```
simulador-iso-optimizado/
├── index.html              (200 líneas - HTML limpio)
├── app.js                  (380 líneas - lógica)
├── styles.css              (450 líneas - estilos)
└── preguntas.json          (1226 preguntas - datos)
```

## ✨ Características

- ✅ **100% funcional** en mobile y PC
- ✅ **Mismo diseño** que la versión original
- ✅ **Preguntas separadas** en JSON
- ✅ **Carga dinámica** sin servidor
- ✅ **GitHub Pages compatible**
- ✅ **Funciona offline** (después de primer carga)
- ✅ **LocalStorage** para guardar fallos

## 🚀 Uso

1. **Copia todos los archivos** a GitHub Pages (o abre `index.html` localmente)
2. **El navegador carga** `preguntas.json` automáticamente
3. **¡Listo!** Sin necesidad de servidor

## 🔄 Cómo actualizar preguntas

Si necesitas agregar preguntas nuevas:

1. Modifica `preguntas.json` directamente (es un JSON estándar)
2. O usa la herramienta en la carpeta anterior: `preguntas_ISO_COMPLETAS.txt`
3. Regenera: `python reemplazar_preguntas.py`

## 💾 Tamaños de archivo

```
index.html        ~8 KB
app.js           ~10 KB
styles.css       ~12 KB
preguntas.json   ~165 KB
─────────────────────────
TOTAL:           ~195 KB (vs 580 KB original)
```

## ✅ Testing

- [x] Modo Práctica ✓
- [x] Modo Examen (50 min) ✓
- [x] Test de Fallos ✓
- [x] Atajos de teclado ✓
- [x] Responsive mobile ✓
- [x] Guardar fallos ✓
- [x] Ordenar por temas ✓

## 📝 Notas

- **Original (`simulador-iso/`)**: Mantente intacta, funcional
- **Nueva (`simulador-iso-optimizado/`)**: Versión mejorada y ligera
- **Ambas usan el mismo** `preguntas_ISO_COMPLETAS.txt` para actualizaciones
