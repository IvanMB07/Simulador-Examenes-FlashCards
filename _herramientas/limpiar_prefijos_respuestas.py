"""Limpia prefijos A./B./C./D. en opciones de bancos JSON.

Analiza sin escribir. Solo modifica los archivos al confirmar en la interfaz.
Crea una copia de seguridad antes de guardar cada banco.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Any

PREFIX_RE = re.compile(r"^\s*([A-Z])\s*[.)]\s*")
PATTERN = "preguntas*.json"


def unwrap_questions(payload: Any) -> tuple[list, bool]:
    if not isinstance(payload, list):
        raise ValueError("El JSON debe contener una lista de preguntas.")
    wrapped = bool(payload and isinstance(payload[0], list))
    if wrapped:
        if len(payload) != 1:
            raise ValueError("Formato de lista envolvente no reconocido.")
        questions = payload[0]
    else:
        questions = payload
    if not all(isinstance(q, dict) for q in questions):
        raise ValueError("La lista contiene elementos que no son objetos de pregunta.")
    return questions, wrapped


def clean_question_options(question: dict) -> str:
    options = question.get("opciones")
    if not isinstance(options, list) or not options:
        return "skipped"
    if not all(isinstance(option, str) for option in options):
        return "skipped"

    matches = [PREFIX_RE.match(option) for option in options]
    if not any(matches):
        return "unchanged"

    expected = [chr(ord("A") + i) for i in range(len(options))]
    if len(options) > 26 or any(
        match is None or match.group(1) != expected[i]
        for i, match in enumerate(matches)
    ):
        return "skipped"

    question["opciones"] = [
        PREFIX_RE.sub("", option, count=1) for option in options
    ]
    return "cleaned"


def analyse_file(path: Path) -> dict:
    with path.open("r", encoding="utf-8-sig") as file:
        payload = json.load(file)
    questions, wrapped = unwrap_questions(payload)
    counts = {"cleaned": 0, "unchanged": 0, "skipped": 0}
    for question in questions:
        counts[clean_question_options(question)] += 1
    return {
        "path": path,
        "payload": [questions] if wrapped else questions,
        "counts": counts,
        "total": len(questions),
    }


def save_with_backup(path: Path, payload: Any) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = path.with_name(f"{path.name}.bak-{timestamp}")
    shutil.copy2(path, backup)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", newline="\n", dir=path.parent,
            prefix=f".{path.stem}-", suffix=".tmp", delete=False
        ) as temp:
            temp_name = temp.name
            json.dump(payload, temp, ensure_ascii=False, indent=2)
            temp.write("\n")
        os.replace(temp_name, path)
    except Exception:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)
        raise
    return backup


def find_question_files(folder: Path) -> list[Path]:
    return sorted(
        path for path in folder.rglob(PATTERN)
        if path.is_file() and ".bak-" not in path.name
    )


class CleanerApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Limpiador de prefijos · Simuladores de Estudio")
        self.root.geometry("900x600")
        self.root.minsize(720, 460)
        self.files: list[Path] = []
        self.results: list[dict] = []
        self.build_ui()

    def build_ui(self):
        self.root.configure(bg="#101828")
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TFrame", background="#101828")
        style.configure("TLabel", background="#101828", foreground="#E2E8F0")
        style.configure("Title.TLabel", font=("Segoe UI", 17, "bold"))
        style.configure("Muted.TLabel", foreground="#94A3B8")
        style.configure("TButton", padding=8)
        style.configure("Accent.TButton", background="#22C55E", foreground="#08130B")
        style.map("Accent.TButton", background=[("active", "#16A34A")])

        body = ttk.Frame(self.root, padding=18)
        body.pack(fill="both", expand=True)
        ttk.Label(body, text="Limpiador de prefijos de respuestas",
                  style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            body,
            text="Retira A., B., C. y D. del comienzo de las opciones sin cambiar su orden ni la solución.",
            style="Muted.TLabel", wraplength=820
        ).pack(anchor="w", pady=(5, 14))

        buttons = ttk.Frame(body)
        buttons.pack(fill="x", pady=(0, 12))
        ttk.Button(buttons, text="Seleccionar JSON",
                   command=self.select_file).pack(side="left", padx=(0, 8))
        ttk.Button(buttons, text="Seleccionar carpeta",
                   command=self.select_folder).pack(side="left", padx=(0, 8))
        ttk.Button(buttons, text="Analizar de nuevo",
                   command=self.analyse).pack(side="left")

        self.source = ttk.Label(body, text="Selecciona un archivo o una carpeta.",
                                style="Muted.TLabel")
        self.source.pack(anchor="w", pady=(0, 8))

        columns = ("file", "total", "cleaned", "unchanged", "skipped")
        self.table = ttk.Treeview(body, columns=columns, show="headings", height=14)
        for key, label, width in [
            ("file", "Archivo", 390), ("total", "Preguntas", 90),
            ("cleaned", "A limpiar", 90), ("unchanged", "Sin cambios", 100),
            ("skipped", "Revisar", 80)
        ]:
            self.table.heading(key, text=label)
            self.table.column(key, width=width,
                              anchor="w" if key == "file" else "center")
        self.table.pack(fill="both", expand=True)

        self.summary = ttk.Label(
            body, text="El análisis no modifica los archivos.",
            style="Muted.TLabel"
        )
        self.summary.pack(anchor="w", pady=12)
        footer = ttk.Frame(body)
        footer.pack(fill="x")
        ttk.Label(footer, text="Se crea una copia .bak antes de guardar.",
                  style="Muted.TLabel").pack(side="left")
        ttk.Button(footer, text="Limpiar archivos", style="Accent.TButton",
                   command=self.apply).pack(side="right")

    def select_file(self):
        filename = filedialog.askopenfilename(
            title="Seleccionar banco de preguntas",
            filetypes=[("Bancos de preguntas", "preguntas*.json"),
                       ("Archivos JSON", "*.json")]
        )
        if filename:
            self.files = [Path(filename)]
            self.source.configure(text=filename)
            self.analyse()

    def select_folder(self):
        folder = filedialog.askdirectory(title="Seleccionar carpeta de simuladores")
        if folder:
            self.files = find_question_files(Path(folder))
            self.source.configure(
                text=f"{folder} · {len(self.files)} archivo(s) preguntas*.json"
            )
            self.analyse()

    def analyse(self):
        self.results = []
        for item in self.table.get_children():
            self.table.delete(item)
        if not self.files:
            self.summary.configure(text="No hay archivos seleccionados.")
            return

        errors = []
        for path in self.files:
            try:
                result = analyse_file(path)
                self.results.append(result)
                c = result["counts"]
                self.table.insert("", "end", values=(
                    str(path), result["total"], c["cleaned"],
                    c["unchanged"], c["skipped"]
                ))
            except Exception as error:
                errors.append(f"{path.name}: {error}")

        total = sum(item["total"] for item in self.results)
        cleaned = sum(item["counts"]["cleaned"] for item in self.results)
        skipped = sum(item["counts"]["skipped"] for item in self.results)
        self.summary.configure(
            text=f"{len(self.results)} archivo(s) válidos · {total} preguntas · "
                 f"{cleaned} con prefijos · {skipped} para revisar. "
                 "No se ha modificado ningún archivo."
        )
        if errors:
            messagebox.showwarning("Archivos no analizados", "\n".join(errors))

    def apply(self):
        pending = [r for r in self.results if r["counts"]["cleaned"]]
        if not pending:
            messagebox.showinfo("Sin cambios", "No hay prefijos que limpiar.")
            return
        amount = sum(r["counts"]["cleaned"] for r in pending)
        if not messagebox.askyesno(
            "Confirmar limpieza",
            f"Se limpiarán {amount} pregunta(s) en {len(pending)} archivo(s).\n\n"
            "Se creará una copia de seguridad de cada JSON.\n¿Quieres continuar?"
        ):
            return

        saved, errors = [], []
        for result in pending:
            try:
                saved.append(save_with_backup(result["path"], result["payload"]))
            except Exception as error:
                errors.append(f"{result['path']}: {error}")
        self.analyse()
        if errors:
            messagebox.showerror("Limpieza parcial", "\n".join(errors))
        else:
            messagebox.showinfo(
                "Limpieza completada",
                f"Se han actualizado {len(saved)} archivo(s). "
                "Las copias de seguridad están junto a los originales."
            )


def main():
    root = tk.Tk()
    CleanerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
