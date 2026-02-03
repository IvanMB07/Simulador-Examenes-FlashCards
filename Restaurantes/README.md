# 🍽️ Registro de Restaurantes

Una aplicación web minimalista para llevar un registro completo de los restaurantes que visitas con tu pareja.

## ✨ Características

### Gestión de Restaurantes
- **Añadir restaurantes** con toda la información relevante
- **Editar** cualquier campo de restaurantes ya guardados
- **Eliminar** restaurantes de la lista
- **Buscar** restaurantes por nombre
- **Solo el nombre es obligatorio** - todos los demás campos son opcionales

### Campos Disponibles
- **Nombre**: Nombre del restaurante (campo obligatorio)
- **Ubicación**: Dirección o ubicación del local
- **Tipo**: Buffet, Restaurante, Cafetería/Pastelería, Comida Rápida, To Good to go, o personalizado
- **Subtipo**: Sushi/Japo, Español, Desayuno, Merienda, Tailandés, Cena, Hamburguesa, Pizza, Italiano, Mexicano, Comida, o personalizado

### Sistema de Valoraciones (0-5 estrellas)
- Calidad
- Cantidad
- Variedad
- Estética
- Servicio
- Calidad/Precio
- **Puntuación Total** (destacada con diseño especial)

### Información Adicional
- **¿Volveríamos?**: Selección con emojis ✅ / ❌
- **Veces Ido**: Contador numérico de visitas
- **Nota**: Campo de texto libre para comentarios
- **Reservar**: Número de teléfono o URL para hacer reservas

## 🎨 Diseño

- **Estilo minimalista** con interfaz limpia y moderna
- **Colores principales**: Naranjas y turquesas
- **Totalmente responsive**: Funciona perfectamente en móvil y escritorio
- **Animaciones suaves** para una mejor experiencia de usuario

## 🚀 Cómo Usar

1. **Abrir** el archivo `index.html` en tu navegador
2. **Añadir** restaurantes desde la pestaña "➕ Añadir Restaurante"
3. **Ver** todos tus restaurantes en la pestaña "📋 Lista de Restaurantes"
4. **Editar** cualquier restaurante clickeando el botón "✏️ Editar"
5. **Buscar** restaurantes usando la barra de búsqueda

## 💾 Almacenamiento

Los datos se guardan automáticamente en el **localStorage** del navegador, por lo que:
- ✅ No necesitas conexión a internet
- ✅ Tus datos persisten entre sesiones
- ⚠️ Los datos son locales a cada navegador/dispositivo

## 🌐 Despliegue en GitHub Pages

1. Crea un repositorio en GitHub
2. Sube los archivos: `index.html`, `styles.css`, `script.js`
3. Ve a Settings → Pages
4. Selecciona la rama principal (main/master)
5. ¡Tu aplicación estará disponible en: `https://tu-usuario.github.io/nombre-repositorio/`!

## 📱 Tecnologías Utilizadas

- HTML5
- CSS3 (Variables CSS, Grid, Flexbox)
- JavaScript Vanilla (ES6+)
- LocalStorage API

## ⭐ Funcionalidades Especiales

- **Selectores personalizados**: Añade tus propios tipos y subtipos
- **Sistema de estrellas interactivo**: Click para valorar
- **Tarjetas visuales**: Cada restaurante se muestra en una tarjeta elegante
- **Búsqueda en tiempo real**: Filtra restaurantes mientras escribes

---

¡Disfruta registrando tus aventuras culinarias! 🍕🍣🍰