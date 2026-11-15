# Simuladores de estudio · core común y CalSisSw

Esta rama inicia la evolución hacia un modelo común de simuladores. La primera integración completa es **Calidad de Sistemas Software (CalSisSw)**.

## CalSisSw

- Modo práctica con feedback inmediato.
- Examen de 20 preguntas y 75 minutos.
- Test de preguntas falladas.
- Puntuación directa: correcta +1, incorrecta −0,5, en blanco 0.
- Perfiles locales independientes.
- Historial por perfil con fecha, modalidad, aciertos, errores, blancas, puntuación, duración y detalle de fallos.
- Gráfico de resultados recientes y exportación JSON.
- Reanudación de sesiones tras recargar o cerrar el navegador.
- Temporizador de examen basado en tiempo real transcurrido.
- Diseño responsive, navegación por teclado, mensajes accesibles y PWA con caché offline del simulador y el core.
- Exportación e importación de copia de seguridad del perfil.

El banco `simulador-CalSisSw/preguntas.json` se deja vacío (`[]`) para añadir el contenido de la asignatura posteriormente.

## Core común

`common/simulador-core.js` concentra las funciones independientes de cada asignatura: persistencia local, perfiles, historial, sesiones, preguntas falladas, selección aleatoria y evaluación. Cada simulador mantiene su configuración y su interfaz.

## Uso y pruebas

Servir el repositorio por HTTP/HTTPS y abrir `simulador-CalSisSw/`. GitHub Pages puede seguir sirviendo la parte estática.

```bash
npm test
```

La rama incluye GitHub Actions para ejecutar las pruebas del core.

## Persistencia entre dispositivos

En esta fase la persistencia automática es **local al navegador/dispositivo**. La exportación/importación JSON permite mover los datos manualmente. La sincronización automática entre dispositivos necesita un backend autenticado; GitHub Pages por sí solo no ejecuta código de servidor.

La arquitectura y la comparación de proveedores están en [docs/arquitectura-persistencia.md](docs/arquitectura-persistencia.md).

## Fuera de esta primera fase

- Sincronización cloud automática.
- Migración de los simuladores existentes al core.
- Repetición espaciada (SRS) configurable.
- Editor/importador visual de preguntas.
- Internacionalización.
