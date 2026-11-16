import argparse
import json
import os
import re
import shutil
import tempfile
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText

BALANCE_LETTERS = ["A", "B", "C", "D"]
QUESTION_ID_RE = re.compile(r"^(?P<prefix>[A-Z0-9]+)-(?P<tema>T\d+)-(?P<num>\d+)(?P<suffix>-Pregunta:.*)$")
WINDOW_BG = "#101828"
PANEL_BG = "#1D2939"
ACCENT = "#22C55E"
TEXT_PRIMARY = "#E2E8F0"
TEXT_MUTED = "#94A3B8"


def parse_option_text(option_text):
    text = str(option_text)
    if len(text) >= 3 and text[0].isalpha() and text[1:3] == ". ":
        return text[0].upper(), text[3:]
    return "", text


def normalize_question_list(payload):
    if isinstance(payload, list) and payload and isinstance(payload[0], list):
        return payload[0], True
    if isinstance(payload, list):
        return payload, False
    raise ValueError("Formato JSON no valido: se esperaba una lista de preguntas.")


def load_json_file(path):
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            payload = json.load(f)
    except json.JSONDecodeError:
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    questions, wrapped = normalize_question_list(payload)
    return payload, questions, wrapped


def save_json_file(path, questions, wrapped):
    output = [questions] if wrapped else questions
    with open(path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
        f.write("\n")


def get_solution_distribution(questions):
    counts = Counter()
    for q in questions:
        sol = str(q.get("solucion", "")).strip().upper()
        if sol:
            counts[sol] += 1
    return counts


def rebalance_questions(questions):
    candidates = []
    skipped_multi = 0

    for q in questions:
        options = q.get("opciones")
        if not isinstance(options, list) or len(options) < 4:
            continue

        solution = str(q.get("solucion", "")).strip().upper()
        unique_solution_letters = sorted(set(ch for ch in solution if ch in BALANCE_LETTERS))
        if len(unique_solution_letters) > 1:
            skipped_multi += 1
            continue

        if solution not in BALANCE_LETTERS:
            continue

        parsed = [parse_option_text(opt) for opt in options]

        correct_idx = -1
        for i, (letter, _body) in enumerate(parsed):
            if letter == solution:
                correct_idx = i
                break

        if correct_idx == -1:
            fallback = ord(solution) - ord("A")
            if 0 <= fallback < len(parsed):
                correct_idx = fallback

        if correct_idx == -1:
            continue

        candidates.append((q, parsed, correct_idx))

    if not candidates:
        return {
            "changed": 0,
            "eligible": 0,
            "skipped_multi": skipped_multi,
            "targets": {},
            "assigned": {},
        }

    total = len(candidates)
    base = total // len(BALANCE_LETTERS)
    rem = total % len(BALANCE_LETTERS)

    targets = {
        letter: base + (1 if i < rem else 0)
        for i, letter in enumerate(BALANCE_LETTERS)
    }
    assigned = {letter: 0 for letter in BALANCE_LETTERS}

    changed = 0

    for q, parsed, correct_idx in candidates:
        best_letter = max(BALANCE_LETTERS, key=lambda l: targets[l] - assigned[l])
        new_correct_idx = BALANCE_LETTERS.index(best_letter)

        correct_body = parsed[correct_idx][1]
        other_bodies = [body for i, (_l, body) in enumerate(parsed) if i != correct_idx]

        new_bodies = [""] * len(parsed)
        new_bodies[new_correct_idx] = correct_body

        k = 0
        for i in range(len(parsed)):
            if i == new_correct_idx:
                continue
            new_bodies[i] = other_bodies[k]
            k += 1

        new_options = []
        for i, body in enumerate(new_bodies):
            label = chr(ord("A") + i)
            new_options.append(f"{label}. {body}")

        old_solution = str(q.get("solucion", "")).strip().upper()
        old_options = list(q.get("opciones", []))

        q["opciones"] = new_options
        q["solucion"] = BALANCE_LETTERS[new_correct_idx]

        if old_options != new_options or old_solution != q["solucion"]:
            changed += 1

        assigned[best_letter] += 1

    return {
        "changed": changed,
        "eligible": len(candidates),
        "skipped_multi": skipped_multi,
        "targets": targets,
        "assigned": assigned,
    }


def renumber_questions_by_topic(questions):
    counters = defaultdict(int)
    changed = 0

    for q in questions:
        cuestion = str(q.get("cuestion", ""))
        match = QUESTION_ID_RE.match(cuestion)
        if not match:
            continue

        tema = match.group("tema")
        counters[tema] += 1

        old_num = match.group("num")
        width = max(1, len(old_num))
        new_num = str(counters[tema]).zfill(width)

        if new_num == old_num:
            continue

        q["cuestion"] = (
            f"{match.group('prefix')}-{tema}-{new_num}{match.group('suffix')}"
        )
        changed += 1

    return changed


def is_candidate_json(path):
    lower_name = path.name.lower()
    if ".bak-" in lower_name:
        return False
    if not lower_name.endswith(".json"):
        return False
    if not lower_name.startswith("preguntas"):
        return False
    return True


def collect_json_files(folder):
    base = Path(folder)
    if not base.exists() or not base.is_dir():
        raise ValueError("La carpeta indicada no existe.")

    files = []
    for path in base.rglob("*.json"):
        if is_candidate_json(path):
            files.append(path)
    return sorted(files)


def analyze_file(path):
    _payload, questions, _wrapped = load_json_file(path)
    counts = get_solution_distribution(questions)
    eligible = 0
    skipped_multi = 0
    renumberable = 0
    for q in questions:
        options = q.get("opciones")
        sol = str(q.get("solucion", "")).strip().upper()
        unique_solution_letters = sorted(set(ch for ch in sol if ch in BALANCE_LETTERS))
        if len(unique_solution_letters) > 1:
            skipped_multi += 1
            continue
        if isinstance(options, list) and len(options) >= 4 and sol in BALANCE_LETTERS:
            eligible += 1
        if QUESTION_ID_RE.match(str(q.get("cuestion", ""))):
            renumberable += 1
    return {
        "questions": len(questions),
        "eligible": eligible,
        "skipped_multi": skipped_multi,
        "renumberable": renumberable,
        "counts": counts,
    }


def rebalance_file(path, create_backup=True, renumber_by_topic=True):
    payload, questions, wrapped = load_json_file(path)
    before = get_solution_distribution(questions)

    backup_path = None
    if create_backup:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_path = f"{path}.bak-{stamp}.json"
        shutil.copy2(path, backup_path)

    result = rebalance_questions(questions)
    renumbered = renumber_questions_by_topic(questions) if renumber_by_topic else 0
    save_json_file(path, questions, wrapped)
    after = get_solution_distribution(questions)

    return {
        "before": before,
        "after": after,
        "backup": backup_path,
        "eligible": result["eligible"],
        "skipped_multi": result.get("skipped_multi", 0),
        "changed": result["changed"],
        "renumbered": renumbered,
        "questions": len(questions),
    }


def run_self_test(folder):
    files = collect_json_files(folder)
    if not files:
        print("SELF-TEST: no se encontraron JSON para probar.")
        return 1

    tested = 0
    skipped = 0
    for f in files:
        try:
            _payload, questions, wrapped = load_json_file(str(f))
            if not questions:
                skipped += 1
                continue

            with tempfile.TemporaryDirectory() as tmpdir:
                temp_path = Path(tmpdir) / f.name
                save_json_file(str(temp_path), questions, wrapped)
                rebalance_file(str(temp_path), create_backup=False)
            tested += 1
        except Exception as ex:
            print(f"SELF-TEST SKIP en {f}: {ex}")
            skipped += 1

    print(f"SELF-TEST OK. Archivos probados: {tested} | Omitidos: {skipped}")
    return 0


class RebalanceApp:
    """Interfaz de escritorio para analizar y reequilibrar bancos de preguntas."""

    COLORS = {
        "window": "#0B1220",
        "surface": "#111C2E",
        "surface_alt": "#17243A",
        "input": "#0D1728",
        "border": "#26364F",
        "accent": "#38BDF8",
        "accent_hover": "#0EA5E9",
        "success": "#34D399",
        "warning": "#FBBF24",
        "danger": "#FB7185",
        "text": "#E5EDF7",
        "muted": "#91A2B9",
        "white": "#FFFFFF",
    }

    def __init__(self, root):
        self.root = root
        self.root.title("Rebalanceador · Banco de preguntas")
        self.root.geometry("1080x780")
        self.root.minsize(900, 660)
        self.root.configure(bg=self.COLORS["window"])

        self.mode_var = tk.StringVar(value="file")
        self.file_path_var = tk.StringVar()
        self.folder_path_var = tk.StringVar()
        self.backup_var = tk.BooleanVar(value=True)
        self.renumber_var = tk.BooleanVar(value=True)
        self.status_var = tk.StringVar(value="Listo para trabajar")
        self.progress_var = tk.DoubleVar(value=0)

        default_file = Path(__file__).with_name("preguntas.json")
        if default_file.exists():
            self.file_path_var.set(str(default_file))
            self.folder_path_var.set(str(default_file.parent))
        else:
            self.folder_path_var.set(str(Path(__file__).resolve().parents[1]))

        self._configure_styles()
        self._build_ui()
        self._set_mode_ui()
        self._update_distribution(Counter(), "Ejecuta un análisis para ver los resultados.")
        self._log("Aplicación iniciada. Selecciona un archivo o una carpeta para comenzar.")

    def _configure_styles(self):
        c = self.COLORS
        style = ttk.Style(self.root)
        style.theme_use("clam")

        style.configure("Root.TFrame", background=c["window"])
        style.configure("Surface.TFrame", background=c["surface"])
        style.configure("SurfaceAlt.TFrame", background=c["surface_alt"])
        style.configure(
            "Title.TLabel", background=c["window"], foreground=c["text"],
            font=("Segoe UI", 21, "bold")
        )
        style.configure(
            "Subtitle.TLabel", background=c["window"], foreground=c["muted"],
            font=("Segoe UI", 10)
        )
        style.configure(
            "Section.TLabel", background=c["surface"], foreground=c["text"],
            font=("Segoe UI", 11, "bold")
        )
        style.configure(
            "Hint.TLabel", background=c["surface"], foreground=c["muted"],
            font=("Segoe UI", 9)
        )
        style.configure(
            "TLabel", background=c["surface"], foreground=c["text"],
            font=("Segoe UI", 10)
        )
        style.configure(
            "TEntry", fieldbackground=c["input"], foreground=c["text"],
            insertcolor=c["text"], bordercolor=c["border"], padding=8
        )
        style.map("TEntry", bordercolor=[("focus", c["accent"])])
        style.configure(
            "TCheckbutton", background=c["surface"], foreground=c["text"],
            font=("Segoe UI", 9), padding=(0, 5)
        )
        style.map(
            "TCheckbutton",
            background=[("active", c["surface"])],
            foreground=[("disabled", c["muted"]), ("active", c["white"])]
        )
        style.configure(
            "TRadiobutton", background=c["surface"], foreground=c["text"],
            font=("Segoe UI", 10), padding=(4, 7)
        )
        style.map(
            "TRadiobutton",
            background=[("active", c["surface_alt"])],
            foreground=[("selected", c["accent"]), ("active", c["white"])]
        )
        style.configure(
            "Primary.TButton", background=c["accent"], foreground="#062033",
            font=("Segoe UI", 10, "bold"), padding=(16, 10), borderwidth=0
        )
        style.map(
            "Primary.TButton",
            background=[("active", c["accent_hover"]), ("disabled", c["border"])],
            foreground=[("disabled", c["muted"])]
        )
        style.configure(
            "Secondary.TButton", background=c["surface_alt"], foreground=c["text"],
            font=("Segoe UI", 9, "bold"), padding=(11, 8), borderwidth=0
        )
        style.map(
            "Secondary.TButton",
            background=[("active", "#243650")],
            foreground=[("active", c["white"])]
        )
        style.configure(
            "TNotebook", background=c["surface"], borderwidth=0, tabmargins=(0, 0, 0, 0)
        )
        style.configure(
            "TNotebook.Tab", background=c["surface_alt"], foreground=c["muted"],
            padding=(16, 9), font=("Segoe UI", 9, "bold"), borderwidth=0
        )
        style.map(
            "TNotebook.Tab",
            background=[("selected", c["surface"])],
            foreground=[("selected", c["accent"])]
        )
        style.configure(
            "Horizontal.TProgressbar", troughcolor=c["input"],
            background=c["accent"], bordercolor=c["input"], lightcolor=c["accent"],
            darkcolor=c["accent"], thickness=7
        )
        for letter, color in {
            "A": "#38BDF8", "B": "#A78BFA", "C": "#34D399", "D": "#FBBF24"
        }.items():
            style.configure(
                f"{letter}.Horizontal.TProgressbar", troughcolor=c["input"],
                background=color, bordercolor=c["input"], lightcolor=color,
                darkcolor=color, thickness=7
            )

    def _build_ui(self):
        c = self.COLORS
        main = ttk.Frame(self.root, style="Root.TFrame", padding=(26, 22, 26, 16))
        main.pack(fill="both", expand=True)

        header = ttk.Frame(main, style="Root.TFrame")
        header.pack(fill="x", pady=(0, 20))

        title_area = ttk.Frame(header, style="Root.TFrame")
        title_area.pack(side="left", fill="x", expand=True)
        ttk.Label(
            title_area, text="Rebalanceador", style="Title.TLabel"
        ).pack(anchor="w")
        ttk.Label(
            title_area,
            text="Distribuye las respuestas correctas entre A, B, C y D sin alterar su contenido.",
            style="Subtitle.TLabel"
        ).pack(anchor="w", pady=(4, 0))

        self.mode_badge = tk.Label(
            header, text="BANCO DE PREGUNTAS", bg=c["surface_alt"],
            fg=c["accent"], font=("Segoe UI", 8, "bold"), padx=12, pady=7
        )
        self.mode_badge.pack(side="right", anchor="n", pady=5)

        config = ttk.Frame(main, style="Surface.TFrame", padding=18)
        config.pack(fill="x")
        ttk.Label(config, text="1. Configuración", style="Section.TLabel").pack(anchor="w")
        ttk.Label(
            config, text="Indica qué quieres procesar y cómo debe realizarse el cambio.",
            style="Hint.TLabel"
        ).pack(anchor="w", pady=(3, 13))

        mode_row = ttk.Frame(config, style="Surface.TFrame")
        mode_row.pack(fill="x", pady=(0, 10))
        ttk.Radiobutton(
            mode_row, text="Archivo individual", value="file",
            variable=self.mode_var, command=self._set_mode_ui
        ).pack(side="left", padx=(0, 18))
        ttk.Radiobutton(
            mode_row, text="Carpeta completa", value="folder",
            variable=self.mode_var, command=self._set_mode_ui
        ).pack(side="left")

        self.file_row = ttk.Frame(config, style="Surface.TFrame")
        self.file_row.pack(fill="x", pady=3)
        ttk.Label(self.file_row, text="Archivo JSON", width=13).pack(side="left")
        self.file_entry = ttk.Entry(self.file_row, textvariable=self.file_path_var)
        self.file_entry.pack(side="left", fill="x", expand=True, padx=(0, 9))
        ttk.Button(
            self.file_row, text="Examinar…", style="Secondary.TButton",
            command=self.select_file
        ).pack(side="right")

        self.folder_row = ttk.Frame(config, style="Surface.TFrame")
        self.folder_row.pack(fill="x", pady=3)
        ttk.Label(self.folder_row, text="Carpeta raíz", width=13).pack(side="left")
        self.folder_entry = ttk.Entry(self.folder_row, textvariable=self.folder_path_var)
        self.folder_entry.pack(side="left", fill="x", expand=True, padx=(0, 9))
        ttk.Button(
            self.folder_row, text="Examinar…", style="Secondary.TButton",
            command=self.select_folder
        ).pack(side="right")

        ttk.Separator(config, orient="horizontal").pack(fill="x", pady=14)
        options = ttk.Frame(config, style="Surface.TFrame")
        options.pack(fill="x")
        ttk.Label(options, text="Opciones de procesamiento", style="Section.TLabel").pack(anchor="w")
        checks = ttk.Frame(options, style="Surface.TFrame")
        checks.pack(fill="x", pady=(5, 0))
        ttk.Checkbutton(
            checks, text="Crear copia de seguridad antes de modificar",
            variable=self.backup_var
        ).pack(side="left", padx=(0, 24))
        ttk.Checkbutton(
            checks, text="Renumerar preguntas por tema desde 1",
            variable=self.renumber_var
        ).pack(side="left")

        action_row = ttk.Frame(main, style="Root.TFrame")
        action_row.pack(fill="x", pady=16)
        ttk.Label(
            action_row, text="2. Ejecutar", background=c["window"],
            foreground=c["muted"], font=("Segoe UI", 9, "bold")
        ).pack(side="left", padx=(0, 14))
        self.analyze_button = ttk.Button(
            action_row, text="Analizar", style="Secondary.TButton",
            command=self.analyze
        )
        self.analyze_button.pack(side="left", padx=(0, 8))
        self.rebalance_button = ttk.Button(
            action_row, text="Reequilibrar", style="Primary.TButton",
            command=self.rebalance
        )
        self.rebalance_button.pack(side="left")
        self.progress = ttk.Progressbar(
            action_row, variable=self.progress_var, maximum=100,
            mode="determinate", length=150
        )
        self.progress.pack(side="right", fill="x", expand=False, padx=(16, 0))

        results = ttk.Frame(main, style="Surface.TFrame", padding=14)
        results.pack(fill="both", expand=True)
        results_header = ttk.Frame(results, style="Surface.TFrame")
        results_header.pack(fill="x", pady=(0, 10))
        ttk.Label(results_header, text="3. Resultados", style="Section.TLabel").pack(side="left")
        ttk.Label(
            results_header, text="El análisis y el registro aparecen en pestañas separadas.",
            style="Hint.TLabel"
        ).pack(side="right")

        distribution = ttk.Frame(results, style="Surface.TFrame")
        distribution.pack(fill="x", pady=(0, 12))
        distribution_header = ttk.Frame(distribution, style="Surface.TFrame")
        distribution_header.pack(fill="x", pady=(0, 8))
        ttk.Label(
            distribution_header, text="Distribución de respuestas correctas",
            style="Section.TLabel"
        ).pack(side="left")
        self.distribution_hint = ttk.Label(
            distribution_header, text="Ejecuta un análisis para ver los resultados.",
            style="Hint.TLabel"
        )
        self.distribution_hint.pack(side="right")

        self.distribution_cards = {}
        cards_row = ttk.Frame(distribution, style="Surface.TFrame")
        cards_row.pack(fill="x")
        option_colors = {
            "A": "#38BDF8",
            "B": "#A78BFA",
            "C": "#34D399",
            "D": "#FBBF24",
        }
        for letter in BALANCE_LETTERS:
            card = tk.Frame(
                cards_row, bg=c["surface_alt"], highlightthickness=1,
                highlightbackground=c["border"], padx=12, pady=9
            )
            card.pack(side="left", fill="x", expand=True, padx=(0, 8))
            top = tk.Frame(card, bg=c["surface_alt"])
            top.pack(fill="x")
            tk.Label(
                top, text=letter, bg=c["surface_alt"], fg=option_colors[letter],
                font=("Segoe UI", 15, "bold")
            ).pack(side="left")
            count_label = tk.Label(
                top, text="—", bg=c["surface_alt"], fg=c["text"],
                font=("Segoe UI", 17, "bold")
            )
            count_label.pack(side="right")
            percent_label = tk.Label(
                card, text="Sin datos", bg=c["surface_alt"], fg=c["muted"],
                font=("Segoe UI", 8)
            )
            percent_label.pack(anchor="w", pady=(1, 5))
            bar = ttk.Progressbar(
                card, maximum=100, value=0, mode="determinate",
                style=f"{letter}.Horizontal.TProgressbar"
            )
            bar.pack(fill="x")
            self.distribution_cards[letter] = {
                "count": count_label, "percent": percent_label, "bar": bar
            }

        self.tabs = ttk.Notebook(results)
        self.tabs.pack(fill="both", expand=True)

        summary_tab = ttk.Frame(self.tabs, style="Surface.TFrame", padding=8)
        log_tab = ttk.Frame(self.tabs, style="Surface.TFrame", padding=8)
        self.tabs.add(summary_tab, text="  Resumen  ")
        self.tabs.add(log_tab, text="  Registro  ")

        self.summary_text = self._create_output(summary_tab)
        self.log_text = self._create_output(log_tab)
        self._style_output(self.summary_text)
        self._style_output(self.log_text, log=True)

        footer = ttk.Frame(main, style="Root.TFrame")
        footer.pack(fill="x", pady=(12, 0))
        self.status_dot = tk.Label(
            footer, text="●", bg=c["window"], fg=c["success"],
            font=("Segoe UI", 9)
        )
        self.status_dot.pack(side="left")
        ttk.Label(
            footer, textvariable=self.status_var, style="Subtitle.TLabel"
        ).pack(side="left", padx=(6, 0))
        ttk.Label(
            footer, text="Los archivos de respaldo conservan la versión original.",
            style="Subtitle.TLabel"
        ).pack(side="right")

    def _update_distribution(self, counts, hint=None):
        total = sum(counts.get(letter, 0) for letter in BALANCE_LETTERS)
        for letter in BALANCE_LETTERS:
            value = counts.get(letter, 0)
            percentage = (value / total * 100) if total else 0
            card = self.distribution_cards[letter]
            card["count"].configure(text=f"{value:,}".replace(",", "."))
            card["percent"].configure(
                text=f"{percentage:.1f}% del total" if total else "Sin datos"
            )
            card["bar"].configure(value=percentage)
        self.distribution_hint.configure(
            text=hint or (f"{total:,} respuestas contabilizadas".replace(",", ".") if total else "Sin datos")
        )

    def _create_output(self, parent):
        c = self.COLORS
        frame = ttk.Frame(parent, style="Surface.TFrame")
        frame.pack(fill="both", expand=True)
        widget = ScrolledText(
            frame, wrap="word", undo=False, relief="flat", borderwidth=0,
            padx=14, pady=12, bg=c["input"], fg=c["text"],
            insertbackground=c["text"], selectbackground="#244B70",
            font=("Cascadia Code", 9), spacing1=2, spacing3=3
        )
        widget.pack(fill="both", expand=True)
        widget.configure(state="disabled")
        return widget

    def _style_output(self, widget, log=False):
        c = self.COLORS
        widget.tag_configure("heading", foreground=c["accent"], font=("Segoe UI", 11, "bold"))
        widget.tag_configure("success", foreground=c["success"])
        widget.tag_configure("error", foreground=c["danger"])
        widget.tag_configure("muted", foreground=c["muted"])
        widget.tag_configure("highlight", foreground=c["white"], font=("Cascadia Code", 9, "bold"))
        if log:
            widget.tag_configure("timestamp", foreground=c["muted"])

    def _set_mode_ui(self):
        is_file = self.mode_var.get() == "file"
        self.file_entry.configure(state="normal" if is_file else "disabled")
        self.folder_entry.configure(state="disabled" if is_file else "normal")
        for child in self.file_row.winfo_children():
            if isinstance(child, ttk.Button):
                child.configure(state="normal" if is_file else "disabled")
        for child in self.folder_row.winfo_children():
            if isinstance(child, ttk.Button):
                child.configure(state="disabled" if is_file else "normal")

    def _set_text(self, widget, content):
        widget.configure(state="normal")
        widget.delete("1.0", "end")
        widget.insert("1.0", content)
        widget.configure(state="disabled")

    def _append_text(self, widget, content):
        widget.configure(state="normal")
        widget.insert("end", content)
        widget.see("end")
        widget.configure(state="disabled")

    def _log(self, msg):
        stamp = datetime.now().strftime("%H:%M:%S")
        self._append_text(self.log_text, f"[{stamp}]  {msg}\n")

    def _set_status(self, message, color=None):
        self.status_var.set(message)
        self.status_dot.configure(fg=color or self.COLORS["success"])
        self.root.update_idletasks()

    def _begin_operation(self, total):
        self.progress_var.set(0)
        self.progress.configure(maximum=max(total, 1))
        self.analyze_button.configure(state="disabled")
        self.rebalance_button.configure(state="disabled")
        self._set_status("Procesando…", self.COLORS["accent"])
        self.root.update_idletasks()

    def _advance_progress(self, current):
        self.progress_var.set(current)
        self.root.update_idletasks()

    def _end_operation(self, message, failed=False):
        self.analyze_button.configure(state="normal")
        self.rebalance_button.configure(state="normal")
        self._set_status(message, self.COLORS["danger"] if failed else self.COLORS["success"])

    def select_file(self):
        path = filedialog.askopenfilename(
            title="Selecciona el banco de preguntas",
            filetypes=[("Archivos JSON", "*.json"), ("Todos los archivos", "*.*")]
        )
        if path:
            self.file_path_var.set(path)
            self._log(f"Archivo seleccionado: {path}")

    def select_folder(self):
        path = filedialog.askdirectory(title="Selecciona la carpeta raíz")
        if path:
            self.folder_path_var.set(path)
            self._log(f"Carpeta seleccionada: {path}")

    def _validate_targets(self):
        if self.mode_var.get() == "file":
            path = self.file_path_var.get().strip()
            if not path:
                messagebox.showerror("Falta el archivo", "Selecciona un archivo JSON.")
                return []
            if not os.path.isfile(path):
                messagebox.showerror("Archivo no válido", "El archivo indicado no existe.")
                return []
            if Path(path).suffix.lower() != ".json":
                messagebox.showerror("Formato no válido", "Selecciona un archivo con extensión .json.")
                return []
            return [Path(path)]

        folder = self.folder_path_var.get().strip()
        if not folder:
            messagebox.showerror("Falta la carpeta", "Selecciona una carpeta raíz.")
            return []
        try:
            files = collect_json_files(folder)
        except Exception as ex:
            messagebox.showerror("Carpeta no válida", str(ex))
            return []
        if not files:
            messagebox.showwarning(
                "Sin archivos", "No se encontraron archivos JSON válidos.\n\n"
                "Se buscan archivos cuyo nombre comience por «preguntas»."
            )
            return []
        return files

    @staticmethod
    def _counts_line(counts):
        return "   ".join(f"{letter}: {counts.get(letter, 0)}" for letter in BALANCE_LETTERS)

    def analyze(self):
        files = self._validate_targets()
        if not files:
            return

        lines = [
            "ANÁLISIS DEL BANCO DE PREGUNTAS",
            "=" * 42,
            f"Archivos encontrados: {len(files)}",
            ""
        ]
        ok = fail = 0
        aggregate_counts = Counter()
        self._begin_operation(len(files))
        self.tabs.select(0)

        for index, file_path in enumerate(files, start=1):
            try:
                info = analyze_file(str(file_path))
                aggregate_counts.update(info["counts"])
                lines.extend([
                    f"✓  {file_path.name}",
                    f"   Preguntas totales: {info['questions']}",
                    f"   Aptas para reequilibrar: {info['eligible']}",
                    f"   Omitidas (solución múltiple): {info['skipped_multi']}",
                    f"   Identificadores renumerables: {info['renumberable']}",
                    f"   Distribución actual: {self._counts_line(info['counts'])}",
                    ""
                ])
                ok += 1
            except Exception as ex:
                lines.extend([f"✕  {file_path}", f"   Error: {ex}", ""])
                fail += 1
            self._advance_progress(index)

        lines[2:2] = [f"Archivos correctos: {ok}", f"Archivos con error: {fail}"]
        self._set_text(self.summary_text, "\n".join(lines))
        self._update_distribution(
            aggregate_counts,
            f"Distribución actual · {sum(aggregate_counts.values())} respuestas"
        )
        self._log(f"Análisis terminado. Correctos: {ok} · Errores: {fail}")
        self._end_operation(
            f"Análisis completado · {ok} correctos · {fail} con error",
            failed=fail > 0
        )

    def rebalance(self):
        files = self._validate_targets()
        if not files:
            return

        if len(files) > 1 and not messagebox.askyesno(
            "Confirmar operación",
            f"Se van a modificar {len(files)} archivos.\n\n"
            "Se aplicarán las opciones seleccionadas. ¿Deseas continuar?"
        ):
            return

        if not self.backup_var.get():
            confirm = messagebox.askyesno(
                "Procesar sin copia de seguridad",
                "Has desactivado la copia de seguridad.\n\n"
                "Los archivos originales se modificarán directamente. ¿Continuar?"
            )
            if not confirm:
                return

        lines = [
            "RESULTADO DEL REEQUILIBRADO",
            "=" * 42,
            f"Archivos seleccionados: {len(files)}",
            f"Copia de seguridad: {'Sí' if self.backup_var.get() else 'No'}",
            f"Renumeración por tema: {'Sí' if self.renumber_var.get() else 'No'}",
            ""
        ]
        total_changed = ok = fail = 0
        aggregate_after = Counter()
        self._begin_operation(len(files))
        self.tabs.select(0)

        for index, file_path in enumerate(files, start=1):
            try:
                result = rebalance_file(
                    str(file_path),
                    create_backup=self.backup_var.get(),
                    renumber_by_topic=self.renumber_var.get()
                )
                total_changed += result["changed"]
                aggregate_after.update(result["after"])
                lines.extend([
                    f"✓  {file_path.name}",
                    f"   Preguntas: {result['questions']} · Aptas: {result['eligible']}",
                    f"   Modificadas: {result['changed']} · Renumeradas: {result['renumbered']}",
                    f"   Omitidas (solución múltiple): {result['skipped_multi']}",
                    f"   Antes:    {self._counts_line(result['before'])}",
                    f"   Después:  {self._counts_line(result['after'])}"
                ])
                if result["backup"]:
                    lines.append(f"   Respaldo: {result['backup']}")
                lines.append("")
                ok += 1
            except Exception as ex:
                lines.extend([f"✕  {file_path}", f"   Error: {ex}", ""])
                fail += 1
            self._advance_progress(index)

        lines[2:2] = [
            f"Archivos correctos: {ok}",
            f"Archivos con error: {fail}",
            f"Preguntas modificadas: {total_changed}"
        ]
        self._set_text(self.summary_text, "\n".join(lines))
        self._update_distribution(
            aggregate_after,
            f"Distribución final · {sum(aggregate_after.values())} respuestas"
        )
        self._log(
            f"Reequilibrado terminado. Correctos: {ok} · Errores: {fail} · "
            f"Preguntas modificadas: {total_changed}"
        )
        self._end_operation(
            f"Proceso completado · {ok} correctos · {fail} con error",
            failed=fail > 0
        )

        if fail == 0:
            messagebox.showinfo(
                "Proceso completado",
                f"Se han procesado correctamente {ok} archivo(s).\n"
                f"Preguntas modificadas: {total_changed}."
            )
        else:
            messagebox.showwarning(
                "Proceso con incidencias",
                f"Archivos correctos: {ok}\nArchivos con error: {fail}\n"
                f"Preguntas modificadas: {total_changed}."
            )

def main():
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--self-test", action="store_true", help="Ejecuta una comprobación automática sin GUI")
    parser.add_argument("--folder", type=str, help="Carpeta a analizar en modo self-test")
    args = parser.parse_args()

    if args.self_test:
        folder = args.folder or str(Path(__file__).resolve().parents[1])
        raise SystemExit(run_self_test(folder))

    root = tk.Tk()
    RebalanceApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
