#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Conversor de exportaciones tipo Moodle a formato del simulador.

Convierte textos como:
  BC06-L31-Q03-¿Pregunta...?
  ...
  a. ...
  b. ...
  c. ...
  d. ...
  Retroalimentación
  La respuesta correcta es: ...

A formato compatible con `txt_a_json.py`:
  BC06-L31-Q03- Pregunta: ¿Pregunta...?
  A. ...
  B. ...
  C. ...
  D. ...
  ANSWER: B

Uso:
  python moodle_a_formato_txt.py entrada.txt salida.txt

Opciones:
  --keep-incomplete   Incluye preguntas incompletas (no recomendado)
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass


NOISE_LINE_RE = re.compile(
    r"^(?:"
    r"Pregunta\s+\d+\s*$|"
    r"Pregunta\s+\d+Respuesta\s*$|"
    r"Correcta\s*$|Incorrecta\s*$|"
    r"Se\s+punt[úu]a\s+.*$|"
    r"Marcar\s+pregunta\s*$|"
    r"Enunciado\s+de\s+la\s+pregunta\s*$"
    r")",
    re.IGNORECASE,
)

QUESTION_START_RE = re.compile(
    r"(?m)^(?P<id>[A-Z0-9]+-L\d+-Q\d+)\s*(?:-|–)?\s*(?P<rest>.*)$"
)

OPTION_LINE_RE = re.compile(r"^\s*([a-dA-D])\.\s*(.*)$")

CORRECT_RE = re.compile(
    r"La\s+respuesta\s+correcta\s+es\s*:\s*(.*)$", re.IGNORECASE
)


@dataclass
class ParsedQuestion:
    qid: str
    question: str
    options: dict[str, str]  # keys: A,B,C,D
    answer: str  # A-D


def _collapse_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _strip_trailing_punct(text: str) -> str:
    return text.strip().strip("\u00ab\u00bb\"'“”‘’ ").rstrip(".。;；:：")


def _norm(text: str) -> str:
    text = _collapse_ws(text)
    text = text.replace("\u00a0", " ")
    text = _strip_trailing_punct(text)
    return text.casefold()


def _split_into_blocks(raw: str) -> list[str]:
    matches = list(QUESTION_START_RE.finditer(raw))
    if not matches:
        return []

    blocks: list[str] = []
    for idx, m in enumerate(matches):
        start = m.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(raw)
        blocks.append(raw[start:end].strip())
    return blocks


def _extract_qid_and_first_line(block: str) -> tuple[str, str]:
    m = QUESTION_START_RE.search(block)
    if not m:
        return "", ""
    qid = m.group("id").strip()
    rest = m.group("rest").strip()
    return qid, rest


def _extract_options(block_lines: list[str]) -> tuple[dict[str, str], list[str]]:
    """Extrae opciones a/b/c/d.

    Devuelve (options_dict, remaining_lines_after_options_start)
    """
    options_lower: dict[str, list[str]] = {}
    i = 0
    # buscar primera opción
    while i < len(block_lines):
        line = block_lines[i].rstrip("\n")
        if OPTION_LINE_RE.match(line):
            break
        i += 1

    if i >= len(block_lines):
        return {}, []

    current_key: str | None = None
    while i < len(block_lines):
        raw_line = block_lines[i].rstrip("\n")
        if NOISE_LINE_RE.match(raw_line.strip()):
            i += 1
            continue

        if raw_line.strip().lower().startswith("retroalimentación"):
            i += 1
            break

        m = OPTION_LINE_RE.match(raw_line)
        if m:
            current_key = m.group(1).lower()
            options_lower.setdefault(current_key, [])
            tail = m.group(2).strip()
            if tail:
                options_lower[current_key].append(tail)
            i += 1
            continue

        if current_key is not None:
            # parte del texto de la opción (puede venir en líneas separadas)
            if raw_line.strip():
                options_lower[current_key].append(raw_line.strip())
        i += 1

    # normalizar a A-D
    mapping = {"a": "A", "b": "B", "c": "C", "d": "D"}
    options: dict[str, str] = {}
    for k_lower, k_upper in mapping.items():
        if k_lower in options_lower:
            options[k_upper] = _collapse_ws(" ".join(options_lower[k_lower]))

    remaining = block_lines[i:] if i < len(block_lines) else []
    return options, remaining


def _extract_question_text(qid: str, first_line_rest: str, block_lines: list[str]) -> str:
    """Obtiene el enunciado hasta antes de las opciones."""

    # Si en la primera línea ya viene el texto, úsalo.
    if first_line_rest:
        q = first_line_rest
    else:
        # Buscar la primera línea “útil” antes de que empiecen las opciones
        q_parts: list[str] = []
        for line in block_lines[1:]:
            s = line.strip()
            if not s:
                continue
            if NOISE_LINE_RE.match(s):
                continue
            if OPTION_LINE_RE.match(s):
                break
            if s.lower().startswith("retroalimentación"):
                break
            q_parts.append(s)
        q = " ".join(q_parts)

    q = q.strip()
    # Limpiezas típicas
    q = re.sub(r"^Pregunta\s*:\s*", "", q, flags=re.IGNORECASE)
    q = _collapse_ws(q)

    if not q:
        return ""

    # Asegurar signos/puntuación mínimo: no tocar contenido, solo prefijo estándar
    return q


def _extract_correct_answer_text(lines: list[str]) -> str:
    """Busca 'La respuesta correcta es:' y devuelve el texto tras el ':'"""
    for idx, line in enumerate(lines):
        m = CORRECT_RE.search(line.strip())
        if not m:
            continue
        tail = m.group(1).strip()
        if tail:
            return tail
        # Si viene en la siguiente línea
        for j in range(idx + 1, min(idx + 4, len(lines))):
            s = lines[j].strip()
            if s:
                return s
        return ""
    return ""


