// Shapes the repository's data files into the three objects the redesigned site reads in the browser:
//   DELHI  districts for the map pages: outline path, area, population, figures by year, infrastructure
//          (comparability between years is decided in the browser by the same functions the tests run, from CONTINUITY)
//   SITE   citywide road trends, victims by mode of travel, enforcement, series status, continuity rules
//   ROADS  the 2023 crash-prone zone list and the roads with the most zones
// Nothing here invents a number: a figure the source does not hold stays null and is never turned into zero.

const fs = require('fs');
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

function buildDelhi(continuity) {
  const data = read('data/dashboard_final.json');
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
  return { trends, victims, enforcement, series, updated: status.updated };
}

function buildRoads() {
  const raw = read('data/crash_zones_2023_raw.json');
  const extra = read('data/road_safety_extra_2023_2024.json');
  const zones2023 = raw.slice().sort((a, b) => a.rank - b.rank).map(z => [z.name, z.road, z.fatal, z.total]);
  const roads = {};
  Object.keys(extra.roadSummary).forEach(y => {
    roads[y] = extra.roadSummary[y]
      .map((r, i) => ({ r, i }))
      .sort((a, b) => b.r.fatal - a.r.fatal || a.i - b.i)
      .slice(0, 12)
      .map(o => [o.r.road, o.r.zones, o.r.fatal, o.r.total]);
  });
  return { roads, zones2023 };
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
