#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pipeline único: Moodle/TXT -> (TXT) -> JSON.

Objetivo: automatizar en un solo script:
  1) Convertir un export "tipo Moodle" a formato TXT del simulador (opcional)
  2) Convertir ese TXT a `preguntas.json` (opcional)

Mantiene el flujo antiguo: puedes seguir usando `moodle_a_formato_txt.py`
(y/o) `txt_a_json.py` por separado.

Ejemplos:
  # 1) Moodle -> TXT y JSON (todo en uno)
  python convertir_preguntas.py modelo_entrada_moodle.txt --from moodle --txt preguntas_ISO_COMPLETAS.txt --json preguntas.json

  # 2) Moodle -> JSON (sin guardar el TXT intermedio)
  python convertir_preguntas.py modelo_entrada_moodle.txt --from moodle --json preguntas.json

  # 3) TXT (ya en formato simulador) -> JSON
  python convertir_preguntas.py preguntas_ISO_COMPLETAS.txt --from txt --json preguntas.json

  # 4) Auto-detect (recomendado)
  python convertir_preguntas.py modelo_entrada_moodle.txt --from auto --json preguntas.json

Notas:
- `--json` sin ruta escribe `preguntas.json`.
- `--txt` sin ruta escribe `preguntas_convertidas.txt`.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path


CODE_RE = re.compile(r"^([A-Z0-9]+-L\d+-Q\d+)")


def _detect_input_format(text: str) -> str:
    """Devuelve 'moodle' o 'txt' con una heurística simple."""
    if re.search(r"La\s+respuesta\s+correcta\s+es\s*:\s*", text, re.IGNORECASE):
        return "moodle"
    if re.search(r"(?m)^\s*[a-dA-D]\.\s*$", text) and re.search(
        r"(?m)^[A-Z0-9]+-L\d+-Q\d+", text
    ):
        return "moodle"
    return "txt"


def _write_json_questions(path: Path, questions: list[dict]) -> None:
    path.write_text(
        json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _extract_code_from_question(item: dict) -> str:
    cuestion = str(item.get("cuestion", "")).strip()
    m = CODE_RE.match(cuestion)
    return m.group(1).upper() if m else ""


def _merge_questions(existing: list[dict], incoming: list[dict]) -> tuple[list[dict], dict[str, int]]:
    codes = set()
    merged = list(existing)

    for q in existing:
        code = _extract_code_from_question(q)
        if code:
            codes.add(code)

    added = 0
    skipped = 0
    for q in incoming:
        code = _extract_code_from_question(q)
        if code and code in codes:
            skipped += 1
            continue
        merged.append(q)
        if code:
            codes.add(code)
        added += 1

    return merged, {"added": added, "skipped": skipped, "existing": len(existing)}


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Convierte export tipo Moodle o TXT del simulador y opcionalmente genera preguntas.json"
    )
    parser.add_argument("input", help="Archivo de entrada (export Moodle o TXT ya formateado)")
    parser.add_argument(
        "--from",
        dest="input_format",
        choices=["auto", "moodle", "txt"],
        default="auto",
        help="Formato de entrada (default: auto)",
    )
    parser.add_argument(
        "--txt",
        nargs="?",
        const="preguntas_convertidas.txt",
        default=None,
        help="Guarda también el TXT en formato simulador. Sin ruta usa preguntas_convertidas.txt",
    )
    parser.add_argument(
        "--json",
        nargs="?",
        const="preguntas.json",
        default=None,
        help="Genera el JSON. Sin ruta usa preguntas.json",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="Si el JSON de salida ya existe, añade solo preguntas nuevas (dedupe por código *-L*-Q*)",
    )
    parser.add_argument(
        "--keep-incomplete",
        action="store_true",
        help="En modo moodle: no descarta preguntas incompletas (rellena y pone ANSWER=A)",
    )

    args = parser.parse_args(argv)

    in_path = Path(args.input)
    if not in_path.exists():
        print(f"❌ No existe el archivo: {in_path}")
        return 2

    raw = in_path.read_text(encoding="utf-8")

    fmt = args.input_format
    if fmt == "auto":
        fmt = _detect_input_format(raw)

    txt_content: str

    if fmt == "moodle":
        from moodle_a_formato_txt import parse_moodle_like, render_to_simulator_format

        parsed, stats = parse_moodle_like(raw, keep_incomplete=args.keep_incomplete)
        txt_content = render_to_simulator_format(parsed)

        print("=" * 70)
        print("🧩 Entrada detectada: MOODLE")
        print("=" * 70)
        print(f"Bloques detectados:     {stats.get('blocks', 0)}")
        print(f"Preguntas convertidas:  {len(parsed)}")

        skipped = (
            stats.get("skipped_no_question", 0)
            + stats.get("skipped_no_options", 0)
            + stats.get("skipped_incomplete_options", 0)
            + stats.get("skipped_no_answer", 0)
            + stats.get("skipped_answer_no_match", 0)
        )
        if skipped and not args.keep_incomplete:
            print("\nOmitidas:")
            for k in (
                "skipped_no_question",
                "skipped_no_options",
                "skipped_incomplete_options",
                "skipped_no_answer",
                "skipped_answer_no_match",
            ):
                if stats.get(k, 0):
                    print(f"  - {k}: {stats[k]}")

    else:
        # TXT ya compatible con txt_a_json.py
        txt_content = raw
        print("=" * 70)
        print("🧩 Entrada detectada: TXT (formato simulador)")
        print("=" * 70)

    # Guardar TXT si lo piden
    if args.txt is not None:
        out_txt = Path(args.txt)
        out_txt.write_text(txt_content, encoding="utf-8", newline="\n")
        print(f"✅ TXT generado: {out_txt}")

    # Generar JSON si lo piden
    if args.json is not None:
        from txt_a_json import parsear_preguntas_txt

        preguntas = parsear_preguntas_txt(txt_content)
        if not preguntas:
            print("❌ No se encontraron preguntas válidas para generar JSON")
            return 1

        out_json = Path(args.json)

        if args.merge and out_json.exists():
            try:
                existing = json.loads(out_json.read_text(encoding="utf-8"))
                if not isinstance(existing, list):
                    existing = []
            except Exception:
                existing = []

            merged, stats = _merge_questions(existing, preguntas)
            _write_json_questions(out_json, merged)
            size_kb = os.path.getsize(out_json) / 1024
            print(
                f"✅ JSON actualizado: {out_json} ({size_kb:.2f} KB, total {len(merged)} | +{stats['added']} nuevas, {stats['skipped']} duplicadas)"
            )
        else:
            _write_json_questions(out_json, preguntas)
            size_kb = os.path.getsize(out_json) / 1024
            print(f"✅ JSON generado: {out_json} ({size_kb:.2f} KB, {len(preguntas)} preguntas)")

    if args.txt is None and args.json is None:
        print("⚠️  No se generó nada: añade --txt y/o --json")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
