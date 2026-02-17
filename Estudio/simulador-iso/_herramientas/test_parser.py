#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de prueba para verificar el parser de preguntas
"""

import re
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

# Leer archivo de prueba (ruta robusta)
root_dir = Path(__file__).resolve().parent.parent
archivo = root_dir / 'preguntas_ISO_COMPLETAS.txt'

print(f"Leyendo {archivo.name}...")
with open(archivo, 'r', encoding='utf-8') as f:
    contenido = f.read()

preguntas = parsear_preguntas_txt(contenido)

print(f"\nTotal de preguntas parseadas: {len(preguntas)}\n")

print("\n" + "="*80)
print("MUESTRA DE LAS PRIMERAS 5 PREGUNTAS:")
print("="*80)
for i, p in enumerate(preguntas[:5], 1):
    print(f"\n{i}. {p['cuestion']}")
    for opcion in p['opciones']:
        print(f"   {opcion}")
    print(f"   RESPUESTA: {p['solucion']}")

# Verificar que todas tienen "Pregunta:"
sin_pregunta = [p for p in preguntas if 'Pregunta:' not in p['cuestion']]
if sin_pregunta:
    print(f"\nADVERTENCIA: {len(sin_pregunta)} preguntas NO tienen 'Pregunta:' en el formato:")
    for p in sin_pregunta[:5]:  # Mostrar solo las primeras 5
        print(f"   - {p['cuestion'][:80]}...")
else:
    print(f"\nOK: Todas las {len(preguntas)} preguntas tienen el formato correcto con 'Pregunta:'")

print("\n" + "="*80)
print("Verificacion completada.")
print("="*80)
