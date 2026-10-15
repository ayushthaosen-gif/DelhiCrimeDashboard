"""Compares the Master Plan for Delhi 2047 land-use designations with satellite land cover (ESA WorldCover 2021, 10 m).

OpenStreetMap land-use tags are incomplete, which leaves many wards "thin coverage" in the OSM comparison. A satellite
land-cover map covers every pixel, so it is a fairer reference for the plan. The catch: a 10 m satellite classifier can
see built-up, trees/grass, cropland, bare ground and water, but not what a built-up area is used for. To say something about
use, the satellite's built-up footprint is combined with OpenStreetMap land-use tags WHERE THEY EXIST: for each planned use
(residential, commercial, industrial, public) the output reports how much of the planned area is satellite-built, and of that
built part how much OSM tags as each use, with the untagged remainder reported as unknown, never guessed.

  python scripts/build_mpd_worldcover_comparison.py              # reads only the Delhi window of the cloud-optimised tile
  python scripts/build_mpd_worldcover_comparison.py --tile PATH  # use a tile you already downloaded
  python scripts/build_mpd_worldcover_comparison.py --cache DIR  # keep the Delhi window as .npz so reruns need no network

Needs rasterio, numpy, shapely (see generator/requirements.txt). Output: data/derived/mpd2047_worldcover_comparison.json

Data: ESA WorldCover 10 m 2021 v200, (c) ESA WorldCover project / Contains modified Copernicus Sentinel data (2021) processed by
the ESA WorldCover consortium, CC BY 4.0. Plan: Delhi Development Authority, MPD-2047 GIS portal (gis.dda.org.in).
"""
import argparse
import io
import json
import os
import sys
import urllib.request

import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.windows import from_bounds

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://esa-worldcover.s3.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N27E075_Map.tif'

# groups: 0 none/other, 1 built-up, 2 green and open (trees, shrub, grass), 3 agriculture / cropland, 4 water, 5 bare or sparse
SAT_GROUP = {10: 2, 20: 2, 30: 2, 40: 3, 50: 1, 60: 5, 80: 4, 90: 4, 95: 4}
GROUP_NAME = {1: 'built', 2: 'green_open', 3: 'agriculture', 4: 'water', 5: 'bare'}
PLAN_BUILT = {'RD', 'RF', 'C1', 'C2', 'C3', 'M1', 'PS1', 'PS1BGCGCE', 'PS1FCO', 'PS2', 'G1', 'G2', 'G3', 'T1', 'T2', 'T3'}
PLAN_GROUP = lambda code: 1 if code in PLAN_BUILT else 2 if code in ('P1', 'P2') else 3 if code == 'A1' else 4 if code == 'A2' else 0
# plan uses for the built-up check, and what the OSM land-use categories mean in the same terms
PLAN_USE = {'RD': 1, 'RF': 1, 'C1': 2, 'C2': 2, 'C3': 2, 'M1': 3, 'PS1': 4, 'PS1BGCGCE': 4, 'PS1FCO': 4, 'PS2': 4, 'G1': 4, 'G2': 4, 'G3': 4}
USE_NAME = {1: 'residential', 2: 'commercial', 3: 'industrial', 4: 'public'}
OSM_USE_LABEL = {0: 'untagged', 1: 'residential', 2: 'commercial', 3: 'industrial', 4: 'public', 5: 'other_tag'}
OSM_LANDUSE_TO_USE = {  # landuse value -> 1 residential, 2 commercial, 3 industrial, 4 public, 5 tagged but not a built use (farm, forest, grass, water...)
    'residential': 1, 'apartments': 1,
    'commercial': 2, 'retail': 2,
    'industrial': 3, 'construction': 3, 'railway': 3, 'quarry': 3, 'landfill': 3, 'brownfield': 3, 'greenfield': 3, 'garages': 3, 'depot': 3,
    'military': 4, 'education': 4, 'institutional': 4, 'hospital': 4, 'religious': 4, 'college': 4, 'civic': 4, 'courthouse': 4, 'school': 4,
    'government': 4, 'police': 4, 'fire_station': 4, 'place_of_worship': 4, 'museum': 4, 'cultural_centre': 4, 'community_services': 4,
}
COMPARABLE = (1, 2, 3)  # plan groups that have a satellite counterpart; P3/P4/utility/blank codes and water are left out
PIXEL_M2 = 90.5         # 1/12000 degree at about 28.6 N (9.26 m x 9.77 m)


