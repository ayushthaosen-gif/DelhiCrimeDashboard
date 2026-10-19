const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseCsv, canonicalBytes, sha256 } = require('../scripts/lib/release_utils');
const { normalize, key, match, identities } = require('../scripts/lib/police_station_logic');
const ROOT = path.resolve(__dirname, '..');
const csv = file => parseCsv(canonicalBytes(path.join(ROOT, file)).toString()).rows;
const json = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const fixtures = require('./fixtures/crosswalk_logic.json');
test('identity ambiguity differs from evidenced aliases and repeated printed occurrences', () => {
  assert.equal(match('Shared Station', fixtures.authority).method, 'ambiguous');
  assert.equal(match('ALPHA-STATION', fixtures.authority).method, 'exact_normalized');
  assert.equal(match('Alpha Station', fixtures.authority).method, 'exact_normalized');
  assert.equal(identities(fixtures.authority, 'Alpha Station').length, 1);
  assert.equal(match('Alfa Station', fixtures.authority, fixtures.variant).method, 'documented_variant');
  assert.equal(match('Unknown', fixtures.authority).method, 'unmapped');
});
test('all source pairs, decisions, unresolved policy and draft manual evidence are preserved', () => {
  const source = csv('data/derived/irad_monthly/irad_station_by_period.csv');
  const rows = csv('data/reference/police_station_crosswalk.csv');
  const authority = csv('data/reference/delhi_police_manual_1_2026_stations.csv');
  const decisions = csv('data/reference/police_station_decisions.csv');
  assert.equal(rows.length, 174); assert.equal(new Set(rows.map(key)).size, rows.length);
  assert.deepEqual([...new Set(source.map(key))].sort(), rows.map(key).sort());
  for (const row of authority) { assert.equal(row.review_status, 'draft'); assert.equal(row.reviewed_by, ''); assert.equal(row.reviewed_on, ''); }
  const metadata = json('data/reference/delhi_police_manual_1_2026_stations.source.json');
  assert.equal(metadata.sha256, sha256(path.join(ROOT, metadata.source)));
  assert.ok(authority.some(r => r.canonical_name === 'ANAND PARBAT' && r.printed_page === '21'));
  assert.ok(authority.some(r => r.canonical_name === 'ANAND PARBAT' && r.printed_page === '203'));
  assert.equal(authority.filter(r => r.evidence_note.startsWith('Territorial')).length, 179);
  assert.equal(authority.filter(r => r.evidence_note.startsWith('Non-territorial')).length, 49);
  const canonicalByIdentity = new Map();
  for (const row of rows) {
    assert.equal(row.effective_date_basis, 'post-period structural reference (Manual updated 2026-05-22)');
    assert.ok(['true', 'false'].includes(row.needs_review));
    assert.ok(['high','medium','low',''].includes(row.mapping_confidence));
    assert.ok(['exact_normalized','documented_variant','specialised_unit','ambiguous','unmapped'].includes(row.mapping_method));
    if (['ambiguous','unmapped','specialised_unit'].includes(row.mapping_method)) { assert.equal(row.police_district, ''); assert.equal(row.needs_review, 'true'); }
    else {
      assert.ok(row.police_district);
      const decision = decisions.find(r => key(r) === key(row));
      const matched = match(row.source_station_label, authority, decision);
      assert.equal(matched.authority.police_district, row.police_district);
      const id = JSON.stringify([normalize(matched.authority.canonical_name), row.police_district]);
      if (canonicalByIdentity.has(id)) assert.equal(row.station_canonical_name, canonicalByIdentity.get(id), 'Aliases must share a canonical display name');
      canonicalByIdentity.set(id, row.station_canonical_name);
      assert.ok(authority.some(a => a.printed_page === row.manual_page && a.police_district === row.police_district && normalize(a.canonical_name) === normalize(matched.authority.canonical_name)));
    }
    if (row.mapping_method !== 'exact_normalized') assert.ok(decisions.some(r => key(r) === key(row)), 'missing nontrivial decision');
  }
  for (const name of ['Madipur','Mianwali Nagar','PASCHIM VIHAR','MACT Cell NW']) { const row = rows.find(r => r.source_station_label === name); assert.equal(row.police_district, ''); assert.equal(row.needs_review, 'true'); }
  for (const name of ['Ambedkar Nagar','Chitranjan Park','Greater Kailash','Sangam Vihar']) assert.match(rows.find(r => r.source_reporting_district === 'South East' && r.source_station_label === name).notes, /Historical.*not proof of historical jurisdiction/);
});
test('every legacy raw-label match preserves canonical name, police district and evidence page', () => {
  const rows = csv('data/reference/police_station_crosswalk.csv');
  const legacy = csv('tools/pipeline_2025/config/police_station_crosswalk.csv');
  assert.equal(legacy.length, 46);
  for (const old of legacy) {
    const matched = rows.filter(r => normalize(r.source_station_label) === normalize(old.police_station_raw));
    assert.ok(matched.length, old.police_station_raw);
    for (const r of matched) { assert.equal(r.station_canonical_name, old.police_station_normalized); assert.equal(r.police_district, old.police_district_2025); assert.equal(r.manual_page, old.evidence_page); }
  }
});
test('crosswalk coverage includes denominators, per-district counts and source-table mapped shares', () => {
  const coverage = json('data/reference/police_station_crosswalk_coverage.json');
  const rows = csv('data/reference/police_station_crosswalk.csv');
  assert.match(coverage.measure, /overlapping annual and monthly windows/);
  assert.match(coverage.measure, /not unique stations, incidents or geographic completeness/);
  assert.equal(coverage.overall.labelsTotal, 174);
  for (const [district, counts] of [['all', coverage.overall], ...Object.entries(coverage.byReportingDistrict)]) {
    const chosen = district === 'all' ? rows : rows.filter(r => r.source_reporting_district === district);
    assert.equal(counts.labelsTotal, chosen.length);
    assert.equal(counts.mapped, chosen.filter(r => r.police_district).length);
    assert.equal(counts.mapped + counts.specialised + counts.ambiguous + counts.unmapped, counts.labelsTotal);
  }
  for (const year of [2025, 2026]) {
    const source = csv(`data/releases/${year}/irad/irad_station_by_period_${year}.csv`);
    const c = coverage.releaseCoverage[year];
    for (const [district, measure] of [['all', c.overall], ...Object.entries(c.byReportingDistrict)]) {
      const chosen = district === 'all' ? source : source.filter(r => r.district === district);
      const mapped = chosen.filter(r => rows.find(c => key(r) === key(c)).police_district).length;
      assert.equal(measure.totalSourceTableRows, chosen.length); assert.equal(measure.mappedSourceTableRows, mapped); assert.equal(measure.share, mapped / chosen.length);
    }
  }
});
