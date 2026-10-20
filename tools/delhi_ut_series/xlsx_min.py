"""Minimal, dependency-free .xlsx reader (standard library only): sheets as lists of (row number, {column letters: value}).

Cell values come back as text exactly as stored; numbers are never coerced here, so a blank or a dash stays unknown.
"""
from __future__ import annotations

import re
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
TAG = '{%s}' % NS['m']


def read_xlsx(path):
    archive = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in archive.namelist():
        root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
        for si in root.findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter(TAG + 't')))
    workbook = ET.fromstring(archive.read('xl/workbook.xml'))
    names = [sheet.get('name') for sheet in workbook.find('m:sheets', NS)]
    sheets = []
    for index, name in enumerate(names, 1):
        root = ET.fromstring(archive.read('xl/worksheets/sheet%d.xml' % index))
        rows = []
        for row in root.iter(TAG + 'row'):
            values = {}
            for cell in row.findall('m:c', NS):
                column = re.match(r'[A-Z]+', cell.get('r')).group(0)
                value = cell.find('m:v', NS)
                if value is None:
                    inline = cell.find('m:is', NS)
                    values[column] = ''.join(t.text or '' for t in inline.iter(TAG + 't')) if inline is not None else None
                elif cell.get('t') == 's':
                    values[column] = shared[int(value.text)]
                else:
                    values[column] = value.text
            rows.append((int(row.get('r')), values))
        sheets.append((name, rows))
    return sheets
