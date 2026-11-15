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

### A. Cloudflare Pages Functions + D1

Es la recomendación principal si priorizamos coste bajo y control. Pages Functions permite ejecutar lógica de servidor en Cloudflare y acceder a D1 mediante bindings. D1 es SQL gestionado. Para autenticación puede integrarse Better Auth con una base compatible; requiere implementar y probar correctamente las rutas, sesiones y controles de acceso.

Según las cuotas oficiales consultadas, Workers Free incluye 100.000 requests/día; D1 Free incluye 5 millones de filas leídas/día, 100.000 escritas/día y 5 GB de almacenamiento. Al alcanzar los límites diarios, las consultas pueden fallar hasta el siguiente periodo o hasta ampliar el plan.

### B. Firebase Authentication + Cloud Firestore

Es la opción con menor complejidad de sincronización cliente. Firebase gestiona autenticación; Firestore Security Rules restringe el acceso por usuario. El SDK web permite persistencia offline y sincroniza cambios al recuperar conexión. Para escrituras concurrentes sobre el mismo documento usa last-write-wins. Es conveniente diseñar documentos pequeños para evitar colisiones. El plan Spark ofrece cuotas sin coste, pero hay límites gratuitos y facturación en el plan Blaze.

### C. Supabase

Sigue siendo técnicamente válido. Su plan Free incluye PostgreSQL, Auth y Realtime; la página de precios publica 500 MB de base de datos, 50.000 MAU y 2 millones de mensajes Realtime. Los proyectos Free pueden pausarse tras una semana de inactividad.

El código actual de SegSisSw crea cuentas con correo sintético `@cuenta.simulador.invalid`, requiere desactivar confirmación por correo, intercepta escrituras globales de localStorage y replica una instantánea JSON completa con lógica manual de revisiones y fusiones. Esto concentra responsabilidades en el navegador y dificulta separar fallos de autenticación, RLS, Realtime y conflictos.

No se puede determinar por qué falló tu instancia sin el error exacto de consola/respuesta y el estado del proyecto. Antes de descartar Supabase habría que comprobar confirmación de email, URL y publishable key, políticas RLS, publicación Realtime y si el proyecto está pausado.

## Plan de evolución

1. Completar core y pruebas en CalSisSw.
2. Evolucionar almacenamiento local de localStorage a IndexedDB.
3. Diseñar SyncProvider con cola/outbox y cursor de cambios.
4. Implementar backend Cloudflare Pages Functions + D1 y autenticación recuperable.
5. Probar dos navegadores/dispositivos, offline, colisión simultánea, cierre de sesión, recuperación y reanudación.
6. Migrar el resto de simuladores al core una vez validado el contrato.

## Alcance de esta rama

CalSisSw incorpora el core común inicial, perfiles locales, historial, exportación/importación, sesiones recuperables, modo de fallos, PWA básica y pruebas unitarias. La sincronización automática cloud, SRS avanzado y editor de preguntas quedan para fases posteriores.


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
- Firestore offline persistence: https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Supabase precios y límites del plan Free: https://supabase.com/pricing
- Supabase pausa de proyectos Free: https://supabase.com/docs/guides/platform/free-project-pausing

Las cuotas y precios pueden cambiar; se deben volver a comprobar antes de desplegar.
