"""Collects the district iRAD reports that Delhi's district administrations post (Central, East, New Delhi, North, North East, North West,
South, South East, South West, West), stages them with checksums and extracts two kinds of table for REVIEW. It never touches the dashboard data.

  python scripts/collect_irad_monthly.py                       # discover, download new PDFs to the cache, extract
  python scripts/collect_irad_monthly.py --offline             # use only PDFs already in the cache
  python scripts/collect_irad_monthly.py --extra "C:/path/iRAD Report1(...).pdf" --extra-district "Central"

Needs pdfplumber (pip install pdfplumber). PDFs go to $IRAD_CACHE (default <repo>/scratch/irad_monthly_pdfs, not committed). Output, all under
data/derived/irad_monthly/:
  irad_monthly_by_district.csv   "Accidents Classified According to Month-wise": one row per district and month
  irad_station_by_period.csv     "Accidents Classified by Stations": one row per police station and reporting period (often one month)
  manifest.json                  every PDF: source URL, page, link text, SHA-256, report district and period, generation date, kind
  issues.json                    rows that fail an arithmetic check, duplicate rows that disagree, and files listed under the wrong district

Both tables are read cell by cell (blank cells stay blank), then every row must satisfy the report's own arithmetic:
  fatal + non-fatal = total accidents;  grievous + minor (hospitalised) + minor (non-hospitalised) + no injury = non-fatal;
  killed + injured (grievous, minor, no injury) = persons total.
Rows that fail stay in the CSV with the failure in the `check` column.

Notes
- The district is taken from each report's own header, not from the website that links it: some district pages link another district's reports.
- iRAD counts come from records with "minimal critical information"; later report tables and the Delhi Traffic Police Road Crash Report can differ.
- When two files cover the same district and period, the one generated later is kept and any difference is recorded in issues.json.
- Source: district administration websites of the Government of NCT of Delhi (iRAD/eDAR pages). Not an official statistic.
"""
import argparse
import csv
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

import pdfplumber

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'derived', 'irad_monthly')
CACHE = os.environ.get('IRAD_CACHE', os.path.join(ROOT, 'scratch', 'irad_monthly_pdfs'))
UA = {'User-Agent': 'Mozilla/5.0 (DelhiCrimeDashboard research; github.com/ayushthaosen-gif/DelhiCrimeDashboard)'}
MAX_BYTES = 1_500_000  # skips the ~3 MB iRAD overview slide decks

PAGES = {
    'Central': 'https://dccentral.delhi.gov.in/en/dccentral/iradedar-central-delhi',
    'East': 'https://dmeast.delhi.gov.in/departments/irad-edar-east-delhi/',
    'New Delhi': 'https://dmnewdelhi.delhi.gov.in/integrated-road-accident-cases-month-wise/',
    'North': 'https://dmnorth.delhi.gov.in/irad-edar-north-delhi/',
    'North East': 'https://dmnortheast.delhi.gov.in/irad-edar-north-east-delhi/',
    'North West': 'https://dmnorthwest.delhi.gov.in/irad-edar-north-west-delhi/',
    'South': 'https://dmsouth.delhi.gov.in/irad-edar-south-delhi/',
    'South East': 'https://dmsoutheast.delhi.gov.in/irad-edar-south-east/',
    'South West': 'https://dmsouthwest.delhi.gov.in/irad-edar-south-west-delhi/',
    'West': 'https://dmwest.delhi.gov.in/integrated-road-accident-cases-month-wise/',
}
SKIP_TEXT = re.compile(r'overview|minutes|guideline|handbook|mobile app|downloads? forms', re.I)
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
MONTH_COLS = ['fatal', 'grievous', 'minor_hospitalised', 'minor_non_hospitalised', 'no_injury', 'total_non_fatal', 'total_accidents',
              'killed', 'persons_grievous', 'persons_minor', 'persons_no_injury', 'persons_total', 'animals_killed', 'animals_injured']
