# 🎯 Guía de Perfiles y Sincronización de Datos

## ✅ **Problemas Resueltos**

### 1. ✨ **Diseño de Selección de Temas**
- ✅ Los checkboxes ahora **no se salen del recuadro**
- Se añadió `overflow: hidden` y `text-overflow: ellipsis` para que el texto se corte correctamente
- Los checkboxes tienen `flex-shrink: 0` para mantener su tamaño

### 2. 👥 **Sistema de Perfiles Separados**
- ✅ Cada usuario puede tener su **perfil independiente**
- Los fallos de cada perfil están **completamente separados**
- No se mezclan los datos entre diferentes usuarios

---

## 📱 **Cómo Sincronizar Entre Dispositivos**

### **Paso 1: Exportar Fallos**
1. En el **dispositivo origen** (ej: tu ordenador):
   - Ve a la pantalla inicial del simulador
   - Haz clic en **"Exportar Fallos"**
   - Se descargará un archivo JSON (ej: `fallos_TuNombre_1234567890.json`)

### **Paso 2: Transferir el Archivo**
Puedes usar cualquiera de estos métodos:

- 📧 **Email**: Envíate el archivo a ti mismo
- ☁️ **Google Drive / OneDrive**: Súbelo a la nube
- 💬 **WhatsApp**: Envíatelo a ti mismo
- 📲 **USB / Bluetooth**: Transferencia directa

### **Paso 3: Importar en el Otro Dispositivo**
1. En el **dispositivo destino** (ej: tu móvil):
   - Abre el simulador
   - Selecciona o crea el mismo perfil
   - Haz clic en **"Importar Fallos"**
   - Selecciona el archivo JSON descargado
   - Confirma la importación

---

## 👤 **Gestión de Perfiles**

### **Crear un Nuevo Perfil**
1. Haz clic en **"+ Nuevo"**
2. Escribe tu nombre (ej: "Juan")
3. Automáticamente se crea tu perfil y se selecciona

### **Cambiar de Perfil**
- Usa el selector desplegable para cambiar entre perfiles
- Los fallos se cargan automáticamente según el perfil seleccionado

### **Eliminar un Perfil**
1. Selecciona el perfil que quieres eliminar
2. Haz clic en **"Eliminar"**
3. Confirma la acción
4. ⚠️ **Nota**: No puedes eliminar el perfil "Usuario Principal"

---

## 🤝 **Uso con Amigos**

### **Escenario: Tú y tu Amigo Usáis el Mismo Ordenador**

#### **Opción 1: Perfiles Separados en el Mismo Navegador**
1. **Tu perfil**: Crea un perfil con tu nombre (ej: "María")
2. **Perfil del amigo**: Crea otro perfil (ej: "Carlos")
3. Cada uno selecciona su perfil al usar el simulador
4. Los fallos se guardan por separado ✅

#### **Opción 2: Diferentes Navegadores**
- **Tú**: Usas Chrome con el perfil "Usuario Principal"
- **Tu amigo**: Usa Firefox o Edge
- Los datos están completamente separados

---

## 📊 **Información del Perfil**

Debajo del selector de perfil verás:
- 📊 **Fallos registrados**: Cantidad actual de preguntas falladas
- 📅 **Fecha de creación**: Cuándo se creó el perfil (si es personalizado)

---

## 💾 **Formato del Archivo Exportado**

El archivo JSON contiene:

```json
{
  "perfil": "perfil_1234567890",
  "nombrePerfil": "María",
  "fallos": [
    {
      "cuestion": "¿Qué es un proceso?",
      "opciones": ["..."],
      "respuesta": 2,
      "respuestaUsuario": 1,
      "respuestaCorrecta": 2,
      "fecha": "2026-01-13T12:30:00.000Z"
    }
  ],
  "fecha": "2026-01-13T12:30:00.000Z"
}
```

---

## ⚙️ **Ventajas del Sistema**

### ✅ **Separación Total de Datos**
- Cada perfil tiene sus propios fallos
- No hay interferencia entre usuarios

### ✅ **Sincronización Manual Segura**
- Tú controlas cuándo y dónde sincronizar
- No se necesita conexión constante a internet
- Privacidad total

