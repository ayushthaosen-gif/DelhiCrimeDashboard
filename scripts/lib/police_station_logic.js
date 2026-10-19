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
module.exports = { normalize, key, identities, match };
