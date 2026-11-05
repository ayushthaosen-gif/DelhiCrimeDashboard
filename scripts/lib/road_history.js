// Delhi Traffic Police district road-crash tables, 2011 to 2024, in one year-indexed shape for the Road safety page.
//
// Two scopes, never mixed:
//   whole  whole-district crash events (fatal, injury, non-injury, total): 2011 to 2015 from the 2015 report's retrospective Table 6.1, then the reports' own district tables for 2016 to 2022
//   zones  crashes within the selected crash-prone zones of each district (zones, simple, fatal, total): 2017 to 2024, with 2016 explicitly unavailable
// Reporting units keep their printed labels and the geography of their own year; nothing is allocated to other districts.
// Printed totals are separate records and are never rows. A district missing from a printed table is listed as omitted, never as zero.
// Sources: data/staged/history_2011_2015/generated/ (2011 to 2015, Table 6.1 of the 2015 report), data/staged/road_districts_2016_2020/generated/ (2016 to 2021), data/releases/road_crash_report_2022/ (2022),
// data/dashboard_final.json (2023 and 2024 zone tables, adapted without changing a value).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const H = 'data/staged/road_districts_2016_2020/generated/';
const R22 = 'data/releases/road_crash_report_2022/';
const REVIEW = 'Pages visually checked by the extracting agent; not independently reviewed.';
const REVIEW_2015 = 'Every cell was read again from the printed page on 2026-11-05 and agrees with the transcription; not independently reviewed.';
const SRC_2015 = { reportYear: 2015, table: '6.1', pdfPage: 1, printedPage: 38, url: 'https://traffic.delhipolice.gov.in/sites/default/files/uploads/2016/12/CHAPTER-6-SPATIAL-TRENDS.pdf', sha256: 'c286cd138729c3827baf2d18724ab7b1ddac07aaae190f4277fc8844bb1c119a', review: REVIEW_2015 };
const norm = n => String(n).toUpperCase().replace(/ DISTRICT$/, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
const sumOf = (rows, i) => rows.reduce((a, r) => a + r[i], 0);

function meta(r, extra) {
  return Object.assign({
    reportYear: r.report_year, table: String(r.source_table), pdfPage: r.source_pdf_page == null ? null : r.source_pdf_page,
    printedPage: r.source_printed_page == null ? null : r.source_printed_page, url: r.source_url || r.original_url, sha256: r.source_sha256, review: REVIEW
  }, extra || {});
}

function build() {
  const annual = read(H + 'traffic_districts_2016_2020_as_reported.json');
  const totals = read(H + 'traffic_district_totals_2016_2020.json');
  const whole21 = read(H + 'traffic_district_crashes_2019_2021.json').filter(r => r.reference_year === 2021);
  const total21 = read(H + 'printed_dtp_totals_2019_2021.json').filter(r => r.reference_year === 2021)[0];
  const d22 = read(R22 + 'district_crashes.json');
  const zones1720 = read(H + 'zone_districts_2017_2020_as_reported.json');
  const zoneTotals = read(H + 'zone_citywide_totals_2016_2020.json');
  const gaps = read(H + 'zone_district_gaps_2016_2020.json');
  const z21 = read(H + 'crash_zone_districts_2021.json');
  const z22 = read(R22 + 'district_selected_zones.json');
  const final = read('data/dashboard_final.json').districts;

  const whole = {};
  // 2011 to 2015: one printed table (Table 6.1 of the 2015 report) lists five years by traffic district. OUTER is a dash for 2011 to 2013 (not tabulated), so it is omitted, never zero.
  const early = read('data/staged/history_2011_2015/generated/traffic_districts_as_printed_2015_vintage.json');
  early.reference_years.forEach((y, i) => {
    const all = early.rows.filter(r => r.reference_year === y), present = all.filter(r => r.total_accidents != null);
    whole[y] = {
      geography: present.length + ' traffic districts', source: SRC_2015,
      rows: present.map(r => [r.traffic_district_label, r.fatal_accidents, r.injury_accidents, r.non_injury_accidents, r.total_accidents]),
      omitted: all.filter(r => r.total_accidents == null).map(r => r.traffic_district_label),
      total: ['fatal_accidents', 'injury_accidents', 'non_injury_accidents', 'total_accidents'].map(k => early.printed_totals[k][i]),
      totalSource: Object.assign({}, SRC_2015, { note: 'Printed total row of Table 6.1 for ' + y + '.' })
    };
  });
  for (let y = 2016; y <= 2020; y++) {
    const rows = annual.filter(r => r.reference_year === y);
    const t = totals.find(r => r.reference_year === y);
    whole[y] = {
      geography: rows.length + ' traffic districts', source: meta(rows[0]),
      rows: rows.map(r => [r.reporting_unit_as_printed, r.fatal_accidents, r.injury_accidents, r.non_injury_accidents, r.total_accidents]),
      total: [t.fatal_accidents, t.injury_accidents, t.non_injury_accidents, t.total_accidents], totalSource: meta(t)
    };
  }
  whole[2021] = {
    geography: whole21.length + ' traffic districts', source: meta(whole21[0]),
    rows: whole21.map(r => [r.reporting_unit_as_printed, r.fatal_crashes, r.injury_crashes, r.non_injury_crashes, r.total_crashes]),
    total: [total21.fatal_crashes, total21.injury_crashes, total21.non_injury_crashes, total21.total_crashes], totalSource: meta(total21)
  };
  whole[2022] = {
    geography: d22.length + ' traffic districts', source: meta(d22[0]),
    rows: d22.map(r => [r.reporting_unit_as_printed, r.fatal_crashes, r.injury_crashes, r.non_injury_crashes, r.total_crashes]),
    total: [1428, 4132, 92, 5652], totalSource: meta(d22[0], { note: 'Printed 2022 whole-district total, 5,652 crashes (see data/releases/road_crash_report_2022/README.md).' })
  };

  const zones = {};
  zones[2016] = {
    unavailable: gaps.find(g => g.reference_year === 2016).reason + ' The citywide total is shown separately.',
    total: [zoneTotals[0].accident_prone_zones, zoneTotals[0].simple_accidents, zoneTotals[0].fatal_accidents, zoneTotals[0].total_accidents], totalSource: meta(zoneTotals[0]), geography: null, rows: []
  };
  for (let y = 2017; y <= 2020; y++) {
    const rows = zones1720.filter(r => r.reference_year === y);
    const t = zoneTotals.find(r => r.reference_year === y);
    zones[y] = {
      geography: whole[y].geography, source: meta(rows[0]),
      rows: rows.map(r => [r.reporting_unit_as_printed, r.accident_prone_zones, r.simple_accidents, r.fatal_accidents, r.total_accidents]),
      total: [t.accident_prone_zones, t.simple_accidents, t.fatal_accidents, t.total_accidents], totalSource: meta(t)
    };
  }
  const zrows21 = z21.filter(r => r.reporting_unit_as_printed !== 'Total'), zt21 = z21.filter(r => r.reporting_unit_as_printed === 'Total')[0];
  zones[2021] = {
    geography: whole[2021].geography, source: meta(zrows21[0]),
    rows: zrows21.map(r => [r.reporting_unit_as_printed, r.crash_prone_zones, r.simple_crashes, r.fatal_crashes, r.total_crashes]),
    total: [zt21.crash_prone_zones, zt21.simple_crashes, zt21.fatal_crashes, zt21.total_crashes], totalSource: meta(zt21)
  };
  zones[2022] = {
    geography: whole[2022].geography, source: meta(z22[0]),
    rows: z22.map(r => [r.reporting_unit_as_printed, r.crash_prone_zones, r.simple_crashes, r.fatal_crashes, r.total_crashes]),
    total: [117, 782, 427, 1209], totalSource: meta(z22[0], { note: 'Printed selected-zone totals reconcile to the 117 named zones (Table 6.41).' })
  };
  [2023, 2024].forEach(y => {
    zones[y] = {
      geography: final.length + ' police districts', source: { reportYear: y, table: y === 2024 ? '6.31' : null, pdfPage: null, printedPage: null, url: null, sha256: null,
        review: 'Production release (data/releases/' + y + '/district_road_safety.json); see data/source/crash_report_2024/README.md.' },
      rows: final.map(d => [d.name, d['crashProneZones' + y], d['simpleCrashes' + y], d['fatalCrashes' + y], d['totalCrashes' + y]]),
      total: null, totalSource: null
    };
  });

  // omissions: a district that has a whole-district row but no selected-zone row that year is omitted in the source, not zero
  for (const y of Object.keys(zones)) {
    const z = zones[y], w = whole[y];
    z.omitted = [];
    if (w && z.rows.length) {
      const have = new Set(z.rows.map(r => norm(r[0])));
      z.omitted = w.rows.map(r => r[0]).filter(n => !have.has(norm(n)));
    }
    const rowTotal = z.total && z.rows.length ? [0, 1, 2, 3].map(i => sumOf(z.rows.map(r => r.slice(1)), i)) : null;
    z.rowsMatchTotal = rowTotal ? rowTotal.every((v, i) => v === z.total[i]) : null;
  }
  for (const y of Object.keys(whole)) {
    const w = whole[y], rt = [0, 1, 2, 3].map(i => sumOf(w.rows.map(r => r.slice(1)), i));
    w.rowsMatchTotal = rt.every((v, i) => v === w.total[i]);
    w.rowsAddUp = w.rows.every(r => r[1] + r[2] + r[3] === r[4]);
    // where the printed table does not add up, say so cell by cell, as printed (no value is changed)
    const cols = ['fatal accidents', 'injury accidents', 'non-injury accidents', 'total accidents'];
    w.printedInconsistencies = [];
    w.rows.forEach(r => { const sum = r[1] + r[2] + r[3]; if (sum !== r[4]) w.printedInconsistencies.push(r[0] + ': the printed total is ' + r[4] + ', but its fatal, injury and non-injury figures add to ' + sum + '. So at least one printed figure in this row is a misprint.'); });
    rt.forEach((v, i) => { if (v !== w.total[i]) w.printedInconsistencies.push('The printed total row gives ' + w.total[i] + ' ' + cols[i] + ', but the district rows above add to ' + v + '.'); });
  }
  return { whole, zones };
}

module.exports = { build };
