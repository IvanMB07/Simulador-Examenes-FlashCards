# Arquitectura de persistencia y sincronización

## Decisión

Mantener la aplicación estática en GitHub Pages es compatible con una arquitectura local-first. Pages sirve HTML, CSS y JavaScript; no ejecuta lógica de servidor ni proporciona base de datos propia. La aplicación sí puede consumir una API HTTPS externa.

La regla de producto será: guardar primero en el dispositivo y sincronizar después. Ningún fallo de red o autenticación debe bloquear una sesión de estudio.

## Capas

1. **Interfaz por asignatura**: pantallas, textos y controles.
2. **Configuración**: identificador, banco de preguntas, número de preguntas, duración, temas y puntuación.
3. **Core común**: motor, selección, evaluación, perfiles, fallos, historial y sesión activa.
4. **Persistencia local**: adaptador local. Esta versión usa localStorage; IndexedDB es la evolución recomendada si aumenta el volumen.
5. **SyncProvider**: cola de cambios, envío, lectura de cambios remotos y resolución de conflictos.
6. **Backend**: autenticación, autorización, validación y base de datos.

El core no debe importar SDK de Supabase, Firebase ni Cloudflare. El proveedor remoto debe ser una capa independiente.

## Modelo remoto propuesto

Evitar replicar el localStorage completo en una única fila JSON. Es sencillo al principio, pero obliga a resolver conflictos sobre un documento grande y puede sobrescribir modificaciones independientes.

Separar al menos:
- users: identidad de autenticación.
- profiles: perfiles de estudio asociados a la cuenta.
- simulator_settings: ajustes por perfil y simulador.
- exam_sessions: fecha, modo, duración, aciertos, errores, blancas, nota y errores.
- active_sessions: estado serializado de una sesión inacabada.
- question_progress: estado SRS por pregunta (intervalo, facilidad, próximo repaso, aciertos y fallos).

Cada registro sincronizable debe incluir id, user_id, profile_id, simulator_id y updated_at. Para borrados se recomienda deleted_at. Las sesiones finalizadas deberían ser inmutables; una sesión activa editada en dos dispositivos necesita versión/lease y aviso de conflicto.

## Flujo de sincronización

1. Guardar localmente al realizar cada acción.
2. Marcar los registros como pendientes.
3. Enviar cambios cuando haya red y usuario autenticado.
4. Validar en servidor la propiedad del perfil y del registro.
5. Descargar cambios posteriores al último cursor sincronizado.
6. Aplicar cambios remotos sin volver a encolarlos.
7. Fusionar por entidad; no reemplazar el estado completo.
8. Reintentar con espera incremental cuando se recupere la conexión.

No usar el nombre visible como identidad ni generar direcciones de correo artificiales a partir de él. La cuenta debe tener un identificador estable y método de recuperación.

## Backends

### A. Firebase Authentication + Cloud Firestore — opción recomendada para la primera sincronización

Es la opción más directa si el objetivo prioritario es que la app funcione offline y sincronice automáticamente cuando vuelva la conexión. El SDK web de Firestore mantiene una caché local y sincroniza los cambios pendientes al recuperar red. En web hay que activar expresamente la persistencia offline; si dos dispositivos modifican el mismo documento, la política habitual es last-write-wins.

Para limitar conflictos, no se debe guardar todo el progreso en un único documento. Cada examen finalizado debe ser un documento independiente con un ID estable; el estado de una sesión activa debe tener su propio documento; y el progreso SRS debe separarse por pregunta. Así, dos dispositivos pueden crear sesiones distintas sin sobrescribirse.

Cuotas publicadas del nivel gratuito Spark para Cloud Firestore: 1 GiB de datos, 50.000 lecturas/día, 20.000 escrituras/día, 20.000 eliminaciones/día y 10 GiB/mes de transferencia. Al superar una cuota gratuita, el producto puede quedar bloqueado durante el resto del periodo hasta el siguiente reinicio o hasta cambiar de plan. Para uso personal y de estudio estas cuotas parecen holgadas, pero deben monitorizarse.

Ventajas: autenticación gestionada, SDK cliente, caché offline y sincronización automática sin construir un servidor propio. Inconvenientes: modelo documental, reglas de seguridad que hay que probar, dependencia de Google y comportamiento last-write-wins si dos dispositivos modifican el mismo documento simultáneamente.

