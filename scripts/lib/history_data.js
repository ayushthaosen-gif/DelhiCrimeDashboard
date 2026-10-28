// Earlier district crime for Explore, 2011 to 2018: the counts exactly as printed for the reporting units of each year
// (data/historical_reporting/counts_2011_2018.json) with the display shapes of the districts that existed then
// (scripts/lib/historical_map_shapes.js). The data are counts only; they are never joined to today's 15 districts, their area or
// population. Station lists and evidence arrays stay in the source files; the page needs only labels, flags, values and shapes.
const fs = require('node:fs');
const path = require('node:path');
const shapesLib = require('./historical_map_shapes');

const MAP_KEY = { inferred_reference: '2014', reference_only: '2014', derived_reference: '2017' };

// The Delhi total as NCRB prints it. The historical release carries it for 2011 to 2015; 2016 to 2018 come from the Delhi UT series.
function citywide(y, row) {
  const own = y.citywide.values;
  if (Object.values(own).some(v => v != null)) return { values: own, scope: y.citywide.scope };
  return {
    values: {
      theft: row.theft, robbery: row.robbery, burglary_old_definition: row.burglary_old_head, criminal_trespass_burglary_revised_definition: row.criminal_trespass_burglary_revised_head, burglary: row.burglary,
      total_ipc: row.total_ipc_bns, total_sll: row.total_sll, total_crimes_against_women: row.total_crimes_against_women
    },
    scope: 'Delhi UT totals as printed in the NCRB State/UT-wise tables (data/releases/delhi_ut_series); not a sum of the districts shown'
  };
}

function build(root) {
  const counts = JSON.parse(fs.readFileSync(path.join(root, 'data/historical_reporting/counts_2011_2018.json'), 'utf8'));
  const shapes = shapesLib.buildShapes(root);
  const notes = shapesLib.notes(root);
  const ut = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root, 'data/releases/delhi_ut_series/delhi_ut_crime.json'), 'utf8')).map(r => [r.year, r]));
  const maps = {};
  for (const [key, list] of Object.entries(shapes.maps)) maps[key] = list.filter(f => f.properties.territorial).map(f => ({ name: f.properties.name, d: f.d }));
  const years = counts.years.map(y => {
    const mapKey = MAP_KEY[y.map.status];
    const names = new Set(maps[mapKey].map(m => m.name.toLowerCase()));
    const territorial = y.units.filter(u => u.territorial);
    for (const u of territorial) if (!names.has(u.label.toLowerCase())) throw new Error(y.year + ': no map shape for ' + u.label);
    const label = y.map.status === 'derived_reference' ? notes.derived : [y.map.status === 'reference_only' ? notes.reference2014 : notes.inferred, y.year === 2015 ? notes.inferred2015 : '', y.year === 2016 ? notes.inferred2016 : ''].filter(Boolean).join(' ');
    return {
      year: y.year, mapKey, mapStatus: y.map.status, mapNote: label, sourceLabel: y.sourceLabel, notes: y.notes, comparability: y.comparability || null,
      citywide: citywide(y, ut[y.year]),
      units: y.units.map(u => ({ label: u.label, territorial: !!u.territorial, values: u.values }))
    };
  });
  return { schemaVersion: '1.0.0', viewBox: shapes.viewBox, policy: counts.policy, maps, years };
}

module.exports = { build };
