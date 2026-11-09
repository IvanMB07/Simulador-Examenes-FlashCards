# Revisión técnica de la entrega

## Problemas corregidos

1. La comparación de snapshots de sincronización ordenaba solo las claves del objeto superior. Los objetos anidados podían serializarse en distinto orden después de pasar por JSONB, provocar falsos cambios y acabar en una secuencia de aplicación de snapshot/recarga. La comparación ahora ordena recursivamente los objetos y la sincronización remota no usa `location.reload()`.
2. Una escritura local durante una subida podía quedar marcada como sincronizada aunque se hubiera producido después de capturar el snapshot. Ahora se compara la versión local al inicio y al final de la petición.
3. Los conflictos de revisión ya no reemplazan sin más el estado local: se recupera la fila remota, se fusionan cambios locales/remotos compatibles y se vuelve a guardar la revisión combinada.
4. Los fallos de red ya no provocan reintentos cada medio segundo. Se mantiene el estado local y los reintentos usan espera incremental.
5. Al aplicar un snapshot remoto se notifica al código de la aplicación para refrescar los gestores de datos, sin recargar la página.
6. Se incrementó la versión de caché del Service Worker a `segsissw-shell-v5`.

## Funcionalidades restauradas / añadidas

- Control **Modo turbo · Avance automático**. Tras contestar, avanza después de 950 ms; al responder la última pregunta abre los resultados. La preferencia se guarda en `configApp`.
- Acción directa para iniciar otro examen/práctica/test desde la pantalla de resultados, sin volver al menú.
- Indicador de diagnóstico del almacenamiento local.
- Botón **Sincronizar ahora** en el panel cloud.

## Comparación con los archivos sueltos adjuntos

Los archivos sueltos `index(2).html`, `script(3).js` y `styles(3).css` son una versión anterior. Sus identificadores HTML, funciones de aplicación y selectores CSS están presentes en la base del ZIP, que además incluye persistencia de sesión, copia completa y sincronización cloud. El modo turbo y el botón directo de otro examen no aparecen implementados en ninguno de los archivos entregados; se han incorporado según la descripción del usuario.

## Validaciones realizadas

- `node --check`: `script.js`, `cloud-sync.js` y `sw.js` sin errores de sintaxis.
- JSON: `preguntas.json` y `manifest.webmanifest` válidos.
- ZIP: comprobación de integridad al generar el paquete.
- Se ha intentado ejecutar una prueba de navegador automatizada, pero el entorno de ejecución bloquea la navegación a archivos y servidores locales (`ERR_BLOCKED_BY_ADMINISTRATOR`). Por tanto, no se considera realizada una prueba E2E de interfaz.
- No se ha podido verificar una sincronización real contra Supabase ni entre dos dispositivos. Debe hacerse con la cuenta del usuario después de publicar estos archivos.

## Importante

`cloud-config.js` se ha conservado sin cambios respecto al ZIP recibido. No reemplazarlo por una plantilla vacía. No se debe introducir una clave `service_role` o `secret` en ese archivo.