class RangeFile(io.RawIOBase):
    """Read-only file object over HTTP range requests, so only the blocks GDAL asks for are fetched (not the whole 91 MB tile).
    Python's own TLS stack is used instead of GDAL's curl, which fails certificate revocation checks on some Windows setups."""

    BLOCK = 1 << 20

    def __init__(self, url):
        self.url, self.pos, self.cache, self.fetched = url, 0, {}, 0
        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'DelhiCrimeDashboard-landcover/1.0'})
        with urllib.request.urlopen(req, timeout=60) as r:
            self.size = int(r.headers['Content-Length'])

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def _block(self, i):
        if i not in self.cache:
            a, b = i * self.BLOCK, min(self.size, (i + 1) * self.BLOCK) - 1
            req = urllib.request.Request(self.url, headers={'Range': 'bytes=%d-%d' % (a, b), 'User-Agent': 'DelhiCrimeDashboard-landcover/1.0'})
            with urllib.request.urlopen(req, timeout=120) as r:
                self.cache[i] = r.read()
            self.fetched += len(self.cache[i])
        return self.cache[i]

    def readinto(self, buf):
        n, end = 0, min(self.size, self.pos + len(buf))
        while self.pos < end:
            i = self.pos // self.BLOCK
            blk = self._block(i)
            off = self.pos - i * self.BLOCK
            take = min(len(blk) - off, end - self.pos)
            buf[n:n + take] = blk[off:off + take]
            n += take
            self.pos += take
        return n


def use_check(m):
    """m[plan_use 1..4][built 0/1][osm_use 0..5] pixel counts -> per planned use: how much is satellite-built, and of the built part
    what OSM tags it as (untagged = unknown, never guessed)."""
    out = {}
    for u, name in USE_NAME.items():
        tot = m[u].sum()
        built = m[u][1]
        b = built.sum()
        row = {'planned_km2': round(tot * PIXEL_M2 / 1e6, 3), 'built_km2': round(b * PIXEL_M2 / 1e6, 3),
               'built_pct': round(b / tot * 100, 1) if tot else None}
        if b:
            row['built_tagged_as_pct'] = {OSM_USE_LABEL[k]: round(built[k] / b * 100, 1) for k in range(6)}
            row['tagged_pct'] = round(100 - built[0] / b * 100, 1)
            tagged_built = b - built[0]
            row['tagged_matches_plan_pct'] = round(built[u] / tagged_built * 100, 1) if tagged_built else None
        else:
            row['built_tagged_as_pct'] = None; row['tagged_pct'] = None; row['tagged_matches_plan_pct'] = None
        out[name] = row
    return out


