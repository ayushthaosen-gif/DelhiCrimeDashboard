"""Delhi UT totals from NCRB's State/UT-wise tables, 2015-2021, read offline and cross-checked across editions.

Inputs (all committed, no network):
  data/raw/ncrb_wayback/excerpts/*.txt          the table pages cut from the Crime in India 2017, 2019 and 2020 Volume 1 PDFs
  data/raw/ncrb_wayback/excerpt_sources.json    PDF hashes, Internet Archive captures and page numbers for those excerpts
  data/raw/ncrb_wayback/cii2021_state_tables/   Tables 1A.1, 1A.2, 1A.3, 3A.1 of Crime in India 2021 (xlsx)

For each measure and year the Delhi row is read from every edition that prints it. Overlapping editions must agree exactly;
a disagreement stops the run. IPC + SLL must equal the printed combined total wherever all three are printed.

    python -I tools/delhi_ut_series/extract_state_tables.py          # write data/staged/delhi_ut_series/state_tables_2015_2021.json
    python -I tools/delhi_ut_series/extract_state_tables.py --check  # fail if the file on disk is stale
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from xlsx_min import read_xlsx  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw/ncrb_wayback'
OUT = ROOT / 'data/staged/delhi_ut_series/state_tables_2015_2021.json'

MEASURES = {'ipc': 'IPC crimes', 'sll': 'SLL crimes', 'ipc_sll': 'IPC and SLL crimes together', 'women': 'Crimes against women (IPC + SLL)'}
EDITION_YEARS = {'cii2017': [2015, 2016, 2017], 'cii2019': [2017, 2018, 2019], 'cii2020': [2018, 2019, 2020]}
XLSX = {'ipc': 'TABLE_1A.1.xlsx', 'sll': 'TABLE_1A.2.xlsx', 'ipc_sll': 'TABLE_1A.3.xlsx', 'women': 'TABLE_3A.1.xlsx'}


def whole_numbers(text):
    """Integers printed with no decimal point. Rates and shares (with a decimal point) are skipped."""
    return [int(t.replace(',', '')) for t in re.findall(r'(?<![\d.])\d[\d,]*(?![\d.,]*\.\d)(?!\d)', text)]


def delhi_row(page):
    for line in page.splitlines():
        m = re.match(r'^\s*\d+\s+Delhi(?:\s+UT)?\b(.*)$', line)
        if m:
            return line.strip(), m.group(1)
    raise ValueError('no Delhi row on the page')


def from_excerpts(sources):
    found = []
    for edition, years in EDITION_YEARS.items():
        info = sources[edition]
        for measure, page_number in info['tablePages'].items():
            page = (RAW / 'excerpts' / f'{edition}_{measure}_page{page_number}.txt').read_text(encoding='utf-8')
            line, rest = delhi_row(page)
            # the first three whole numbers on the row are the three years; fewer means the printed cell is missing from the text layer
            values = whole_numbers(rest)[:3]
            found.append({'measure': measure, 'edition': edition, 'label': info['label'], 'page': page_number, 'years': years, 'values': values, 'row': ' '.join(line.split()), 'complete': len(values) == len(years)})
    return found


def from_xlsx():
    found = []
    for measure, filename in XLSX.items():
        rows = read_xlsx(RAW / 'cii2021_state_tables' / filename)[0][1]
        header = next(v for n, v in rows if v.get('B') == 'State/UT')
        years = [int(header[c]) for c in 'CDE']
        delhi = next(v for n, v in rows if str(v.get('B', '')).strip() == 'Delhi')
        values = [int(float(delhi[c])) for c in 'CDE']
        found.append({'measure': measure, 'edition': 'cii2021', 'label': 'Crime in India 2021, Table ' + {'ipc': '1A.1', 'sll': '1A.2', 'ipc_sll': '1A.3', 'women': '3A.1'}[measure], 'page': None, 'years': years, 'values': values, 'row': 'Delhi ' + ' '.join(str(v) for v in values), 'complete': True})
    return found


def build():
    sources = json.loads((RAW / 'excerpt_sources.json').read_text(encoding='utf-8'))
    observations = from_excerpts(sources) + from_xlsx()
    table = {}
    for o in observations:
        for year, value in zip(o['years'], o['values']):
            table.setdefault(o['measure'], {}).setdefault(year, []).append({'edition': o['edition'], 'value': value})
    consolidated, disagreements = {}, []
    for measure, by_year in table.items():
        for year, items in sorted(by_year.items()):
            values = {i['value'] for i in items}
            if len(values) > 1:
                disagreements.append({'measure': measure, 'year': year, 'values': items})
            consolidated.setdefault(year, {})[measure] = {'value': items[0]['value'], 'editions': [i['edition'] for i in items], 'agree': len(values) == 1}
    if disagreements:
        raise SystemExit('editions disagree: ' + json.dumps(disagreements))
    # 2020 IPC is missing from the 2020 edition's text layer; the 2021 edition prints it. IPC + SLL must equal the combined total.
    sums = {}
    for year, m in sorted(consolidated.items()):
        if all(k in m for k in ('ipc', 'sll', 'ipc_sll')):
            ok = m['ipc']['value'] + m['sll']['value'] == m['ipc_sll']['value']
            sums[year] = {'ipc': m['ipc']['value'], 'sll': m['sll']['value'], 'printedCombined': m['ipc_sll']['value'], 'ipcPlusSllEqualsCombined': ok}
            if not ok:
                raise SystemExit(f'{year}: IPC + SLL does not equal the printed combined total')
    return {
        'schemaVersion': '1.0.0',
        'purpose': 'Delhi UT totals from NCRB Crime in India State/UT-wise tables, 2015-2021, with every edition that prints each year compared.',
        'method': 'Delhi row of Table 1A.1 (IPC), 1A.2 (SLL), 1A.3 or the combined IPC+SLL table, and the crime-against-women table, read from table-page excerpts of the 2017, 2019 and 2020 Volume 1 PDFs and from the 2021 xlsx tables. Overlapping editions must agree exactly.',
        'generatedBy': 'tools/delhi_ut_series/extract_state_tables.py',
        'measures': MEASURES,
        'observations': observations,
        'years': {str(y): consolidated[y] for y in sorted(consolidated)},
        'ipcPlusSllCheck': {str(y): v for y, v in sums.items()},
        'singleEditionYears': {measure: [y for y, items in sorted(by.items()) if len(items) == 1] for measure, by in table.items()},
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
            print('STALE:', OUT.relative_to(ROOT))
            return 1
        print('OK:', OUT.relative_to(ROOT))
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(data)
    result = json.loads(data)
    for year, m in result['years'].items():
        print(year, {k: (v['value'], len(v['editions'])) for k, v in m.items()})
    return 0


if __name__ == '__main__':
    sys.exit(main())
