#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Revisor de Preguntas ISO - Herramienta para detectar duplicados y errores
Permite revisar preguntas similares y decidir cuál mantener
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
import re
from difflib import SequenceMatcher
from collections import defaultdict
import json

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
        # Formato esperado: BC02-L3-Q01 o 3BC7-L11-Q01
        patron = r'^[A-Z0-9]+-L\d+-Q\d+$'
        return bool(re.match(patron, self.codigo))
    
    def similitud_texto(self, otra):
        """Calcula similitud entre dos preguntas (0-1)"""
        return SequenceMatcher(None, self.texto.lower(), otra.texto.lower()).ratio()
    
    def es_similar(self, otra, umbral=0.85):
        """Determina si dos preguntas son similares"""
        return (self.similitud_texto(otra) >= umbral and 
                self.respuesta == otra.respuesta)
    
    def __str__(self):
        return f"{self.codigo}: {self.texto[:50]}..."

    def clave_exacto(self):
        """Clave canónica para detectar duplicados 100% (ignorando el código)."""
        def _norm(s: str) -> str:
            return " ".join((s or "").strip().split())

        return (
            _norm(self.texto),
            tuple(_norm(o) for o in (self.opciones or [])),
            (self.respuesta or "").strip().upper(),
        )

class ParserPreguntas:
    """Parser para leer preguntas del archivo de texto"""
    
    @staticmethod
    def parsear_archivo(ruta_archivo):
        """Lee y parsea todas las preguntas del archivo (.txt o .json)"""
        if ruta_archivo.lower().endswith('.json'):
            return ParserPreguntas.parsear_json(ruta_archivo)
        return ParserPreguntas.parsear_txt(ruta_archivo)

    @staticmethod
    def parsear_txt(ruta_archivo):
        """Lee y parsea todas las preguntas del archivo de texto"""
        preguntas = []
        
        with open(ruta_archivo, 'r', encoding='utf-8') as f:
            lineas = f.readlines()
        
        i = 0
        while i < len(lineas):
            linea = lineas[i].strip()
            
            # Buscar línea de pregunta (código + texto)
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

    @staticmethod
    def parsear_json(ruta_archivo):
        """Lee y parsea preguntas desde el JSON del simulador.

        Formato esperado: lista de objetos {cuestion, opciones, solucion}
        donde 'cuestion' incluye el código: 'BC02-L3-Q01- Pregunta: ...'
        """
        with open(ruta_archivo, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not isinstance(data, list):
            raise ValueError("El JSON debe ser una lista de preguntas")

        preguntas = []
        for idx, item in enumerate(data, start=1):
            if not isinstance(item, dict):
                continue

            cuestion = (item.get('cuestion') or '').strip()
            opciones = item.get('opciones') or []
            respuesta = (item.get('solucion') or '').strip()

            codigo = "SIN-CODIGO"
            texto = cuestion

            m = re.match(r'^([A-Z0-9]+-L\d+-Q\d+)-?\s*[–-]\s*Pregunta:\s*(.+)$', cuestion)
            if m:
                codigo = m.group(1)
                texto = m.group(2).strip()
            else:
                m2 = re.match(r'^([A-Z0-9]+-L\d+-Q\d+)\s*[–-]\s*(.+)$', cuestion)
                if m2:
                    codigo = m2.group(1)
                    texto = m2.group(2).strip()

            if not isinstance(opciones, list):
                opciones = []
            opciones = [str(o).strip() for o in opciones if str(o).strip()]

            if respuesta:
                respuesta = respuesta.strip().upper()

            if opciones and respuesta:
                preguntas.append(Pregunta(codigo, texto, opciones, respuesta, linea_inicio=idx))

        return preguntas

class RevisorPreguntasGUI:
    """Interfaz gráfica para revisar preguntas duplicadas y con errores"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("Revisor de Preguntas ISO")
        self.root.geometry("1400x900")
        self.root.configure(bg='#1a1a1a')
        
        self.preguntas = []
        self.problemas = []
        self.index_actual = 0
        self.decisiones = {}  # {index_problema: pregunta_seleccionada}
        self.duplicados_exacto = {'grupos': 0, 'preguntas_a_eliminar': 0}
        
        self.configurar_estilos()
        self.crear_widgets()
        
    def configurar_estilos(self):
        """Configura los estilos del tema oscuro"""
        style = ttk.Style()
        style.theme_use('clam')
        
        # Colores
        bg_dark = '#1a1a1a'
        bg_medium = '#2a2a2a'
        fg_light = '#e0e0e0'
        accent = '#00d4ff'
        
        style.configure('Dark.TFrame', background=bg_dark)
        style.configure('Dark.TLabel', background=bg_dark, foreground=fg_light, font=('Segoe UI', 10))
        style.configure('Title.TLabel', background=bg_dark, foreground=accent, font=('Segoe UI', 14, 'bold'))
        style.configure('Dark.TButton', background=bg_medium, foreground=fg_light, borderwidth=0, padding=10)
        style.map('Dark.TButton', background=[('active', accent)])
        
    def crear_widgets(self):
        """Crea la interfaz de usuario"""
        # Frame principal
        main_frame = ttk.Frame(self.root, style='Dark.TFrame')
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Título y botones de control
        header_frame = ttk.Frame(main_frame, style='Dark.TFrame')
        header_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(header_frame, text="Revisor de Preguntas ISO", 
                 style='Title.TLabel').pack(side=tk.LEFT)
        
        ttk.Button(header_frame, text="Cargar Archivo", 
                  command=self.cargar_archivo, style='Dark.TButton').pack(side=tk.RIGHT, padx=5)

        ttk.Button(header_frame, text="Auto-eliminar 100% idénticas",
              command=self.auto_eliminar_duplicados_exacto, style='Dark.TButton').pack(side=tk.RIGHT, padx=5)
        
        # Frame de progreso
        progress_frame = ttk.Frame(main_frame, style='Dark.TFrame')
        progress_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.lbl_progreso = ttk.Label(progress_frame, text="Carga un archivo para comenzar", 
                                      style='Dark.TLabel')
        self.lbl_progreso.pack()
        
        # Frame de estadísticas
        stats_frame = ttk.Frame(main_frame, style='Dark.TFrame')
        stats_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.lbl_stats = ttk.Label(stats_frame, text="", style='Dark.TLabel')
        self.lbl_stats.pack()
        
        # Notebook para pestañas
        self.notebook = ttk.Notebook(main_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        # Pestaña 1: Duplicados
        self.crear_pestaña_duplicados()
        
        # Pestaña 2: Códigos malformados
        self.crear_pestaña_codigos()
        
        # Pestaña 3: Resultado final
        self.crear_pestaña_resultado()
        
        # Botones de navegación
        nav_frame = ttk.Frame(main_frame, style='Dark.TFrame')
        nav_frame.pack(fill=tk.X, pady=(10, 0))
        
        self.btn_anterior = ttk.Button(nav_frame, text="← Anterior", 
                                       command=self.anterior, style='Dark.TButton')
        self.btn_anterior.pack(side=tk.LEFT, padx=5)
        self.btn_anterior['state'] = 'disabled'
        
        self.btn_siguiente = ttk.Button(nav_frame, text="Siguiente →", 
                                        command=self.siguiente, style='Dark.TButton')
        self.btn_siguiente.pack(side=tk.LEFT, padx=5)
        self.btn_siguiente['state'] = 'disabled'
        
        ttk.Button(nav_frame, text="Generar Archivo Limpio", 
                  command=self.generar_archivo_limpio, 
                  style='Dark.TButton').pack(side=tk.RIGHT, padx=5)
        
    def crear_pestaña_duplicados(self):
        """Crea la pestaña para revisar duplicados"""
        frame = ttk.Frame(self.notebook, style='Dark.TFrame')
        self.notebook.add(frame, text="Duplicados")
        
        # Instrucciones
        ttk.Label(frame, text="Selecciona la pregunta que deseas mantener:", 
                 style='Dark.TLabel').pack(pady=10)
        
        # Frame con scroll para las preguntas
        canvas = tk.Canvas(frame, bg='#1a1a1a', highlightthickness=0)
        scrollbar = ttk.Scrollbar(frame, orient="vertical", command=canvas.yview)
        self.scrollable_frame_dup = ttk.Frame(canvas, style='Dark.TFrame')
        
        self.scrollable_frame_dup.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=self.scrollable_frame_dup, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        self.frame_duplicados = self.scrollable_frame_dup
        
    def crear_pestaña_codigos(self):
        """Crea la pestaña para revisar códigos malformados"""
        frame = ttk.Frame(self.notebook, style='Dark.TFrame')
        self.notebook.add(frame, text="Códigos Malformados")
        
        ttk.Label(frame, text="Preguntas con códigos que no siguen el formato estándar:", 
                 style='Dark.TLabel').pack(pady=10)
        
        # Lista de códigos malformados
        self.text_codigos = scrolledtext.ScrolledText(frame, height=30, width=150,
                                                      bg='#2a2a2a', fg='#e0e0e0',
                                                      font=('Consolas', 10))
        self.text_codigos.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
    def crear_pestaña_resultado(self):
        """Crea la pestaña con el resultado final"""
        frame = ttk.Frame(self.notebook, style='Dark.TFrame')
        self.notebook.add(frame, text="Resultado")
        
        ttk.Label(frame, text="Vista previa del archivo limpio:", 
                 style='Dark.TLabel').pack(pady=10)
        
        self.text_resultado = scrolledtext.ScrolledText(frame, height=35, width=150,
                                                        bg='#2a2a2a', fg='#e0e0e0',
                                                        font=('Consolas', 9))
        self.text_resultado.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
    def cargar_archivo(self):
        """Carga y analiza el archivo de preguntas"""
        ruta = filedialog.askopenfilename(
            title="Seleccionar archivo de preguntas",
            filetypes=[("Archivos (TXT/JSON)", "*.txt *.json"), ("Archivos de texto", "*.txt"), ("JSON", "*.json"), ("Todos los archivos", "*.*")],
            initialdir="."
        )
        
        if not ruta:
            return
        
        try:
            self.preguntas = ParserPreguntas.parsear_archivo(ruta)
            if not self.preguntas:
                messagebox.showwarning("Aviso", "No se encontraron preguntas válidas en el archivo")
                return
            messagebox.showinfo("Éxito", f"Se cargaron {len(self.preguntas)} preguntas")
            self.analizar_preguntas()
        except Exception as e:
            messagebox.showerror("Error", f"Error al cargar archivo:\n{str(e)}")
    
    def analizar_preguntas(self):
        """Analiza las preguntas buscando duplicados y errores"""
        self.problemas = []
        self.decisiones = {}
        self.index_actual = 0
        self.btn_anterior['state'] = 'disabled'
        self.btn_siguiente['state'] = 'disabled'

        self.duplicados_exacto = self._contar_duplicados_exacto()
        
        # 1. Buscar códigos malformados
        codigos_malos = [p for p in self.preguntas if not p.codigo_valido]
        
        # 2. Buscar duplicados
        ya_comparadas = set()
        for i, p1 in enumerate(self.preguntas):
            for j, p2 in enumerate(self.preguntas[i+1:], start=i+1):
                par = tuple(sorted([i, j]))
                if par in ya_comparadas:
                    continue
                
                if p1.es_similar(p2, umbral=0.85):
                    self.problemas.append({
                        'tipo': 'duplicado',
                        'preguntas': [p1, p2],
                        'indices': [i, j]
                    })
                    ya_comparadas.add(par)
        
        # Actualizar estadísticas
        self.actualizar_estadisticas()
        
        # Mostrar códigos malformados
        self.mostrar_codigos_malformados(codigos_malos)
        
        # Mostrar duplicados
        if self.problemas:
            self.mostrar_problema(0)
            self.btn_siguiente['state'] = 'normal'
        else:
            for widget in self.frame_duplicados.winfo_children():
                widget.destroy()
            messagebox.showinfo("Resultado", "No se encontraron duplicados")
    
    def actualizar_estadisticas(self):
        """Actualiza las estadísticas mostradas"""
        total = len(self.preguntas)
        duplicados = len(self.problemas)
        malformados = sum(1 for p in self.preguntas if not p.codigo_valido)
        exacto_groups = self.duplicados_exacto.get('grupos', 0)
        exacto_remove = self.duplicados_exacto.get('preguntas_a_eliminar', 0)
        
        texto = (
            f"Total preguntas: {total} | Duplicados similares: {duplicados} | "
            f"Duplicados 100%: {exacto_remove} (en {exacto_groups} grupos) | "
            f"Códigos malformados: {malformados}"
        )
        self.lbl_stats.config(text=texto)
        
        if self.problemas:
            progreso = f"Revisando problema {self.index_actual + 1} de {len(self.problemas)}"
            self.lbl_progreso.config(text=progreso)
        else:
            self.lbl_progreso.config(text="No hay duplicados similares pendientes")

    def _contar_duplicados_exacto(self):
        """Devuelve conteo de duplicados exactos (no modifica el dataset)."""
        grupos = defaultdict(list)
        for i, p in enumerate(self.preguntas):
            grupos[p.clave_exacto()].append(i)

        grupos_dup = [idxs for idxs in grupos.values() if len(idxs) > 1]
        preguntas_a_eliminar = sum(len(idxs) - 1 for idxs in grupos_dup)
        return {'grupos': len(grupos_dup), 'preguntas_a_eliminar': preguntas_a_eliminar}

    def auto_eliminar_duplicados_exacto(self):
        """Elimina en bloque duplicados 100% idénticos (mantiene la primera aparición)."""
        if not self.preguntas:
            messagebox.showwarning("Advertencia", "Primero carga un archivo")
            return

        conteo = self._contar_duplicados_exacto()
        if conteo['preguntas_a_eliminar'] == 0:
            messagebox.showinfo("Resultado", "No se encontraron duplicados 100% idénticos")
            return

        ok = messagebox.askyesno(
            "Confirmar",
            f"Se eliminarán {conteo['preguntas_a_eliminar']} preguntas (duplicados 100%).\n"
            f"Grupos afectados: {conteo['grupos']}.\n\n"
            "¿Continuar?"
        )
        if not ok:
            return

        vistos = set()
        preguntas_limpias = []
        eliminadas = 0
        for p in self.preguntas:
            k = p.clave_exacto()
            if k in vistos:
                eliminadas += 1
                continue
            vistos.add(k)
            preguntas_limpias.append(p)

        self.preguntas = preguntas_limpias
        self.index_actual = 0
        self.problemas = []
        self.decisiones = {}

        messagebox.showinfo("Éxito", f"Eliminadas {eliminadas} preguntas duplicadas 100% idénticas")
        self.analizar_preguntas()
    
    def mostrar_codigos_malformados(self, codigos_malos):
        """Muestra las preguntas con códigos malformados"""
        self.text_codigos.delete('1.0', tk.END)
        
        if not codigos_malos:
            self.text_codigos.insert('1.0', "✓ No se encontraron códigos malformados")
            return
        
        texto = f"Se encontraron {len(codigos_malos)} preguntas con códigos malformados:\n\n"
        
        for p in codigos_malos:
            texto += f"Línea {p.linea_inicio}:\n"
            texto += f"  Código: {p.codigo}\n"
            texto += f"  Pregunta: {p.texto[:80]}...\n"
            texto += f"  Formato esperado: BC02-L3-Q01 o 3BC7-L11-Q01\n\n"
        
        self.text_codigos.insert('1.0', texto)
    
    def mostrar_problema(self, index):
        """Muestra un problema (duplicado) específico"""
        if index < 0 or index >= len(self.problemas):
            return
        
        self.index_actual = index
        self.actualizar_estadisticas()
        
        # Limpiar frame
        for widget in self.frame_duplicados.winfo_children():
            widget.destroy()
        
        problema = self.problemas[index]
        preguntas = problema['preguntas']
        
        # Variable para la selección
        var_seleccion = tk.StringVar(value=self.decisiones.get(index, ''))
        
        # Mostrar información de similitud
        if len(preguntas) == 2:
            similitud = preguntas[0].similitud_texto(preguntas[1])
            ttk.Label(self.frame_duplicados, 
                     text=f"Similitud: {similitud*100:.1f}%", 
                     style='Dark.TLabel',
                     foreground='#00d4ff').pack(pady=5)
        
        # Mostrar cada pregunta
        for i, pregunta in enumerate(preguntas):
            frame_pregunta = tk.Frame(self.frame_duplicados, bg='#2a2a2a', 
                                     relief=tk.RAISED, borderwidth=2)
            frame_pregunta.pack(fill=tk.X, padx=10, pady=10)
            
            # Radio button para seleccionar
            rb = tk.Radiobutton(frame_pregunta, text=f"Mantener esta pregunta", 
                               variable=var_seleccion, value=str(i),
                               bg='#2a2a2a', fg='#e0e0e0', 
                               selectcolor='#1a1a1a',
                               font=('Segoe UI', 10, 'bold'),
                               command=lambda: self.seleccionar_pregunta(index, var_seleccion.get()))
            rb.pack(anchor=tk.W, padx=10, pady=5)
            
            # Código
            lbl_codigo = tk.Label(frame_pregunta, text=f"Código: {pregunta.codigo}", 
                                 bg='#2a2a2a', fg='#00d4ff', 
                                 font=('Consolas', 10, 'bold'))
            lbl_codigo.pack(anchor=tk.W, padx=10, pady=2)
            
            # Línea del archivo
            lbl_linea = tk.Label(frame_pregunta, text=f"Línea: {pregunta.linea_inicio}", 
                                bg='#2a2a2a', fg='#888', 
                                font=('Segoe UI', 9))
            lbl_linea.pack(anchor=tk.W, padx=10, pady=2)
            
            # Pregunta
            text_pregunta = tk.Text(frame_pregunta, height=3, width=100, 
                                   bg='#1a1a1a', fg='#e0e0e0', 
                                   font=('Segoe UI', 10), wrap=tk.WORD)
            text_pregunta.insert('1.0', pregunta.texto)
            text_pregunta.config(state='disabled')
            text_pregunta.pack(padx=10, pady=5)
            
            # Opciones
            for opcion in pregunta.opciones:
                lbl_opcion = tk.Label(frame_pregunta, text=opcion, 
                                     bg='#2a2a2a', fg='#e0e0e0', 
                                     font=('Segoe UI', 9))
                lbl_opcion.pack(anchor=tk.W, padx=20, pady=1)
            
            # Respuesta
            lbl_respuesta = tk.Label(frame_pregunta, 
                                    text=f"RESPUESTA: {pregunta.respuesta}", 
                                    bg='#2a2a2a', fg='#00ff00', 
                                    font=('Segoe UI', 10, 'bold'))
            lbl_respuesta.pack(anchor=tk.W, padx=10, pady=5)
        
        # Botón para eliminar todas las del grupo
        ttk.Button(self.frame_duplicados, text="Eliminar TODAS estas preguntas", 
                  command=lambda: self.eliminar_todas(index),
                  style='Dark.TButton').pack(pady=10)
    
    def seleccionar_pregunta(self, index_problema, seleccion):
        """Registra la decisión del usuario"""
        self.decisiones[index_problema] = seleccion
    
    def eliminar_todas(self, index_problema):
        """Marca todas las preguntas del grupo para eliminación"""
        respuesta = messagebox.askyesno("Confirmar", 
                                        "¿Eliminar todas las preguntas de este grupo?")
        if respuesta:
            self.decisiones[index_problema] = 'eliminar_todas'
            self.siguiente()
    
    def anterior(self):
        """Navega al problema anterior"""
        if self.index_actual > 0:
            self.mostrar_problema(self.index_actual - 1)
            self.btn_siguiente['state'] = 'normal'
            if self.index_actual == 0:
                self.btn_anterior['state'] = 'disabled'
    
    def siguiente(self):
        """Navega al siguiente problema"""
        if self.index_actual < len(self.problemas) - 1:
            self.mostrar_problema(self.index_actual + 1)
            self.btn_anterior['state'] = 'normal'
            if self.index_actual == len(self.problemas) - 1:
                self.btn_siguiente['state'] = 'disabled'
        else:
            messagebox.showinfo("Fin", "Has revisado todos los duplicados")
    
    def generar_archivo_limpio(self):
        """Genera el archivo limpio basado en las decisiones"""
        if not self.problemas:
            messagebox.showwarning("Advertencia", "No hay problemas para resolver")
            return
        
        # Verificar que se hayan tomado todas las decisiones
        sin_decidir = len(self.problemas) - len(self.decisiones)
        if sin_decidir > 0:
            respuesta = messagebox.askyesno("Advertencia", 
                f"Hay {sin_decidir} problemas sin revisar.\n¿Continuar de todos modos?")
            if not respuesta:
                return
        
        # Determinar qué preguntas mantener
        indices_eliminar = set()
        
        for i, problema in enumerate(self.problemas):
            decision = self.decisiones.get(i, '')
            
            if decision == 'eliminar_todas':
                # Eliminar todas las preguntas del grupo
                indices_eliminar.update(problema['indices'])
            elif decision.isdigit():
                # Mantener una y eliminar las demás
                mantener = int(decision)
                for j, idx in enumerate(problema['indices']):
                    if j != mantener:
                        indices_eliminar.add(idx)
        
        # Crear lista de preguntas limpias
        preguntas_limpias = [p for i, p in enumerate(self.preguntas) 
                            if i not in indices_eliminar]
        
        # Generar vista previa
        self.mostrar_vista_previa(preguntas_limpias, indices_eliminar)
        
        # Preguntar si guardar
        respuesta = messagebox.askyesno("Guardar", 
            f"Se eliminarán {len(indices_eliminar)} preguntas.\n"
            f"Quedarán {len(preguntas_limpias)} preguntas.\n\n"
            "¿Guardar archivo limpio?")
        
        if respuesta:
            self.guardar_archivo_limpio(preguntas_limpias)
    
    def mostrar_vista_previa(self, preguntas_limpias, indices_eliminados):
        """Muestra vista previa del archivo limpio"""
        self.text_resultado.delete('1.0', tk.END)
        
        texto = f"=== RESUMEN ===\n"
        texto += f"Total original: {len(self.preguntas)} preguntas\n"
        texto += f"A eliminar: {len(indices_eliminados)} preguntas\n"
        texto += f"Resultado final: {len(preguntas_limpias)} preguntas\n\n"
        texto += "="*80 + "\n\n"
        
        # Mostrar algunas preguntas de ejemplo
        texto += "=== PRIMERAS 5 PREGUNTAS ===\n\n"
        for p in preguntas_limpias[:5]:
            texto += f"{p.codigo}- Pregunta: {p.texto}\n"
            for opcion in p.opciones:
                texto += f"{opcion}\n"
            texto += f"ANSWER: {p.respuesta}\n\n"
        
        self.text_resultado.insert('1.0', texto)
    
    def guardar_archivo_limpio(self, preguntas_limpias):
        """Guarda el archivo limpio"""
        ruta = filedialog.asksaveasfilename(
            title="Guardar archivo limpio",
            defaultextension=".json",
            filetypes=[("JSON", "*.json"), ("Archivos de texto", "*.txt"), ("Todos los archivos", "*.*")],
            initialfile="preguntas_ISO_limpio.json"
        )
        
        if not ruta:
            return
        
        try:
            if ruta.lower().endswith('.json'):
                salida = []
                for p in preguntas_limpias:
                    salida.append({
                        'cuestion': f"{p.codigo}- Pregunta: {p.texto}",
                        'opciones': list(p.opciones),
                        'solucion': (p.respuesta or '').strip().upper(),
                    })
                with open(ruta, 'w', encoding='utf-8') as f:
                    json.dump(salida, f, ensure_ascii=False, indent=2)
            else:
                with open(ruta, 'w', encoding='utf-8') as f:
                    for p in preguntas_limpias:
                        f.write(f"{p.codigo}- Pregunta: {p.texto}\n")
                        for opcion in p.opciones:
                            f.write(f"{opcion}\n")
                        f.write(f"ANSWER: {p.respuesta}\n\n")
            
            messagebox.showinfo("Éxito", f"Archivo guardado:\n{ruta}")
        except Exception as e:
            messagebox.showerror("Error", f"Error al guardar:\n{str(e)}")

def main():
    root = tk.Tk()
    app = RevisorPreguntasGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
