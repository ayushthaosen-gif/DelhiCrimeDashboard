const RULE_VERSION = 'irad-phase1-v1';
function fail(row, message) { throw new Error(`${row}: ${message}`); }
function validYear(value) { return /^\d{4}$/.test(value) && Number(value) >= 1000; }
function iso(value, row) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) fail(row, `invalid ISO date ${value}`);
}
function period(r, type, row) {
  const station = type === 'station';
  const from = r[station ? 'period_from' : 'report_period_from'];
  const to = r[station ? 'period_to' : 'report_period_to'];
  const year = r[station ? 'report_year' : 'year'];
  if (year && !validYear(year)) fail(row, `malformed year ${year}`);
  if (!station && (!validYear(year) || !/^\d+$/.test(r.month) || Number(r.month) < 1 || Number(r.month) > 12)) fail(row, 'invalid monthly year/month');
  if (Boolean(from) !== Boolean(to)) fail(row, 'one-sided date period');
  if (from) {
    iso(from, row); iso(to, row);
    if (from > to) fail(row, 'reversed date period');
    if (year && (from.slice(0, 4) !== year || to.slice(0, 4) !== year)) fail(row, 'year inconsistent with dates');
    if (!station) {
      const month = `${year}-${r.month.padStart(2, '0')}`;
      if (month < from.slice(0, 7) || month > to.slice(0, 7)) fail(row, 'month outside stated period');
    }
  } else if (year && r.period_inferred !== 'true') fail(row, 'year fallback requires period_inferred=true');
  return { from, to, year, inferred: !from || r.period_inferred === 'true' };
}
function disposition(r, type, row = 'row') {
  const p = period(r, type, row);
  if (type === 'station' && p.from && p.from.slice(0, 4) !== p.to.slice(0, 4)) return 'multi_year_window';
  const year = type === 'month_wise' ? p.year : p.from ? p.from.slice(0, 4) : p.year;
  if (!year) return 'undated_no_year';
  return ['2025', '2026'].includes(year) ? `release_${year}` : 'historical_single_year';
}
function sourceIdentity(rows, inventory, links) {
  const byName = new Map(inventory.map(item => [item.file, item]));
  for (const [i, r] of rows.entries()) {
    const a = byName.get(r.source_file), b = links[r.source_file];
    if (!a || !b) fail(`source row ${i + 2}`, `missing metadata for ${r.source_file}`);
    if (a.sha256 !== r.sha256 || b.sha256 !== r.sha256) fail(`source row ${i + 2}`, `SHA-256 mismatch for ${r.source_file}`);
    for (const key of ['public_url', 'page_url', 'link_text', 'retrieved_on']) if (!b[key]) fail(r.source_file, `missing ${key}`);
  }
}
function monthEnd(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function coverageMatrix(year, monthly, station, districts) {
  const expected = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  return districts.map(district => {
    const entry = { district, latestPeriodEnd: null };
    for (const [type, rows] of [['month_wise', monthly], ['station', station]]) {
      const selected = rows.filter(r => r.district === district);
      const reports = [], seen = new Set(), covered = new Set(), partial = new Set(), windows = [];
      for (const r of selected) {
        const p = period(r, type, r.source_file);
        const scope = r.scope || 'unspecified', dateBasis = r.date_basis || 'unspecified';
        const key = JSON.stringify([r.source_file, p.from, p.to, p.inferred, scope, dateBasis, r.schema]);
        if (!seen.has(key)) {
          seen.add(key);
          const report = { sourceFile: r.source_file, periodFrom: p.from || null, periodTo: p.to || null, periodInferred: p.inferred, scope, dateBasis, schema: r.schema };
          reports.push(report);
          if (p.to && (!entry.latestPeriodEnd || p.to > entry.latestPeriodEnd)) entry.latestPeriodEnd = p.to;
          if (type === 'station' && p.from && !p.inferred && !(p.from === p.from.slice(0, 7) + '-01' && p.to === monthEnd(p.from.slice(0, 7)))) {
            windows.push({ sourceFile: r.source_file, periodFrom: p.from, periodTo: p.to, kind: p.from === `${year}-01-01` && p.to === `${year}-12-31` ? 'annual' : 'cumulative' });
          }
        }
        if (p.inferred || !p.from) continue;
        if (type === 'month_wise') {
          const m = `${r.year}-${r.month.padStart(2, '0')}`;
          if (p.from <= m + '-01' && p.to >= monthEnd(m)) covered.add(m); else partial.add(m);
        } else if (p.from.slice(0, 7) === p.to.slice(0, 7)) {
          const m = p.from.slice(0, 7);
          if (p.from === m + '-01' && p.to === monthEnd(m)) covered.add(m); else partial.add(m);
        } // Multi-month windows never provide independent monthly observations.
      }
      const bases = new Set(reports.filter(r => !r.periodInferred).map(r => r.dateBasis));
      const scopes = new Set(reports.filter(r => !r.periodInferred).map(r => r.scope));
      entry[type] = { expectedMonths: expected, coveredMonths: [...covered].sort(), partialEndpoints: [...partial].sort(), gaps: expected.filter(m => !covered.has(m) && !partial.has(m)), partial: !(expected.every(m => covered.has(m)) && bases.size === 1 && scopes.size === 1), reports, windows };
    }
    return entry;
  });
}
module.exports = { RULE_VERSION, validYear, period, disposition, sourceIdentity, coverageMatrix };
