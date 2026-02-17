#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Análisis rápido de preguntas - Genera un reporte sin GUI
"""

import re
from difflib import SequenceMatcher
from collections import defaultdict

class Pregunta:
    """Representa una pregunta del examen"""
    def __init__(self, codigo, texto, opciones, respuesta, linea_inicio):
        self.codigo = codigo
        self.texto = texto
        self.opciones = opciones
        self.respuesta = respuesta
        self.linea_inicio = linea_inicio
        self.codigo_valido = self._validar_codigo()
        
    def _validar_codigo(self):
        """Verifica si el código tiene el formato correcto"""
        patron = r'^[A-Z0-9]+-L\d+-Q\d+$'
        return bool(re.match(patron, self.codigo))
    
    def similitud_texto(self, otra):
        """Calcula similitud entre dos preguntas (0-1)"""
        return SequenceMatcher(None, self.texto.lower(), otra.texto.lower()).ratio()
    
    def es_similar(self, otra, umbral=0.85):
        """Determina si dos preguntas son similares"""
        return (self.similitud_texto(otra) >= umbral and 
                self.respuesta == otra.respuesta)

def parsear_archivo(ruta_archivo):
    """Lee y parsea todas las preguntas del archivo"""
    preguntas = []
    
    with open(ruta_archivo, 'r', encoding='utf-8') as f:
        lineas = f.readlines()
    
    i = 0
    while i < len(lineas):
        linea = lineas[i].strip()
        
        # Buscar línea de pregunta
        match = re.match(r'^([A-Z0-9]+-L\d+-Q\d+)-?\s*[–-]\s*Pregunta:\s*(.+?)[:：]?$', linea)
        if match:
            codigo = match.group(1)
            texto = match.group(2).strip()
            linea_inicio = i + 1
            
            # Leer opciones
            opciones = []
            i += 1
            while i < len(lineas):
                linea_opcion = lineas[i].strip()
                if linea_opcion.startswith(('A.', 'B.', 'C.', 'D.')):
                    opciones.append(linea_opcion)
                    i += 1
                else:
                    break
            
            # Leer respuesta
            respuesta = None
            if i < len(lineas) and lineas[i].strip().startswith('ANSWER:'):
                respuesta = lineas[i].strip().replace('ANSWER:', '').strip()
                i += 1
            
            if opciones and respuesta:
                pregunta = Pregunta(codigo, texto, opciones, respuesta, linea_inicio)
                preguntas.append(pregunta)
        else:
            i += 1
    
    return preguntas

def analizar_preguntas(archivo_entrada, archivo_salida='reporte_analisis.txt'):
    """Analiza las preguntas y genera un reporte"""
    
    print(f"Analizando {archivo_entrada}...")
    preguntas = parsear_archivo(archivo_entrada)
    print(f"✓ Cargadas {len(preguntas)} preguntas\n")
    
    # 1. Códigos malformados
    print("Buscando códigos malformados...")
    codigos_malos = [p for p in preguntas if not p.codigo_valido]
    print(f"✓ Encontrados {len(codigos_malos)} códigos malformados\n")
    
    # 2. Duplicados
    print("Buscando duplicados (esto puede tardar)...")
    duplicados = []
    ya_comparadas = set()
    
    for i, p1 in enumerate(preguntas):
        if (i + 1) % 50 == 0:
            print(f"  Procesadas {i+1}/{len(preguntas)} preguntas...")
        
        for j, p2 in enumerate(preguntas[i+1:], start=i+1):
            par = tuple(sorted([i, j]))
            if par in ya_comparadas:
                continue
            
            if p1.es_similar(p2, umbral=0.85):
                duplicados.append({
                    'preguntas': [p1, p2],
                    'indices': [i, j],
                    'similitud': p1.similitud_texto(p2)
                })
                ya_comparadas.add(par)
    
    print(f"✓ Encontrados {len(duplicados)} grupos de duplicados\n")
    
    # Generar reporte
    print(f"Generando reporte en {archivo_salida}...")
    
    with open(archivo_salida, 'w', encoding='utf-8') as f:
        f.write("="*80 + "\n")
        f.write(" REPORTE DE ANÁLISIS DE PREGUNTAS ISO\n")
        f.write("="*80 + "\n\n")
        
        # Resumen
        f.write("RESUMEN\n")
        f.write("-" * 80 + "\n")
        f.write(f"Total de preguntas: {len(preguntas)}\n")
        f.write(f"Códigos malformados: {len(codigos_malos)}\n")
        f.write(f"Grupos de duplicados: {len(duplicados)}\n")
        f.write(f"Preguntas únicas estimadas: {len(preguntas) - len(duplicados)}\n")
        f.write("\n\n")
        
        # Códigos malformados
        f.write("="*80 + "\n")
        f.write(" CÓDIGOS MALFORMADOS\n")
        f.write("="*80 + "\n\n")
        
        if codigos_malos:
            for p in codigos_malos:
                f.write(f"Línea {p.linea_inicio}: {p.codigo}\n")
                f.write(f"  Pregunta: {p.texto[:80]}...\n")
                f.write(f"  Formato esperado: BC02-L3-Q01 o 3BC7-L11-Q01\n\n")
        else:
            f.write("✓ No se encontraron códigos malformados\n\n")
        
        # Duplicados
        f.write("="*80 + "\n")
        f.write(" PREGUNTAS DUPLICADAS\n")
        f.write("="*80 + "\n\n")
        
        if duplicados:
            for i, dup in enumerate(duplicados, 1):
                f.write(f"\n--- GRUPO {i} (Similitud: {dup['similitud']*100:.1f}%) ---\n\n")
                
                for j, p in enumerate(dup['preguntas'], 1):
                    f.write(f"PREGUNTA {j}:\n")
                    f.write(f"  Código: {p.codigo}\n")
                    f.write(f"  Línea: {p.linea_inicio}\n")
                    f.write(f"  Texto: {p.texto}\n")
                    f.write(f"  Respuesta: {p.respuesta}\n\n")
                
                f.write("\n")
        else:
            f.write("✓ No se encontraron duplicados\n\n")
        
        # Estadísticas por lección
        f.write("="*80 + "\n")
        f.write(" ESTADÍSTICAS POR LECCIÓN\n")
        f.write("="*80 + "\n\n")
        
        lecciones = defaultdict(int)
        for p in preguntas:
            # Extraer número de lección (L3, L11, etc.)
            match = re.search(r'L(\d+)', p.codigo)
            if match:
                leccion = f"L{match.group(1)}"
                lecciones[leccion] += 1
        
        for leccion in sorted(lecciones.keys(), key=lambda x: int(x[1:])):
            f.write(f"{leccion}: {lecciones[leccion]} preguntas\n")
        
        f.write("\n")
    
    print(f"✓ Reporte generado exitosamente\n")
    print("="*80)
    print(f" RESUMEN")
    print("="*80)
    print(f"Total preguntas: {len(preguntas)}")
    print(f"Códigos malformados: {len(codigos_malos)}")
    print(f"Grupos duplicados: {len(duplicados)}")
    print(f"Archivo generado: {archivo_salida}")
    print("="*80)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        archivo = sys.argv[1]
    else:
        archivo = "preguntas_ISO_COMPLETAS.txt"
    
    try:
        analizar_preguntas(archivo)
    except FileNotFoundError:
        print(f"Error: No se encontró el archivo '{archivo}'")
        print("Uso: python analisis_rapido.py [archivo.txt]")
    except Exception as e:
        print(f"Error: {e}")
