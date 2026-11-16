# Simuladores de Estudio

Colección de simuladores y herramientas de apoyo al estudio, organizada por asignaturas. El proyecto reúne una página de acceso común, siete simuladores construidos sobre un core compartido y un módulo de flashcards independiente.

<p align="center">
  <strong>Practica · Examínate · Repasa tus errores · Consulta tu progreso</strong>
</p>

## Asignaturas

| Simulador | Asignatura | Arquitectura |
|---|---|---|
| [ISO II](simulador-ISO-2/) | Ingeniería de Software II | Core común |
| [CalSisSw](simulador-CalSisSw/) | Calidad de Sistemas Software | Core común |
| [SegSisSw](simulador-SegSisSw/) | Seguridad de Sistemas Software | Core común |
| [SIE](simulador-SIE/) | Sistemas de Información Empresarial | Core común |
| [DBBDD](simulador-DBBDD/) | Desarrollo de Bases de Datos | Core común |
| [API](simulador-API/) | Aspectos Profesionales de la Informática | Core común + selector específico de examen |
| [REQ](simulador-REQ/) | Ingeniería de Requisitos | Core común + particularidades de respuestas múltiples |
| [IPO · Flashcards](flashcards-ipo/) | Interacción Persona-Ordenador | Aplicación independiente |

Los siete simuladores principales utilizan `common/simulador-core.js`. IPO se conserva como una aplicación independiente y todavía no utiliza ese core.

## Funcionalidades

Las opciones concretas dependen de la asignatura y de su configuración. En los simuladores basados en el core se comparten estas capacidades:

- **Práctica:** sesiones de entrenamiento con selección de preguntas.
- **Examen:** sesiones con temporizador, configuración y sistema de puntuación propios de cada asignatura.
- **Repaso de fallos:** posibilidad de volver a trabajar las preguntas respondidas incorrectamente.
- **Perfiles:** progreso separado por perfil.
- **Historial:** consulta de sesiones y resultados anteriores.
- **Recuperación de sesión:** almacenamiento del estado de una sesión en curso para continuar más tarde.
- **Seguimiento de preguntas:** registro del uso de preguntas para ayudar a variar la selección.
- **Persistencia local:** el progreso se guarda en el navegador.
- **Sincronización opcional:** integración común con Firebase Authentication y Cloud Firestore para sincronizar los datos compatibles entre dispositivos cuando el proyecto está configurado y existe una sesión iniciada.
- **PWA:** los siete simuladores principales y los recursos del core están incluidos en la estrategia de caché del service worker.

Cada asignatura conserva sus propios parámetros: identificador de almacenamiento, banco de preguntas, número de preguntas, duración, reglas de corrección y, cuando corresponde, lógica específica de selección. Los datos de un simulador no se mezclan con los de otro.

## Arquitectura

```text
Simuladores de Estudio
├── index.html                 Página de entrada
├── sw.js                      Service worker y caché PWA
├── common/
│   ├── simulador-core.js      Lógica compartida de estudio
│   └── firebase/
│       ├── firebase-config.js Configuración del proyecto
│       └── firebase-sync.js   Adaptador de sincronización
├── simulador-ISO-2/
├── simulador-CalSisSw/
├── simulador-SegSisSw/
├── simulador-SIE/
├── simulador-DBBDD/
├── simulador-API/
├── simulador-REQ/
├── flashcards-ipo/             Aplicación independiente
├── _herramientas/              Utilidades para mantener los bancos
├── docs/                       Documentación técnica
└── tests/                      Pruebas automatizadas
```

### Core compartido

El core concentra la lógica transversal y evita mantener implementaciones distintas de las mismas funciones en cada asignatura. Entre sus componentes se encuentran:

- `StorageAdapter`: persistencia local con espacios de nombres.
- `ProfileManager`: creación, selección y gestión de perfiles.
- `ExamHistory`: almacenamiento y consulta del historial.
- `SessionStore`: persistencia de sesiones activas.
- `FailedQuestionStore`: registro de preguntas falladas.
- `QuestionHistoryStore`: seguimiento del uso de preguntas.
- `ExamEngine`: ciclo de vida de las sesiones, respuestas, temporizador y finalización.
- Funciones de selección por tema, barajado y corrección.