def _answer_letter_from_correct_text(correct_text: str, options: dict[str, str]) -> str:
    if not correct_text:
        return ""

    # Si viene con letra (p.ej. "b." o "B")
    m = re.match(r"^\s*([a-dA-D])\s*\.?\s*(.*)$", correct_text)
    if m and m.group(2).strip() == "":
        return m.group(1).upper()

    correct_norm = _norm(correct_text)

    # Match exacto normalizado
    for letter, opt_text in options.items():
        if _norm(opt_text) == correct_norm:
            return letter

    # Heurística: contains
    best_letter = ""
    best_score = 0
    correct_tokens = set(correct_norm.split())

    for letter, opt_text in options.items():
        opt_norm = _norm(opt_text)
        opt_tokens = set(opt_norm.split())
        if not opt_tokens:
            continue
        # Jaccard-ish simple
        inter = len(correct_tokens & opt_tokens)
        union = len(correct_tokens | opt_tokens)
        score = int(1000 * inter / max(1, union))

        if correct_norm in opt_norm or opt_norm in correct_norm:
            score += 200

        if score > best_score:
            best_score = score
            best_letter = letter

    # Umbral conservador
    if best_letter and best_score >= 250:
        return best_letter

    return ""


def parse_moodle_like(raw: str, keep_incomplete: bool = False) -> tuple[list[ParsedQuestion], dict[str, int]]:
    blocks = _split_into_blocks(raw)

    stats = {
        "blocks": len(blocks),
        "parsed": 0,
        "written": 0,
        "skipped_no_options": 0,
        "skipped_incomplete_options": 0,
        "skipped_no_answer": 0,
        "skipped_answer_no_match": 0,
        "skipped_no_question": 0,
    }

    result: list[ParsedQuestion] = []

    for block in blocks:
        lines = block.splitlines()
        qid, rest = _extract_qid_and_first_line(block)
        if not qid:
            continue

        question_text = _extract_question_text(qid, rest, lines)
        if not question_text and not keep_incomplete:
            stats["skipped_no_question"] += 1
            continue

        options, remaining_after_opts = _extract_options(lines)
        if not options:
            stats["skipped_no_options"] += 1
            continue

        if any(letter not in options for letter in ("A", "B", "C", "D")):
            if not keep_incomplete:
                stats["skipped_incomplete_options"] += 1
                continue
            # rellenar faltantes con vacío
            for letter in ("A", "B", "C", "D"):
                options.setdefault(letter, "")

        correct_text = _extract_correct_answer_text(remaining_after_opts)
        if not correct_text:
            if not keep_incomplete:
                stats["skipped_no_answer"] += 1
                continue
            answer_letter = "A"
        else:
            answer_letter = _answer_letter_from_correct_text(correct_text, options)
            if not answer_letter:
                if not keep_incomplete:
                    stats["skipped_answer_no_match"] += 1
                    continue
                answer_letter = "A"

        result.append(
            ParsedQuestion(
                qid=qid,
                question=question_text,
                options=options,
                answer=answer_letter,
            )
        )
        stats["parsed"] += 1

    return result, stats


def render_to_simulator_format(questions: list[ParsedQuestion]) -> str:
    out_lines: list[str] = []

    for q in questions:
        out_lines.append(f"{q.qid}- Pregunta: {q.question}")
        out_lines.append(f"A. {q.options.get('A','').strip()}")
        out_lines.append(f"B. {q.options.get('B','').strip()}")
        out_lines.append(f"C. {q.options.get('C','').strip()}")
        out_lines.append(f"D. {q.options.get('D','').strip()}")
        out_lines.append(f"ANSWER: {q.answer}")
        out_lines.append("")

    return "\n".join(out_lines).rstrip() + "\n"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Convierte export tipo Moodle a formato preguntas_*.txt del simulador"
    )
    parser.add_argument("input", help="Archivo de entrada (txt pegado/export)")
    parser.add_argument(
        "output",
        nargs="?",
        default="preguntas_convertidas.txt",
        help="Archivo de salida (default: preguntas_convertidas.txt)",
    )
    parser.add_argument(
        "--keep-incomplete",
        action="store_true",
        help="No descartar preguntas incompletas (rellena con vacíos y ANSWER=A)",
    )

    args = parser.parse_args(argv)

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            raw = f.read()
    except FileNotFoundError:
        print(f"❌ No existe el archivo: {args.input}")
        return 2

    questions, stats = parse_moodle_like(raw, keep_incomplete=args.keep_incomplete)
    output_text = render_to_simulator_format(questions)

    with open(args.output, "w", encoding="utf-8", newline="\n") as f:
        f.write(output_text)

    stats["written"] = len(questions)

    print("=" * 70)
    print("✅ Conversión completada")
    print("=" * 70)
    print(f"Entrada:  {args.input}")
    print(f"Salida:   {args.output}")
    print(f"Bloques detectados:     {stats['blocks']}")
    print(f"Preguntas convertidas:  {stats['written']}")

    skipped = (
        stats["skipped_no_options"]
        + stats["skipped_incomplete_options"]
        + stats["skipped_no_answer"]
        + stats["skipped_answer_no_match"]
        + stats["skipped_no_question"]
    )
    if skipped:
        print("\nOmitidas:")
        for k in (
            "skipped_no_question",
            "skipped_no_options",
            "skipped_incomplete_options",
            "skipped_no_answer",
            "skipped_answer_no_match",
        ):
            if stats[k]:
                print(f"  - {k}: {stats[k]}")

        if not args.keep_incomplete:
            print("\n💡 Consejo: si quieres forzar la salida aunque falte algo, usa --keep-incomplete")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
