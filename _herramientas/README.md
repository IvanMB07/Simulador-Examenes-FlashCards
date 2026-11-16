# Herramientas auxiliares

Esta carpeta contiene utilidades de mantenimiento compartidas por los simuladores. La idea es centralizar las operaciones sobre los bancos de preguntas y evitar mantener copias distintas de la misma herramienta en cada asignatura.

## Rebalanceador universal de respuestas

El rebalanceador permite analizar y modificar bancos de preguntas en formato JSON para equilibrar la posición de las respuestas correctas.

### Archivos

| Archivo | Función |
|---|---|
| `Ejecutar_Rebalanceador_Universal.bat` | Lanzador para Windows. Abre la aplicación gráfica. |
| `rebalanceador_respuestas_gui.pyw` | Implementación Python de la interfaz y de las operaciones sobre los bancos. |

### Requisitos

- Windows para utilizar el archivo `.bat`.
- Python 3 instalado y asociado a los archivos `.pyw`.
- Tkinter disponible en la instalación de Python.

La aplicación utiliza únicamente módulos de la biblioteca estándar de Python.

### Cómo utilizarlo

1. Ejecuta `Ejecutar_Rebalanceador_Universal.bat`.
2. Selecciona un archivo JSON de preguntas o una carpeta que contenga varios bancos.
3. Revisa el análisis y la distribución actual de respuestas correctas.
4. Ejecuta el rebalanceo cuando el banco seleccionado sea el esperado.
5. Comprueba el resultado y conserva la copia de seguridad generada.

La herramienta busca archivos JSON cuyo nombre empiece por `preguntas` cuando se procesa una carpeta. No procesa cualquier JSON de forma indiscriminada.

### Operaciones disponibles

**1. Reequilibrar las respuestas A/B/C/D**

- Cuenta la distribución de las soluciones.
- Reubica el texto de la opción correcta en la letra que corresponda para equilibrar el conjunto.
- Mantiene el contenido de las opciones y actualiza el campo `solucion`.
- Omite preguntas que no tengan al menos cuatro opciones válidas o una solución A/B/C/D reconocible.
- Omite preguntas con más de una letra de solución, ya que no son compatibles con el rebalanceo de respuesta única.

**2. Renumerar preguntas por tema**

Reconoce identificadores con una estructura similar a:

```text
CODIGO-TEMA-NUMERO-Pregunta: ...
```

Renumera las preguntas dentro de cada tema y conserva el resto del identificador. Solo afecta a los identificadores que coinciden con el patrón admitido por la herramienta.

**3. Procesar archivos o carpetas**

- Permite trabajar sobre un banco individual.
- Permite recorrer una carpeta y procesar los archivos `preguntas*.json` encontrados.
- Admite bancos en formato de lista de preguntas y listas envueltas en otra lista.

**4. Copias de seguridad**

La herramienta crea una copia del archivo original antes de guardar los cambios, con un sufijo temporal similar a:

```text
preguntas.json.bak-20261116-120000.json
```

Conserva esa copia hasta haber validado el banco modificado. No incluyas los backups en un commit salvo que exista una razón concreta para versionarlos.

## Recomendaciones antes de modificar un banco

- Comprueba que has seleccionado la asignatura correcta.
- Revisa que las preguntas de respuesta múltiple no se estén tratando como preguntas de respuesta única.
- Verifica la distribución final de las soluciones.
- Comprueba que el JSON sigue siendo válido.
- Revisa algunos enunciados y opciones para confirmar que la respuesta correcta no ha cambiado semánticamente.
- Ejecuta las pruebas del repositorio desde la raíz:

```bash
npm test
```

El rebalanceador modifica los archivos seleccionados directamente después de crear su backup. Utilízalo sobre una rama de trabajo y revisa el diff antes de confirmar los cambios.

## Mantenimiento

Si se incorpora otra herramienta compartida, documenta aquí su propósito, requisitos, archivos de entrada/salida, forma de ejecución y limitaciones. Las utilidades específicas de una sola asignatura pueden permanecer en su carpeta si no aportan reutilización fuera de ella.
