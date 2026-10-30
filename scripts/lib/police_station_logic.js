const normalize = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const key = row => JSON.stringify([row.district ?? row.source_reporting_district, row.police_station ?? row.source_station_label]);
// Repeated printed occurrences of the same name AND district are evidence for one
// identity (owner clarification). The same name in different districts is ambiguous.
function identities(authority, name) {
  const unique = new Map();
  for (const r of authority.filter(r => normalize(r.canonical_name) === normalize(name))) {
    const id = JSON.stringify([normalize(r.canonical_name), r.police_district]);
    if (!unique.has(id) || r.evidence_note.startsWith('Territorial')) unique.set(id, r);
  }
  return [...unique.values()];
}
function match(label, authority, decision) {
  if (decision && ['specialised_unit', 'ambiguous', 'unmapped'].includes(decision.decision)) return { method: decision.decision, authority: null };
  const matches = identities(authority, decision?.canonical_name || label);
  if (matches.length > 1) return { method: 'ambiguous', authority: null };
  if (!matches.length) return { method: 'unmapped', authority: null };
  return { method: decision ? 'documented_variant' : 'exact_normalized', authority: matches[0] };
}
// Review state of an evidence row from the Manual extract. "draft" rows carry no reviewer; "reviewed" rows name who reviewed them and when
// (an ISO date). Anything else is an error, so a human review can be recorded in the CSV without breaking the build.
function checkReview(row) {
  const status = row.review_status, who = (row.reviewed_by || '').trim(), on = row.reviewed_on || '';
  if (status === 'draft') { if (who || on) throw new Error('A draft row must have no reviewer or review date: ' + row.canonical_name); }
  else if (status === 'reviewed') { if (!who || !/^\d{4}-\d{2}-\d{2}$/.test(on) || Number.isNaN(Date.parse(on))) throw new Error('A reviewed row needs reviewed_by and a reviewed_on date (YYYY-MM-DD): ' + row.canonical_name); }
  else throw new Error('review_status must be draft or reviewed, not "' + status + '": ' + row.canonical_name);
  return status;
}
// A crosswalk row still needs review unless it is an exact normalised match to a roster row that a human has reviewed. Documented variants,
// ambiguous, unmapped and specialised labels are judgements and always stay flagged.
function needsReview(method, authorityRow) { return !(method === 'exact_normalized' && authorityRow && authorityRow.review_status === 'reviewed'); }
module.exports = { normalize, key, identities, match, checkReview, needsReview };
