const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parseCsv, canonicalBytes, sha256, toCsv } = require('./lib/release_utils');
const { normalize, key, match, checkReview, needsReview } = require('./lib/police_station_logic');
const ROOT = path.resolve(__dirname, '..');
const REFERENCE = 'data/reference/';
const csv = file => parseCsv(canonicalBytes(path.join(ROOT, file)).toString()).rows;
const json = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const write = (file, content) => fs.writeFileSync(path.join(ROOT, file), content);
function build() {
  const source = csv('data/derived/irad_monthly/irad_station_by_period.csv');
  const authority = csv(REFERENCE + 'delhi_police_manual_1_2026_stations.csv');
  const metadata = json(REFERENCE + 'delhi_police_manual_1_2026_stations.source.json');
  assert.equal(sha256(path.join(ROOT, metadata.source)), metadata.sha256, 'Manual source SHA-256 mismatch');
  for (const row of authority) {
    assert.ok(Number(row.printed_page) > 0 && Number(row.pdf_page_index) === Number(row.printed_page) - 1);
    checkReview(row);
  }
  const decisions = csv(REFERENCE + 'police_station_decisions.csv');
  const byDecision = new Map(decisions.map(r => [key(r), r]));
  assert.equal(byDecision.size, decisions.length, 'Duplicate decision pair');
  const legacy = csv('tools/pipeline_2025/config/police_station_crosswalk.csv');
  const displayNames = new Map();
  for (const old of legacy) {
    const matchingSource = source.find(r => normalize(r.police_station) === normalize(old.police_station_raw));
    assert.ok(matchingSource, 'Legacy label absent: ' + old.police_station_raw);
    const a = match(matchingSource.police_station, authority, byDecision.get(key(matchingSource))).authority;
    assert.ok(a, 'Legacy label unresolved: ' + old.police_station_raw);
    const id = JSON.stringify([normalize(a.canonical_name), a.police_district]);
    if (displayNames.has(id)) assert.equal(displayNames.get(id), old.police_station_normalized, 'Conflicting canonical display names');
    displayNames.set(id, old.police_station_normalized);
  }
  const pairs = [...new Map(source.map(r => [key(r), r])).values()].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  assert.equal(pairs.length, 174);
  for (const decision of decisions) assert.ok(pairs.some(r => key(r) === key(decision)), 'Extra decision: ' + key(decision));
  const rows = pairs.map(r => {
    const decision = byDecision.get(key(r)), mapping = match(r.police_station, authority, decision), a = mapping.authority;
    const compatible = legacy.filter(l => normalize(l.police_station_raw) === normalize(r.police_station));
    if (compatible.length > 1) assert.ok(compatible.every(l => l.police_station_normalized === compatible[0].police_station_normalized && l.police_district_2025 === compatible[0].police_district_2025 && l.evidence_page === compatible[0].evidence_page), 'Conflicting legacy rows');
    const old = compatible[0];
    if (old) {
      assert.ok(a, 'Legacy mapped row became unresolved: ' + r.police_station);
      assert.equal(a.police_district, old.police_district_2025, 'Legacy police district mismatch');
      assert.ok(authority.some(x => normalize(x.canonical_name) === normalize(a.canonical_name) && x.police_district === a.police_district && x.printed_page === old.evidence_page), 'Legacy page not in authority extract');
    }
    let notes = decision?.reviewer_note || (a && a.review_status === 'reviewed' ? 'Unique normalized territorial roster identity; roster row reviewed by ' + a.reviewed_by + ' on ' + a.reviewed_on + '.' : 'Unique normalized territorial roster identity; evidence extract is draft pending human verification.');
    if (r.district === 'South East' && ['AMBEDKARNAGAR', 'CHITRANJANPARK', 'GREATERKAILASH', 'SANGAMVIHAR'].map(x => x.toLowerCase()).includes(normalize(r.police_station))) notes += ' Historical South East 2022-2024 reporting label; post-period Manual assignment is not proof of historical jurisdiction.';
    if (!a) notes += ' Unresolved/non-territorial: police_district deliberately empty.';
    return { station_canonical_name: a ? displayNames.get(JSON.stringify([normalize(a.canonical_name), a.police_district])) || a.canonical_name : '', source_station_label: r.police_station, source_reporting_district: r.district, police_district: a?.police_district || '', subdivision: a?.subdivision || '', manual_page: old?.evidence_page || a?.printed_page || decision?.evidence_page || 'no_supporting_entry_found', effective_date_basis: 'post-period structural reference (Manual updated 2026-05-22)', mapping_confidence: a ? mapping.method === 'exact_normalized' ? 'high' : 'medium' : '', mapping_method: mapping.method, needs_review: String(needsReview(mapping.method, a)), notes };
  });
  write(REFERENCE + 'police_station_crosswalk.csv', toCsv(Object.keys(rows[0]), rows));
  function counts(part) {
    const mapped = part.filter(r => r.police_district).length;
    return { labelsTotal: part.length, mapped, specialised: part.filter(r => r.mapping_method === 'specialised_unit').length, ambiguous: part.filter(r => r.mapping_method === 'ambiguous').length, unmapped: part.filter(r => r.mapping_method === 'unmapped').length };
  }
  const byKey = new Map(rows.map(r => [key(r), r]));
  const releaseCoverage = {};
  for (const year of [2025, 2026]) {
    const selected = csv(`data/releases/${year}/irad/irad_station_by_period_${year}.csv`);
    const denominator = list => { const mapped = list.filter(r => byKey.get(key(r))?.police_district).length; return { mappedSourceTableRows: mapped, totalSourceTableRows: list.length, share: list.length ? mapped / list.length : null }; };
    releaseCoverage[year] = { overall: denominator(selected), byReportingDistrict: Object.fromEntries([...new Set(selected.map(r => r.district))].sort().map(d => [d, denominator(selected.filter(r => r.district === d))])) };
  }
  const states = new Set(authority.map(r => r.review_status)), reviewStatus = states.size === 1 ? [...states][0] : 'partial';
  const inputs = ['data/derived/irad_monthly/irad_station_by_period.csv', REFERENCE + 'delhi_police_manual_1_2026_stations.csv', REFERENCE + 'delhi_police_manual_1_2026_stations.source.json', REFERENCE + 'police_station_decisions.csv', 'tools/pipeline_2025/config/police_station_crosswalk.csv'];
  const coverage = { schemaVersion: '1.0.0', generatedAt: null, releaseMetadataDate: '2026-10-19', releaseStatus: 'staged', productionReady: false, evidenceReviewStatus: reviewStatus, identityPolicy: metadata.identityPolicy, measure: 'Source-table rows, which include overlapping annual and monthly windows; not unique stations, incidents or geographic completeness.', overall: counts(rows), byReportingDistrict: Object.fromEntries([...new Set(rows.map(r => r.source_reporting_district))].sort().map(d => [d, counts(rows.filter(r => r.source_reporting_district === d))])), releaseCoverage, legacyCompatibility: { rows: legacy.length, matchingRule: 'Normalize each legacy raw label and join to all matching source labels, without inventing a reporting district. Preserve canonical display name, police district and evidence page on every matched pair.', matches: legacy.map(l => { const matching = rows.filter(r => normalize(r.source_station_label) === normalize(l.police_station_raw)); assert.ok(matching.length, 'Legacy raw label absent from source: ' + l.police_station_raw); return { legacyRawLabel: l.police_station_raw, matchedPairs: matching.map(r => [r.source_reporting_district, r.source_station_label]) }; }) }, derivedFrom: inputs.map(file => ({ path: file, sha256: sha256(path.join(ROOT, file)), selectionRuleVersion: 'police-station-phase1-v1' })) };
  write(REFERENCE + 'police_station_crosswalk_coverage.json', JSON.stringify(coverage, null, 2) + '\n');
  console.log('Generated staged crosswalk: ' + JSON.stringify(coverage.overall));
}
if (require.main === module) build();
module.exports = { build };
