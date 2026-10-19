"""Offline, source-faithful pre-2016 research staging. Never writes production files."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'data/staged/history_2011_2015'
METADATA_DATE = '2026-10-19'


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encoded(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def read(file: str):
    return json.loads((BASE / file).read_text(encoding='utf-8-sig'))


def pdf_text(file: Path, first: int | None = None, last: int | None = None) -> str:
    args = ['pdftotext', '-layout']
    if first is not None:
        args += ['-f', str(first), '-l', str(last or first)]
    result = subprocess.run(args + [str(file), '-'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return result.stdout.decode('utf-8')


def count(token):
    """A printed dash or blank is unknown, never inferred to mean zero."""
    if token is None or str(token).strip() in ['', '-', '..', 'NA', 'N.A.']:
        return None
    if isinstance(token, bool):
        raise ValueError('Boolean is not an incident count')
    value = float(str(token).replace(',', ''))
    if value < 0 or not value.is_integer():
        raise ValueError(f'Not a nonnegative integer count: {token}')
    return int(value)


PDF_HEADERS = [
    'Murder (Sec.302 IPC)', 'Attempt To Commit Murder (Sec.307 IPC)',
    'C.H. Not Amounting To Murder (Sec.304 & 308 IPC)',
    'Rape Total (Sec.376 IPC)', 'Rape Custodial', 'Rape Other',
    'Kidnapping & Abduction Total (Sec.363-369,371-373 IPC)',
    'Kidnapping & Abduction Of Women & Girls', 'Kidnapping & Abduction Others',
    'Dacoity (Sec.395 to 398 IPC)',
    'Preparation & Assembly for Dacoity (Sec.399-402 IPC)',
    'Robbery (Sec.392-394,397 & 398 IPC)',
    'Burglary (Sec.449-452,454,455,457-460 IPC)',
    'Theft Total (Sec.379-382 IPC)', 'Auto Theft', 'Other Theft',
    'Riots (Sec.143-145,147-151,153,153A,153B,157,158,160 IPC)',
    'Criminal Breach of Trust (Sec.406-409 IPC)', 'Cheating (Sec.419,420 IPC)',
    'Counterfeiting (Sec.231-254,489A-489D IPC)',
    'Arson (Sec.435,436,438 IPC)', 'Hurt (Sec.323-333,335-338 IPC)',
    'Dowry Death (Sec.304B IPC)', 'Assault on Women (Sec.354 IPC)',
    'Insult to Modesty of Women (Sec.509 IPC)', 'Cruelty by Husband & Relatives (Sec.498A IPC)',
    'Importation of Girls (Sec.366B IPC)', 'Causing Death by Negligence (Sec.304A IPC)',
    'Other IPC Crime', 'Total Cognizable Crime Under IPC',
]


def pdf_delhi_block(text: str):
    active = False
    rows = []
    for line in text.splitlines():
        normalized = re.sub('[^A-Z]', '', line.upper())
        if normalized == 'DELHIUT':
            active = True
            continue
        if not active or not line.strip():
            continue
        parts = line.split()
        if parts[0] == 'TOTAL':
            values = parts[1:]
            if len(values) != 10:
                raise ValueError(f'Expected ten printed Delhi totals: {line}')
            return rows, [count(v) for v in values]
        if not parts[0].isdigit():
            continue
        serial = int(parts.pop(0))
        label = []
        while parts and not re.fullmatch(r'[\d,]+|-|\.\.', parts[0]):
            label.append(parts.pop(0))
        if len(parts) != 10 or not label:
            raise ValueError(f'Cannot parse district row faithfully: {line}')
        rows.append({'source_serial': serial, 'reporting_unit_label': ' '.join(label), 'values': [count(v) for v in parts]})
    raise ValueError('Missing Delhi section or its printed TOTAL')


def ncrb_pdf(year: int):
    source = f'raw/ncrb_{year}_district_ipc.pdf'
    # The complete all-India original is archived. Only Delhi's three panels are selected.
    text = pdf_text(BASE / source, 49, 51)
    panels = [pdf_delhi_block(p) for p in text.split('\f') if re.sub('[^A-Z]', '', p.upper()).find('DELHIUT') >= 0]
    if len(panels) != 3:
        raise ValueError(f'{source}: expected three Delhi table panels')
    labels = [r['reporting_unit_label'] for r in panels[0][0]]
    if len(labels) != (18 if year == 2013 else 17) or any([r['reporting_unit_label'] for r in panel[0]] != labels for panel in panels):
        raise ValueError(f'{source}: inconsistent panel labels; do not guess a join')
    headers = list(PDF_HEADERS)
    if year == 2011:
        headers[23] = 'Molestation (Sec.354 IPC)'
        headers[24] = 'Sexual Harassment (Sec.509 IPC)'
    records = []
    for index, label in enumerate(labels):
        values = sum([panel[0][index]['values'] for panel in panels], [])
        records.append({'reference_year': year, 'reporting_unit_label': label, 'source_serial': panels[0][0][index]['source_serial'], 'values': values,
                        'source_pdf_pages': [49, 50, 51], 'source_printed_pages': [296, 297, 298],
                        'selected_metrics': {'theft': values[13], 'robbery': values[11], 'burglary_old_definition': values[12], 'total_ipc': values[29], 'total_sll': None, 'total_crimes_against_women': None}})
    totals = sum([panel[1] for panel in panels], [])
    return {'source': source, 'reference_year': year, 'table': '1.14', 'geography': 'Delhi UT police reporting units as printed, including specialised/non-territorial units',
            'geography_mapping': None, 'column_headers': headers, 'header_policy': 'Readable transcriptions of the printed multi-line headers and section numbers; original PDF remains authoritative.',
            'reporting_units': records, 'printed_summary': {'reporting_unit_label': 'TOTAL', 'values': totals},
            'missing_metrics': {'total_sll': 'Not supplied by this IPC district table.', 'total_crimes_against_women': 'Components exist, but no comparable aggregate is fabricated.'}}


def ncrb_xlsx(year: int, kind: str):
    source = f'raw/ncrb_{year}_district_{kind}.xlsx'
    workbook = load_workbook(BASE / source, read_only=True, data_only=True)
    sheet = workbook['District Data Report']
    matrix = list(sheet.values)
    headers = list(matrix[1])
    start = [i for i, row in enumerate(matrix) if row[0] == 'State: Delhi UT']
    if len(start) != 1:
        raise ValueError(f'{source}: Delhi state header must be unique')
    records, summary = [], None
    for index in range(start[0] + 1, len(matrix)):
        row = matrix[index]
        if isinstance(row[0], str) and row[0].startswith('State:'):
            break
        if not row[1]:
            continue
        if row[1] == 'Total District(s)':
            summary = {'reporting_unit_label': row[1], 'source_row': index + 1, 'values': list(row)}
            break
        if row[2] != year:
            raise ValueError(f'{source} row {index + 1}: year mismatch')
        named = {header: row[i] for i, header in enumerate(headers) if header is not None}
        if kind == 'ipc':
            selected = {'theft': count(named['Theft']), 'robbery': count(named['Robbery']), 'criminal_trespass_burglary_revised_definition': count(named['Criminal Trespass/Burglary']), 'total_ipc': count(named['Total Cognizable IPC crimes'])}
        elif kind == 'sll':
            selected = {'total_sll': count(named['Total Cognizable SLL crimes'])}
        else:
            selected = {'total_crimes_against_women': count(named['Total Crimes against Women']), 'total_crimes_in_which_women_was_victim': count(named['Total Crimes in which Women was Victim'])}
        records.append({'reference_year': year, 'reporting_unit_label': row[1], 'source_serial': row[0], 'source_row': index + 1, 'values': list(row), 'selected_metrics': selected})
    if len(records) != 19 or summary is None:
        raise ValueError(f'{source}: expected 19 original units and a separate printed summary')
    return {'source': source, 'reference_year': year, 'table': kind, 'sheet': sheet.title, 'geography': 'Delhi UT reporting units as printed; not current districts',
            'geography_mapping': None, 'column_headers': headers, 'header_policy': 'All source columns preserved by position, including unlabelled auxiliary columns. Null headers/values remain null; auxiliary columns are not offence counts.',
            'source_title': matrix[0][0], 'reporting_units': records, 'printed_summary': summary}


class HtmlTables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.table, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.table = []
        elif tag == 'tr' and self.table is not None:
            self.row = []
        elif tag in ['th', 'td'] and self.row is not None:
            self.cell = []

    def handle_data(self, value):
        if self.cell is not None:
            self.cell.append(value)

    def handle_endtag(self, tag):
        if tag in ['th', 'td'] and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == 'table' and self.table is not None:
            self.tables.append(self.table)
            self.table = None


def traffic_citywide():
    parser = HtmlTables()
    parser.feed((BASE / 'raw/dtp_statistics.html').read_text(encoding='utf-8'))
    matches = [table for table in parser.tables if any('Fatal Accidents' in cell for row in table for cell in row)]
    if len(matches) != 1:
        raise ValueError('Cannot uniquely identify the official citywide accident table')
    table = matches[0]
    headers = table[0]
    expected = ['Year', 'Non-Inj.Accidents', 'Simple Accidents', 'Fatal Accidents', 'Total Accidents', 'Persons Injured', 'Persons Killed']
    if headers != expected:
        raise ValueError(f'Citywide source schema changed: {headers}')
    all_rows = [{'reference_year': count(row[0]), 'values': [count(v) for v in row]} for row in table[1:] if row and row[0].isdigit()]
    chosen = [r for r in all_rows if 2011 <= r['reference_year'] <= 2015]
    if len(chosen) != 5:
        raise ValueError('Incomplete citywide reference years')
    for row in chosen:
        _, noninjury, simple, fatal, total, injured, killed = row['values']
        if None in row['values'] or noninjury + simple + fatal != total or killed < fatal:
            raise ValueError(f'Invalid citywide arithmetic in {row}')
    baseline = read('inputs/production_road_safety_baseline.json')
    production = baseline['data']['trends']
    current_file = ROOT / baseline['source_path']
    if current_file.exists() and sha(current_file.read_bytes()) != baseline['sha256']:
        raise ValueError('Production reference changed since staging; reassess the overlap explicitly')
    overlap = []
    for row in all_rows:
        old = next((r for r in production if r['year'] == row['reference_year']), None)
        if old:
            if [old['crashes'], old['fatalities'], old['fatalCrashes']] != [row['values'][4], row['values'][6], row['values'][3]]:
                raise ValueError(f'Production overlap differs in {row["reference_year"]}; report, never repair production')
            overlap.append(row['reference_year'])
    return {'source': 'raw/dtp_statistics.html', 'geography': 'Delhi citywide as published by Delhi Traffic Police', 'reference_years': list(range(2011, 2016)), 'column_headers': headers,
            'rows': chosen, 'production_overlap_verified': overlap, 'series_extension_assessment': '2011-2013 total accidents, fatal accidents and persons killed can extend the existing citywide published-count trend in a later approved change; 2014-2015 are already present. Injury and category counts require explicit source-edition selection. No district allocation is implied.',
            'definition_limit': 'Published police counts. A 30-day fatality follow-up definition was not established in the retrieved historical source; do not label these as standardized 30-day mortality rates.'}


def traffic_as_printed(transcription):
    records = []
    for unit in transcription['rows']:
        for i, year in enumerate(transcription['years']):
            metrics = {name: unit[name][i] for name in transcription['metrics']}
            records.append({'reference_year': year, 'traffic_district_label': unit['label'], **metrics, 'persons_killed': None, 'persons_injured': None,
                            'source': transcription['source'], 'source_table': '6.1', 'source_pdf_page': 1, 'source_printed_page': 38,
                            'geography_vintage': 'Traffic districts as tabulated retrospectively in the 2015 report; original-year boundaries not independently verified.'})
    return {'source': transcription['source'], 'reference_years': transcription['years'], 'status': 'needs_review_source_inconsistencies', 'extraction_method': 'Image table transcribed visually; original PDF and structured transcription retained.',
            'review_status': 'author_checked_not_independently_reviewed', 'null_policy': 'Printed dashes remain null, not zero. Outer is not separately tabulated for 2011-2013; no boundary or district existence is inferred.', 'rows': records,
            'printed_totals': transcription['printed_totals']}


def archived_statistics(registry, city):
    """Keep contemporary snapshots distinct from the later official web edition."""
    editions, differences = [], []
    for source in registry.get('archived_statistics_pages', []):
        parser = HtmlTables()
        parser.feed((BASE / source['path']).read_text(encoding='utf-8'))
        matches = [t for t in parser.tables if t and t[0] == city['column_headers']]
        if len(matches) != 1:
            raise ValueError('Archived statistics schema is not uniquely identifiable')
        rows = []
        for row in matches[0][1:]:
            if not row or not row[0].isdigit() or not 2011 <= int(row[0]) <= 2015:
                continue
            values = [count(v) for v in row]
            if sum(values[1:4]) != values[4]:
                raise ValueError('Archived citywide accident categories do not reconcile')
            rows.append({'reference_year': values[0], 'values': values})
            latest = next(r['values'] for r in city['rows'] if r['reference_year'] == values[0])
            for index, (old, new) in enumerate(zip(values, latest)):
                if old != new:
                    differences.append({'source': source['path'], 'capture_timestamp': source['capture_timestamp'], 'reference_year': values[0], 'metric': city['column_headers'][index], 'archived_value': old, 'later_official_value': new})
        editions.append({**source, 'column_headers': city['column_headers'], 'rows': rows})
    return {'status': 'separate_source_editions_not_overwritten', 'editions': editions, 'differences_from_later_official_statistics': differences,
            'interpretation': 'Archive capture dates are not publication dates. Cause of discrepancies is not established; neither edition is silently corrected. Total crashes, fatal crashes and persons killed agree for 2011-2013. Injury counts and 2013 non-injury/simple counts require explicit edition selection. These pages are not the full annual reports.'}


def diagnostics(tables, traffic, city):
    issues = []
    for table in tables:
        summary, headers = table['printed_summary']['values'], table['column_headers']
        first_metric = 0 if table['source'].endswith('.pdf') else 3
        for i, header in enumerate(headers):
            if i < first_metric or header is None:
                continue
            values = [r['values'][i] for r in table['reporting_units']]
            if any(v is None for v in values) or summary[i] is None:
                issues.append({'kind': 'missing_metric_values', 'source': table['source'], 'column': i + 1, 'header': header})
            elif sum(values) != summary[i]:
                issues.append({'kind': 'reporting_units_do_not_sum_to_printed_summary', 'source': table['source'], 'column': i + 1, 'header': header, 'sum': sum(values), 'printed_summary': summary[i]})
    for row in traffic['rows']:
        components = [row[k] for k in ['fatal_accidents', 'injury_accidents', 'non_injury_accidents']]
        if all(v is not None for v in components) and sum(components) != row['total_accidents']:
            issues.append({'kind': 'traffic_row_arithmetic', 'reference_year': row['reference_year'], 'label': row['traffic_district_label'], 'sum_of_categories': sum(components), 'printed_total': row['total_accidents'], 'source_table': '6.1', 'source_printed_page': 38})
    for i, year in enumerate(range(2011, 2016)):
        for metric in ['fatal_accidents', 'injury_accidents', 'non_injury_accidents', 'total_accidents']:
            values = [r[metric] for r in traffic['rows'] if r['reference_year'] == year and r[metric] is not None]
            # Diagnostic subtotal only; null source cells are not replaced or redistributed.
            observed_sum = sum(values)
            printed = traffic['printed_totals'][metric][i]
            if observed_sum != printed:
                issues.append({'kind': 'traffic_observed_rows_vs_printed_total', 'reference_year': year, 'metric': metric, 'non_null_observations': len(values), 'observed_sum': observed_sum, 'printed_total': printed, 'source_table': '6.1', 'source_printed_page': 38})
        official = next(r for r in city['rows'] if r['reference_year'] == year)['values']
        for metric, source_index in [('fatal_accidents', 3), ('injury_accidents', 2), ('non_injury_accidents', 1), ('total_accidents', 4)]:
            printed = traffic['printed_totals'][metric][i]
            if printed != official[source_index]:
                issues.append({'kind': 'traffic_printed_total_vs_citywide_source', 'reference_year': year, 'metric': metric, 'table_6_1_total': printed, 'citywide_statistics': official[source_index]})
    return issues


def build(check=False):
    registry = read('inputs/sources.json')
    for source in registry['sources'] + registry.get('evidence_files', []):
        data = (BASE / source['path']).read_bytes()
        if sha(data) != source['sha256'] or len(data) != source['bytes']:
            raise ValueError(f'Source identity mismatch: {source["path"]}')
    tables = [ncrb_pdf(year) for year in [2011, 2012, 2013]] + [ncrb_xlsx(year, kind) for year in [2014, 2015] for kind in ['ipc', 'sll', 'women']]
    city = traffic_citywide()
    traffic = traffic_as_printed(read('inputs/traffic_table_6_1.json'))
    archives = archived_statistics(registry, city)
    issues = diagnostics(tables, traffic, city)
    products = {f'generated/ncrb_{table["reference_year"]}_{table["table"].replace(".", "_")}.json': encoded(table) for table in tables}
    products['generated/traffic_citywide_2011_2015.json'] = encoded(city)
    products['generated/traffic_districts_as_printed_2015_vintage.json'] = encoded(traffic)
    products['generated/traffic_archived_statistics_editions.json'] = encoded(archives)
    quality = {'arithmetic_diagnostics': issues, 'source_identity_warnings': registry['source_identity_warnings'], 'archived_statistics_edition_differences': archives['differences_from_later_official_statistics'], 'interpretation': 'Source inconsistencies and edition differences are retained and flagged, not repaired. These diagnostics are not claims of clean original-source arithmetic.'}
    products['generated/quality_report.json'] = encoded(quality)
    availability = []
    for year in range(2011, 2016):
        year_tables = [t for t in tables if t['reference_year'] == year]
        crime = next(t for t in year_tables if t['table'] in ['1.14', 'ipc'])
        availability.append({'reference_year': year, 'crime': {'availability': 'official_original_year_district_data_staged', 'reporting_units': len(crime['reporting_units']), 'reporting_unit_labels': [r['reporting_unit_label'] for r in crime['reporting_units']], 'metrics': ['theft', 'robbery', 'burglary_old_definition' if year <= 2013 else 'criminal_trespass_burglary_revised_definition', 'total_ipc'] + (['total_sll', 'total_crimes_against_women'] if year >= 2014 else []), 'missing_metrics': ['total_sll', 'comparable_total_crimes_against_women'] if year <= 2013 else [], 'publication': registry['publication_evidence'][str(year)], 'series_assessment': 'Separate historical reporting-unit series. No safe append to current 15-district panel without boundary and offence-definition evidence.', 'definition_changes': registry['comparability_notes'][str(year)]},
                             'road_crashes': {'original_annual_report': 'relevant official 2015 report chapters archived' if year == 2015 else 'not located in current official archive during this investigation; this does not prove non-publication', 'citywide': 'official citywide count series staged and arithmetic validated', 'traffic_districts': '2015-report retrospective table staged as printed; source inconsistencies and traffic-geography break prevent blind extension', 'non_null_traffic_districts_in_retrospective_table': sum(r['reference_year'] == year and r['total_accidents'] is not None for r in traffic['rows']), 'publication_date': None, 'publication_date_note': '2015 report front matter is undated; PDF file timestamps are recorded separately and are not treated as publication dates.', 'series_assessment': 'Citywide counts: candidate extension for 2011-2013; 2014-2015 already in existing trend. District/circle data: separate historical series, with source issues unresolved.'}})
    products['generated/availability_comparability.json'] = encoded(availability)
    report = render_report(availability, city, tables, quality, registry)
    if archives['editions']:
        report += '\n## Archive follow-up\n\nWayback snapshots of the official site recovered supporting originals, but no complete 2011-2014 annual report was located.\n\n'
        report += '| Reference year | Recovered evidence | Complete annual report |\n|---|---|---|\n'
        report += '| 2011 | Official statistics in archived 2014/2015 pages | Not located |\n| 2012 | Official statistics in archived 2014/2015 pages; injury-count version discrepancy | Not located |\n| 2013 | Original accident-prone-zone map and archived statistics | Not located |\n| 2014 | Original accident-prone-zone map and separate zone list | Not located |\n\n'
        report += 'The 2013 map and 2014 map/list were visually checked against their embedded titles and Delhi Traffic Police/Accident Research Cell insignia. These are single-page image PDFs, not annual-report substitutes. Historical map regions/labels remain unchanged; no coordinates or current-district mapping are inferred. Their stated zone threshold is at least three fatal accidents or ten total accidents within a 500-metre diameter. Exact publication dates remain unknown; capture timestamps and upload paths are not release dates.\n\n'
        report += 'The archived official statistics give **6,639 injured in 2012**, versus **6,633** in the later official edition. For 2013 they give **169 non-injury and 5,619 simple accidents**, versus **173 and 5,615** later. Total accidents, fatal accidents and persons killed agree for 2011-2013. The cause of these edition differences is unverified. Preserve both; only those three agreeing measures remain straightforward citywide extension candidates.\n\n'
        report += 'Both archived tables and every differing cell are preserved in generated/traffic_archived_statistics_editions.json. The source register records replay URLs, original government URLs, capture timestamps, checksums and reuse limitations. Archive hosting supplies provenance, not a new reuse licence. Search scope and failed retrievals are recorded in inputs/archive_search_log.json.\n'
    products['AVAILABILITY_AND_COMPARABILITY.md'] = report.encode('utf-8')
    manifest = {'schemaVersion': '1.0.0', 'generatedBy': 'tools/history_2011_2015/build.py', 'generatedAt': None, 'metadataDate': METADATA_DATE, 'releaseStatus': 'staged_research', 'productionReady': False, 'dashboardIntegrated': False, 'referenceYears': list(range(2011, 2016)),
                'nullPolicy': 'Source blanks and dashes remain null. Literal numeric zeros remain zero. Never distribute citywide or old-district counts among later districts.',
                'geographyPolicy': 'Retain original NCRB reporting units and separate Delhi UT summaries. Traffic districts and citywide counts are separate series. Same labels do not establish equal boundaries across periods or agencies.',
                'counts': {'ncrb_tables': len(tables), 'ncrb_reporting_unit_rows': sum(len(t['reporting_units']) for t in tables), 'ncrb_separate_printed_summaries': len(tables), 'traffic_citywide_rows': len(city['rows']), 'traffic_retrospective_district_rows': len(traffic['rows']), 'documented_arithmetic_diagnostics': len(issues), 'archived_statistics_editions': len(archives['editions']), 'archived_statistics_differing_cells': len(archives['differences_from_later_official_statistics'])},
                'sources': registry['sources'], 'evidenceFiles': registry.get('evidence_files', []), 'derivedFrom': [{'path': 'data/staged/history_2011_2015/' + name, 'sha256': sha((BASE / name).read_bytes())} for name in ['inputs/sources.json', 'inputs/traffic_table_6_1.json', 'inputs/production_road_safety_baseline.json', 'inputs/archive_search_log.json']],
                'files': [{'path': name, 'sha256': sha(data), 'bytes': len(data)} for name, data in sorted(products.items())], 'monitorVerification': registry['monitor_verification'], 'reuseTerms': registry['reuse_terms'],
                'validationInterpretation': 'Source hashes, extraction schema, selected years and citywide arithmetic must pass. Original-source arithmetic contradictions remain explicit in quality_report.json; traffic district data are not approved for series extension.'}
    products['manifest.json'] = encoded(manifest)
    for name, data in products.items():
        file = BASE / name
        if check:
            if not file.exists() or file.read_bytes() != data:
                raise ValueError(f'Non-reproducible generated output: {name}')
        else:
            file.parent.mkdir(exist_ok=True, parents=True)
            file.write_bytes(data)
    print(json.dumps({'mode': 'check' if check else 'build', 'counts': manifest['counts'], 'source_files_verified': len(registry['sources']), 'production_overlap_verified': city['production_overlap_verified']}, sort_keys=True))
    return manifest, quality


def render_report(availability, city, tables, quality, registry):
    lines = ['# Delhi 2011-2015: availability and comparability', '', 'Staged research only. Production files and the dashboard are unchanged.', '',
             'Official NCRB original-year district tables are available for every requested year. They cannot be appended as if they described today\'s 15 police districts. Citywide Delhi Traffic Police published counts can support an earlier citywide trend; retrospective traffic-district data require a separate historical series.', '',
             '## Year-by-year findings', '', '| Reference year | NCRB geography and source | Crime metrics and definition breaks | Traffic sources and gaps | Existing-series assessment |', '|---|---|---|---|---|']
    for entry in availability:
        y, c, r = entry['reference_year'], entry['crime'], entry['road_crashes']
        geography = f'{c["reporting_units"]} original reporting units, including special units; ' + ('Table 1.14 PDF, printed pp.296-298' if y <= 2013 else 'official additional-table XLSX files')
        metrics = ', '.join(c['metrics']) + '. ' + ' '.join(c['definition_changes'])
        road = ('Relevant chapters of the original 2015 annual report archived.' if y == 2015 else 'Original annual PDF not located; official 2015 retrospective and current statistics available.') + f' {r["non_null_traffic_districts_in_retrospective_table"]} traffic districts have non-null totals in the retrospective table.'
        lines.append(f'| {y} | {geography} | {metrics} | {road} | Crime: separate historical panel. Road: ' + ('citywide extension candidate; district table held for review.' if y <= 2013 else 'citywide already present; district series stays separate.') + ' |')
    lines += ['', '## Publication dates and source editions', '', '| Reference year | NCRB publication evidence | Traffic publication evidence |', '|---|---|---|']
    for entry in availability:
        p = entry['crime']['publication']
        lines.append(f'| {entry["reference_year"]} | {p["display"]} | ' + ('2015 annual front matter undated; exact publication date unknown.' if entry['reference_year'] == 2015 else 'Original annual-report publication date not verified.') + ' |')
    lines += ['', 'Foreword dates, original report releases, PDF creation/modification timestamps, portal upload paths and retrieval dates are different facts. The registry records their bases separately. NCRB\'s 2015 corrigendum is retained with the archived edition; it is not silently applied to unrelated tables.', '',
              '## Citywide road counts', '', '| Reference year | Non-injury accidents | Simple accidents | Fatal accidents | Total accidents | Persons injured | Persons killed |', '|---|---:|---:|---:|---:|---:|---:|']
    for row in city['rows']:
        lines.append('| ' + ' | '.join(str(v) for v in row['values']) + ' |')
    lines += ['', 'These are the Traffic Police\'s published counts, not rates or population-adjusted risk. Fatal accidents and persons killed are distinct. The archived official statistics table agrees with the existing production trend for the overlap years ' + ', '.join(map(str, city['production_overlap_verified'])) + '. The 2014 and 2015 counts already exist in data/road_safety_trends.json; only 2011-2013 would add earlier citywide observations. A standardized 30-day follow-up definition was not established; do not infer one.', '',
              '## Geography, definitions and nulls', '',
              '- Retain all original reporting-unit labels. CAW, STF, GRP(RLY), Metro, SPUWAC and other specialised units are not interchangeable with territorial districts. Delhi UT printed summaries are stored separately and never added to their component rows.',
              '- No current-district identifiers, boundary interpolation, allocation weights or population-based distribution is created. Matching text labels do not prove unchanged boundaries.',
              '- In the 2015 retrospective traffic table, OUTER is a dash for 2011-2013 and separately tabulated from 2014. Dashes remain null; no district-existence or boundary date is inferred from them. These are traffic districts, not automatically NCRB police-reporting areas.',
              '- The 2014 NCRB disclaimer explicitly records revised proformae, new crime heads and changed sections. Earlier Burglary is kept distinct from Criminal Trespass/Burglary. C.H. including sections 304 and 308 in the earlier table is not silently merged with the later separate attempt category.',
              '- The 2013 disclaimer changes crime-rate denominators for women and other population segments. Counts are staged; no historical rate or denominator is reconstructed. Its principal-offence rule counts the most serious offence in a case, and subgroup totals overlap IPC/SLL totals.',
              '- The 2014 disclaimer expands the crimes-against-women basket to include abetment of women\'s suicide and the Protection of Women from Domestic Violence Act. The later workbook\'s Total Crimes against Women and Total Crimes in which Women was Victim are different measures. No earlier aggregate is guessed from component columns.', '',
              '## Source quality findings', '']
    for issue in registry['source_identity_warnings']:
        lines.append('- ' + issue['summary'])
    for issue in quality['arithmetic_diagnostics']:
        lines.append('- ' + json.dumps(issue, ensure_ascii=False, sort_keys=True))
    lines += ['', 'The retrospective traffic table is retained as printed in a separate needs-review artifact. It is not used to overwrite the independently validated citywide table. District cells with unknown values are never filled from citywide residuals.', '',
              '## Reuse terms', '']
    for term in registry['reuse_terms']:
        lines.append('- **' + term['publisher'] + ':** ' + term['assessment'])
    lines += ['', 'Public accessibility and permission to download do not establish a blanket redistribution licence. No licence from an OGD catalogue is transferred to a different NCRB-hosted PDF/XLSX without evidence. Review the recorded terms before public redistribution.', '',
              '## Monitor prerequisite', '', 'PR #41 is merged. Both post-merge monitor runs succeeded; the first posted the short NCRB TLS warning, and the second suppressed its identical digest. The evidence is recorded in inputs/sources.json and the saved monitor-verification package. No duplicate run was dispatched and no issue state was changed by this investigation.', '',
              '## Source register', '', '| Archived file | Reference years / role | Original URL | SHA-256 |', '|---|---|---|---|']
    for source in registry['sources']:
        lines.append(f'| {source["path"]} | {source["reference_years"]}; {source["role"]} | {source["url"]} | {source["sha256"]} |')
    lines += ['', '## Reproduce and validate', '', 'Install tools/history_2011_2015/requirements.txt in an isolated environment and ensure Poppler pdftotext is available. Run:', '', '```text', 'python tools/history_2011_2015/build.py', 'python tools/history_2011_2015/build.py --check', 'python -m unittest discover -s tools/history_2011_2015 -p "test_*.py"', '```', '',
              'The default build is offline and validates the immutable archived input bytes before extraction. --check compares every generated byte without writing it. Fetching missing originals is separate and refuses a changed SHA-256. Raw landing-page snapshots are historical evidence; a live page may have changed since capture. UI integration is outside this authorization.', '']
    return '\n'.join(lines)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    build(args.check)