### B. Cloudflare Workers/Pages Functions + D1 + autenticación

Es la opción que ofrece más control y un modelo SQL. Pages Functions puede utilizar D1 mediante bindings. Se puede mantener GitHub Pages y consumir un Worker API independiente por HTTPS; eso exige CORS y gestionar el token de sesión. O se puede mover el frontend a Cloudflare Pages y alojar las rutas API como Functions en el mismo proyecto, lo que evita CORS entre app y API.

Better Auth dispone de integración con D1, pero sigue siendo necesario configurar las rutas, migraciones, sesiones, secretos y autorización. Hay un detalle importante de coste/rendimiento: Workers Free permite 100.000 peticiones al día, pero limita cada petición a 10 ms de CPU. Las operaciones de autenticación y hashing de contraseñas deben probarse con la versión exacta de Better Auth y con el plan real; hubo un informe de consumo de CPU excesivo en una versión anterior de Better Auth en Cloudflare Workers.

D1 Free incluye 5 millones de filas leídas/día, 100.000 filas escritas/día y 5 GB de almacenamiento total. Si se supera la cuota diaria de D1, las consultas dejan de ejecutarse hasta el reinicio o hasta ampliar el plan.

Ventajas: SQL, control del esquema, coste de infraestructura bajo y despliegue integrado con el frontend si se usa Cloudflare Pages. Inconvenientes: hay que desarrollar el protocolo de sincronización local/remoto, la cola de operaciones, los cursores, los conflictos y la autenticación. No ofrece por sí solo el comportamiento offline/sync gestionado de Firestore.

### C. Supabase

Sigue siendo técnicamente válido y ofrece PostgreSQL, Auth y Realtime. El plan Free publica 500 MB de base de datos, 50.000 usuarios activos mensuales y 2 millones de mensajes Realtime. Los proyectos Free con poca actividad pueden pausarse tras siete días.

En el código actual de SegSisSw, la tabla `study_sync` guarda una instantánea JSONB completa por usuario, con número de revisión y lógica de fusión de conflictos. El cliente intercepta métodos de `Storage.prototype` para detectar escrituras locales y la identidad se forma con un correo sintético `@cuenta.simulador.invalid`. La confirmación de email debe estar desactivada y no existe recuperación convencional de contraseña. La clave del archivo de configuración es una publishable key, diseñada para estar en el cliente; no es una `service_role` y no debe confundirse con una clave secreta.

El SQL incluido habilita RLS y filtra por `auth.uid() = user_id`, además de añadir la tabla a Realtime. No he encontrado en los archivos una prueba E2E que demuestre que la sincronización ha funcionado con dos dispositivos: el documento de revisión del propio ZIP indica que no se verificó una sincronización real contra Supabase. Por eso no puedo atribuir el fallo a una única causa sin consultar los errores de consola/red y el estado del proyecto.

Antes de descartar Supabase conviene comprobar: que el proyecto no esté pausado; que la confirmación de email esté desactivada; que URL y publishable key correspondan al mismo proyecto; que la tabla y sus políticas RLS existan; que Realtime esté suscrito correctamente; y qué respuesta HTTP devuelve Auth o `study_sync`.

## Recomendación

Para la primera versión con sincronización automática, probaría **Firebase Authentication + Firestore**: permite mantener GitHub Pages y reduce mucho el código de sincronización que tendríamos que mantener. Mantendría el core independiente del proveedor para que, si más adelante se necesita SQL o lógica de servidor propia, podamos implementar un proveedor Cloudflare D1 sin reescribir el simulador.

Si el objetivo principal pasa a ser controlar toda la infraestructura en SQL y aprovechar Cloudflare, entonces escogería Workers + D1, pero solo después de probar el consumo de CPU del flujo de autenticación y construir el SyncProvider correctamente. No usaría otra vez un único JSON global por usuario como contrato de persistencia.

## Plan de evolución

