# Assets - Sonidos

Este directorio contiene los efectos de sonido de la aplicación.

## Archivos necesarios:

### fart-1.mp3
- Sonido corto de pedo (tono bajo)
- Duración: 300-500ms
- Volumen: -6dB

### fart-2.mp3
- Sonido medio de pedo (tono alto)
- Duración: 400-600ms
- Volumen: -6dB

### fart-3.mp3
- Sonido largo de pedo (variado)
- Duración: 500-800ms
- Volumen: -6dB

## Instrucciones:

1. **Buscar sonidos** 
   - Sitios como Freesound.org, Zapsplat.com
   - Busca "fart", "pedo", "burp" en formato libre
   - O crea los tuyos propios (Audacity, etc.)

2. **Convertir a MP3**
   - Descarga en formato WAV
   - Usa FFmpeg: `ffmpeg -i input.wav -q:a 9 output.mp3`
   - O usa un convertidor online

3. **Optimizar**
   - Duración: 300-800ms
   - Volumen: -6dB (no demasiado fuerte)
   - Formato: MP3 (máxima compatibilidad)

4. **Colocar archivos**
   - Guarda los 3 archivos en esta carpeta
   - Nombra exactamente: fart-1.mp3, fart-2.mp3, fart-3.mp3

## Alternativa: Sin sonidos
Si no tienes sonidos aún, la app funcionará bien sin ellos.
Los usuarios pueden desactivar el sonido en la interfaz.

## Nota sobre autoplay
Los navegadores modernos requieren interacción del usuario antes de reproducir audio.
Esto está implementado correctamente en la app (se reproduce al hacer click).