def ward_rows(counts, wards_meta, use_counts):
    """counts[w][plan_group][sat_group] in pixels -> one comparison row per ward."""
    rows = []
    for w, meta in enumerate(wards_meta):
        m = counts[w + 1]
        plan_total = m[1:].sum()                       # all plan-designated pixels (any group but none)
        comp = m[list(COMPARABLE), :]                  # rows: plan built / green / agriculture
        comp_px = comp.sum()
        row = {'ward': meta['name'], 'ward_no': meta['no'], 'district': meta['district'], 'area_sq_km': meta['area']}
        row['plan_covered_km2'] = round(plan_total * PIXEL_M2 / 1e6, 3)
        row['comparable_km2'] = round(comp_px * PIXEL_M2 / 1e6, 3)
        for g in COMPARABLE:
            name = GROUP_NAME[g]
            planned = m[g, :].sum() / comp_px * 100 if comp_px else 0
            # satellite share of the same pixels (the comparable plan area) that the classifier calls this group
            sat = comp[:, g].sum() / comp_px * 100 if comp_px else 0
            row['planned_' + name + '_share_pct'] = round(planned, 1)
            row['satellite_' + name + '_share_pct'] = round(sat, 1)
            row['delta_' + name + '_pp'] = round(planned - sat, 1)
        row['satellite_bare_share_pct'] = round(comp[:, 5].sum() / comp_px * 100, 1) if comp_px else 0
        # the mismatches people ask about: planned green or agriculture that the satellite shows as built-up
        for g, label in ((2, 'green_open'), (3, 'agriculture')):
            den = m[g, :].sum()
            row['planned_' + label + '_seen_as_built_pct'] = round(m[g, 1] / den * 100, 1) if den else None
        den = m[1, :].sum()
        row['planned_built_seen_as_green_or_crop_pct'] = round((m[1, 2] + m[1, 3]) / den * 100, 1) if den else None
        ward_px = m.sum()  # the ward's own pixels, so coverage cannot exceed 100% when the polygon area differs slightly
        covered = plan_total / ward_px * 100 if ward_px else 0
        row['plan_coverage_pct'] = round(covered, 1)
        row['use_check'] = use_check(use_counts[w + 1])
        row['comparison_confidence'] = 'ok' if row['comparable_km2'] >= 0.15 and covered >= 10 else 'low - thin coverage (small comparable plan area)'
        rows.append(row)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tile', help='path to a local ESA WorldCover GeoTIFF instead of reading the cloud tile')
    ap.add_argument('--cache', help='directory to keep the Delhi window as .npz, so reruns need no network')
    args = ap.parse_args()

    wards = json.load(open(os.path.join(ROOT, 'data/delhi_wards_infra.geojson'), encoding='utf-8'))['features']
    plan = json.load(open(os.path.join(ROOT, 'data/source/mpd2047_landuse_raw.geojson'), encoding='utf-8'))['features']
    metas = [{'name': f['properties']['Ward_Name'], 'no': f['properties']['Ward_No'], 'district': f['properties'].get('assignedDistrict'), 'area': f['properties'].get('areaSqKm')} for f in wards]

    xs, ys = [], []
    def walk(a):
        if isinstance(a[0], (int, float)):
            xs.append(a[0]); ys.append(a[1])
        else:
            for b in a:
                walk(b)
    for f in wards:
        walk(f['geometry']['coordinates'])
    W, S, E, N = min(xs) - 0.01, min(ys) - 0.01, max(xs) + 0.01, max(ys) + 0.01

    cache_file = os.path.join(args.cache, 'worldcover_delhi_window.npz') if args.cache else None
    if cache_file and os.path.exists(cache_file):
        z = np.load(cache_file)
        sat = z['sat']
        transform = rasterio.Affine(*[float(v) for v in z['transform']])
        print('window loaded from cache:', sat.shape, file=sys.stderr)
    else:
        source = args.tile if args.tile else RangeFile(URL)
        with rasterio.open(source) as src:
            win = from_bounds(W, S, E, N, src.transform).round_offsets().round_lengths()
            sat = src.read(1, window=win)
            transform = src.window_transform(win)
            print('window read:', sat.shape, 'pixels', sat.size, file=sys.stderr)
            if not args.tile:
                print('bytes fetched over the network: %.1f MB of %.1f MB' % (source.fetched / 1e6, source.size / 1e6), file=sys.stderr)
        if cache_file:
            os.makedirs(args.cache, exist_ok=True)
            np.savez_compressed(cache_file, sat=sat, transform=np.array(transform[:6]))

    lut = np.zeros(256, dtype=np.uint8)
    for code, g in SAT_GROUP.items():
        lut[code] = g
    sat_g = lut[sat]
    del sat

    ward_id = rasterize([(f['geometry'], i + 1) for i, f in enumerate(wards)], out_shape=sat_g.shape, transform=transform, fill=0, dtype='int16')
    plan_g = rasterize([(f['geometry'], PLAN_GROUP((f['properties'].get('use_zones') or '').strip())) for f in plan if f.get('geometry')],
                       out_shape=sat_g.shape, transform=transform, fill=0, dtype='uint8')
    # plan codes outside the comparable groups (P3, P4, utilities, blank) rasterize as 0 above and are simply not compared

    # built-up by planned use: plan use raster and OSM land-use raster on the same grid
    plan_use = rasterize([(f['geometry'], PLAN_USE.get((f['properties'].get('use_zones') or '').strip(), 0)) for f in plan if f.get('geometry')],
                         out_shape=sat_g.shape, transform=transform, fill=0, dtype='uint8')
    osm = json.load(open(os.path.join(ROOT, 'data/delhi_landuse_simplified.geojson'), encoding='utf-8'))['features']
    osm_use = rasterize([(f['geometry'], OSM_LANDUSE_TO_USE.get(f['properties'].get('landuse'), 5)) for f in osm if f.get('geometry')],
                        out_shape=sat_g.shape, transform=transform, fill=0, dtype='uint8')
    n = len(wards) + 1
    use_counts = np.zeros((n, 5, 2, 6), dtype=np.int64)
    flat_u = (ward_id.astype(np.int32) * 60 + plan_use.astype(np.int32) * 12 + (sat_g == 1).astype(np.int32) * 6 + osm_use.astype(np.int32)).ravel()
    use_counts += np.bincount(flat_u, minlength=n * 60).reshape(n, 5, 2, 6)
    del flat_u
    counts = np.zeros((n, 6, 6), dtype=np.int64)
    flat = (ward_id.astype(np.int32) * 36 + plan_g.astype(np.int32) * 6 + sat_g.astype(np.int32)).ravel()
    counts += np.bincount(flat, minlength=n * 36).reshape(n, 6, 6)
    counts[0] = 0  # pixels outside every ward

    rows = ward_rows(counts, metas, use_counts)
    city = counts[1:].sum(axis=0)
    comp_total = city[list(COMPARABLE), :].sum()
    use_city = use_counts[1:].sum(axis=0)
    use_matrix = use_check(use_city)
    matrix = {}
    for g in COMPARABLE:
        matrix['planned_' + GROUP_NAME[g]] = {('satellite_' + GROUP_NAME[s]): round(city[g, s] * PIXEL_M2 / 1e6, 1) for s in (1, 2, 3, 4, 5)}
    out = {
        'metadata': {
            'title': 'MPD-2047 planned land use versus satellite land cover (ESA WorldCover 2021), by MCD ward',
            'satellite_source': 'ESA WorldCover 10 m 2021 v200, tile N27E075 (classification of Sentinel-1 and Sentinel-2 imagery from 2021). (c) ESA WorldCover project, CC BY 4.0.',
            'plan_source': 'Delhi Development Authority, Master Plan for Delhi 2047 GIS portal (gis.dda.org.in), via data/source/mpd2047_landuse_raw.geojson',
            'method': 'Both layers are rasterised on the 10 m WorldCover grid and cross-tabulated inside each ward. Only pixels where the plan designates built, green/open or agricultural use are compared; the satellite shares are taken over those same pixels, so the two denominators match.',
            'crosswalk_plan': {'built': sorted(PLAN_BUILT), 'green_open': ['P1', 'P2'], 'agriculture': ['A1'], 'not_compared': 'water (A2), monuments (P3), sports (P4), utilities (U, U1-U5) and blank codes'},
            'crosswalk_satellite': {'built': [50], 'green_open': [10, 20, 30], 'agriculture': [40], 'bare': [60], 'water': [80, 90, 95]},
            'what_it_can_and_cannot_say': 'A satellite sees what is on the ground, not what the land is used for. The built-up group therefore lumps residential, industrial, commercial and public land together; the use_check section splits it only where OpenStreetMap has a land-use tag (residential and industrial are tagged fairly well, commercial and institutional poorly), and reports the untagged remainder as unknown. Trees inside residential colonies, parks with paved areas, fallow farmland and construction sites (bare) are classified as the satellite sees them. 10 m pixels, 2021 imagery, and the plan is from 2026: a plan-versus-satellite gap can be development that has not happened yet, change since 2021, or classifier error. It is not a measurement of compliance.',
            'comparison_confidence_rule': 'ok when the comparable plan area is at least 0.15 km2 and the plan covers at least 10% of the ward',
            'pixel_area_m2': PIXEL_M2,
        },
        'citywide': {
            'wards': len(rows), 'wards_low_confidence': sum(1 for r in rows if r['comparison_confidence'] != 'ok'),
            'comparable_km2': round(comp_total * PIXEL_M2 / 1e6, 1),
            'plan_group_by_satellite_group_km2': matrix,
            'built_up_by_planned_use': use_matrix,
        },
        'wards': rows,
    }
    os.makedirs(os.path.join(ROOT, 'data/derived'), exist_ok=True)
    with open(os.path.join(ROOT, 'data/derived/mpd2047_worldcover_comparison.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, indent=1)
    print('wards', len(rows), '| comparable km2', out['citywide']['comparable_km2'], '| low confidence', out['citywide']['wards_low_confidence'])
    print(json.dumps(matrix, indent=1))


if __name__ == '__main__':
    main()