STATION_COLS = ['fatal', 'grievous', 'minor_hospitalised', 'minor_non_hospitalised', 'no_injury', 'total_non_fatal', 'total_accidents',
                'fir_filed', 'proceeded_mact', 'pending', 'completed', 'killed', 'persons_grievous', 'persons_minor', 'persons_no_injury',
                'persons_total', 'vehicle_count', 'animals_killed', 'animals_injured']


def http(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else data.decode('utf-8', 'replace')


def links(html, base):
    out = []
    for m in re.finditer(r'<a\b[^>]*href="([^"]*)"[^>]*>(.*?)</a>', html, re.I | re.S):
        text = re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', ' ', m.group(2))).strip()
        out.append((urllib.parse.urljoin(base, m.group(1).replace('&amp;', '&')), text))
    return out


def discover(page):
    html = http(page)
    found = []
    for url, text in links(html, page):
        if SKIP_TEXT.search(text) or 'i4c_handbook' in url or 'Minutes' in url:
            continue
        if url.lower().split('?')[0].endswith('.pdf'):
            found.append((url, text))
        elif urllib.parse.urlparse(url).netloc.endswith('delhi.gov.in') and '/document/' in url and (
                text.lower() in ('link', 'click to view/download', '') or 'sub-division' in (url + ' ' + text).lower()):
            try:                                   # some districts (West) link to a small page that holds the PDF
                for u2, t2 in links(http(url), url):
                    if u2.lower().split('?')[0].endswith('.pdf') and not SKIP_TEXT.search(t2):
                        found.append((u2, (t2 if t2 and t2.lower() not in ('download', 'link') else '') or (text if text.lower() != 'link' else url.rstrip('/').split('/')[-1])))
            except Exception as e:
                print('  could not read', url, e, file=sys.stderr)
    seen, uniq = set(), []
    for u, t in found:
        if u not in seen:
            seen.add(u); uniq.append((u, t))
    return uniq


DISTRICTS = {'CENTRAL': 'Central', 'EAST': 'East', 'NEWDELHI': 'New Delhi', 'NORTH': 'North', 'NORTHEAST': 'North East', 'NORTHWEST': 'North West',
             'SOUTH': 'South', 'SOUTHEAST': 'South East', 'SOUTHWEST': 'South West', 'WEST': 'West', 'SHAHDARA': 'Shahdara'}


def district_name(raw):
    """'SOUTH EAST DISTRICT' / 'CENTRAL DELHI' / 'CENTRALDELHI' -> 'South East' / 'Central' (spaces are unreliable in some PDFs)."""
    if not raw:
        return None
    s = re.sub(r'\s+', '', raw.upper())
    s = re.sub(r'DISTRICT$', '', s)
    if s != 'NEWDELHI':
        s = re.sub(r'DELHI$', '', s)
    return DISTRICTS.get(s)


def to_iso(s):
    return datetime.strptime(s, '%d-%b-%Y').date().isoformat() if s else None


def header(text):
    compact = re.sub(r'\s+', '', text)               # some PDFs extract with no spaces between words, others with extra ones
    head = compact[:2500]
    d = re.search(r'District:([A-Za-z]+?)/', head)
    per = re.search(r'From(\d\d-[A-Za-z]{3}-\d{4})to(\d\d-[A-Za-z]{3}-\d{4})', head)
    gen = re.search(r'DateofGeneration(\d\d-[A-Za-z]{3}-\d{4})(\d\d:\d\d:\d\d)', compact)
    kind = 'month_wise' if re.search(r'AccidentsClassifiedAccordingtoMonth-wise', head, re.I) else \
        'by_station' if re.search(r'ClassifiedbyStations', head, re.I) else 'other'
    pend = re.search(r'Outof(\d+)\(TotalAccidents\),(\d+)isLocalBodyPending', compact)
    return {'district': district_name(d.group(1)) if d else None, 'from': to_iso(per.group(1)) if per else None, 'to': to_iso(per.group(2)) if per else None,
            'generated': datetime.strptime(gen.group(1) + ' ' + gen.group(2), '%d-%b-%Y %H:%M:%S').isoformat() if gen else None, 'kind': kind,
            'local_body_pending': int(pend.group(2)) if pend else None}


def num(c):
    c = (c or '').strip()
    m = re.match(r'^(\d+)', c)                      # "3(100)" -> 3
    return int(m.group(1)) if m else None


def arithmetic(v, persons=True):
    """The report's own identities. Blank cells count as 0."""
    g = lambda k: v.get(k) or 0
    problems = []
    if g('fatal') + g('total_non_fatal') != g('total_accidents'):
        problems.append('fatal + non-fatal != total accidents')
    if g('grievous') + g('minor_hospitalised') + g('minor_non_hospitalised') + g('no_injury') != g('total_non_fatal'):
        problems.append('injury classes != total non-fatal')
    if persons and g('killed') + g('persons_grievous') + g('persons_minor') + g('persons_no_injury') != g('persons_total'):
        problems.append('person classes != persons total')
    return problems


def read_pdf(path):
    """-> header dict, month rows, station rows."""
    with pdfplumber.open(path) as doc:
        first = doc.pages[0]
        h = header((first.extract_text() or '') + '\n' + '\n'.join((p.extract_text() or '')[-300:] for p in doc.pages))
        months, stations = {}, []
        if h['kind'] == 'month_wise':
            tables = first.extract_tables()
            for row in (tables[0] if tables else []):
                if row and row[0] in MONTHS + ['TOTAL'] and len(row) >= 15 and row[0] not in months:
                    months[row[0]] = {c: num(row[i + 1]) for i, c in enumerate(MONTH_COLS)}
        elif h['kind'] == 'by_station':
            for page in doc.pages:
                for table in page.extract_tables():
                    for row in table:
                        if len(row) >= 22 and str(row[0] or '').strip().isdigit():
                            name = ' '.join(str(row[2] or '').split())
                            stations.append({'s_no': int(row[0]), 'code': (row[1] or '').strip(), 'police_station': name,
                                             **{c: num(row[i + 3]) for i, c in enumerate(STATION_COLS)}})
    return h, months, stations


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--offline', action='store_true')
    ap.add_argument('--extra', action='append', default=[], help='an extra (user-supplied) iRAD PDF')
    ap.add_argument('--extra-district', action='append', default=[])
    args = ap.parse_args()
    os.makedirs(CACHE, exist_ok=True); os.makedirs(OUT, exist_ok=True)

    entries = []   # (site district, page, url, link text, local path)
    if not args.offline:
        for district, page in PAGES.items():
            try:
                found = discover(page)
            except Exception as e:
                print('page failed', district, e, file=sys.stderr); continue
            print(district, len(found), 'pdf links', file=sys.stderr)
            for url, text in found:
                fn = re.sub(r'[^A-Za-z0-9._-]+', '_', district) + '__' + urllib.parse.unquote(url.split('/')[-1].split('?')[0])
                local = os.path.join(CACHE, fn)
                try:
                    if not os.path.exists(local):
                        req = urllib.request.Request(url, method='HEAD', headers=UA)
                        with urllib.request.urlopen(req, timeout=60) as r:
                            size = int(r.headers.get('Content-Length') or 0)
                        if size > MAX_BYTES:
                            print('  skipped (large):', url, size, file=sys.stderr); continue
                        open(local, 'wb').write(http(url, binary=True))
                except Exception as e:
                    print('  download failed', url, e, file=sys.stderr); continue
                entries.append((district, page, url, text, local))
    else:
        for fn in sorted(os.listdir(CACHE)):
            entries.append((fn.split('__')[0].replace('_', ' '), '', '(cache) ' + fn, '', os.path.join(CACHE, fn)))
    for path, dist in zip(args.extra, args.extra_district + [None] * len(args.extra)):
        entries.append((dist, '(supplied by the project owner)', '(local file) ' + os.path.basename(path), '', path))

    manifest, issues = [], {'arithmetic': [], 'conflicts': [], 'listed_under_wrong_district': []}
    by_sha = {}
    month_best, station_best = {}, {}
    for site, page, url, text, local in entries:
        if not local.lower().endswith('.pdf'):
            continue
        raw = open(local, 'rb').read()
        sha = hashlib.sha256(raw).hexdigest()
        try:
            h, months, stations = read_pdf(local)
        except Exception as e:
            print('  unreadable', local, e, file=sys.stderr); continue
        rec = {'listed_on_site': site, 'source_url': url, 'source_page': page, 'link_text': text, 'file': os.path.basename(local), 'bytes': len(raw), 'sha256': sha,
               'report_district': h['district'], 'period_from': h['from'], 'period_to': h['to'], 'generated': h['generated'], 'kind': h['kind'],
               'rows': len(stations) if h['kind'] == 'by_station' else sum(1 for m in months.values() if m['total_accidents'])}
        site = district_name(site) or site
        if site and h['district'] and site != h['district']:
            rec['listed_under_wrong_district'] = True
            issues['listed_under_wrong_district'].append({'file': rec['file'], 'listed_on': site, 'report_says': h['district'], 'period': [h['from'], h['to']]})
        if sha in by_sha:
            rec['duplicate_of'] = by_sha[sha]; manifest.append(rec); continue          # identical file listed on two pages
        by_sha[sha] = rec['file']
        manifest.append(rec)
        for mi, m in enumerate(MONTHS):
            v = months.get(m)
            if not v or not (v.get('total_accidents') or 0) or not h['from']:
                continue
            problems = arithmetic(v)
            row = {'district': h['district'] or site, 'year': int(h['from'][:4]), 'month': mi + 1, 'month_name': m, **{c: v.get(c) or 0 for c in MONTH_COLS},
                   'local_body_pending': h['local_body_pending'] if h['from'][:7] == h['to'][:7] else None, 'report_period_from': h['from'], 'report_period_to': h['to'],
                   'generated': h['generated'], 'extraction_method': 'pdf_table', 'source_file': rec['file'], 'sha256': sha, 'check': '; '.join(problems) or 'ok'}
            if problems:
                issues['arithmetic'].append({k: row[k] for k in ('district', 'year', 'month_name', 'source_file', 'check')})
            key = (row['district'], row['year'], row['month'])
            old = month_best.get(key)
            if old:
                if any(old[c] != row[c] for c in ('total_accidents', 'fatal', 'killed')):
                    issues['conflicts'].append({'table': 'month', 'district': row['district'], 'period': '%d-%02d' % (row['year'], row['month']),
                                                'values': [{'file': x['source_file'], 'generated': x['generated'], 'accidents': x['total_accidents'], 'fatal': x['fatal'], 'killed': x['killed']} for x in (old, row)]})
                if (row['generated'] or '') <= (old['generated'] or ''):
                    continue
            month_best[key] = row
        for st in stations:
            problems = arithmetic(st)
            row = {'district': h['district'] or site, 'period_from': h['from'], 'period_to': h['to'], 'generated': h['generated'], **st,
                   'source_file': rec['file'], 'sha256': sha, 'check': '; '.join(problems) or 'ok'}
            if problems:
                issues['arithmetic'].append({'district': row['district'], 'period': row['period_from'], 'station': st['police_station'], 'source_file': rec['file'], 'check': row['check']})
            key = (row['district'], row['period_from'], row['period_to'], st['code'], st['police_station'])
            old = station_best.get(key)
            if old:
                if any(old[c] != row[c] for c in ('total_accidents', 'fatal', 'killed')):
                    issues['conflicts'].append({'table': 'station', 'district': row['district'], 'station': st['police_station'], 'period': [row['period_from'], row['period_to']],
                                                'values': [{'file': x['source_file'], 'generated': x['generated'], 'accidents': x['total_accidents'], 'fatal': x['fatal'], 'killed': x['killed']} for x in (old, row)]})
                if (row['generated'] or '') <= (old['generated'] or ''):
                    continue
            station_best[key] = row

    # Scanned (image-only) PDFs: values transcribed from the page images, used only when the staged file still has the same checksum and only where
    # no text-layer row exists for that district and month. Each transcription already passed the arithmetic and printed-total checks.
    tpath = os.path.join(OUT, 'transcribed_image_tables.json')
    if os.path.exists(tpath):
        tr = json.load(open(tpath, encoding='utf-8'))
        staged = {f['sha256']: f for f in manifest}
        for t in tr['files']:
            if t['sha256'] not in staged:
                issues['conflicts'].append({'table': 'transcription', 'file': t['file'], 'problem': 'staged PDF is missing or changed (checksum differs), so its transcription was not used'})
                continue
            for mi, m in enumerate(MONTHS):
                v = t['months'][m]
                key = (tr['district'], t['year'], mi + 1)
                if key in month_best:
                    continue
                problems = arithmetic(v)
                month_best[key] = {'district': tr['district'], 'year': t['year'], 'month': mi + 1, 'month_name': m, **{c: v.get(c) or 0 for c in MONTH_COLS},
                                   'local_body_pending': None, 'report_period_from': t['period_from'], 'report_period_to': t['period_to'], 'generated': None,
                                   'extraction_method': 'image_transcription', 'source_file': t['file'], 'sha256': t['sha256'], 'check': '; '.join(problems) or 'ok'}

    mrows = sorted(month_best.values(), key=lambda r: (r['district'], r['year'], r['month']))
    srows = sorted(station_best.values(), key=lambda r: (r['district'], r['period_from'] or '', r['period_to'] or '', r['code']))
    mfields = ['district', 'year', 'month', 'month_name'] + MONTH_COLS + ['local_body_pending', 'report_period_from', 'report_period_to', 'generated', 'extraction_method', 'source_file', 'sha256', 'check']
    sfields = ['district', 'period_from', 'period_to', 'generated', 's_no', 'code', 'police_station'] + STATION_COLS + ['source_file', 'sha256', 'check']
    for name, fields, rows in (('irad_monthly_by_district.csv', mfields, mrows), ('irad_station_by_period.csv', sfields, srows)):
        with open(os.path.join(OUT, name), 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=fields); w.writeheader(); w.writerows(rows)
    json.dump({'generated': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'note': 'Review data staged from district iRAD reports; not integrated into the dashboard.',
               'files': sorted(manifest, key=lambda r: (r['report_district'] or '', r['period_from'] or '', r['file']))}, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    json.dump(issues, open(os.path.join(OUT, 'issues.json'), 'w'), indent=1)

    print('pdfs', len(manifest), '| month rows', len(mrows), '| station rows', len(srows), '| arithmetic issues', len(issues['arithmetic']),
          '| conflicts', len(issues['conflicts']), '| listed under wrong district', len(issues['listed_under_wrong_district']))
    cov = defaultdict(set)
    for r in mrows:
        cov[('month-wise', r['district'])].add('%d-%02d' % (r['year'], r['month']))
    per = defaultdict(set)
    for r in srows:
        per[r['district']].add((r['period_from'], r['period_to']))
    for (kind, d), s in sorted(cov.items()):
        print('  month-wise %-12s %3d months  %s .. %s' % (d, len(s), min(s), max(s)))
    for d, s in sorted(per.items()):
        starts, ends = [x[0] for x in s if x[0]], [x[1] for x in s if x[1]]
        print('  by-station %-12s %3d periods %s .. %s' % (d, len(s), min(starts) if starts else '?', max(ends) if ends else '?'))


if __name__ == '__main__':
    main()
