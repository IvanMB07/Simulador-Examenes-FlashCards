Nuevos requisitos:
- Al finalizar un examen, que permita ver las preguntas de nuevo con las opciones correctas e incorrectas.
- Añadir un historial de examenes para ver los resultados anteriores, junto con el resumen por preguntas.
- Mejorar la GUI
- Crear un modelo universal o algo asi con herencia quiza que cambie segun lo que necesite

Resumen rápido — ya he revisado script.js y script.js (mucha lógica compartida: SimuladorExamen, GestorFallos, GestorHistorial, perfiles, import/export). Siguiente paso: propongo mejoras concretas y priorizadas.

Estado actual

Presente: GestorFallos (fallos por perfil), GestorHistorial (preguntas vistas), perfiles, import/export de fallos, selección/aleatorización avanzada y manejo de dependencias entre preguntas.
Ausente: historial de exámenes (sesiones completas con puntuación/fecha/duración), persistencia/resume de exámenes, un módulo core compartido (hay duplicación entre simuladores), métricas/analítica de exámenes y pruebas automatizadas.
Faltas principales (para "perfectos")

Historial de exámenes: guardar cada sesión (fecha, tipo, correctas/incorrectas, nota, duración, errores) por perfil y UI para consultarlo/exportarlo.
Refactor/core común: extraer lógica compartida (SimuladorExamen, gestores, utilidades) a un módulo común y usar pequeñas configuraciones por simulador (cantidad, tiempo, URL preguntas).
Mejora GUI / UX: responsive, accesibilidad ARIA/keyboard, diseño móvil (PWA), vista de resultados con gráficos (historial), indicadores de progreso y feedback visual más claro.
Funciones adicionales recomendadas: reanudar examen (persistir estado), temporizador resistente a recargas, modo de repaso espaciado (SRS), editor/importador de preguntas, tests unitarios y pipeline CI, i18n y modo oscuro.
Propuesta priorizada (mínimo esfuerzo → máximo impacto)

Añadir historial de exámenes (localStorage por perfil + UI de lista + exportar JSON).
Extraer módulo común Estudio/common/simulador-core.js y convertir cada simulador en una configuración ligera que importe ese core.
Implementar vista de historial + gráficos (Chart.js o simple SVG) y botón “repetir examen”.
Añadir persistencia de estado de examen para reanudar tras recarga.
Tests mínimos y README breve para contribuir y CI.