1. Completar el core y pruebas de CalSisSw.
2. Evolucionar almacenamiento local de localStorage a IndexedDB.
3. Implementar Firebase Authentication + Firestore mediante un proveedor independiente.
4. Diseñar reglas de seguridad y el esquema documental por usuario, perfil, simulador, sesión y pregunta.
5. Probar dos dispositivos, offline, colisiones, recuperación de cuenta y reanudación.
6. Migrar el resto de simuladores al core una vez validado el contrato.

## Alcance de esta rama

CalSisSw incorpora el core común inicial, perfiles locales, historial, exportación/importación, sesiones recuperables, modo de fallos, PWA, Firebase Authentication + Firestore, reglas de seguridad y pruebas unitarias. El proyecto Firebase debe crearse y configurarse mediante [docs/firebase-setup.md](firebase-setup.md). La sincronización real entre dispositivos queda pendiente de esa configuración y de una prueba de extremo a extremo.


## Topología de despliegue

GitHub Pages puede seguir alojando el frontend estático y llamar a un Worker API independiente mediante HTTPS. En ese escenario hay que configurar CORS, enviar el token de sesión en cada petición y mantener los secretos solo en el entorno del Worker.

La alternativa con menos piezas operativas es mover el frontend a Cloudflare Pages y alojar las rutas API como Pages Functions en el mismo proyecto, usando D1 mediante bindings. Esto evita CORS entre frontend y API. No es obligatorio hacer ese cambio para tener backend: GitHub Pages + Worker API + D1 también es viable.

## Referencias oficiales consultadas

- GitHub Pages y sus límites de alojamiento estático: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Cloudflare Pages Functions y bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Pages Functions, cuotas: https://developers.cloudflare.com/pages/functions/pricing/
- Cloudflare Workers, límites y precios: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare D1, cuotas y precios: https://developers.cloudflare.com/d1/platform/pricing/
- Better Auth en Cloudflare Workers: https://better-auth.com/docs/guides/cloudflare
- Better Auth 1.5 y soporte D1: https://better-auth.com/blog/1-5
- Límites de CPU de Cloudflare Workers: https://developers.cloudflare.com/workers/platform/limits/
- Informe de CPU en autenticación Better Auth/Workers: https://github.com/better-auth/better-auth/issues/8860
- Cuotas de Firestore: https://firebase.google.com/docs/firestore/quotas
- Planes y límites Spark de Firebase: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Firestore offline persistence: https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Supabase precios y límites del plan Free: https://supabase.com/pricing
- Supabase pausa de proyectos Free: https://supabase.com/docs/guides/platform/free-project-pausing

Las cuotas y precios pueden cambiar; se deben volver a comprobar antes de desplegar.


## Implementación Firebase en CalSisSw

El proveedor independiente está en `common/firebase/firebase-sync.js`; no se importa desde el core. Utiliza el SDK modular de Firebase 13.3.0 mediante módulos ESM del CDN oficial, fijado a una versión concreta para evitar cambios inesperados. Firebase recomienda la API modular y documenta el uso de módulos browser desde gstatic para proyectos ESM sin bundler. <Cite refs={["turn171593search1"]}/>

La inicialización solicita `persistentLocalCache` con `persistentMultipleTabManager`, para que Firestore use IndexedDB y comparta la caché entre pestañas compatibles. <Cite refs={["turn857793search1","turn857793search7"]}/>

Los datos se organizan por UID y perfil:
- `users/{uid}/profiles/{profileId}`
- `.../simulators/{simulatorId}/examSessions/{sessionId}`
- `.../simulators/{simulatorId}/failedQuestions/{questionIdHash}`
- `.../simulators/{simulatorId}/activeSessions/current`

Las reglas de `firestore.rules` conceden acceso únicamente si `request.auth.uid` coincide con el UID del propietario. Firebase recomienda restringir acceso por propietario y aplicar reglas explícitas también a las subcolecciones. <Cite refs={["turn171593search0","turn857793search3","turn171593search5"]}/>

La sesión activa es un documento único por perfil y simulador. Si dos dispositivos escriben concurrentemente sobre la misma sesión activa, Firestore aplica última escritura; el proveedor no intenta fusionar respuestas simultáneas de una misma pregunta. Esta restricción debe conservarse en las pruebas de dos dispositivos.

La configuración real de Firebase no está incluida: `common/firebase/firebase-config.js` se deja como plantilla vacía. Consulta `docs/firebase-setup.md`.
