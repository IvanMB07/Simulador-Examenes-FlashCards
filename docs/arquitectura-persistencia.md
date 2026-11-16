# Arquitectura de persistencia y sincronización

## Objetivo

Los simuladores principales utilizan una arquitectura local-first: la lógica de estudio funciona en el navegador y guarda el progreso en el dispositivo. La sincronización remota es una capa adicional y no forma parte del motor de examen.

El repositorio ya incorpora una implementación con Firebase Authentication y Cloud Firestore. Este documento describe esa implementación, sus límites y los criterios para futuras evoluciones.

## Arquitectura actual

```text
Interfaz del simulador
        │
        ▼
Configuración de asignatura
        │
        ▼
common/simulador-core.js
  ├── ExamEngine
  ├── ProfileManager
  ├── ExamHistory
  ├── SessionStore
  ├── FailedQuestionStore
  ├── QuestionHistoryStore
  └── StorageAdapter
        │
        ├── localStorage
        │
        └── evento simulador:storage-change
                       │
                       ▼
          common/firebase/firebase-sync.js
                       │
             Firebase Authentication
                       │
                       ▼
                Cloud Firestore
```

### 1. Interfaz y configuración

Cada simulador conserva su HTML, CSS, banco de preguntas y configuración. La configuración determina el identificador del simulador, el número de preguntas, la duración, el sistema de puntuación y las reglas específicas de selección.

El core no debe contener reglas particulares de una asignatura. Por ejemplo, los ámbitos de parcial y las agrupaciones de preguntas dependientes de API se resuelven en su módulo de selección propio.

### 2. Core compartido

`common/simulador-core.js` proporciona los stores y el motor descritos en [common/README.md](../common/README.md). El core no importa el SDK de Firebase ni realiza peticiones de red.

### 3. Almacenamiento local

`StorageAdapter` utiliza `localStorage` y separa las claves por namespace, tipo de dato y perfil. Los cambios generan el evento `simulador:storage-change`, que permite a un proveedor externo observar las escrituras.

El almacenamiento local sigue siendo la base de funcionamiento. Si el usuario no ha iniciado sesión o Firebase no está configurado, las funciones locales continúan disponibles.

### 4. Proveedor Firebase

`common/firebase/firebase-sync.js` implementa `FirebaseSyncProvider`. Este módulo:

- Inicializa Firebase Authentication y Cloud Firestore.
- Gestiona el estado de autenticación.
- Asocia el espacio local a la cuenta autenticada.
- Observa los cambios locales emitidos por el core.
- Sincroniza perfiles y datos de estudio compatibles.
- Mantiene suscripciones a los cambios remotos.
- Solicita sincronización al recuperar conectividad y al abandonar/ocultar la página.

La inicialización de Firestore solicita caché local persistente con gestor multi-pestaña. Si el navegador no permite esa configuración, el código utiliza la instancia de Firestore disponible como alternativa.

## Identidad y aislamiento de datos

La identidad de sincronización es el UID proporcionado por Firebase Authentication, no el nombre visible del perfil ni el correo electrónico.

Los datos locales se particionan por namespace de simulador y por cuenta. Dentro de cada simulador, los stores aíslan los datos por perfil. Esta separación evita mezclar el progreso de cuentas distintas en un mismo navegador.

El banco de preguntas se mantiene en los archivos del repositorio y no se sincroniza como contenido personal de la cuenta.

## Modelo remoto

Las reglas de Firestore se encuentran en `firestore.rules`. La implementación utiliza rutas bajo el usuario autenticado y separa los datos por perfil y simulador. Las colecciones contempladas por las reglas incluyen:

- Perfiles.
- Sesiones de examen finalizadas.
- Preguntas falladas.
- Sesiones activas.

Las reglas verifican que el UID autenticado coincida con el propietario de la ruta. Las reglas deben desplegarse en el proyecto correcto y probarse con usuarios distintos; la configuración del cliente por sí sola no concede autorización.

## Consistencia y conflictos

Firestore sincroniza documentos y utiliza su política de resolución de escrituras concurrentes. La sesión activa de un perfil y simulador es un documento compartido; dos dispositivos que escriban simultáneamente sobre esa misma sesión pueden sobrescribirse según el orden de llegada de las escrituras.

Por tanto:

- Utiliza una sola sesión activa por perfil y simulador cuando alternes entre dispositivos.
- No asumas que una sesión activa permite edición colaborativa simultánea.
- Comprueba el estado de sincronización antes de cerrar el navegador si hay cambios pendientes.
- Las sesiones finalizadas se registran en el historial como elementos separados.

La sincronización no sustituye a una estrategia de concurrencia transaccional para edición simultánea. Si el producto necesitara ese escenario, habría que introducir versiones, control optimista de concurrencia o un mecanismo de lease.

## Seguridad y privacidad

- No incluyas credenciales privadas de Admin SDK en archivos servidos al navegador.
- Mantén las reglas de Firestore restringidas al propietario autenticado.
- No utilices reglas abiertas de prueba en producción.
- Cierra sesión en dispositivos compartidos.
- No registres contraseñas, tokens ni datos sensibles en logs.
- Verifica las reglas con cuentas distintas antes de dar por validado el aislamiento entre usuarios.

La configuración web de Firebase se distribuye al cliente y no sustituye las reglas de seguridad. Consulta [docs/firebase-setup.md](firebase-setup.md).

## Pruebas y validación

Las pruebas automatizadas de `npm test` cubren la lógica del core y parte de la integración estática de las interfaces. No equivalen a una prueba de extremo a extremo contra Firebase.

Para validar la sincronización real se necesita:

1. Un proyecto Firebase accesible.
2. Authentication y Firestore habilitados.
3. Las reglas publicadas.
4. Dos navegadores o dispositivos con la misma cuenta.
5. Pruebas de creación y actualización de perfiles, historial, fallos y sesiones.
6. Pruebas de pérdida y recuperación de conexión.
7. Pruebas con cuentas diferentes para comprobar el aislamiento.

No se debe afirmar que la sincronización remota está validada únicamente porque las pruebas unitarias locales pasen.

## Evolución posible

### IndexedDB como almacenamiento principal

El adaptador actual utiliza `localStorage`. IndexedDB podría ser adecuado si el volumen de datos aumenta o se necesitan transacciones y consultas locales más complejas. La migración debe conservar los datos existentes y probarse con perfiles y simuladores ya utilizados.

### Otros proveedores

El core debe seguir desacoplado del proveedor remoto. Si en el futuro se adopta otro backend, debe implementarse un adaptador independiente que respete el contrato de eventos y datos, sin introducir dependencias del proveedor dentro de `simulador-core.js`.

La sustitución de Firebase por otro backend no está implementada actualmente.
