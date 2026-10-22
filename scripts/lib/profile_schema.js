// The data contract for ward and district profiles. Every exported column is described here: what it is, its unit, where it comes from,
// which year it describes, how uncertain it is, and what a blank means. scripts/build_profiles.js refuses to write a column that is not
// described, and test/profiles.test.js refuses a description with no column. The same text feeds the "Why this place?" panel and the exports.

const UNCERTAINTY = {
  official_count: {
    label: 'Official count',
    meaning: 'A count published by an official body for a stated geography and year. It counts registered cases or reported crashes, not everything that happened.'
  },
  mapped_osm: {
    label: 'Mapped in OpenStreetMap',
    meaning: 'A count of features volunteers have mapped in OpenStreetMap. It is a lower bound: a zero or a low count can mean the area is not mapped, not that the facility is absent.'
  },
  approximate_position: {
    label: 'Depends on approximate positions',
    meaning: 'Depends on crash-zone positions placed by hand at landmark centres; the Traffic Police publish no coordinates. Each zone carries its own estimated accuracy (150 m to 5 km), so a zone can fall in the wrong ward.'
  },
  survey: {
    label: 'Survey, partial coverage',
    meaning: 'From a survey that did not cover every district. A blank means not surveyed, not zero.'
  },
  derived: {
    label: 'Derived here',
    meaning: 'Computed in this project from other fields by the rule stated in the field description. It inherits the uncertainty of its inputs.'
  },
  district_inherited: {
    label: 'District value copied to wards',
    meaning: 'Crime is published only per police district, so every ward in a district shows the same figure. It says nothing about differences between wards.'
  },
  geometry: {
    label: 'Boundary, not official',
    meaning: 'From the legacy 290-ward boundary file (DataMeet, before the 2022 delimitation). It is not an official or current boundary.'
  },
  identifier: { label: 'Identifier', meaning: 'A name or number used to identify the row.' }
};

const GENERAL_CANNOT_ESTABLISH = [
  'Why crashes happened, or that any facility here caused or would prevent them.',
  'Risk per person or per trip: there are no pedestrian or traffic counts, so counts are not rates of risk.',
  'That a place without mapped infrastructure has none: OpenStreetMap coverage is uneven.',
  'Crime by ward: crime is published only for the 15 police districts.',
  'Anything about the current 250 MCD wards: these profiles use the legacy 290-ward geography.',
  'A change over time for a ward or a named zone: boundaries, zone lists and mapping all change between years.',
  'Who is responsible for a location, or what should be built there. Field verification is needed before any intervention.'
];

const BY_CLASS_CANNOT = {
  approximate_position: 'Where exactly crashes happened, or that a crash-prone zone lies inside this ward rather than next to it.',
  mapped_osm: 'How much of the facility actually exists on the ground.',
  district_inherited: 'Whether this ward is better or worse than its neighbours in the same district.',
  survey: 'Anything about districts the survey did not cover.',
  official_count: 'The true level of crime or crashes: counts depend on reporting and registration.'
};

function field(id, label, unit, group, klass, source, year, nullMeaning, extra) {
  return Object.assign({ id: id, label: label, unit: unit, group: group, uncertainty: klass, source: source, dataYear: year, blankMeans: nullMeaning || 'Not applicable.' }, extra || {});
}