### ✅ **Portabilidad**
- Lleva tus datos a cualquier dispositivo
- Funciona en móvil, tablet, ordenador
- Solo necesitas el archivo JSON

### ✅ **Backup Automático**
- Cada exportación es un backup
- Puedes guardar múltiples versiones
- Recupera datos en caso de pérdida

---

## 🔄 **Flujo de Trabajo Recomendado**

### **Para Uso Personal en Múltiples Dispositivos**
1. **Al finalizar el día en el ordenador**:
   - Exporta tus fallos
   - Súbelos a Google Drive / OneDrive

2. **Al usar el móvil**:
   - Descarga el archivo más reciente
   - Impórtalo en el móvil
   - Sigue estudiando

3. **Antes de volver al ordenador**:
   - Exporta desde el móvil
   - Importa en el ordenador
   - Mantén todo sincronizado

### **Para Uso Compartido con Amigos**
1. **Cada usuario crea su perfil**:
   - María → Perfil "María"
   - Carlos → Perfil "Carlos"

2. **Al usar el simulador**:
   - Cada uno selecciona su perfil
   - Los datos no se mezclan

3. **Sincronización individual**:
   - Cada uno exporta/importa solo sus datos
   - Total independencia

---

## 🛠️ **Solución de Problemas**

### **No aparece mi perfil en el otro dispositivo**
- Los perfiles se crean localmente en cada dispositivo
- Solución: Crea el mismo perfil en el nuevo dispositivo y luego importa los fallos

### **Importé los fallos pero no aparecen**
- Verifica que hayas seleccionado el perfil correcto antes de importar
- Los fallos se importan al perfil actualmente seleccionado

### **Quiero fusionar fallos de dos dispositivos**
1. Exporta desde dispositivo A
2. Exporta desde dispositivo B
3. Importa archivo A en dispositivo B (o viceversa)
4. Los fallos se reemplazan, no se fusionan
5. Solución: Mantén un dispositivo como "maestro" y sincroniza siempre desde/hacia él

---

## 📝 **Notas Importantes**

- ⚠️ **Los perfiles se almacenan localmente en cada navegador**: Usar Chrome en un ordenador y Safari en otro son entornos completamente diferentes
- ⚠️ **Importar reemplaza los fallos actuales**: No se suman, se reemplazan. Asegúrate de exportar primero si tienes datos importantes
- ✅ **El perfil "Usuario Principal" no se puede eliminar**: Es el perfil por defecto
- ✅ **Los datos nunca se envían a internet**: Todo se guarda en tu dispositivo

---

## 🎓 **Ejemplos de Uso**

### **Ejemplo 1: Estudiante con Móvil y Ordenador**
- **Lunes en casa (ordenador)**: Practica y falla 15 preguntas → Exporta
- **Martes en el bus (móvil)**: Importa los 15 fallos → Repasa
- **Miércoles en casa (ordenador)**: Importa los datos del móvil actualizado

### **Ejemplo 2: Dos Amigos Compartiendo Ordenador**
- **María**: Perfil "María" → 20 fallos registrados
- **Carlos**: Perfil "Carlos" → 35 fallos registrados
- Cada uno solo ve sus propios fallos cuando selecciona su perfil

### **Ejemplo 3: Backup de Seguridad**
- Exporta tus fallos cada semana
- Guárdalos en carpeta "Backups"
- Si algo falla, siempre puedes recuperar

---

## 💡 **Consejos Pro**

1. **Nombra los archivos de forma descriptiva**:
   - ❌ `fallos_Maria_1234567890.json`
   - ✅ `2026-01-13_fallos_Maria_50preguntas.json`

2. **Exporta regularmente**:
   - Antes de borrar caché del navegador
   - Antes de actualizar el sistema
   - Cada semana como backup

3. **Usa carpetas en la nube**:
   - Crea una carpeta "Simulador ISO"
   - Súbela a Drive/OneDrive
   - Acceso desde cualquier dispositivo

---

¿Tienes más dudas? ¡Prueba el sistema! Es muy intuitivo 🚀
