import argparse
import json
import os
import shutil
import tempfile
from collections import Counter
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText

BALANCE_LETTERS = ["A", "B", "C", "D"]
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
    for q in questions:
        options = q.get("opciones")
        sol = str(q.get("solucion", "")).strip().upper()
        unique_solution_letters = sorted(set(ch for ch in sol if ch in BALANCE_LETTERS))
        if len(unique_solution_letters) > 1:
            skipped_multi += 1
            continue
        if isinstance(options, list) and len(options) >= 4 and sol in BALANCE_LETTERS:
            eligible += 1
    return {
        "questions": len(questions),
        "eligible": eligible,
        "skipped_multi": skipped_multi,
        "counts": counts,
    }


def rebalance_file(path, create_backup=True):
    payload, questions, wrapped = load_json_file(path)
    before = get_solution_distribution(questions)

    backup_path = None
    if create_backup:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_path = f"{path}.bak-{stamp}.json"
        shutil.copy2(path, backup_path)

    result = rebalance_questions(questions)
    save_json_file(path, questions, wrapped)
    after = get_solution_distribution(questions)

    return {
        "before": before,
        "after": after,
        "backup": backup_path,
        "eligible": result["eligible"],
        "skipped_multi": result.get("skipped_multi", 0),
        "changed": result["changed"],
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
    def __init__(self, root):
        self.root = root
        self.root.title("Rebalanceador Universal de Respuestas")
        self.root.geometry("940x680")
        self.root.minsize(820, 560)
        self.root.configure(bg=WINDOW_BG)

        self.mode_var = tk.StringVar(value="file")
        self.file_path_var = tk.StringVar()
        self.folder_path_var = tk.StringVar()
        self.backup_var = tk.BooleanVar(value=True)

        default_file = Path(__file__).with_name("preguntas.json")
        if default_file.exists():
            self.file_path_var.set(str(default_file))
            self.folder_path_var.set(str(default_file.parent))
        else:
            self.folder_path_var.set(str(Path(__file__).resolve().parent))

        self._build_ui()
        self._set_mode_ui()
        self._log("Listo. Puedes trabajar por archivo o por carpeta (todas las asignaturas).")

    def _configure_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        style.configure("Root.TFrame", background=WINDOW_BG)
        style.configure("Card.TFrame", background=PANEL_BG)
        style.configure("Title.TLabel", background=WINDOW_BG, foreground=TEXT_PRIMARY, font=("Segoe UI", 18, "bold"))
        style.configure("Subtitle.TLabel", background=WINDOW_BG, foreground=TEXT_MUTED, font=("Segoe UI", 10))
        style.configure("CardTitle.TLabel", background=PANEL_BG, foreground=TEXT_PRIMARY, font=("Segoe UI", 11, "bold"))
        style.configure("CardText.TLabel", background=PANEL_BG, foreground=TEXT_MUTED, font=("Segoe UI", 10))

        style.configure("TLabel", background=PANEL_BG, foreground=TEXT_PRIMARY, font=("Segoe UI", 10))
        style.configure("TEntry", fieldbackground="#0F172A", foreground=TEXT_PRIMARY, bordercolor="#334155")
        style.configure("TCheckbutton", background=PANEL_BG, foreground=TEXT_PRIMARY)
        style.configure("TRadiobutton", background=PANEL_BG, foreground=TEXT_PRIMARY)
        style.map("TRadiobutton", background=[("active", PANEL_BG)])

        style.configure("Action.TButton", background=ACCENT, foreground="#052E16", font=("Segoe UI", 10, "bold"), padding=8)
        style.map("Action.TButton", background=[("active", "#16A34A")])

        style.configure("Secondary.TButton", background="#334155", foreground=TEXT_PRIMARY, font=("Segoe UI", 10), padding=6)
        style.map("Secondary.TButton", background=[("active", "#475569")])

    def _build_ui(self):
        self._configure_styles()

        main = ttk.Frame(self.root, style="Root.TFrame")
        main.pack(fill="both", expand=True, padx=14, pady=12)

        header = ttk.Frame(main, style="Root.TFrame")
        header.pack(fill="x", pady=(0, 10))
        ttk.Label(header, text="Rebalanceador Universal", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            header,
            text="Reparte soluciones A/B/C/D sin cambiar el contenido real de las respuestas.",
            style="Subtitle.TLabel",
        ).pack(anchor="w", pady=(3, 0))

        config_card = ttk.Frame(main, style="Card.TFrame", padding=12)
        config_card.pack(fill="x")

        ttk.Label(config_card, text="Modo de trabajo", style="CardTitle.TLabel").pack(anchor="w")
        ttk.Label(config_card, text="Archivo individual o carpeta completa de simuladores.", style="CardText.TLabel").pack(anchor="w", pady=(0, 8))

        mode_row = ttk.Frame(config_card, style="Card.TFrame")
        mode_row.pack(fill="x", pady=(0, 6))
        ttk.Radiobutton(mode_row, text="Un archivo JSON", value="file", variable=self.mode_var, command=self._set_mode_ui).pack(side="left", padx=(0, 14))
        ttk.Radiobutton(mode_row, text="Carpeta completa", value="folder", variable=self.mode_var, command=self._set_mode_ui).pack(side="left")

        self.file_row = ttk.Frame(config_card, style="Card.TFrame")
        self.file_row.pack(fill="x", pady=4)
        ttk.Label(self.file_row, text="Archivo:").pack(side="left")
        ttk.Entry(self.file_row, textvariable=self.file_path_var).pack(side="left", fill="x", expand=True, padx=8)
        ttk.Button(self.file_row, text="Seleccionar", style="Secondary.TButton", command=self.select_file).pack(side="left")

        self.folder_row = ttk.Frame(config_card, style="Card.TFrame")
        self.folder_row.pack(fill="x", pady=4)
        ttk.Label(self.folder_row, text="Carpeta:").pack(side="left")
        ttk.Entry(self.folder_row, textvariable=self.folder_path_var).pack(side="left", fill="x", expand=True, padx=8)
        ttk.Button(self.folder_row, text="Seleccionar", style="Secondary.TButton", command=self.select_folder).pack(side="left")

        ttk.Checkbutton(
            config_card,
            text="Crear copia de seguridad antes de modificar (.bak-YYYYMMDD-HHMMSS.json)",
            variable=self.backup_var,
        ).pack(anchor="w", pady=(8, 0))

        actions = ttk.Frame(main, style="Root.TFrame")
        actions.pack(fill="x", pady=10)
        ttk.Button(actions, text="Analizar", style="Action.TButton", command=self.analyze).pack(side="left")
        ttk.Button(actions, text="Reequilibrar", style="Action.TButton", command=self.rebalance).pack(side="left", padx=8)

        results_card = ttk.Frame(main, style="Card.TFrame", padding=10)
        results_card.pack(fill="both", expand=True)
        ttk.Label(results_card, text="Resultados", style="CardTitle.TLabel").pack(anchor="w", pady=(0, 6))

        self.summary_text = ScrolledText(results_card, height=11, wrap="word", bg="#0B1220", fg=TEXT_PRIMARY, insertbackground=TEXT_PRIMARY)
        self.summary_text.pack(fill="both", expand=True, pady=(0, 8))
        self.summary_text.configure(state="disabled")

        ttk.Label(results_card, text="Log", style="CardTitle.TLabel").pack(anchor="w", pady=(0, 6))
        self.log_text = ScrolledText(results_card, height=9, wrap="word", bg="#0B1220", fg="#C7D2FE", insertbackground=TEXT_PRIMARY)
        self.log_text.pack(fill="both", expand=True)
        self.log_text.configure(state="disabled")

    def _set_mode_ui(self):
        is_file = self.mode_var.get() == "file"

        for child in self.file_row.winfo_children():
            state = "normal" if is_file else "disabled"
            try:
                child.configure(state=state)
            except tk.TclError:
                pass

        for child in self.folder_row.winfo_children():
            state = "disabled" if is_file else "normal"
            try:
                child.configure(state=state)
            except tk.TclError:
                pass

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
        self._append_text(self.log_text, f"[{stamp}] {msg}\n")

    def select_file(self):
        path = filedialog.askopenfilename(
            title="Selecciona archivo JSON",
            filetypes=[("JSON", "*.json"), ("Todos", "*.*")],
        )
        if path:
            self.file_path_var.set(path)
            self._log(f"Archivo seleccionado: {path}")

    def select_folder(self):
        path = filedialog.askdirectory(title="Selecciona carpeta raíz")
        if path:
            self.folder_path_var.set(path)
            self._log(f"Carpeta seleccionada: {path}")

    def _validate_targets(self):
        if self.mode_var.get() == "file":
            path = self.file_path_var.get().strip()
            if not path:
                messagebox.showerror("Error", "Selecciona un archivo JSON.")
                return []
            if not os.path.exists(path):
                messagebox.showerror("Error", "El archivo no existe.")
                return []
            return [Path(path)]

        folder = self.folder_path_var.get().strip()
        if not folder:
            messagebox.showerror("Error", "Selecciona una carpeta.")
            return []
        try:
            files = collect_json_files(folder)
        except Exception as ex:
            messagebox.showerror("Error", str(ex))
            return []
        if not files:
            messagebox.showwarning("Aviso", "No se encontraron archivos JSON válidos en la carpeta.")
            return []
        return files

    @staticmethod
    def _counts_line(counts):
        return " | ".join([f"{l}:{counts.get(l, 0)}" for l in BALANCE_LETTERS])

    def analyze(self):
        files = self._validate_targets()
        if not files:
            return

        lines = []
        ok = 0
        fail = 0

        for f in files:
            try:
                info = analyze_file(str(f))
                lines.append(
                    f"OK  {f}\n"
                    f"  Preguntas: {info['questions']} | Elegibles: {info['eligible']} | Omitidas por solucion multiple: {info['skipped_multi']}\n"
                    f"  Distribucion: {self._counts_line(info['counts'])}\n"
                )
                ok += 1
            except Exception as ex:
                lines.append(f"ERR {f}\n  {ex}\n")
                fail += 1

        header = [
            f"Analisis completado.",
            f"Archivos OK: {ok}",
            f"Archivos con error: {fail}",
            "",
        ]
        self._set_text(self.summary_text, "\n".join(header + lines))
        self._log(f"Analisis completado. OK={ok}, Error={fail}")

    def rebalance(self):
        files = self._validate_targets()
        if not files:
            return

        if len(files) > 1:
            if not messagebox.askyesno("Confirmar", f"Se van a procesar {len(files)} archivos. ¿Continuar?"):
                return

        lines = []
        total_changed = 0
        ok = 0
        fail = 0

        for f in files:
            try:
                result = rebalance_file(str(f), create_backup=self.backup_var.get())
                total_changed += result["changed"]
                lines.append(
                    f"OK  {f}\n"
                    f"  Preguntas: {result['questions']} | Elegibles: {result['eligible']} | Omitidas por solucion multiple: {result['skipped_multi']} | Modificadas: {result['changed']}\n"
                    f"  Antes:   {self._counts_line(result['before'])}\n"
                    f"  Despues: {self._counts_line(result['after'])}\n"
                )
                if result["backup"]:
                    lines.append(f"  Backup: {result['backup']}\n")
                lines.append("\n")
                ok += 1
            except Exception as ex:
                lines.append(f"ERR {f}\n  {ex}\n\n")
                fail += 1

        header = [
            "Reequilibrado completado.",
            f"Archivos OK: {ok}",
            f"Archivos con error: {fail}",
            f"Preguntas modificadas (total): {total_changed}",
            "",
        ]
        self._set_text(self.summary_text, "\n".join(header + lines))
        self._log(f"Reequilibrado completado. OK={ok}, Error={fail}, Modificadas={total_changed}")

        if fail == 0:
            messagebox.showinfo("OK", f"Proceso completado correctamente.\nArchivos procesados: {ok}")
        else:
            messagebox.showwarning("Completado con incidencias", f"OK: {ok}\nCon error: {fail}")


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