function build(ctx) {
  const osm = ctx.osmSnapshot, ward = 'Legacy 290-ward boundary file (DataMeet, CC-BY-SA 2.5 India)';
  const OSM = 'OpenStreetMap contributors (ODbL) via Overpass';
  const ZONES = 'Delhi Road Crash Report 2024 (Table 6.29), positions placed by hand (data/delhi_crash_prone_zones_2024_all_named_approx.geojson)';
  const dens = (id, label, per) => field(id + '_per_km2', label + ' per km²', per, 'infrastructure', 'derived', 'count divided by ward area', String(osm), 'Not applicable.');
  const wardFields = [
    field('ward_no', 'Ward number', '', 'identity', 'identifier', ward, 'legacy', 'One polygon has no number in the source and is labelled UNWARDED_1.'),
    field('ward_name', 'Ward name', '', 'identity', 'identifier', ward, 'legacy', 'Two wards share the name RAM NAGAR: use the ward number as the key.'),
    field('geography', 'Ward geography', '', 'identity', 'identifier', 'data/geography_registry.json', 'legacy', 'Always legacy_290_wards.'),
    field('assigned_district', 'Police district containing the ward centre', '', 'identity', 'derived', 'Ward bounding-box centre tested against the district boundaries', 'legacy', 'Blank if the centre falls outside every district.'),
    field('area_km2', 'Ward area', 'km²', 'identity', 'geometry', ward, 'legacy', 'Not applicable.'),
    field('crash_zones_2024', 'Crash-prone zones placed in the ward', 'zones', 'crash', 'approximate_position', ZONES, '2024', 'Zero means no zone position falls in the ward.'),
    field('crash_zones_without_printed_counts_2024', 'Of those zones, how many print no crash count', 'zones', 'crash', 'approximate_position', ZONES, '2024', 'Zero means every zone placed in the ward prints its counts. A zone not ranked in Table 6.29 appears only in the category lists and prints none.'),
    field('crash_zone_fatal_crashes_2024', 'Fatal crashes within those zones that print a count', 'crashes', 'crash', 'approximate_position', ZONES, '2024', 'Zero means no zone is placed in the ward. Blank means zones are placed there but none prints a count. Counts within zones only, not ward totals, and a lower bound where some zones print none.'),
    field('crash_zone_total_crashes_2024', 'All crashes within those zones', 'crashes', 'crash', 'approximate_position', ZONES, '2024', 'Zero means no zone is placed in the ward. Blank means zones are placed there but none prints a count. A lower bound where some zones print none.'),
    field('crash_zone_pedestrian_fatal_crashes_2024', 'Pedestrian fatal crashes within those zones', 'crashes', 'crash', 'approximate_position', ZONES, '2024', 'Zero means no zone is placed in the ward. Blank means no zone there prints a pedestrian count. A lower bound where some print none.'),
    field('crash_zone_names', 'Names of the crash-prone zones placed in the ward', '', 'crash', 'approximate_position', ZONES, '2024', 'No zone placed in the ward.'),
    field('high_injury_network', 'In the smallest set of wards holding half of 2024 zone fatal crashes', 'yes/no', 'crash', 'derived', 'Computed in scripts/build_ward_infra.js from crash_zone_fatal_crashes_2024', '2024', 'Not applicable.'),
    field('high_injury_network_rank', 'Rank within that set', 'rank', 'crash', 'derived', 'Same rule as above', '2024', 'Blank outside the set.'),
    field('bus_stops', 'Bus stops mapped', 'stops', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped.'),
    field('traffic_signals', 'Traffic signals mapped', 'signals', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped.'),
    field('pedestrian_crossings', 'Pedestrian crossings mapped', 'crossings', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped.'),
    field('pedestrian_overpasses', 'Pedestrian overpass groups mapped', 'groups', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped.'),
    field('footway_km', 'Footway length mapped', 'km', 'infrastructure', 'mapped_osm', OSM + '; segment midpoints assigned to wards', String(osm), 'Zero may mean unmapped. Sparse in Delhi; a low value mostly reflects mapping.'),
    field('street_lamps_mapped', 'Street lamps mapped', 'lamps', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped. This is not a streetlight survey.'),
    field('hospitals', 'Hospitals mapped', 'hospitals', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped.'),
    field('surveillance_points_mapped', 'Surveillance points mapped', 'points', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped; the points carry no video and are not a camera register.'),
    field('metro_gates_official', 'Metro gates (official DMRC list)', 'gates', 'infrastructure', 'official_count', 'Delhi Metro Rail Corporation gate locations via the Delhi Transport Stack (dataset 3, last updated by the publisher 2024-12-02); counts derived by this project (data/derived/metro_gates_official_2024.json)', '2024-12', 'Zero means no gate in the official list falls in the ward. The list was last updated on 2024-12-02 and has defects (see the derived file), so a newer or missing gate is not counted.'),
    field('police_stations', 'Police stations', 'stations', 'infrastructure', 'official_count', 'Delhi Police GSDL station list via a community mirror', 'list date not established', 'Zero means no station position falls in the ward.'),
    field('police_posts', 'Police posts mapped', 'posts', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped; posts are undercounted in some districts.'),
    dens('bus_stops', 'Bus stops', 'per km²'), dens('traffic_signals', 'Traffic signals', 'per km²'), dens('pedestrian_crossings', 'Pedestrian crossings', 'per km²'),
    dens('street_lamps_mapped', 'Street lamps mapped', 'per km²'), dens('hospitals', 'Hospitals', 'per km²'), dens('surveillance_points_mapped', 'Surveillance points mapped', 'per km²'),
    field('metro_gates_official_per_km2', 'Metro gates (official list) per km²', 'per km²', 'infrastructure', 'derived', 'count divided by ward area', '2024-12', 'Not applicable.'),
    field('footway_km_per_km2', 'Footway length per km²', 'km per km²', 'infrastructure', 'derived', 'footway_km divided by area_km2', String(osm), 'Not applicable.'),
    field('official_liquor_vends', 'Official liquor vends placed in the ward', 'vends', 'context', 'approximate_position', 'Official vend list, positions mostly approximate', 'list date not established', 'Zero means none placed in the ward.'),
    field('residential_pct', 'Residential land cover', '% of mapped area', 'land_use', 'mapped_osm', 'OpenStreetMap land use clipped to the ward', String(osm), 'Not applicable.'),
    field('commercial_pct', 'Commercial land cover', '% of mapped area', 'land_use', 'mapped_osm', 'OpenStreetMap land use clipped to the ward', String(osm), 'Not applicable.'),
    field('industrial_pct', 'Industrial land cover', '% of mapped area', 'land_use', 'mapped_osm', 'OpenStreetMap land use clipped to the ward', String(osm), 'Not applicable.'),
    field('institutional_pct', 'Institutional land cover', '% of mapped area', 'land_use', 'mapped_osm', 'OpenStreetMap land use clipped to the ward', String(osm), 'Not applicable.'),
    field('green_open_pct', 'Green and open land cover', '% of mapped area', 'land_use', 'mapped_osm', 'OpenStreetMap land use clipped to the ward', String(osm), 'Not applicable.'),
    field('landuse_mapped_pct', 'Share of the ward with any land use mapped', '% of ward area', 'coverage', 'mapped_osm', 'OpenStreetMap land use clipped to the ward', String(osm), 'Not applicable. A low value means the land-use shares describe little of the ward.'),
    field('low_landuse_coverage', 'Land use mapped for under a quarter of the ward', 'yes/no', 'coverage', 'derived', 'landuse_mapped_pct below 25', String(osm), 'Not applicable. The land-use shares then describe only a small part of the ward; treat other OpenStreetMap counts with the same caution.'),
    field('no_mapped_infrastructure', 'No bus stop, signal, crossing, hospital or footway mapped', 'yes/no', 'coverage', 'derived', 'All of those counts are zero', String(osm), 'Not applicable. Most likely an unmapped ward.'),
    field('district_ipc_density_2024_per_km2', 'IPC/BNS cases per km² in the containing district', 'cases per km²', 'district_context', 'district_inherited', 'NCRB Crime in India, district-wise table 2024', '2024', 'Blank if the ward has no assigned district. Same for every ward in the district.'),
    field('district_crime_against_women_density_2024_per_km2', 'Crimes against women per km² in the containing district', 'cases per km²', 'district_context', 'district_inherited', 'NCRB Crime in India, district-wise table 2024', '2024', 'Blank if the ward has no assigned district. Same for every ward in the district.')
  ];

  const CRIME = 'NCRB Crime in India, district-wise tables';
  const ROAD = 'Delhi Road Crash Reports (selected-zone tables by district)';
  const dField = (id, label, unit, group, klass, source, year, blank) => field(id, label, unit, group, klass, source, year, blank);
  const districtFields = [
    dField('district', 'Police district', '', 'identity', 'identifier', 'Delhi Police district list', '2024'),
    dField('area_km2', 'Area', 'km²', 'identity', 'geometry', 'Simplified district boundaries (about 165 m tolerance), not survey-grade', '2024'),
    dField('population', 'Population (approximate)', 'people', 'identity', 'derived', 'Approximate district population used by this project; excludes daytime visitors', 'approximate'),
    dField('theft_2024', 'Theft cases registered', 'cases', 'crime', 'official_count', CRIME, '2024'),
    dField('robbery_2024', 'Robbery cases registered', 'cases', 'crime', 'official_count', CRIME, '2024'),
    dField('burglary_2024', 'Burglary cases registered', 'cases', 'crime', 'official_count', CRIME, '2024'),
    dField('total_ipc_bns_2024', 'All IPC/BNS cases registered', 'cases', 'crime', 'official_count', CRIME, '2024'),
    dField('crime_against_women_2024', 'Crimes against women registered', 'cases', 'crime', 'official_count', CRIME, '2024'),
    dField('total_sll_2024', 'Special and Local Laws cases registered', 'cases', 'crime', 'official_count', CRIME, '2024'),
    dField('total_ipc_2023', 'All IPC cases registered', 'cases', 'crime', 'official_count', CRIME, '2023', 'Not reported.'),
    dField('crime_comparison_2023_2024', 'Comparability of 2023 and 2024 crime counts', '', 'crime', 'derived', 'data/continuity.json', '2023 to 2024', 'Not applicable.'),
    dField('crashes_in_zones_2024', 'Crashes within crash-prone zones', 'crashes', 'road', 'official_count', ROAD, '2024', 'Counts within zones only, not all crashes in the district.'),
    dField('fatal_crashes_in_zones_2024', 'Fatal crashes within crash-prone zones', 'crashes', 'road', 'official_count', ROAD, '2024', 'Counts within zones only.'),
    dField('crash_prone_zones_2024', 'Crash-prone zones', 'zones', 'road', 'official_count', ROAD, '2024', 'Zone lists change every year.'),
    dField('crashes_in_zones_2023', 'Crashes within crash-prone zones', 'crashes', 'road', 'official_count', ROAD, '2023', 'Counts within zones only.'),
    dField('fatal_crashes_in_zones_2023', 'Fatal crashes within crash-prone zones', 'crashes', 'road', 'official_count', ROAD, '2023', 'Counts within zones only.'),
    dField('persons_killed_2024', 'Persons killed in road crashes', 'people', 'road', 'official_count', 'Delhi Road Crash Report 2024, district table', '2024', 'Whole district, not only zones.'),
    dField('persons_killed_2023', 'Persons killed in road crashes', 'people', 'road', 'official_count', 'Delhi Road Crash Report 2023, district table', '2023', 'Whole district, not only zones.'),
    dField('road_comparison_2023_2024', 'Comparability of 2023 and 2024 zone crash counts', '', 'road', 'derived', 'data/continuity.json', '2023 to 2024', 'Not applicable.'),
    dField('streetlights_per_km2', 'Streetlights per km² (survey)', 'per km²', 'infrastructure', 'survey', 'PAPL streetlight and underpass survey via Delhi Open Transit Data', 'survey period', 'Not surveyed (6 districts), not zero.'),
    dField('underpasses', 'Underpasses (survey)', 'underpasses', 'infrastructure', 'survey', 'PAPL survey', 'survey period', 'Not surveyed (6 districts), not zero.'),
    dField('papl_surveyed', 'Covered by the PAPL survey', 'yes/no', 'infrastructure', 'derived', 'The nine surveyed districts', 'survey period', 'Not applicable.'),
    dField('police_stations', 'Police stations', 'stations', 'infrastructure', 'official_count', 'Delhi Police GSDL list via a community mirror', 'list date not established', ''),
    dField('police_posts', 'Police posts mapped', 'posts', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Undercounted in Outer.'),
    dField('metro_gates', 'Metro gates mapped', 'gates', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped. Differs widely from the official list in several districts (see metro_gates_official).'),
    dField('metro_gates_official', 'Metro gates (official DMRC list)', 'gates', 'infrastructure', 'official_count', 'Delhi Metro Rail Corporation gate locations via the Delhi Transport Stack (dataset 3, last updated by the publisher 2024-12-02); counts derived by this project (data/derived/metro_gates_official_2024.json)', '2024-12', 'Zero means no gate in the official list falls in the district.'),
    dField('bus_stops', 'Bus stops mapped', 'stops', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped.'),
    dField('surveillance_points_mapped', 'Surveillance points mapped', 'points', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped; no video, not a register.'),
    dField('pedestrian_overpasses', 'Pedestrian overpasses mapped', 'overpasses', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Zero may mean unmapped.'),
    dField('footway_km', 'Footway length mapped', 'km', 'infrastructure', 'mapped_osm', OSM, String(osm), 'Sparse in Delhi; a low value mostly reflects mapping.'),
    dField('footway_km_per_km2', 'Footway length per km²', 'km per km²', 'infrastructure', 'derived', 'footway_km divided by area_km2', String(osm), '')
  ];
  return { uncertaintyClasses: UNCERTAINTY, cannotEstablish: { general: GENERAL_CANNOT_ESTABLISH, byClass: BY_CLASS_CANNOT }, wardFields: wardFields, districtFields: districtFields };
}

module.exports = { build, UNCERTAINTY, GENERAL_CANNOT_ESTABLISH, BY_CLASS_CANNOT };
