#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CONVERTIR TXT A JSON - Convierte preguntas desde TXT a JSON
Genera el archivo preguntas.json desde preguntas_ISO_COMPLETAS.txt
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

def convertir_txt_a_json(archivo_txt, archivo_json):
    """
    Convierte preguntas de TXT a JSON
    
    Parámetros:
    - archivo_txt: ruta del archivo TXT con preguntas (ej: 'preguntas_ISO_COMPLETAS.txt')
    - archivo_json: ruta del archivo JSON de salida (ej: 'preguntas.json')
    """
    
    if not os.path.exists(archivo_txt):
        print(f"❌ Error: No se encuentra el archivo {archivo_txt}")
        return False
    
    print(f"📄 Leyendo archivo TXT: {archivo_txt}")
    with open(archivo_txt, 'r', encoding='utf-8') as f:
        preguntas = parsear_preguntas_txt(f.read())
    
    if not preguntas:
        print("❌ Error: No se encontraron preguntas válidas en el archivo")
        return False
    
    print(f"✅ {len(preguntas)} preguntas parseadas correctamente\n")
    
    # Estadísticas
    con_pregunta = sum(1 for p in preguntas if 'Pregunta:' in p['cuestion'])
    print(f"📊 Estadísticas:")
    print(f"   - Total de preguntas: {len(preguntas)}")
    print(f"   - Preguntas con 'Pregunta:': {con_pregunta}/{len(preguntas)}")
    
    # Agrupar por tema
    temas = {}
    for p in preguntas:
        match = re.search(r'-L(\d+)-', p['cuestion'])
        if match:
            tema = match.group(1)
            temas[tema] = temas.get(tema, 0) + 1
    
    print(f"\n📚 Distribución por tema:")
    for tema in sorted(temas.keys()):
        print(f"   - L{tema}: {temas[tema]} preguntas")
    
    # Mostrar muestra
    print(f"\n📋 Muestra de las primeras 3 preguntas:")
    for i, p in enumerate(preguntas[:3], 1):
        print(f"\n   {i}. {p['cuestion'][:80]}...")
        print(f"      Opciones: {len(p['opciones'])}")
        print(f"      Solución: {p['solucion']}")
    
    # Guardar JSON (formato legible con indentación)
    print(f"\n💾 Guardando archivo JSON: {archivo_json}")
    with open(archivo_json, 'w', encoding='utf-8') as f:
        json.dump(preguntas, f, ensure_ascii=False, indent=2)
    
    # Calcular tamaño del archivo
    tamaño_kb = os.path.getsize(archivo_json) / 1024
    
    print(f"\n{'='*70}")
    print(f"✅ CONVERSIÓN COMPLETADA EXITOSAMENTE")
    print(f"{'='*70}")
    print(f"   Archivo generado: {archivo_json}")
    print(f"   Tamaño: {tamaño_kb:.2f} KB")
    print(f"   Total de preguntas: {len(preguntas)}")
    print(f"\n💡 Ahora puedes subir este JSON a GitHub y el simulador lo usará automáticamente")
    
    return True

if __name__ == "__main__":
    import sys
    
    # Determinar archivos
    if len(sys.argv) > 2:
        archivo_txt = sys.argv[1]
        archivo_json = sys.argv[2]
    elif len(sys.argv) > 1:
        archivo_txt = sys.argv[1]
        archivo_json = "preguntas.json"
    else:
        archivo_txt = "preguntas_ISO_COMPLETAS.txt"
        archivo_json = "preguntas.json"
    
    print(f"\n{'='*70}")
    print(f"🔄 CONVERTIR TXT A JSON")
    print(f"{'='*70}")
    print(f"Entrada:  {archivo_txt}")
    print(f"Salida:   {archivo_json}")
    print(f"{'='*70}\n")
    
    convertir_txt_a_json(archivo_txt, archivo_json)
