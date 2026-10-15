"""NEGATIVE-RESULT EXPERIMENT (see docs/MPD_BUILT_UP_USE_TRIAL.md). Trial: can building footprint shape and size predict land use (residential / commercial / industrial / public)?
Labels come from OSM land-use polygons, so this only tests whether footprints reproduce OSM's use tags, and where they
generalise to unseen blocks. Needs: pip install duckdb numpy shapely scikit-learn. Reads Overture Maps buildings over S3 for a ~10 km x 10 km area.
The WorldCover window cache comes from: python scripts/build_mpd_worldcover_comparison.py --cache $SCRATCH/wc_cache"""
import json, os, sys, time
import numpy as np
import duckdb
import shapely
from shapely import wkb
from shapely.strtree import STRtree
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics import classification_report, confusion_matrix, f1_score, accuracy_score

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SP = os.environ.get('SCRATCH', os.path.join(REPO, 'scratch'))  # cache dir: trial_buildings.parquet and wc_cache/worldcover_delhi_window.npz
os.makedirs(SP, exist_ok=True)
REL = '2026-09-23.1'
W, S, E, N = 77.10, 28.60, 77.20, 28.69
CELL = 100.0
KX = 111320 * np.cos(np.radians(28.65)); KY = 110574.0

cache = os.path.join(SP, 'trial_buildings.parquet')
con = duckdb.connect()
if not os.path.exists(cache):
    con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
    src = f"read_parquet('s3://overturemaps-us-west-2/release/{REL}/theme=buildings/type=building/*', hive_partitioning=1)"
    t = time.time()
    con.execute(f"""COPY (SELECT id, ST_AsWKB(geometry) AS wkb, sources[1].dataset AS src, height, class
        FROM {src} WHERE bbox.xmin > {W} AND bbox.xmax < {E} AND bbox.ymin > {S} AND bbox.ymax < {N}) TO '{cache.replace(chr(92), '/')}' (FORMAT PARQUET)""")
    print('queried buildings in', round(time.time() - t), 's', file=sys.stderr)
rows = con.execute(f"SELECT id, wkb, src, height FROM read_parquet('{cache.replace(chr(92), '/')}')").fetchall()
print('buildings', len(rows), file=sys.stderr)

geoms = shapely.from_wkb([bytes(r[1]) for r in rows])
srcs = np.array([r[2] or '' for r in rows])
heights = np.array([r[3] if r[3] is not None else np.nan for r in rows], dtype=float)
# project to local metres
def proj(g):
    return shapely.transform(g, lambda c: np.column_stack([(c[:, 0] - W) * KX, (c[:, 1] - S) * KY]))
gm = proj(geoms)
area = shapely.area(gm); peri = shapely.length(gm)
mrr = shapely.minimum_rotated_rectangle(gm)
rect = np.where(shapely.area(mrr) > 0, area / np.maximum(shapely.area(mrr), 1e-6), 0)
compact = np.where(peri > 0, 4 * np.pi * area / np.maximum(peri, 1e-6) ** 2, 0)
cent = shapely.centroid(gm); cx = shapely.get_x(cent); cy = shapely.get_y(cent)
ok = (area >= 8) & (area < 50000)
nx = int(np.ceil((E - W) * KX / CELL)); ny = int(np.ceil((N - S) * KY / CELL))
ci = np.floor(cx / CELL).astype(int); cj = np.floor(cy / CELL).astype(int)
inside = ok & (ci >= 0) & (ci < nx) & (cj >= 0) & (cj < ny)
cell = np.where(inside, cj * nx + ci, -1)

# WorldCover context from the cached window (10 m grid)
z = np.load(os.path.join(SP, 'wc_cache', 'worldcover_delhi_window.npz'))
sat = z['sat']; tr = z['transform']  # a,b,c,d,e,f of the affine
def wc_frac(i, j):
    lon0 = W + i * CELL / KX; lon1 = W + (i + 1) * CELL / KX; lat0 = S + j * CELL / KY; lat1 = S + (j + 1) * CELL / KY
    c0 = int((lon0 - tr[2]) / tr[0]); c1 = int((lon1 - tr[2]) / tr[0]); r0 = int((lat1 - tr[5]) / tr[4]); r1 = int((lat0 - tr[5]) / tr[4])
    blk = sat[max(r0, 0):r1, max(c0, 0):c1]
    if blk.size == 0: return None
    return (blk == 50).mean(), np.isin(blk, (10, 20, 30)).mean(), (blk == 60).mean()

# labels from OSM land use
USEMAP = {'residential': 1, 'apartments': 1, 'commercial': 2, 'retail': 2, 'industrial': 3, 'construction': 3, 'railway': 3, 'quarry': 3, 'landfill': 3,
          'brownfield': 3, 'greenfield': 3, 'garages': 3, 'depot': 3, 'military': 4, 'education': 4, 'institutional': 4, 'hospital': 4, 'religious': 4,
          'college': 4, 'civic': 4, 'courthouse': 4, 'school': 4, 'government': 4, 'police': 4, 'place_of_worship': 4, 'museum': 4}
lu = json.load(open(os.path.join(REPO, 'data/delhi_landuse_simplified.geojson'), encoding='utf-8'))['features']
lu_g = [shapely.geometry.shape(f['geometry']) for f in lu]
lu_u = np.array([USEMAP.get(f['properties'].get('landuse'), 5) for f in lu])
tree = STRtree(lu_g)

