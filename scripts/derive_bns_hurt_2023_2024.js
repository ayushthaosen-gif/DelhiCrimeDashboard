// Reads the "Hurt" head of Delhi's 2023 NCRB IPC table and the "Hurt or Grievous Hurt" head of the 2024 IPC/BNS table from the archived workbooks and writes
// data/derived/bns_hurt_2023_2024.json: how much of Delhi's 2023 to 2024 fall in registered cases the hurt change can account for, with the national figures
// as reported (not re-derived here). Needs `unzip` on the PATH. Not run in CI; test/patterns.test.js checks the file against the archived workbooks' hashes.
//
//   node scripts/derive_bns_hurt_2023_2024.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { sha256 } = require('./lib/release_utils');
const { utRows } = require('./lib/patterns');

const ROOT = path.join(__dirname, '..');
const DIR = 'data/raw/source_archive/ncrb/';

function readSheet(rel) {
  const file = path.join(ROOT, rel);
  const ss = execFileSync('unzip', ['-p', file, 'xl/sharedStrings.xml'], { maxBuffer: 1e8 }).toString('utf8');
  const strs = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('').replace(/&amp;/g, '&'));
  const sheet = execFileSync('unzip', ['-p', file, 'xl/worksheets/sheet1.xml'], { maxBuffer: 1e9 }).toString('utf8');
  const rows = [];
  for (const rm of sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const row = {};
    for (const c of rm[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = (c[3] || '').match(/<v>([\s\S]*?)<\/v>/);
      if (v) row[c[1]] = /t="s"/.test(c[2]) ? strs[+v[1]] : v[1];
    }
    rows.push(row);
  }
  return rows;
}

// Delhi's block: every unit listed under "State: Delhi" up to the next state or total row. These are the units NCRB prints for Delhi
// (the 15 districts plus Crime Branch, Railway and other specialised units), the same scope as the Delhi-wide totals on the site.
function delhiSum(rows, headerPattern) {
  const hdr = rows.find(r => Object.values(r).some(v => headerPattern.test(v)));
  const cols = Object.keys(hdr).filter(c => headerPattern.test(hdr[c]));
  if (cols.length !== 1) throw new Error('expected one hurt column, found ' + cols.length);
  const start = rows.findIndex(r => /^State: Delhi/.test(r.A || ''));
  const units = [];
  for (let i = start + 1; i < rows.length; i++) {
    const r = rows[i];
    if (/^State:|^Total/i.test(String(r.A || r.B)) && units.length > 3) break;
    if (r.B) units.push(r);
  }
  return { header: hdr[cols[0]], units: units.length, value: units.reduce((a, r) => a + (+r[cols[0]] || 0), 0) };
}

const f23 = DIR + 'districtwise_ipc_crimes_2023.xlsx', f24 = DIR + 'districtwise_ipc_bns_crimes_2024.xlsx';
const h23 = delhiSum(readSheet(f23), /^Hurt$/), h24 = delhiSum(readSheet(f24), /^Hurt or Grievous Hurt$/);

const ut = utRows();
const rowOf = y => ut.find(r => r.year === String(y));
const t23 = rowOf(2023), t24 = rowOf(2024);
const total23 = +t23.total_ipc_bns, total24 = +t24.total_ipc_bns, theft23 = +t23.theft, theft24 = +t24.theft;

const out = {
  schemaVersion: '1.0.0',
  title: 'Hurt head, Delhi, 2023 (IPC) and 2024 (BNS): how much of the 2023 to 2024 fall it can account for',
  scope: 'Delhi as NCRB prints it (the 15 districts plus Crime Branch, Railway and other specialised units), registered cases.',
  delhi: {
    hurt2023: h23.value, hurt2023Header: h23.header, hurt2024: h24.value, hurt2024Header: h24.header,
    hurtChange: h24.value - h23.value, hurtChangePct: Math.round((h24.value / h23.value - 1) * 1000) / 10,
    totalIpcBns2023: total23, totalIpcBns2024: total24, totalChange: total24 - total23, totalChangePct: Math.round((total24 / total23 - 1) * 1000) / 10,
    theft2023: theft23, theft2024: theft24, theftChange: theft24 - theft23,
    hurtShareOfTotalFallPct: Math.round((h24.value - h23.value) / (total24 - total23) * 1000) / 10,
    theftShareOfTotalFallPct: Math.round((theft24 - theft23) / (total24 - total23) * 1000) / 10
  },
  national: {
    status: 'As reported in the press from the NCRB Crime in India 2024 report; not re-derived here and the NCRB report itself was not read.',
    hurtCases2023: 636000, hurtCases2024: 441000, hurtChangePct: -30.58,
    cognizableCrimes2023: 6241000, cognizableCrimes2024: 5885000, cognizableChangePct: -6,
    explanation: 'NCRB attributes the fall in hurt cases to the Bharatiya Nyaya Sanhita: hurt and grievous hurt sections were merged and simple hurt became a non-cognisable offence, so it no longer appears in police registration data.',
    sources: [
      'https://www.drishtiias.com/daily-updates/daily-news-analysis/ncrbs-crime-in-india-2024-report/print_manually',
      'https://thewire.in/government/crime-rate-fell-6-in-2024-ncrb-attributes-dip-to-change-from-ipc-to-bns'
    ]
  },
  inputs: [f23, f24].map(f => ({ file: f, sha256: sha256(path.join(ROOT, f)) })),
  caveats: [
    'The 2023 head is named "Hurt" and the 2024 head "Hurt or Grievous Hurt"; NCRB says the BNS merged these sections, so the two are not the same definition and the change is not a change in incidents.',
    'The hurt change accounts for only a small part of Delhi\'s fall; theft accounts for most of it, and the national hurt explanation says nothing about theft.',
    'Whether other heads moved because of reclassification has not been checked head by head.'
  ]
};
fs.mkdirSync(path.join(ROOT, 'data', 'derived'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/derived/bns_hurt_2023_2024.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out.delhi));
