"""Checks for the Delhi UT extraction: printed totals agree with the printed unit rows, nulls stay null, and the file is current.

    python -I tools/delhi_ut_series/test_extract.py   (run from the repository root)
"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract  # noqa: E402


class ExtractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = extract.build()

    def test_printed_total_equals_sum_of_printed_units_everywhere(self):
        for year in self.data['years']:
            for measure, agrees in year['agreement'].items():
                self.assertTrue(agrees, '%s %s' % (year['year'], measure))

    def test_every_year_reports_the_same_twenty_three_units(self):
        for year in self.data['years']:
            self.assertEqual(year['unitCount'], 23)
        self.assertEqual(self.data['years'][0]['unitLabels'], self.data['years'][2]['unitLabels'])

    def test_known_printed_values(self):
        by_year = {y['year']: y['printedTotal'] for y in self.data['years']}
        self.assertEqual(by_year[2022]['total_ipc_bns'], 300429)
        self.assertEqual(by_year[2024]['total_crimes_against_women'], 13396)

    def test_blank_and_dash_are_unknown_never_zero(self):
        for value in [None, '', '-', '..', 'NA']:
            self.assertIsNone(extract.number(value))
        self.assertEqual(extract.number('0'), 0)
        self.assertEqual(extract.number('1,234'), 1234)

    def test_file_on_disk_matches_a_fresh_extraction(self):
        self.assertEqual(extract.OUT.read_bytes(), extract.encode(self.data))


if __name__ == '__main__':
    unittest.main()
