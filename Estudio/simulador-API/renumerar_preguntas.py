import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

# Renumera preguntas por tema y reordena el JSON.
# python Estudio/simulador-API/renumerar_preguntas.py --input Estudio/simulador-API/preguntas.json --output Estudio/simulador-API/preguntas-renumerado.json

def format_index(value: int) -> str:
    return f"{value:02d}" if value < 100 else str(value)


def build_group_map(items):
    group_map = {}
    counter = 0
    for item in items:
        group_key = item.get("grupoDependencia")
        if not group_key or group_key in group_map:
            continue
        counter += 1
        parts = group_key.split("-")
        if len(parts) >= 2 and parts[0] == "API":
            parts[1] = f"EDep{format_index(counter)}"
            group_map[group_key] = "-".join(parts)
        else:
            group_map[group_key] = f"API-EDep{format_index(counter)}-{group_key}"
    return group_map


def extract_tema(question: str):
    match = re.match(r"^API-(T\d+)", question)
    return match.group(1) if match else None


def renumber(items, group_map, theme_order):
    indexed = []
    for idx, item in enumerate(items):
        question = item.get("cuestion", "")
        tema = extract_tema(question)
        order_key = (theme_order.get(tema, 999), idx)
        indexed.append((order_key, item, tema))

    indexed.sort(key=lambda entry: entry[0])

    counters = defaultdict(int)
    for _, item, tema in indexed:
        question = item.get("cuestion", "")
        if tema and "-Pregunta:" in question and question.startswith("API-"):
            counters[tema] += 1
            number = format_index(counters[tema])
            _, rest = question.split("-Pregunta:", 1)
            item["cuestion"] = f"API-{tema}-{number}-Pregunta:{rest}"

        if "grupoDependencia" in item:
            original_group = item["grupoDependencia"]
            if original_group in group_map:
                item["grupoDependencia"] = group_map[original_group]

    return [item for _, item, _ in indexed]


def main():
    parser = argparse.ArgumentParser(description="Renumera preguntas por tema y reordena el JSON.")
    parser.add_argument(
        "--input",
        default="preguntas.json",
        help="Ruta del JSON de entrada.",
    )
    parser.add_argument(
        "--output",
        default="preguntas-renumerado.json",
        help="Ruta del JSON de salida.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    items = json.loads(input_path.read_text(encoding="utf-8"))

    group_map = build_group_map(items)
    theme_order = {"T1": 0, "T2": 1, "T3": 2, "T4": 3}
    new_items = renumber(items, group_map, theme_order)

    output_path.write_text(
        json.dumps(new_items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
