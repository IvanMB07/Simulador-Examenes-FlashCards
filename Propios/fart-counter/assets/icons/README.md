# Favicon files

Este directorio contiene los favicons de la aplicación.

## Archivos necesarios:

### favicon.svg
- Favicon SVG (recomendado, moderno)
- Tamaño: 32x32px
- Se renderiza automáticamente

### apple-touch-icon.png
- Icono para iOS/iPad
- Tamaño: 180x180px
- Se usa cuando agregas a pantalla de inicio

## Instrucciones:

1. **Crear favicon.svg**
   - Usa emojis: 💨 o crear un SVG simple
   - Ejemplo SVG mínimo:
   ```xml
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <rect fill="#FF8C42" width="100" height="100" rx="25"/>
     <text x="50" y="60" font-size="60" text-anchor="middle">💨</text>
   </svg>
   ```

2. **Crear apple-touch-icon.png**
   - Diseño cuadrado 180x180px
   - PNG con transparencia (si es necesario)
   - Puede ser lo mismo que favicon en mayor tamaño

3. **Alternativa rápida**
   - Usa favicon.io o similares
   - Exporta automáticamente para web
   - Coloca los archivos aquí

## Nota:
Si no agregues favicons, la app funcionará perfectamente.
Solo harás que se vea más profesional en pestañas y pantalla de inicio.
