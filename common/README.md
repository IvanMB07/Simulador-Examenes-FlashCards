# Core compartido de los simuladores

`common/simulador-core.js` es el módulo JavaScript ES que concentra la lógica reutilizable de los siete simuladores principales. Su objetivo es que perfiles, sesiones, historial, corrección y selección de preguntas tengan un comportamiento común, sin obligar a que todas las asignaturas compartan las mismas reglas de examen o la misma interfaz.

## Responsabilidades

El core se ocupa de la lógica transversal:

| Componente | Responsabilidad |
|---|---|
| `StorageAdapter` | Lectura, escritura y eliminación en `localStorage`, con espacios de nombres y eventos de cambio. |
| `ProfileManager` | Perfiles de estudio, perfil activo y registro local de perfiles eliminados. |
| `ExamHistory` | Historial de sesiones finalizadas, consulta, limpieza y exportación. |
| `SessionStore` | Guardado y recuperación de la sesión activa. |
| `FailedQuestionStore` | Registro de preguntas falladas para sesiones de repaso. |
| `QuestionHistoryStore` | Seguimiento de preguntas utilizadas y prioridad de repaso. |
| `ExamEngine` | Inicio, reanudación, respuesta, navegación, temporizador y finalización de sesiones. |

El módulo también exporta funciones auxiliares para barajar preguntas, identificar temas, distribuir preguntas por tema, reconocer preguntas de respuesta múltiple y calcular resultados.

## Integración desde un simulador

Cada asignatura importa las clases que necesita desde el core y declara su propia configuración. El patrón general es:

```js
import {
  StorageAdapter,
  ProfileManager,
  ExamHistory,
  SessionStore,
  FailedQuestionStore,
  ExamEngine,
  QuestionHistoryStore
} from '../common/simulador-core.js';

const CONFIG = {
  id: 'ID_ASIGNATURA',
  title: 'Nombre de la asignatura',
  questionUrl: './preguntas.json',
  examQuestionCount: 20,
  practiceQuestionCount: 25,
  examDurationMinutes: 75,
  scoring: {
    correct: 1,
    incorrect: 0,
    blank: 0
  }
};

const storage = new StorageAdapter(`estudio:${CONFIG.id}`);
const profiles = new ProfileManager(storage);
const history = new ExamHistory(storage, () => profiles.activeId, CONFIG.id);
const sessions = new SessionStore(storage, () => profiles.activeId, CONFIG.id);
const failures = new FailedQuestionStore(storage, () => profiles.activeId);
const questionHistory = new QuestionHistoryStore(
  storage,
  () => profiles.activeId,
  150
);
```

El fragmento ilustra el contrato de integración; los valores de configuración deben adaptarse a la asignatura. No copies los parámetros del ejemplo como si fueran valores obligatorios.

### Aislamiento de datos

Cada simulador crea su propio espacio de almacenamiento mediante un identificador estable, por ejemplo `estudio:API` o `estudio:CalSisSw`. Los stores reciben el identificador del perfil activo cuando leen o escriben datos. Por ello, el identificador del simulador y el perfil forman parte del aislamiento de los datos.

No reutilices un mismo `CONFIG.id` en dos asignaturas diferentes: provocaría que compartieran el mismo espacio local.

## Qué debe permanecer fuera del core

El core no debe conocer detalles propios de una asignatura. Mantén en el simulador:

- El título, el banco `preguntas.json` y sus metadatos.
- El número de preguntas de práctica y examen.
- La duración del examen.
- La puntuación y las fórmulas particulares.
- Los filtros o ámbitos de examen específicos.
- La interfaz HTML/CSS y los textos de la asignatura.
- Adaptadores de selección especiales, como `simulador-API/api-question-selection.js`.

Por ejemplo, API mantiene un selector específico para sus parciales y grupos de preguntas dependientes; REQ conserva los comportamientos necesarios para preguntas de respuesta múltiple. Estas particularidades no deben introducir condiciones específicas dentro del motor común si pueden resolverse mediante configuración o un módulo propio.

## Persistencia local

`StorageAdapter` utiliza `localStorage` y serializa los valores como JSON. Cada clave se construye con el espacio de nombres del simulador, el tipo de dato y el perfil. Las escrituras emiten el evento `simulador:storage-change`, que permite a una capa externa observar cambios sin acoplar el core a un proveedor cloud.

El core no importa Firebase ni depende de su SDK. Esta separación permite mantener la lógica de estudio y las pruebas unitarias independientes de la conexión de red.

## Sincronización remota

La integración remota se encuentra en `common/firebase/`:

- `firebase-config.js`: configuración web del proyecto Firebase.
- `firebase-sync.js`: implementación de `FirebaseSyncProvider`, que conecta Authentication y Cloud Firestore con los cambios emitidos por el adaptador local.

El proveedor escucha los cambios de almacenamiento, gestiona la identidad de Firebase, mantiene el estado de sincronización y aplica datos remotos al espacio local de la cuenta. Firestore se inicializa con caché local persistente y gestor multi-pestaña cuando el navegador lo permite.

La sincronización es una capa adicional: si Firebase no está configurado o el usuario no ha iniciado sesión, el simulador sigue utilizando el almacenamiento local. La configuración de Firebase y las reglas de seguridad se documentan en [`docs/firebase-setup.md`](../docs/firebase-setup.md).

La sesión activa de un perfil y simulador utiliza un documento remoto compartido. Si dos dispositivos escriben simultáneamente sobre esa misma sesión, puede prevalecer la última escritura. No trates esa situación como edición colaborativa en tiempo real.

## Pruebas

Las pruebas del core están en `tests/` y utilizan el test runner nativo de Node.js. Se sustituye `localStorage` por un almacenamiento en memoria para probar la lógica sin navegador ni conexión a Firebase.

Desde la raíz del repositorio:

```bash
npm test
```

Al modificar el core:

1. Añade o actualiza pruebas para el comportamiento afectado.
2. Comprueba los casos de perfiles diferentes y simuladores diferentes.
3. Comprueba tanto la creación como la reanudación y finalización de sesiones si el cambio afecta a `ExamEngine`.
4. Ejecuta la suite completa.
5. Revisa que ningún simulador dependa accidentalmente de un comportamiento específico de otra asignatura.

## Criterio de evolución

Antes de añadir una función al core, comprueba que es realmente transversal. Si depende de un temario, un parcial, una fórmula de nota o un formato de pregunta de una asignatura, debe quedarse en esa asignatura o exponerse mediante una extensión explícita.

El almacenamiento local actual está basado en `localStorage`; cambiarlo por IndexedDB sería una evolución de infraestructura y requiere diseñar y probar una migración de datos. No asumas que ese cambio ya está implementado.
