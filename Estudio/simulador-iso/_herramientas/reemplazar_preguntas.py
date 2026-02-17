#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
REEMPLAZAR PREGUNTAS - Actualiza TODAS las preguntas del HTML
Este script reemplaza completamente el conjunto de preguntas en el HTML
"""

import json
import re
import os
from pathlib import Path

def parsear_preguntas_txt(texto):
    """Parsea preguntas desde formato TXT"""
    preguntas = []
    bloques = re.split(r'\n(?=[A-Z0-9]+-L\d+-Q\d+)', texto.strip())
    
    for bloque in bloques:
        if not bloque.strip():
            continue
        
        # Extraer código y pregunta
        # Formato esperado: BC02-L3-Q01- Pregunta: ¿Texto de la pregunta?
        match_codigo = re.match(r'([A-Z0-9]+-L\d+-Q\d+)-?\s*(?:–|-)\s*(?:Pregunta:\s*)?(.+?)(?=\nA\.|\n[A-D]\.)', bloque, re.DOTALL)
        if not match_codigo:
            continue
        
        codigo = match_codigo.group(1)
        pregunta_texto = match_codigo.group(2).strip()
        pregunta_texto = re.sub(r'\s+', ' ', pregunta_texto)
        
        # Extraer opciones
        opciones = []
        for letra in ['A', 'B', 'C', 'D']:
            patron = rf'{letra}\.\s*(.+?)(?=\n[A-D]\.|ANSWER:|RESPUESTA:|$)'
            match_opcion = re.search(patron, bloque, re.DOTALL)
            if match_opcion:
                opcion_texto = match_opcion.group(1).strip()
                opcion_texto = re.sub(r'\s+', ' ', opcion_texto)
                opciones.append(f"{letra}. {opcion_texto}")
        
        # Extraer respuesta
        match_respuesta = re.search(r'(?:ANSWER|RESPUESTA):\s*([A-D])', bloque)
        if not match_respuesta or len(opciones) != 4:
            continue
        
        respuesta = match_respuesta.group(1)
        
        # Construir la pregunta con formato estándar: CODIGO- Pregunta: Texto
        # Si el texto ya contiene "Pregunta:", no duplicar
        if not pregunta_texto.startswith('Pregunta:'):
            pregunta_completa = f"{codigo}- Pregunta: {pregunta_texto}"
        else:
            pregunta_completa = f"{codigo}- {pregunta_texto}"
        
        preguntas.append({
            "cuestion": pregunta_completa,
            "opciones": opciones,
            "solucion": respuesta
        })
    
    return preguntas

def reemplazar_preguntas(archivo_txt):
    """
    Reemplaza TODAS las preguntas del HTML con las del archivo TXT
    
    Parámetros:
    - archivo_txt: ruta del archivo TXT con preguntas (ej: 'preguntas_ISO.txt')
    """
    
    # Determinar ruta del HTML (en la raíz del simulador)
    script_dir = Path(__file__).resolve().parent
    ruta_html = script_dir / 'index.html'
    if not ruta_html.exists():
        ruta_html = script_dir.parent / 'index.html'
    
    if not ruta_html.exists():
        print("❌ Error: No se encuentra index.html (ni junto al script ni en la carpeta superior)")
        return
    
    print(f"📄 Leyendo archivo de preguntas: {archivo_txt}")
    with open(archivo_txt, 'r', encoding='utf-8') as f:
        nuevas_preguntas = parsear_preguntas_txt(f.read())
    
    print(f"✅ {len(nuevas_preguntas)} preguntas parseadas correctamente\n")
    
    # Verificar formato
    con_pregunta = sum(1 for p in nuevas_preguntas if 'Pregunta:' in p['cuestion'])
    print(f"📊 Estadísticas:")
    print(f"   - Preguntas con 'Pregunta:': {con_pregunta}/{len(nuevas_preguntas)}")
    
    # Mostrar muestra
    print(f"\n📋 Muestra de las primeras 3 preguntas:")
    for i, p in enumerate(nuevas_preguntas[:3], 1):
        print(f"\n   {i}. {p['cuestion'][:80]}...")
    
    # Confirmar acción
    print(f"\n{'='*70}")
    print("⚠️  ATENCIÓN: Esta acción REEMPLAZARÁ todas las preguntas existentes")
    print(f"{'='*70}")
    respuesta = input("¿Continuar? (s/n): ").strip().lower()
    
    if respuesta not in ['s', 'si', 'sí', 'y', 'yes']:
        print("❌ Operación cancelada")
        return
    
    # Leer HTML
    print(f"\n📖 Leyendo HTML...")
    with open(ruta_html, 'r', encoding='utf-8') as f:
        html = f.read()
    
    # Reemplazar preguntas en el HTML
    json_minificado = json.dumps(nuevas_preguntas, ensure_ascii=False, separators=(',', ':'))
    
    patron_viejo = r'const PREGUNTAS_COMPLETAS = \[.*?\];'
    patron_nuevo = f'const PREGUNTAS_COMPLETAS = {json_minificado};'
    
    html_nuevo = re.sub(patron_viejo, patron_nuevo, html, flags=re.DOTALL)
    
    # Guardar HTML
    with open(ruta_html, 'w', encoding='utf-8') as f:
        f.write(html_nuevo)
    
    print(f"\n{'='*70}")
    print(f"✅ PROCESO COMPLETADO EXITOSAMENTE")
    print(f"{'='*70}")
    print(f"   Total de preguntas: {len(nuevas_preguntas)}")
    print(f"   Con formato 'Pregunta:': {con_pregunta}")
    print(f"   HTML actualizado: {ruta_html}")
    print(f"\n💡 Ahora puedes abrir {ruta_html} en tu navegador para probar")

if __name__ == "__main__":
    import sys
    
    # Uso: python reemplazar_preguntas.py [archivo.txt]
    
    if len(sys.argv) > 1:
        archivo_txt = sys.argv[1]
    else:
        archivo_txt = "preguntas_ISO.txt"
    
    if not os.path.exists(archivo_txt):
        print(f"❌ Error: No se encuentra el archivo '{archivo_txt}'")
        print("Uso: python reemplazar_preguntas.py [archivo.txt]")
        sys.exit(1)
    
    reemplazar_preguntas(archivo_txt)
