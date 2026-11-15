# Configurar Firebase para CalSisSw

Esta integración utiliza Firebase Authentication con correo/contraseña y Cloud Firestore. El proyecto web puede seguir desplegándose en GitHub Pages.

## 1. Crear el proyecto Firebase

1. Abre https://console.firebase.google.com/
2. Crea un proyecto nuevo.
3. En el proyecto, añade una aplicación web desde Configuración del proyecto > General > Tus aplicaciones (icono `</>`).
4. Copia el objeto de configuración web que muestra Firebase. No uses credenciales de Admin SDK ni archivos de cuenta de servicio.

La configuración web contiene identificadores públicos del proyecto. No son contraseñas. El acceso a los datos se controla mediante Authentication y las reglas de Firestore.

## 2. Activar autenticación

1. Abre Authentication > Sign-in method.
2. Activa **Correo electrónico/contraseña**.
3. Guarda los cambios.
4. En Authentication > Settings > Authorized domains, confirma que aparecen:
   - `localhost` para pruebas locales.
   - `ivanmb07.github.io` para GitHub Pages.

Cada usuario tendrá una cuenta Firebase propia. No se derivan correos ficticios del nombre del perfil.

## 3. Crear Firestore

1. Abre Firestore Database.
2. Crea la base de datos en modo producción.
3. Selecciona una ubicación y termina el asistente.
4. En la pestaña Rules, pega el contenido completo de `firestore.rules` y publícalo.

También puedes publicar las reglas desde la raíz del repositorio con Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project TU_PROJECT_ID
```

El `firebase.json` del repositorio ya apunta a `firestore.rules`. No actives reglas de prueba que permitan lectura/escritura pública.

## 4. Introducir la configuración web en el repositorio

Abre `common/firebase/firebase-config.js` y sustituye los valores vacíos por los de tu aplicación web Firebase:

```js
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  appId: "TU_APP_ID",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  storageBucket: "TU_PROJECT_ID.firebasestorage.app"
};
```

Copia exactamente los valores que entrega Firebase; el ejemplo no sustituye la configuración real. El archivo se sirve al navegador y sus valores no son secretos. No añadas nunca una clave Admin SDK o una clave privada al frontend.

Después, confirma ese cambio en la rama `simualdor-CalSisSw` y publícala en GitHub Pages cuando quieras hacer la prueba desde fuera de localhost.

## 5. Probar la sincronización

1. Abre el simulador desde `http://localhost:8000/simulador-CalSisSw/` o desde la URL de GitHub Pages.
2. En la sección **Sincronización entre dispositivos**, crea una cuenta con tu correo y una contraseña de al menos 6 caracteres.
3. Cierra sesión e inicia sesión para verificar la persistencia de la cuenta.
4. Abre el simulador en otro navegador/dispositivo e inicia sesión con la misma cuenta.
5. Comprueba que aparecen los mismos perfiles, historial y preguntas falladas. Para generar sesiones de examen necesitarás que el banco tenga suficientes preguntas; de momento `preguntas.json` se mantiene vacío por decisión del proyecto.

El botón **Sincronizar ahora** permite solicitar una sincronización manual. En funcionamiento normal, los cambios locales se guardan primero y el SDK los envía cuando hay conexión.

## 6. Qué se sincroniza

- Perfiles.
- Historial de exámenes/prácticas, con sus preguntas, resultados, fechas y errores.
- Preguntas falladas por perfil.
- Sesión activa para poder reanudarla en otro dispositivo.

El banco `preguntas.json` no se sube a Firestore: sigue versionado con el código del simulador.

## 7. Consideraciones de sincronización

- Firestore mantiene una caché IndexedDB persistente en navegadores compatibles y sincroniza escrituras pendientes cuando vuelve la conexión. El SDK utiliza persistencia multi-pestaña.
- El historial se guarda como documentos individuales, no como una única instantánea JSON por cuenta.
- La sesión activa actual de un perfil utiliza un documento compartido. Si se responde simultáneamente a la misma sesión desde dos dispositivos, Firestore aplica su política de última escritura; utiliza una sola sesión por perfil a la vez.
- Los datos siguen disponibles localmente aunque el usuario cierre sesión. Cerrar sesión detiene la sincronización, no elimina el progreso local.
- El borrado de perfil se propaga como tombstone y limpia las colecciones de CalSisSw de ese perfil.
- La caché local de Firestore es persistente en el navegador; en dispositivos compartidos, cierra sesión al terminar y evita guardar credenciales en perfiles de navegador que no controles.

## Referencias oficiales

- Firebase Web setup: https://firebase.google.com/docs/web/setup
- Firebase Authentication para web: https://firebase.google.com/docs/auth/web/start
- Firestore offline persistence: https://firebase.google.com/docs/firestore/manage-data/enable-offline
- Firestore Security Rules: https://firebase.google.com/docs/firestore/security/rules-conditions

La integración del repositorio no puede completar la creación del proyecto Firebase ni conocer sus credenciales. Esa parte debe realizarse desde tu Firebase Console.
