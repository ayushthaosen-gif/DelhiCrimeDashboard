// Shapes the repository's data files into the three objects the redesigned site reads in the browser:
//   DELHI  districts for the map pages: outline path, area, population, figures by year, infrastructure
//          (comparability between years is decided in the browser by the same functions the tests run, from CONTINUITY)
//   SITE   citywide road trends, victims by mode of travel, enforcement, series status, continuity rules
//   ROADS  the 2023 crash-prone zone list and the roads with the most zones
// Nothing here invents a number: a figure the source does not hold stays null and is never turned into zero.

const fs = require('fs');
const roadHistory = require('./road_history');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const CRIME = ['theft', 'robbery', 'burglary', 'totalIPC', 'crimeAgainstWomen', 'totalSLL'];
const CRIME_YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const ROAD = ['totalCrashes', 'fatalCrashes', 'personsKilled', 'crashProneZones'];

// How the field for a measure and year is named in data/dashboard_final.json.
function fieldFor(key, year) {
  if (year === 2023) return key;
  return key + year;
}

function crimeValue(d, key, year) {
  const v = d[fieldFor(key, year)];
  if (v == null || typeof v !== 'number') return null;
  // 2016 to 2021 carry a coverage flag; anything but "reported" means the district has no figure that year.
  if (year >= 2016 && year <= 2021) {
    const flag = key === 'theft' || key === 'robbery' || key === 'burglary' ? d['coverage' + year] : d['coverageTotalIPC' + year];
    if (flag && flag !== 'reported') return null;
  }
  return v;
}

function roadValue(d, key, year) {
  const v = d[key + year];
  return typeof v === 'number' ? v : null;
}

// 2022 Delhi Road Crash Report (Tables 6.43, 6.41, 6.45), in data/releases/road_crash_report_2022/. The 2022 report prints the same
// 15 district names as the police districts, with the printed hyphen-less spellings for the compound names.
const R22 = 'data/releases/road_crash_report_2022/';
const NAME22 = { 'North East': 'North-East', 'North West': 'North-West', 'South East': 'South-East', 'South West': 'South-West' };
function zones2022ByDistrict() {
  const out = {};
  read(R22 + 'district_selected_zones.json').forEach(r => { out[NAME22[r.reporting_unit_as_printed] || r.reporting_unit_as_printed] = r; });
  return out;
}

function buildDelhi(continuity) {
  const data = read('data/dashboard_final.json');
  const z22 = zones2022ByDistrict();
  data.districts.forEach(d => { if (!z22[d.name]) throw new Error('2022 selected-zone table has no row for ' + d.name); });
  const districts = data.districts.map(d => {
    const s = {};
    CRIME.forEach(key => {
      s[key] = {};
      CRIME_YEARS.forEach(y => {
        const v = crimeValue(d, key, y);
        s[key][y] = v;
      });
    });
    ROAD.forEach(key => {
      s[key] = {};
      [2023, 2024].forEach(y => { s[key][y] = roadValue(d, key, y); });
    });
    // 2022: selected-zone counts only. People killed is not in the 2022 tables, so it stays null (never zero).
    const r22 = z22[d.name];
    s.totalCrashes[2022] = r22.total_crashes; s.fatalCrashes[2022] = r22.fatal_crashes; s.crashProneZones[2022] = r22.crash_prone_zones; s.personsKilled[2022] = null;
    return {
      name: d.name,
      path: d.path,
      cx: d.cx,
      cy: d.cy,
      area: d.areaSqKm,
      pop: d.population,
      s,
      infra: {
        lights: d.lightDensityPerKm2,
        underpasses: d.underpasses,
        police: d.policeStations,
        posts: d.chowkiPosts,
        metro: d.metroGates,
        cctv: d.surveillanceCameras,
        bus: d.busStops,
        overbridges: d.pedestrianOverpasses
      }
    };
  });
  return { viewBox: data.viewBox, districts };
}

