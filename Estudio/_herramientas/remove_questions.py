#!/usr/bin/env python3
import json
import sys
import shutil
from datetime import datetime

# List of question codes to remove (match if present in 'cuestion' text)
CODES = [
    # Bloque T2/T4
    "API-T2-143-Pregunta","API-T2-146-Pregunta","API-T2-145-Pregunta","API-T2-140-Pregunta","API-T2-132-Pregunta","API-T2-134-Pregunta",
    "API-T4-23-Pregunta","API-T4-31-Pregunta","API-T4-33-Pregunta","API-T4-28-Pregunta","API-T4-30-Pregunta","API-T4-26-Pregunta",
    # Bloque T7 (ley y normativa)
    "API-T7-282-Pregunta","API-T7-271-Pregunta","API-T7-264-Pregunta","API-T7-294-Pregunta","API-T7-290-Pregunta","API-T7-270-Pregunta",
    "API-T7-281-Pregunta","API-T7-260-Pregunta","API-T7-276-Pregunta","API-T7-295-Pregunta","API-T7-287-Pregunta","API-T7-315-Pregunta",
    "API-T7-265-Pregunta","API-T7-298-Pregunta","API-T7-284-Pregunta","API-T7-292-Pregunta","API-T7-304-Pregunta","API-T7-266-Pregunta",
    "API-T7-278-Pregunta","API-T7-291-Pregunta","API-T7-305-Pregunta","API-T7-296-Pregunta","API-T7-318-Pregunta","API-T7-301-Pregunta",
    "API-T7-275-Pregunta","API-T7-310-Pregunta","API-T7-263-Pregunta","API-T7-157-Pregunta","API-T7-269-Pregunta","API-T7-268-Pregunta",
    "API-T7-283-Pregunta","API-T7-306-Pregunta","API-T7-261-Pregunta","API-T7-303-Pregunta","API-T7-285-Pregunta","API-T7-312-Pregunta",
    "API-T7-293-Pregunta","API-T7-309-Pregunta","API-T7-262-Pregunta","API-T7-297-Pregunta","API-T7-279-Pregunta","API-T7-273-Pregunta",
    "API-T7-280-Pregunta","API-T7-289-Pregunta","API-T7-254-Pregunta","API-T7-286-Pregunta","API-T7-313-Pregunta","API-T7-179-Pregunta",
    "API-T7-274-Pregunta","API-T7-277-Pregunta","API-T7-308-Pregunta","API-T7-299-Pregunta","API-T7-158-Pregunta","API-T7-267-Pregunta",
    "API-T7-272-Pregunta","API-T7-288-Pregunta","API-T7-307-Pregunta","API-T7-311-Pregunta","API-T7-317-Pregunta","API-T7-316-Pregunta",
    "API-T7-314-Pregunta","API-T7-302-Pregunta","API-T7-300-Pregunta",
]


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    path = 'C:\\Users\\Lenovo\\OneDrive - Universidad de Castilla-La Mancha\\UNIVERSIDAD\\codes\\Simulador-Examenes-FlashCards\\Estudio\\simulador-API\\preguntas.json'
    if len(sys.argv) > 1:
        path = sys.argv[1]

    # backup
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup = path + f'.bak_{ts}'
    shutil.copy2(path, backup)
    print(f'Backup creado: {backup}')

    data = load_json(path)
    if not isinstance(data, list):
        print('Formato inesperado: se esperaba una lista en la raíz del JSON.')
        return

    removed = []
    kept = []
    codes_found = set()

    for item in data:
        text = ''
        if isinstance(item, dict):
            # find probable field
            for k in ['cuestion','pregunta','question','enunciado','texto','titulo']:
                if k in item and isinstance(item[k], str):
                    text = item[k]
                    break
            if not text:
                # find first string field
                for v in item.values():
                    if isinstance(v, str):
                        text = v
                        break
        # decide removal
        matched = False
        for code in CODES:
            if code in text:
                matched = True
                codes_found.add(code)
                break
        if matched:
            removed.append(item)
        else:
            kept.append(item)

    print(f'Encontradas para eliminar: {len(removed)}')
    missing = [c for c in CODES if c not in codes_found]
    if missing:
        print('Algunos códigos NO fueron encontrados en el archivo:', len(missing))

    # save new file
    save_json(path, kept)

    # save report
    report_path = path.replace('.json', '') + '_removal_report.md'
    with open(report_path, 'w', encoding='utf-8') as r:
        r.write('# Informe de eliminación de preguntas\n\n')
        r.write(f'Backup: {backup}\n\n')
        r.write(f'Total originales: {len(data)}\n')
        r.write(f'Eliminadas: {len(removed)}\n')
        r.write(f'Restantes: {len(kept)}\n\n')
        r.write('## Códigos solicitados para eliminar (resumido)\n')
        for c in CODES:
            status = 'ENCONTRADO' if c in codes_found else 'NO ENCONTRADO'
            r.write(f'- {c}: {status}\n')
        r.write('\n## Preguntas eliminadas (muestra)\n')
        for i, it in enumerate(removed[:50]):
            r.write(f'- Índice original desconocido: ')
            # write question text
            qt = ''
            if isinstance(it, dict):
                for k in ['cuestion','pregunta','question','enunciado','texto','titulo']:
                    if k in it and isinstance(it[k], str):
                        qt = it[k]
                        break
                if not qt:
                    for v in it.values():
                        if isinstance(v, str):
                            qt = v
                            break
            r.write(qt + '\n')

    print('Reporte guardado en', report_path)

if __name__ == '__main__':
    main()
