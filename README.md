# Simulador universal · primera implementación CalSisSw

Esta rama introduce el primer simulador sobre `common/simulador-core.js` y el adaptador `simulador-CalSisSw/`.

## Uso local

Servir el repositorio mediante un servidor HTTP (GitHub Pages funciona también) y abrir `simulador-CalSisSw/`.

## Banco de preguntas

`simulador-CalSisSw/preguntas.json` está deliberadamente vacío (`[]`). Formato previsto:

```json
[
  {
    "id": "CalSisSw-T1-001",
    "tema": 1,
    "cuestion": "Enunciado",
    "opciones": ["A. Opción A", "B. Opción B", "C. Opción C", "D. Opción D"],
    "solucion": "A"
  }
]
```

## Puntuación

Correcta: +1; incorrecta: −0,5; en blanco: 0. La nota mostrada es puntuación directa, no normalizada a 10.

## Persistencia

Los perfiles, las sesiones inacabadas y el historial se guardan en el navegador. La copia JSON permite migrar los datos manualmente. La sincronización automática entre dispositivos requiere un backend con autenticación y políticas de acceso; no es una capacidad de GitHub Pages por sí sola.

## Próximos pasos

- Implementar un proveedor cloud autenticado detrás del adaptador de persistencia.
- Completar la integración de service worker y pruebas automatizadas.
- Incorporar SRS, editor de preguntas y CI en fases posteriores.
