"""Checks for historical geography, null semantics and source-faithful extraction."""
import unittest

import build
from fetch_missing import verify


class HistoricalStageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pdf = {y: build.ncrb_pdf(y) for y in [2011, 2012, 2013]}
        cls.later = {(y, k): build.ncrb_xlsx(y, k) for y in [2014, 2015] for k in ['ipc', 'sll', 'women']}
        cls.city = build.traffic_citywide()
        cls.traffic = build.traffic_as_printed(build.read('inputs/traffic_table_6_1.json'))

    def test_unknown_and_zero_remain_distinct(self):
        for value in [None, '', '-', '..', 'NA', 'N.A.']:
            self.assertIsNone(build.count(value))
        self.assertEqual(build.count('0'), 0)
        self.assertEqual(build.count('1,234'), 1234)
        for value in [-1, 1.5, True, 'nan']:
            with self.assertRaises(ValueError):
                build.count(value)

    def test_pdf_year_specific_units_and_panel_alignment(self):
        self.assertEqual([len(self.pdf[y]['reporting_units']) for y in self.pdf], [17, 17, 18])
        self.assertNotIn('METRO RAIL', [r['reporting_unit_label'] for r in self.pdf[2012]['reporting_units']])
        self.assertIn('METRO RAIL', [r['reporting_unit_label'] for r in self.pdf[2013]['reporting_units']])
        for table in self.pdf.values():
            self.assertIsNone(table['geography_mapping'])
            self.assertTrue(all(len(r['values']) == 30 for r in table['reporting_units']))
            self.assertNotIn('TOTAL', [r['reporting_unit_label'] for r in table['reporting_units']])

    def test_pdf_source_counts_and_definition_breaks(self):
        self.assertEqual(self.pdf[2013]['printed_summary']['values'][0], 517)
        self.assertEqual(self.pdf[2013]['printed_summary']['values'][3], 1636)
        self.assertEqual(self.pdf[2011]['column_headers'][23], 'Molestation (Sec.354 IPC)')
        self.assertIn('Insult', self.pdf[2012]['column_headers'][24])
        for table in self.pdf.values():
            for row in table['reporting_units']:
                self.assertIsNone(row['selected_metrics']['total_sll'])
                self.assertIsNone(row['selected_metrics']['total_crimes_against_women'])

    def test_workbook_columns_rows_and_summary_are_not_collapsed(self):
        for (year, kind), table in self.later.items():
            self.assertEqual(len(table['reporting_units']), 19)
            self.assertEqual(len(table['column_headers']), 248)
            self.assertIsNone(table['printed_summary']['values'][2])
            self.assertTrue(all(r['values'][2] == year for r in table['reporting_units']))
            self.assertIsNone(table['geography_mapping'])
            if kind == 'women':
                self.assertIn('Total Crimes against Women', table['column_headers'])
                self.assertIn('Total Crimes in which Women was Victim', table['column_headers'])

    def test_ncrb_columns_reconcile_without_summing_overlapping_heads(self):
        tables = list(self.pdf.values()) + list(self.later.values())
        issues = build.diagnostics(tables, {'rows': [], 'printed_totals': self.traffic['printed_totals']}, self.city)
        self.assertFalse(any(i.get('source', '').startswith('raw/ncrb_') for i in issues))

    def test_citywide_is_separate_and_matches_existing_overlap(self):
        self.assertEqual(self.city['rows'][0]['values'], [2011, 71, 5162, 2047, 7280, 6975, 2110])
        self.assertEqual(self.city['rows'][-1]['values'], [2015, 160, 6343, 1582, 8085, 8258, 1622])
        self.assertEqual(self.city['production_overlap_verified'], list(range(2014, 2022)))

    def test_retrospective_nulls_and_printed_errors_are_preserved(self):
        outer = [r for r in self.traffic['rows'] if r['traffic_district_label'] == 'OUTER']
        self.assertEqual([r['total_accidents'] for r in outer], [None, None, None, 850, 701])
        self.assertTrue(all(r['persons_killed'] is None for r in self.traffic['rows']))
        issues = build.diagnostics([], self.traffic, self.city)
        self.assertEqual(len(issues), 9)
        mismatch = next(i for i in issues if i['kind'] == 'traffic_printed_total_vs_citywide_source')
        self.assertEqual((mismatch['table_6_1_total'], mismatch['citywide_statistics']), (45, 71))
        north = next(r for r in self.traffic['rows'] if r['reference_year'] == 2012 and r['traffic_district_label'] == 'NORTH')
        self.assertEqual((north['injury_accidents'], north['total_accidents']), (115, 446))

    def test_all_archive_hashes_and_changed_source_rejection(self):
        for source in build.read('inputs/sources.json')['sources']:
            data = (build.BASE / source['path']).read_bytes()
            verify(data, source)
        with self.assertRaises(ValueError):
            verify(b'changed', source)

    def test_wrong_documents_not_used_as_definition_evidence(self):
        registry = build.read('inputs/sources.json')
        self.assertEqual(len(registry['source_identity_warnings']), 3)
        wrong = [s for s in registry['sources'] if s['role'] == 'evidence_only_mislinked_document']
        self.assertEqual(len(wrong), 3)
        self.assertTrue(all(s['reference_years'] == [] for s in wrong))
        self.assertIsNone(registry['publication_evidence']['2014']['publication_date'])
        self.assertEqual(registry['publication_evidence']['2015']['publication_date'], '2016-08-30')

    def test_generated_outputs_are_byte_reproducible(self):
        manifest, quality = build.build(check=True)
        self.assertFalse(manifest['productionReady'])
        self.assertFalse(manifest['dashboardIntegrated'])

    def test_archived_statistics_keep_all_changed_cells_by_edition(self):
        archive = build.archived_statistics(build.read('inputs/sources.json'), self.city)
        self.assertEqual(len(archive['editions']), 2)
        self.assertEqual(len(archive['differences_from_later_official_statistics']), 6)
        for edition in archive['editions']:
            self.assertEqual([r['reference_year'] for r in edition['rows']], [2011, 2012, 2013])
            old = edition['rows'][1]['values']
            self.assertEqual(old[5], 6639)
            later = next(r['values'] for r in self.city['rows'] if r['reference_year'] == 2012)
            self.assertEqual(later[5], 6633)
            for row in edition['rows']:
                current = next(r['values'] for r in self.city['rows'] if r['reference_year'] == row['reference_year'])
                self.assertEqual([row['values'][i] for i in [3, 4, 6]], [current[i] for i in [3, 4, 6]])

    def test_archived_zone_documents_are_supporting_evidence_not_full_reports(self):
        registry = build.read('inputs/sources.json')
        maps = [s for s in registry['sources'] if s['role'] == 'archived_official_supporting_document']
        self.assertEqual(len(maps), 3)
        self.assertEqual([s['reference_years'] for s in maps], [[2013], [2014], [2014]])
        self.assertTrue(all(s['page_count'] == 1 and s['publication_date'] is None for s in maps))
        self.assertTrue(all('delhitrafficpolice.nic.in' in s['original_url'] for s in maps))
        self.assertEqual(build.read('inputs/archive_search_log.json')['full_reports_found'], [])


if __name__ == '__main__':
    unittest.main()