function buildSite(continuity) {
  const trendsFile = read('data/road_safety_trends.json');
  const extra = read('data/road_safety_extra_2023_2024.json');
  const status = read('data/series_status.json');
  const trends = trendsFile.trends.map(r => ({ year: r.year, crashes: r.crashes, fatalCrashes: r.fatalCrashes, killed: r.fatalities }));
  const victims = {};
  trendsFile.victims.forEach(v => {
    victims[v.year] = {
      pedestrian: v.pedestrianKilled, twoWheeler: v.twoWheelerKilled, cyclist: v.cyclistKilled, car: v.carKilled, bus: v.busPassengerKilled,
      slowMoving: v.slowMovingKilled, animal: v.animalDrivenKilled, other: v.otherKilled, total: v.totalKilled
    };
  });
  // 2011 to 2018 (data/releases/road_victims_by_mode_2004_2018/): the older reports' own categories, kept apart from the 2019 to 2024 series
  // (the Overview and its sparkline keep using 2019 to 2024 only); the Road safety page merges them and says where each year comes from.
  const victimsEarly = {};
  read('data/releases/road_victims_by_mode_2004_2018/victims_by_mode.json').filter(r => r.year >= 2011).forEach(r => {
    victimsEarly[r.year] = {
      pedestrian: r.pedestrians_killed, twoWheeler: r.scooter_motorcycle_riders_killed, cyclist: r.cyclists_killed, car: r.car_occupants_killed, bus: r.bus_passengers_killed,
      slowMoving: r.slow_moving_vehicles_killed, animal: r.animal_driven_vehicle_drivers_killed, other: r.other_drivers_killed, total: r.total_killed
    };
  });
  const enforcement = {};
  Object.keys(extra.enforcement).forEach(y => {
    const e = extra.enforcement[y];
    enforcement[y] = {
      hitAndRunFatal: e.hitAndRunFatalCrashes, hitAndRunShare: e.hitAndRunShareOfFatalPercent, drinkDriving: e.drinkingDrivingProsecutions,
      rlvd: e.rlvdCameraSystems, rlvdJunctions: e.rlvdJunctions, osvd: e.osvdCameraSystems, osvdLocations: e.osvdLocations, overspeed: e.overspeedNotices
    };
  });
  const series = status.series.map(s => ({
    name: s.name,
    latest: s.latest_reference_period,
    status: String(s.status).replace(/_/g, ' '),
    geo: s.geography
  }));
  const enforcementHistory = read('data/releases/road_enforcement_2019_2022/enforcement.json').map(r => ({
    measure: r.measure, year: r.reference_year, value: r.value, kind: r.value_kind, reportYear: r.report_year, pdfPage: r.source_pdf_page, printedPage: r.source_printed_page,
    url: r.source_url, sha256: r.source_sha256, review: r.review_status, note: r.note
  }));
  return { trends, victims, victimsEarly, enforcement, enforcementHistory, series, updated: status.updated };
}

