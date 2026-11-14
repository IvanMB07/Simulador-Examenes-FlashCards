# Activar sincronización entre dispositivos (nombre + código)

La aplicación ya incorpora el cliente de sincronización. Para que la nube funcione hay que conectarla a un proyecto Supabase; no se puede activar sin las credenciales de un proyecto creado por ti.

## 1. Crear el proyecto
1. Entra en https://supabase.com/ y crea un proyecto.
2. En el panel, abre **SQL Editor** y ejecuta el contenido completo de `supabase-setup.sql`.
3. Abre **Project Settings → API** y copia **Project URL** y la **Publishable key** (o la `anon` legacy key).
4. En **Authentication → Providers → Email**, desactiva **Confirm email / Email confirmations**. La aplicación no pide ni utiliza una dirección de correo real: crea internamente un identificador técnico derivado del nombre para utilizar el sistema de cuentas de Supabase.

## 2. Pegar la configuración
Edita `cloud-config.js`:

```js
window.SIMULADOR_CLOUD_CONFIG = {
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU-PUBLISHABLE-KEY'
};
```

No pongas nunca una `service_role` ni una secret key en este archivo. La tabla aplica Row Level Security y cada usuario solo puede leer y modificar su propia fila.

## 3. Publicar y usar
1. Publica todos los archivos de la carpeta en el mismo hosting HTTPS donde abres el simulador. Conserva `preguntas.json` si lo tienes local.
2. En un dispositivo, abre el simulador, introduce un nombre de usuario y un código personal de al menos 8 caracteres y pulsa **Crear cuenta**.
3. En el otro dispositivo, abre la misma URL y utiliza exactamente el mismo nombre y código, pulsando **Entrar**.
4. El progreso se guarda primero en el navegador y se sincroniza automáticamente cuando hay conexión. Al detectar cambios remotos, el simulador actualiza los datos y recarga la página.

## Consideraciones
- No es necesario facilitar un correo electrónico.
- El código personal funciona como contraseña: guárdalo en un lugar seguro. No hay recuperación por correo en este diseño.
- El proyecto Supabase y su configuración son necesarios para habilitar la sincronización real. Sin ellos, el simulador continúa funcionando localmente.
- La sincronización usa control de revisión y una fusión de cambios cuando dos dispositivos escriben casi a la vez. Los errores de red no bloquean el guardado local.
- Las comparaciones de datos ignoran el orden de las propiedades JSON; esto evita tratar el mismo contenido como distinto por el orden de serialización de JSONB.
- Los cambios recibidos no fuerzan una recarga completa de la aplicación.
- El contenido de preguntas no se sube: solo se sincronizan configuración, perfiles, fallos, historial y sesiones del simulador.
