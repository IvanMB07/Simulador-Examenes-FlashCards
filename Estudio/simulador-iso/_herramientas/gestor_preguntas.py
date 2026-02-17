#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GESTOR DE PREGUNTAS - Simulador de Exámenes
Añade preguntas nuevas al HTML de forma automática y sencilla
"""

import json
import re
import os
from pathlib import Path

def extraer_json_del_html(html):
    """Extrae el JSON de preguntas del HTML"""
    match = re.search(r'const PREGUNTAS_COMPLETAS = (\[.*?\]);', html, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    return []

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
        # NO eliminar "Pregunta:" - mantener el formato original
        
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

def obtener_codigos_existentes(preguntas_existentes):
    """Extrae los códigos de preguntas existentes"""
    codigos = set()
    for p in preguntas_existentes:
        match = re.match(r'([A-Z0-9]+-L\d+-Q\d+)', p['cuestion'])
        if match:
            codigos.add(match.group(1).upper())
    return codigos

def añadir_preguntas(archivo_txt=None, preguntas_nuevas=None):
    """
    Añade preguntas nuevas al HTML
    
    Parámetros:
    - archivo_txt: ruta del archivo TXT con preguntas (ej: 'preguntas_ISO.txt')
    - preguntas_nuevas: lista de dicts con preguntas {cuestion, opciones, solucion}
    """
    
    # Determinar ruta del HTML (en la raíz del simulador)
    script_dir = Path(__file__).resolve().parent
    ruta_html = script_dir.parent / 'index.html'
    
    if not ruta_html.exists():
        print(f"❌ Error: No se encuentra el archivo HTML en {ruta_html}")
        return
    
    # Leer HTML
    with open(ruta_html, 'r', encoding='utf-8') as f:
        html = f.read()
    
    # Extraer preguntas existentes
    preguntas_existentes = extraer_json_del_html(html)
    codigos_existentes = obtener_codigos_existentes(preguntas_existentes)
    
    print(f"📋 Preguntas existentes: {len(preguntas_existentes)}")
    print(f"   Códigos únicos: {len(codigos_existentes)}\n")
    
    # Parsear nuevas preguntas
    nuevas = []
    
    if archivo_txt:
        print(f"📄 Leyendo archivo: {archivo_txt}")
        with open(archivo_txt, 'r', encoding='utf-8') as f:
            nuevas.extend(parsear_preguntas_txt(f.read()))
        print(f"   ✓ {len(nuevas)} preguntas parseadas del archivo\n")
    
    if preguntas_nuevas:
        nuevas.extend(preguntas_nuevas)
        print(f"   ✓ {len(preguntas_nuevas)} preguntas añadidas manualmente\n")
    
    # Verificar duplicados y filtrar
    duplicados = 0
    añadidas = 0
    preguntas_finales = list(preguntas_existentes)
    
    for p in nuevas:
        match = re.match(r'([A-Z0-9]+-L\d+-Q\d+)', p['cuestion'])
        codigo = match.group(1).upper() if match else None
        
        if codigo and codigo in codigos_existentes:
            print(f"   ⚠️  {codigo} - YA EXISTE")
            duplicados += 1
        else:
            preguntas_finales.append(p)
            if codigo:
                codigos_existentes.add(codigo)
            print(f"   ✅ {codigo} - Añadida")
            añadidas += 1
    
    # Actualizar HTML con nuevo JSON embebido
    json_minificado = json.dumps(preguntas_finales, ensure_ascii=False, separators=(',', ':'))
    
    patron_viejo = r'const PREGUNTAS_COMPLETAS = \[.*?\];'
    patron_nuevo = f'const PREGUNTAS_COMPLETAS = {json_minificado};'
    
    html_nuevo = re.sub(patron_viejo, patron_nuevo, html, flags=re.DOTALL)
    
    # Guardar HTML
    with open(ruta_html, 'w', encoding='utf-8') as f:
        f.write(html_nuevo)
    
    print(f"\n{'='*60}")
    print(f"✅ PROCESO COMPLETADO")
    print(f"{'='*60}")
    print(f"   Duplicados omitidos: {duplicados}")
    print(f"   Preguntas nuevas: {añadidas}")
    print(f"   Total: {len(preguntas_finales)} preguntas")
    print(f"\n   HTML actualizado: {ruta_html}")

if __name__ == "__main__":
    import sys
    
    # Uso: python gestor_preguntas.py [archivo.txt]
    # O: python gestor_preguntas.py (sin argumentos para usar datos pegados)
    
    archivo_txt = None
    
    if len(sys.argv) > 1:
        archivo_txt = sys.argv[1]
        if not os.path.exists(archivo_txt):
            print(f"❌ Error: No se encuentra el archivo '{archivo_txt}'")
            sys.exit(1)
        print(f"🚀 Modo: Leer desde archivo '{archivo_txt}'")
    else:
        print("🚀 Modo: Leer desde archivo o entrada manual")
    
    # Ejemplo de preguntas para agregar manualmente (opcional)
    # Descomenta y modifica si quieres probar:
    preguntas_ejemplo = [
        # {
        #     "cuestion": "CODIGO-LXX-QXX- ¿Pregunta aquí?",
        #     "opciones": ["A. Opción 1", "B. Opción 2", "C. Opción 3", "D. Opción 4"],
        #     "solucion": "A"
        # }
    ]
    
    añadir_preguntas(archivo_txt=archivo_txt, preguntas_nuevas=preguntas_ejemplo if preguntas_ejemplo else None)
