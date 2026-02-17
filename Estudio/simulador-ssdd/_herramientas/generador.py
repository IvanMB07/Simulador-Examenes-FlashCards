import pdfplumber
import json
import re
import os

# CONFIGURACIÓN
# Asegúrate de que los nombres coinciden con tus archivos
archivos_pdf = [
    "ssdd_1415_P2.solved.pdf",
    "ssdd_1516_P2.solved.pdf",
    "ssdd_1718_P2.solved.pdf",
    "ssdd_1718_P2X.solved.pdf",
    "ssdd_1920_P2.solved.pdf",
    "ssdd_1920_P2X.solved.pdf",
    "ssdd_2021_P2.solved.pdf",
    "ssdd_2021_P2X.solved.pdf",
    "ssdd_2122_P2.solved.pdf",
    "ssdd_2122_P2X.solved.pdf",
    "ssdd_2223_P2.solved.pdf",
    "ssdd_2223_P2X.solved.pdf",
    "ssdd_2324_P2.solved.pdf",
    "ssdd_2324_P2X.solved.pdf",
    "ssdd_2425_P2.solved.pdf",
    "ssdd_2425_P2X.solved.pdf" 
]

def limpiar_basura(texto):
    """Elimina caracteres (cid:X), espacios extra y símbolos de casillas vacías."""
    if not texto: return ""
    # Eliminar (cid:X)
    texto = re.sub(r'\(cid:\d+\)', '', texto)
    # Eliminar símbolos de casillas vacías para limpiar el texto de la opción
    texto = re.sub(r'[□☐]', '', texto)
    # Eliminar espacios múltiples
    texto = re.sub(r'\s+', ' ', texto).strip()
    return texto

def es_opcion_correcta(texto_bruto):
    """Detecta si la línea contiene el cuadrado negro o el check de corrección."""
    # Símbolos de respuesta correcta usados en tus exámenes
    simbolos_correctos = ['■', '☑', '☒'] 
    return any(s in texto_bruto for s in simbolos_correctos)

def procesar_examenes(archivos):
    base_de_preguntas = []

    for archivo in archivos:
        if not os.path.exists(archivo):
            print(f"⚠️ No encontrado: {archivo}")
            continue

        print(f"📄 Procesando {archivo}...")
        
        # Extraer metadatos del nombre del archivo
        match_anio = re.search(r'(\d{4})', archivo)
        match_extra = re.search(r'P2(X)', archivo)
        anio = match_anio.group(1) if match_anio else "Unknown"
        es_extra = "X" if match_extra else ""
        codigo_examen = f"SSDD-{anio}{es_extra}"

        # 1. Extracción de texto crudo
        texto_completo = ""
        with pdfplumber.open(archivo) as pdf:
            for page in pdf.pages:
                # Usamos x_tolerance para intentar mantener columnas separadas si es posible
                texto_completo += page.extract_text(x_tolerance=2) + "\n"

        # 2. Normalización de símbolos extraños (algunos PDFs usan caracteres raros para los checks)
        # Reemplazamos posibles variantes visuales
        texto_completo = texto_completo.replace('', '■').replace('F0FE', '☑')

        # 3. Dividir por Preguntas usando Regex
        # Buscamos patrones: "1 [2p]", "10 (2p)", "5 [6p]"
        # El split nos devuelve trozos donde cada uno empieza por una pregunta
        patron_inicio_pregunta = r'\n(\d+)\s*(?:\[|\()(\d+)p(?:\]|\))'
        bloques = re.split(patron_inicio_pregunta, texto_completo)

        # El primer bloque suele ser cabecera del examen, lo ignoramos (bloques[0])
        # A partir de ahí, re.split devuelve: [texto_previo, num_preg, puntos, contenido_preg, num_preg, puntos...]
        
        # Iteramos de 3 en 3: (Número, Puntos, Contenido)
        for i in range(1, len(bloques), 3):
            if i + 2 >= len(bloques): break
            
            num_pregunta = bloques[i]
            # puntos = bloques[i+1] # No lo usamos en el JSON pero está ahí
            contenido = bloques[i+2]

            # 4. Procesar el contenido de la pregunta
            # Buscamos dónde empiezan las opciones (a), b)...)
            # Truco: Buscamos la primera aparición de " a) " o " a. " o saltos de línea con a)
            
            # Dividimos contenido en líneas para buscar opciones
            lineas = contenido.split('\n')
            enunciado = []
            opciones_raw = []
            capturando_opciones = False

            # Regex para detectar inicio de opción: "a)", "b)", etc, con o sin check antes
            regex_opcion = re.compile(r'(?:[■□☐☑☒]\s*)?([a-g])\)')

            for linea in lineas:
                # Si la línea tiene múltiples opciones pegadas (ej: "a) xxxx   c) yyyy")
                # Las separamos forzando un salto de línea antes de cada letra de opción
                linea_expandida = re.sub(r'(\s+[a-g]\))', r'\n\1', linea)
                
                sublineas = linea_expandida.split('\n')
                for sub in sublineas:
                    sub = sub.strip()
                    if not sub: continue

                    match_op = regex_opcion.search(sub)
                    if match_op:
                        capturando_opciones = True
                        opciones_raw.append(sub)
                    else:
                        if not capturando_opciones:
                            enunciado.append(sub)
                        else:
                            # Si ya estamos en opciones y no tiene letra, es continuación de la anterior
                            if opciones_raw:
                                opciones_raw[-1] += " " + sub
            
            # Construir objeto pregunta
            texto_pregunta = limpiar_basura(" ".join(enunciado))
            
            # Si el enunciado está muy sucio o vacío, a veces es basura del PDF, filtramos
            if len(texto_pregunta) < 5: 
                continue

            opciones_finales = []
            solucion = "?"

            for op_raw in opciones_raw:
                # Detectar letra
                match_letra = regex_opcion.search(op_raw)
                if match_letra:
                    letra = match_letra.group(1).upper() # A, B, C...
                    texto_op = limpiar_basura(op_raw)
                    # Quitar la letra del texto (ej: "a) Hola" -> "Hola")
                    texto_op = re.sub(r'^[a-g]\)\s*', '', texto_op, flags=re.IGNORECASE)
                    
                    opciones_finales.append(f"{letra}) {texto_op}")

                    # Chequear si es la correcta
                    if es_opcion_correcta(op_raw):
                        solucion = letra

            # Guardar en la lista
            base_de_preguntas.append({
                "cuestion": f"{codigo_examen}-Q{num_pregunta}- {texto_pregunta}",
                "opciones": opciones_finales,
                "solucion": solucion
            })

    # Guardar JSON final
    with open("preguntas_SSDD_CLEAN.json", "w", encoding="utf-8") as f:
        json.dump(base_de_preguntas, f, indent=4, ensure_ascii=False)

    print(f"\n✨ ¡Proceso terminado! {len(base_de_preguntas)} preguntas limpias guardadas.")

if __name__ == "__main__":
    procesar_examenes(archivos_pdf)