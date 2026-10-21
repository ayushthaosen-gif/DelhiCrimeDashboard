"""Extract the Delhi UT totals exactly as NCRB prints them in the 2021-2024 district tables.

Every NCRB district table ends each state block with a printed "Total Districts" row. For Delhi that row covers every
reporting unit (the territorial districts and the specialised units such as Metro, Railway and Crime Branch), so it is
the printed Delhi-wide figure, not a sum we computed. For each figure the extractor also adds up the printed unit rows
and records whether the two agree; a disagreement is reported, never silently corrected.

    python tools/delhi_ut_series/extract.py          # write data/staged/delhi_ut_series/printed_totals_2021_2024.json
    python tools/delhi_ut_series/extract.py --check  # fail if the file on disk differs from a fresh extraction

Standard library only. Reads only files already archived in data/raw/source_archive/ncrb/ (2022-2024) and data/raw/ncrb_wayback/ (2021, recovered from the Internet Archive).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from xlsx_min import read_xlsx  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'data/raw/source_archive/ncrb'
OUT = ROOT / 'data/staged/delhi_ut_series/printed_totals_2021_2024.json'

A = 'data/raw/source_archive/ncrb/'
W = 'data/raw/ncrb_wayback/cii2021_district_workbooks/'
# year -> table -> file (relative to the repository), and for each measure the column letter and a pattern the printed header must match.
TABLES = {
    2021: {
        'ipc': (W + 'districtwise_ipc_crimes_2021.xlsx', {'theft': ('CM', r'Theft \(Total\)'), 'robbery': ('CT', r'Robbery'), 'burglary': ('CP', r'Burglary \(Total\)'), 'total_ipc_bns': ('EN', r'Total Cognizable IPC crimes')}),
        'sll': (W + 'districtwise_sll_crimes_2021.xlsx', {'total_sll': ('CO', r'Total Cognizable SLL Crimes')}),
        'women': (W + 'districtwise_crime_against_women_2021.xlsx', {'total_crimes_against_women': ('BB', r'Total Crime against Women \(IPC\+SLL\)')}),
    },
    2022: {
        'ipc': (A + 'districtwise_ipc_crimes_2022.xlsx', {'theft': ('CM', r'Theft \(Total\)'), 'robbery': ('CT', r'Robbery'), 'burglary': ('CP', r'Burglary \(Total\)'), 'total_ipc_bns': ('EN', r'Total Cognizable IPC crimes')}),
        'sll': (A + 'districtwise_sll_crimes_2022.xlsx', {'total_sll': ('CO', r'Total Cognizable SLL Crimes')}),
        'women': (A + 'districtwise_crime_against_women_2022.xlsx', {'total_crimes_against_women': ('BB', r'Total Crime against Women \(IPC\+SLL\)')}),
    },
    2023: {
        'ipc': (A + 'districtwise_ipc_crimes_2023.xlsx', {'theft': ('CM', r'Theft \(Total\)'), 'robbery': ('CT', r'Robbery'), 'burglary': ('CP', r'Burglary \(Total\)'), 'total_ipc_bns': ('EN', r'Total Cognizable IPC crimes')}),
        'sll': (A + 'districtwise_sll_crimes_2023.xlsx', {'total_sll': ('CO', r'Total Cognizable SLL Crimes')}),
        'women': (A + 'districtwise_crime_against_women_2023.xlsx', {'total_crimes_against_women': ('BB', r'Total Crime against Women \(IPC\+SLL\)')}),
    },
    2024: {
        'ipc': (A + 'districtwise_ipc_bns_crimes_2024.xlsx', {'theft': ('CY', r'Theft \(Total a to g\)'), 'robbery': ('DI', r'Robbery'), 'burglary': ('DR', r'Burglary \(Total a\+b\)'), 'total_ipc_bns': ('EZ', r'Total Cognizable IPC/BNS crimes')}),
        'sll': (A + 'districtwise_sll_crimes_2024.xlsx', {'total_sll': ('CQ', r'Total Cognizable SLL Crimes')}),
        'women': (A + 'districtwise_crime_against_women_2024.xlsx', {'total_crimes_against_women': ('BO', r'Total Crime against Women \(IPC/BNS \+ SLL Crimes\)')}),
    },
}
MEASURES = ['theft', 'robbery', 'burglary', 'total_ipc_bns', 'total_sll', 'total_crimes_against_women']


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def number(text):
    """A printed number as an int; anything else (blank, dash) is unknown, never zero."""
    if text is None:
        return None
    cleaned = str(text).strip().replace(',', '')
    if re.fullmatch(r'-?\d+', cleaned):
        return int(cleaned)
    if re.fullmatch(r'-?\d+\.0+', cleaned):
        return int(float(cleaned))
    return None


def header_text(rows, column, upto=8):
    parts = []
    for n, values in rows:
        if n > upto:
            break
        value = values.get(column)
        if isinstance(value, str):
            parts.append(' '.join(value.split()))
    return ' / '.join(parts)


def delhi_block(rows):
    start = next(n for n, v in rows if isinstance(v.get('A'), str) and v['A'].strip().lower() == 'state: delhi')
    units, total = [], None
    for n, v in rows:
        if n <= start:
            continue
        label = (v.get('B') or '').strip()
        if label.startswith('Total Districts'):
            total = (n, v)
            break
        if v.get('A') is not None or label:
            units.append((n, v, label))
    if total is None:
        raise ValueError('no printed "Total Districts" row after the Delhi block')
    return start, units, total


def extract_year(year):
    record = {'year': year, 'sources': [], 'unitCount': None, 'unitLabels': None, 'printedTotal': {}, 'sumOfPrintedUnits': {}, 'agreement': {}, 'printedTotalRow': {}, 'units': {}}
    unit_labels = None
    for table, (filename, columns) in TABLES[year].items():
        path = ROOT / filename
        sheet = read_xlsx(path)[0][1]
        start, units, total = delhi_block(sheet)
        labels = [u[2] for u in units]
        if unit_labels is None:
            unit_labels = labels
        elif unit_labels != labels:
            raise ValueError('%d: reporting units differ between tables: %s vs %s' % (year, unit_labels, labels))
        record['sources'].append({'table': table, 'path': filename, 'sha256': sha256(path), 'delhiBlockStartRow': start, 'printedTotalRow': total[0]})
        for measure, (column, pattern) in columns.items():
            header = header_text(sheet, column)
            if not re.search(pattern, header, re.I):
                raise ValueError('%d %s: column %s header %r does not match %r' % (year, measure, column, header, pattern))
            printed = number(total[1].get(column))
            values = [number(u[1].get(column)) for u in units]
            for label, value in zip(labels, values):
                record['units'].setdefault(label, {})[measure] = value
            record['printedTotal'][measure] = printed
            record['sumOfPrintedUnits'][measure] = None if any(v is None for v in values) else sum(values)
            record['agreement'][measure] = printed is not None and record['sumOfPrintedUnits'][measure] == printed
            record['printedTotalRow'][measure] = {'table': table, 'column': column, 'header': header, 'row': total[0]}
    record['unitCount'] = len(unit_labels)
    record['unitLabels'] = unit_labels
    return record


def build():
    years = [extract_year(y) for y in sorted(TABLES)]
    return {
        'schemaVersion': '1.0.0',
        'purpose': 'Delhi UT totals as NCRB prints them in the district-wise tables ("Total Districts" row of the Delhi block). The row covers every reporting unit, including specialised units, so it is the printed Delhi-wide figure and is higher than the sum of the 15 territorial districts.',
        'nullPolicy': 'A blank or dash in the source is null, never zero.',
        'generatedBy': 'tools/delhi_ut_series/extract.py',
        'years': years,
    }


def encode(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = encode(build())
    if args.check:
        if not OUT.exists() or OUT.read_bytes() != data:
            print('STALE: %s differs from a fresh extraction' % OUT.relative_to(ROOT))
            return 1
        print('OK: %s matches a fresh extraction' % OUT.relative_to(ROOT))
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(data)
    print('wrote', OUT.relative_to(ROOT))
    for y in json.loads(data)['years']:
        print(y['year'], y['unitCount'], 'units', {m: (y['printedTotal'][m], y['agreement'][m]) for m in y['printedTotal']})
    return 0


if __name__ == '__main__':
    sys.exit(main())
