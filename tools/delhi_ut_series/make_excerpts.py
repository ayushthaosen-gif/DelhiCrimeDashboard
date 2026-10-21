"""One-off: cut the pages that hold the Delhi UT rows out of the NCRB Crime in India Volume 1 PDFs.

The PDFs (7-32 MB each) are not committed. This script, given a folder that holds them, writes the table pages as text
into data/raw/ncrb_wayback/excerpts/ and records the PDF's SHA-256, Internet Archive capture and the page numbers in
data/raw/ncrb_wayback/excerpt_sources.json. extract_state_tables.py then works offline from those excerpts.

    python -I tools/delhi_ut_series/make_excerpts.py PDF_FOLDER

Needs pdftotext (poppler) on the PATH. Each edition's capture details come from PDF_FOLDER/_fetch_log.tsv
(url, capture timestamp, bytes, sha256) written by the fetch step.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/raw/ncrb_wayback'

EDITIONS = {
    'cii2017': {'file': '1653885627_Crime in India 2017 - Volume 1_0_0.pdf', 'years': '2015-2017', 'label': 'Crime in India 2017, Volume 1'},
    'cii2019': {'file': '1653730573_CII 2019 Volume 1.pdf', 'years': '2017-2019', 'label': 'Crime in India 2019, Volume 1'},
    'cii2020': {'file': 'CII 2020 Volume 1.pdf', 'years': '2018-2020', 'label': 'Crime in India 2020, Volume 1'},
}
# table key -> heading pattern (the table title as printed, with the years of the edition)
TABLES = {
    'ipc': r'IPC Crimes \(State/UT-wise\) - {years}',
    'sll': r'SLL Crimes \(State/UT-wise\) - {years}',
    'ipc_sll': r'Total IPC & SLL Crimes\s+\(State/UT-wise\) - {years}',
    'women': r'Crime against Women \(IPC ?\+ ?SLL\) - {years}',
}


def main(folder: Path):
    log = {}
    for line in (folder / '_fetch_log.tsv').read_text(encoding='utf-8').splitlines():
        parts = line.split('\t')
        if len(parts) >= 4:
            log[Path(parts[0].replace('%20', ' ')).name] = parts
    sources = {}
    (OUT / 'excerpts').mkdir(parents=True, exist_ok=True)
    for key, edition in EDITIONS.items():
        pdf = folder / edition['file']
        data = pdf.read_bytes()
        record = log.get(edition['file'])
        if record is None:
            raise SystemExit('no fetch-log entry for ' + edition['file'])
        digest = hashlib.sha256(data).hexdigest()
        assert digest == record[3], 'PDF differs from its fetch log'
        text = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], check=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout.decode('utf-8', errors='replace')
        pages = text.split('\f')
        found = {}
        for table, pattern in TABLES.items():
            heading = re.compile(pattern.format(years=edition['years']))
            for index, page in enumerate(pages):
                if heading.search(page) and re.search(r'^\s*\d+\s+Delhi', page, re.M) and not re.search(r'^\s*Contents', page, re.M):
                    (OUT / 'excerpts' / f'{key}_{table}_page{index + 1}.txt').write_text(page.replace('\r\n', '\n').rstrip() + '\n', encoding='utf-8', newline='\n')
                    found[table] = index + 1
                    break
            else:
                if table != 'ipc_sll':  # the combined IPC+SLL table exists only in the later editions
                    raise SystemExit(f'{key}: table {table} not found')
        sources[key] = {'label': edition['label'], 'years': edition['years'], 'pdfPages': len(pages), 'tablePages': found,
                        'originalUrl': record[0], 'captureTimestamp': record[1], 'bytes': len(data), 'sha256': digest,
                        'archiveUrl': 'https://web.archive.org/web/%sid_/%s' % (record[1], record[0].replace(' ', '%20'))}
    (OUT / 'excerpt_sources.json').write_text(json.dumps(sources, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({k: v['tablePages'] for k, v in sources.items()}))


if __name__ == '__main__':
    main(Path(sys.argv[1]))
