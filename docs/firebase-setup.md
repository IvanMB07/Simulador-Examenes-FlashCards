# Firebase: configuración y verificación

Los siete simuladores principales integran el proveedor común de sincronización situado en `common/firebase/`. Utiliza Firebase Authentication para identificar la cuenta y Cloud Firestore para sincronizar datos de estudio.

La aplicación sigue siendo estática y puede servirse desde GitHub Pages. Si Firebase no está disponible o no hay una sesión iniciada, el progreso continúa guardándose localmente.

## Estado de la configuración del repositorio

El archivo `common/firebase/firebase-config.js` ya contiene la configuración web del proyecto Firebase utilizado por el repositorio. No es necesario sustituirla para utilizar la configuración actual.

Los valores de configuración web (por ejemplo, API key, identificador de proyecto y app ID) identifican el proyecto y se entregan al navegador. No son credenciales de Admin SDK. No añadas claves privadas, archivos de cuenta de servicio ni secretos de servidor al frontend.

Si en el futuro se utiliza otro proyecto Firebase, actualiza ese archivo con los valores de la aplicación web correspondiente y verifica que las reglas publicadas pertenecen al mismo proyecto.

## 1. Servicios necesarios

En Firebase Console, comprueba el proyecto asociado a la configuración del repositorio:

1. En **Authentication → Sign-in method**, habilita el proveedor **Correo electrónico/contraseña**.
2. En **Authentication → Settings → Authorized domains**, incluye el dominio desde el que se sirve la aplicación.
   - Para desarrollo local: `localhost`.
   - Para GitHub Pages: el dominio de publicación que corresponda a este repositorio.
3. En **Firestore Database**, comprueba que la base de datos está creada y disponible.

Los nombres y la ubicación exacta de las opciones de Firebase Console pueden cambiar con el tiempo.

## 2. Reglas de Firestore

El repositorio incluye las reglas en `firestore.rules` y la referencia de despliegue en `firebase.json`.

Las reglas limitan las operaciones a la cuenta autenticada cuyo UID coincide con el UID propietario de la ruta. No publiques reglas abiertas de prueba que permitan leer o escribir datos de cualquier usuario.

Para publicar las reglas con Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

Ejecuta el despliegue desde la raíz del repositorio y comprueba que Firebase CLI está apuntando al proyecto correcto antes de publicar.

## 3. Probar un simulador

1. Sirve el repositorio por HTTP o abre la versión publicada.
2. Entra en cualquiera de los siete simuladores basados en el core.
3. Localiza el apartado de sincronización entre dispositivos.
4. Registra una cuenta de prueba o inicia sesión.
5. Comprueba que el estado de sincronización cambia a conectado/sincronizado.
6. Crea un perfil adicional o genera progreso de prueba.
7. Abre el mismo simulador en otro navegador o dispositivo e inicia sesión con la misma cuenta.
8. Comprueba que los datos compatibles aparecen en el segundo entorno.

Haz la primera prueba con datos no importantes. No utilices como única verificación que la interfaz muestre una cuenta conectada: comprueba también que los datos aparecen en el otro navegador.

## 4. Datos que gestiona el proveedor

La implementación actual contempla la sincronización de:

- Perfiles de estudio.
- Historial de sesiones.
- Preguntas falladas.
- Sesión activa para continuar una actividad.

El banco de preguntas (`preguntas.json`) se distribuye con el código del repositorio; no se trata como información personal de la cuenta.

La organización remota se realiza bajo el UID de Firebase y separa los datos por perfil y simulador. Las reglas de `firestore.rules` aplican la comprobación de propiedad a las rutas contempladas por la aplicación.

## 5. Comportamiento local y offline

- Las acciones se guardan primero en el almacenamiento local del navegador.
- Firestore utiliza caché local persistente en navegadores compatibles.
- Cuando se recupera la conexión, el SDK puede sincronizar las escrituras pendientes.
- Cerrar sesión detiene la sincronización, pero no equivale a borrar el progreso local.
- Los datos locales se separan por cuenta en el navegador.

La persistencia web de Firestore depende de IndexedDB y de las capacidades del navegador. En navegadores privados o entornos restringidos puede no estar disponible; la aplicación dispone del almacenamiento local propio como base de trabajo.

## 6. Sesiones activas y uso simultáneo

La sesión activa de un perfil y simulador se representa mediante un documento compartido. Si dos dispositivos modifican simultáneamente esa misma sesión, puede prevalecer la última escritura. Por tanto, utiliza una única sesión activa por perfil y simulador cuando trabajes desde varios dispositivos.

El historial de sesiones finalizadas y las preguntas falladas tienen identificadores propios y se sincronizan por separado.

## 7. Diagnóstico

Si el estado no llega a sincronizado, comprueba:

- Que el navegador tiene conexión.
- Que el dominio actual está autorizado en Firebase Authentication.
- Que el proveedor de correo/contraseña está habilitado.
- Que la configuración web del archivo `common/firebase/firebase-config.js` corresponde al proyecto esperado.
- Que Firestore está creado y las reglas de `firestore.rules` se han publicado en ese mismo proyecto.
- Que la consola del navegador no muestra errores de autenticación, permisos o carga de módulos desde `www.gstatic.com`.

No publiques capturas que expongan datos personales de cuentas, tokens o información de sesión.

## Referencias oficiales

- [Añadir Firebase a una aplicación web](https://firebase.google.com/docs/web/setup)
- [Autenticación con correo y contraseña en web](https://firebase.google.com/docs/auth/web/password-auth)
- [Persistencia offline de Cloud Firestore](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Reglas de seguridad de Cloud Firestore](https://firebase.google.com/docs/firestore/security/get-started)

Esta guía describe la configuración del repositorio; la disponibilidad real del proyecto, sus cuotas y el estado de sus servicios deben comprobarse en Firebase Console.