function buildRoads() {
  const raw = read('data/crash_zones_2023_raw.json');
  const extra = read('data/road_safety_extra_2023_2024.json');
  const zones2023 = raw.slice().sort((a, b) => a.rank - b.rank).map(z => [z.name, z.road, z.fatal, z.total]);
  // 2022: named zones as printed (no road and no coordinates in that table) and the roads table (selected zones on each road)
  // The 2022 zone table prints no road. A road is added only where a later report (2023 or 2024, Table 6.29) assigns one to the same normalised
  // place name; it is derived metadata (flag true in the fifth place), never a printed 2022 value. Possible matches stay out until reviewed.
  const enrich = {};
  read(R22 + 'zones_2022_roads_from_later_reports.json').forEach(e => { enrich[e.rank + '|' + e.name_as_printed] = e; });
  const zones2022 = read(R22 + 'crash_prone_zones.json').slice().sort((a, b) => a.rank - b.rank).map(z => {
    const e = enrich[z.rank + '|' + z.name_as_printed];
    if (!e) throw new Error('2022 zone ' + z.rank + ' is missing from the road enrichment file');
    const derived = e.road_match_status === 'exact_name_later_report' && e.road;
    return [z.name_as_printed, derived ? e.road : null, z.fatal_crashes, z.total_crashes, derived ? 1 : 0];
  });
  // 2024: the named zones in the repository's zone file. Zones ranked in Table 6.29 carry crash counts; the others appear only in the
  // report's category lists (pedestrian, two-wheeler, and so on), so their all-crash counts are null here, never zero.
  const z24 = read('data/delhi_crash_prone_zones_2024_all_named_approx.geojson').features.map(f => f.properties);
  const zones2024 = z24.map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.table_6_29_rank == null) - (b.p.table_6_29_rank == null) || a.p.table_6_29_rank - b.p.table_6_29_rank || a.i - b.i)
    .map(o => [o.p.location_name, o.p.road_name, o.p.all_fatal_crashes, o.p.all_total_crashes]);
  const roads = {
    2022: read(R22 + 'roads_selected_zones.json').map((r, i) => ({ r, i })).sort((a, b) => b.r.fatal_crashes - a.r.fatal_crashes || a.i - b.i).slice(0, 12).map(o => [o.r.road_as_printed, o.r.crash_prone_zones, o.r.fatal_crashes, o.r.total_crashes])
  };
  Object.keys(extra.roadSummary).forEach(y => {
    roads[y] = extra.roadSummary[y]
      .map((r, i) => ({ r, i }))
      .sort((a, b) => b.r.fatal - a.r.fatal || a.i - b.i)
      .slice(0, 12)
      .map(o => [o.r.road, o.r.zones, o.r.fatal, o.r.total]);
  });
  // 2016 to 2021 (data/releases/road_zones_roads_2016_2021/): named zones as printed, with the road where that year's table has one
  // (2021 prints none), and the road-wise tables for 2017 to 2021 (2016 prints no road table).
  const RH = 'data/releases/road_zones_roads_2016_2021/';
  const named = read(RH + 'named_zones_2016_2021.json'), roadRows = read(RH + 'roads_selected_zones_2017_2021.json');
  const out = { roads, zones2023, zones2022, zones2024, history: roadHistory.build(), roadRows: {} };
  for (let y = 2016; y <= 2021; y++) {
    out['zones' + y] = named.filter(z => z.reference_year === y).sort((a, b) => a.serial - b.serial).map(z => [z.name_as_printed, z.road_as_printed, z.fatal_crashes, z.total_crashes, 0]);
  }
  for (let y = 2017; y <= 2021; y++) {
    const rows = roadRows.filter(r => r.reference_year === y).sort((a, b) => a.rank - b.rank);
    out.roadRows[y] = rows.length;
    roads[y] = rows.map((r, i) => ({ r, i })).sort((a, b) => b.r.fatal_crashes - a.r.fatal_crashes || a.i - b.i).slice(0, 12).map(o => [o.r.road_as_printed, o.r.crash_prone_zones, o.r.fatal_crashes, o.r.total_crashes]);
  }
  [2022, 2023, 2024].forEach(y => { out.roadRows[y] = out.roadRows[y] || (y === 2022 ? 32 : 35); });
  // 2013 to 2015 and 2011 to 2012 (data/releases/road_zones_roads_2011_2015/): named zones as printed (2013 and 2014 from the PWD compilation, 2015 from
  // Table 10.1), 2015 road groups calculated by exact printed label (derived, not a printed table), and the retrospective 2011 and 2012 stretches.
  // 2013 and 2014 print no road table and 2011 and 2012 no zone list; those stay unavailable, not zero.
  const RE = 'data/releases/road_zones_roads_2011_2015/';
  const early = read(RE + 'named_zones_2013_2015.json'), road15 = read(RE + 'roads_2015_derived_exact_labels.json'), stretch = read(RE + 'roads_2011_2012_retrospective.json');
  for (let y = 2013; y <= 2015; y++) {
    out['zones' + y] = early.filter(z => z.reference_year === y).sort((a, b) => a.serial - b.serial).map(z => [z.name_as_printed, z.road_as_printed, z.fatal_crashes, z.total_crashes, 0]);
  }
  const road14 = read(RE + 'roads_2014_derived_exact_labels.json'), stretch14 = read(RE + 'road_stretches_2014_retrospective.json');
  const named14 = road14.filter(r => r.road_as_printed);
  roads[2014] = named14.map((r, i) => ({ r, i })).sort((a, b) => b.r.fatal_crashes - a.r.fatal_crashes || a.i - b.i).slice(0, 12).map(o => [o.r.road_as_printed, o.r.crash_prone_zones, o.r.fatal_crashes, o.r.total_crashes]);
  out.roadRows[2014] = named14.length;
  roads[2015] = road15.map((r, i) => ({ r, i })).sort((a, b) => b.r.fatal_crashes - a.r.fatal_crashes || a.i - b.i).slice(0, 12).map(o => [o.r.road_as_printed, o.r.crash_prone_zones, o.r.fatal_crashes, o.r.total_crashes]);
  out.roadRows[2015] = road15.length;
  out.roadsDerived = { 2014: true, 2015: true };
  out.stretches = {};
  [2011, 2012].forEach(y => { out.stretches[y] = stretch.filter(r => r.reference_year === y).map(r => [r.road_group_as_printed, r.road_as_printed, r.fatal_crashes, r.simple_crashes, r.noninjury_crashes, r.total_crashes, null]); });
  // 2014 (audited supplement): two rows do not add up in the source; the printed total stays and the sum of the parts is carried in the seventh place
  const groupOf = {}; stretch.forEach(r => { groupOf[r.road_as_printed] = r.road_group_as_printed; });
  out.stretches[2014] = stretch14.map(r => { if (!groupOf[r.road_as_printed]) throw new Error('2014 stretch without a 2011/2012 group: ' + r.road_as_printed); return [groupOf[r.road_as_printed], r.road_as_printed, r.fatal_crashes, r.simple_crashes, r.noninjury_crashes, r.total_crashes_as_printed, r.source_arithmetic_discrepancy ? r.component_sum : null]; });
  return out;
}

// The continuity file with the evidence paths removed, plus the comparison functions' source (the page runs the same code the tests run).
function pageContinuity() {
  const c = read('data/continuity.json');
  const strip = v => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object') {
      const o = {};
      Object.keys(v).forEach(k => { if (k !== 'evidence' && k !== 'sources') o[k] = strip(v[k]); });
      return o;
    }
    return v;
  };
  return strip(c);
}

function buildAll() {
  const continuity = read('data/continuity.json');
  return { DELHI: buildDelhi(continuity), SITE: buildSite(continuity), ROADS: buildRoads(), CONTINUITY: pageContinuity(), updated: read('data/series_status.json').updated };
}

module.exports = { buildAll, CRIME, ROAD, CRIME_YEARS };