feats, labels, groups, meta = [], [], [], []
order = np.argsort(cell)
cells = np.unique(cell[cell >= 0])
by = {c: [] for c in cells}
for idx in np.where(cell >= 0)[0]:
    by[cell[idx]].append(idx)
for c, idxs in by.items():
    if len(idxs) < 4: continue
    j, i = divmod(c, nx)
    a = area[idxs]; b = np.array(idxs)
    cover = a.sum() / (CELL * CELL)
    px = np.column_stack([cx[b], cy[b]])
    # nearest-neighbour spacing
    if len(b) > 1:
        d = np.sqrt(((px[:, None, :] - px[None, :, :]) ** 2).sum(-1)); np.fill_diagonal(d, np.inf); nn = d.min(1).mean()
    else:
        nn = 50.0
    w = wc_frac(i, j)
    if w is None: continue
    h = heights[b]
    pt = shapely.points((i + 0.5) * CELL / KX + W, (j + 0.5) * CELL / KY + S)
    hit = tree.query(pt, predicate='within')
    lab = int(lu_u[hit[0]]) if len(hit) else 0
    feats.append([len(b), cover, a.mean(), np.median(a), np.percentile(a, 90), a.max(), (a > 400).mean(), (a > 1000).mean(), rect[b].mean(), compact[b].mean(),
                  nn, w[0], w[1], w[2], np.nanmean(h) if np.isfinite(h).any() else 0.0, (srcs[b] == 'OpenStreetMap').mean()])
    labels.append(lab); groups.append((j // 10) * 1000 + (i // 10)); meta.append((i, j))
X = np.array(feats); y = np.array(labels); g = np.array(groups)
NAMES = ['n_buildings', 'cover_frac', 'area_mean', 'area_median', 'area_p90', 'area_max', 'share_gt400', 'share_gt1000', 'rectangularity', 'compactness', 'nn_spacing',
         'wc_built', 'wc_green', 'wc_bare', 'height_mean', 'osm_source_share']
print('cells', len(y), 'label counts (0 none,1 res,2 com,3 ind,4 public,5 non-built tag):', {int(k): int(v) for k, v in zip(*np.unique(y, return_counts=True))}, file=sys.stderr)

# train/evaluate on built cells with a built use label
m = (y >= 1) & (y <= 4) & (X[:, 11] > 0.3)
Xm, ym, gm_ = X[m], y[m], g[m]
print('labelled built cells', m.sum(), {int(k): int(v) for k, v in zip(*np.unique(ym, return_counts=True))}, file=sys.stderr)

def cv(cols, label):
    pred = np.zeros_like(ym)
    for tr_i, te_i in GroupKFold(n_splits=5).split(Xm, ym, gm_):
        rf = RandomForestClassifier(n_estimators=300, min_samples_leaf=3, class_weight='balanced', random_state=0, n_jobs=-1).fit(Xm[tr_i][:, cols], ym[tr_i])
        pred[te_i] = rf.predict(Xm[te_i][:, cols])
    print('\n==', label, '| spatial 1 km block CV | accuracy %.3f | macro-F1 %.3f' % (accuracy_score(ym, pred), f1_score(ym, pred, average='macro')))
    print(classification_report(ym, pred, labels=[1, 2, 3, 4], target_names=['residential', 'commercial', 'industrial', 'public'], zero_division=0))
    print(confusion_matrix(ym, pred, labels=[1, 2, 3, 4]))
    return pred

base = np.bincount(ym).argmax()
print('majority-class baseline accuracy %.3f (always %d)' % ((ym == base).mean(), base))
allc = list(range(len(NAMES)))
no_src = [i for i in allc if NAMES[i] != 'osm_source_share']
p_all = cv(allc, 'all features (incl. OSM-source share)')
p_nosrc = cv(no_src, 'without OSM-source share')
shape_only = [NAMES.index(n) for n in ['n_buildings', 'cover_frac', 'area_mean', 'area_median', 'area_p90', 'area_max', 'share_gt400', 'share_gt1000', 'rectangularity', 'compactness', 'nn_spacing']]
p_shape = cv(shape_only, 'footprint shape/size only (no satellite context, no source)')
# does skill hold in ML-dominated cells (few OSM-mapped buildings)?
lowosm = Xm[:, NAMES.index('osm_source_share')] < 0.3
print('\ncells with <30%% OSM-sourced buildings: %d of %d; accuracy without source feature: %.3f' % (lowosm.sum(), len(ym), accuracy_score(ym[lowosm], p_nosrc[lowosm])))
hiosm = Xm[:, NAMES.index('osm_source_share')] > 0.7
print('cells with >70%% OSM-sourced buildings: %d; accuracy without source feature: %.3f' % (hiosm.sum(), accuracy_score(ym[hiosm], p_nosrc[hiosm])))
rf = RandomForestClassifier(n_estimators=300, min_samples_leaf=3, class_weight='balanced', random_state=0, n_jobs=-1).fit(Xm[:, no_src], ym)
print('\nfeature importance (no source):', sorted(zip([NAMES[i] for i in no_src], np.round(rf.feature_importances_, 3)), key=lambda t: -t[1])[:8])