Consulta [common/README.md](common/README.md) para conocer el contrato y las responsabilidades del módulo.

### Persistencia y sincronización

El almacenamiento local utiliza `localStorage`. La sincronización remota está separada del core y se implementa mediante `FirebaseSyncProvider`, que conecta Firebase Authentication con Cloud Firestore. Firestore dispone de caché local persistente en navegadores compatibles y sincroniza los cambios cuando hay conexión.

La configuración del cliente se encuentra en `common/firebase/firebase-config.js`; las reglas de acceso están en `firestore.rules`. La configuración web de Firebase identifica el proyecto y se entrega al cliente, pero la seguridad de los datos depende de Authentication y de las reglas de Firestore. No introduzcas credenciales privadas de Admin SDK en el frontend.

La sincronización entre dispositivos requiere que Firebase esté configurado, que las reglas estén publicadas y que el usuario inicie sesión. La sesión activa de un mismo perfil y simulador es un recurso compartido: no está diseñada para editarse simultáneamente desde varios dispositivos.

Más información: [guía de Firebase](docs/firebase-setup.md) y [arquitectura de persistencia](docs/arquitectura-persistencia.md).

## Ejecutar en local

El proyecto es estático y utiliza módulos JavaScript ES. Para probarlo, sirve la raíz del repositorio mediante HTTP; abrir directamente los HTML con `file://` puede impedir la carga de módulos y recursos.

Con Python instalado:

```bash
python -m http.server 8000
```

Después abre:

- Panel principal: http://localhost:8000/
- Simulador ISO II: http://localhost:8000/simulador-ISO-2/
- CalSisSw: http://localhost:8000/simulador-CalSisSw/

También puedes abrir cualquier otra carpeta de simulador desde el mismo servidor.

## Pruebas

Requisitos: Node.js (la automatización de GitHub Actions utiliza Node.js 22).

```bash
npm test
```

El comando ejecuta las pruebas integradas con el test runner de Node.js. Las pruebas cubren el core, la gestión de perfiles, el historial, las sesiones recuperables, la selección por temas, la corrección y algunas comprobaciones de integración de las interfaces.

Los workflows de GitHub Actions también realizan comprobaciones sintácticas de los módulos JavaScript antes de ejecutar la suite.

## Herramientas auxiliares

En [`_herramientas/`](_herramientas/README.md) se encuentra el rebalanceador universal de respuestas para bancos JSON. Permite analizar y equilibrar las respuestas correctas A/B/C/D, renumerar identificadores por tema y crear copias de seguridad.

## Estructura de los bancos de preguntas

Los simuladores cargan sus preguntas desde el archivo `preguntas.json` de su propia carpeta. El contenido se versiona junto al código de la asignatura. La estructura habitual contiene el enunciado, las opciones y la solución; algunos bancos incorporan campos adicionales para temas, dependencias o preguntas especiales.

Al modificar un banco, conserva el formato JSON y comprueba que los identificadores y las soluciones coinciden con las opciones. Puedes utilizar el rebalanceador para operaciones de mantenimiento, pero revisa siempre el resultado antes de incorporarlo a `main`.

## Estado y criterios del proyecto

- Los siete simuladores principales comparten el core.
- IPO continúa como aplicación separada.
- La configuración de cada asignatura permanece en su propio simulador.
- La lógica común debe añadirse al core cuando sea reutilizable; las reglas específicas deben permanecer en el simulador correspondiente.
- Los cambios deben acompañarse de pruebas cuando afecten a lógica compartida o a funcionalidades existentes.

## Contribuir al proyecto

1. Crea una rama a partir de `main`.
2. Realiza cambios acotados a una funcionalidad o tarea.
3. Ejecuta `npm test` y las comprobaciones pertinentes.
4. Abre un pull request hacia `main`, describiendo el cambio y sus pruebas.

---

Proyecto personal de apoyo al estudio. El contenido de los bancos de preguntas y sus reglas de evaluación pueden cambiar a medida que se actualizan las asignaturas.
