"""Georeferences "Map 6.1 Road Crash Prone Zones-2024 (111)" from the Delhi Road Crash Report 2024 (PDF page 116).

The report says every crash spot is geo-tagged but publishes no coordinates. It does print a map of all 111 zones as dots over
the Delhi boundary. This script registers that low-resolution raster to the real Delhi outline and reads the dots back as
longitude/latitude. It is independent of place-name geocoding, but coarse: the map is about 340 px across Delhi (roughly 150 m
per pixel) and each dot is about 1 km wide, so dot positions are good to a few hundred metres at best, worse in the crowded
centre where dots overlap.

  python scripts/georeference_report_map.py --pdf "C:/path/Delhi-Crash-Report-2024.pdf" [--page 116]
  python scripts/georeference_report_map.py --image page116.png        # an already extracted page image

Needs numpy, scipy, Pillow, shapely, and `pdfimages` (poppler) when --pdf is used. The page image is not stored in the repo.
Output: data/audits/crash_zones_2024/crash_zone_report_map_dots_2024.json
"""
import argparse
import json
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.optimize import minimize
from scipy.cluster.vq import kmeans2
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data/audits/crash_zones_2024/crash_zone_report_map_dots_2024.json')
LON0, LAT0 = 77.1, 28.65
KX, KY = 111320 * np.cos(np.radians(LAT0)), 110574.0


def load_image(args):
    if args.image:
        return Image.open(args.image).convert('RGB')
    tmp = tempfile.mkdtemp(prefix='crashmap_')
    subprocess.run(['pdfimages', '-png', '-f', str(args.page), '-l', str(args.page), args.pdf, os.path.join(tmp, 'p')], check=True)
    files = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
    return Image.open(os.path.join(tmp, files[0])).convert('RGB')


def delhi_outline():
    g = json.load(open(os.path.join(ROOT, 'data/dashboard_boundaries_simplified.geojson'), encoding='utf-8'))['features']
    polys = [shape(f['geometry']).buffer(0) for f in g]          # buffer(0) repairs any invalid ring
    return unary_union(polys)


def to_m(xy):
    return np.column_stack([(xy[:, 0] - LON0) * KX, (xy[:, 1] - LAT0) * KY])


def rasterize(poly, params, size):
    """params = (scale px/m, rotation rad, tx px, ty px); returns a boolean mask of the outline in image pixels."""
    s, th, tx, ty = params
    c, sn = np.cos(th), np.sin(th)
    def tf(pts):
        m = to_m(np.asarray(pts))
        x = s * (c * m[:, 0] - sn * m[:, 1]) + tx
        y = -s * (sn * m[:, 0] + c * m[:, 1]) + ty      # image y grows downwards
        return list(map(tuple, np.column_stack([x, y])))
    img = Image.new('1', size, 0)
    d = ImageDraw.Draw(img)
    for p in (poly.geoms if poly.geom_type == 'MultiPolygon' else [poly]):
        d.polygon(tf(p.exterior.coords), fill=1)
        for hole in p.interiors:
            d.polygon(tf(hole.coords), fill=0)
    return np.array(img)


def boundary_points(poly, n=900):
    ext = max(poly.geoms, key=lambda g: g.area).exterior if poly.geom_type == 'MultiPolygon' else poly.exterior
    return np.array([ext.interpolate(t, normalized=True).coords[0] for t in np.linspace(0, 1, n, endpoint=False)])


def apply(p, pts):
    s_, th, tx, ty = p
    c, sn = np.cos(th), np.sin(th)
    m = to_m(pts)
    return np.column_stack([s_ * (c * m[:, 0] - sn * m[:, 1]) + tx, -s_ * (sn * m[:, 0] + c * m[:, 1]) + ty])


def fit_outline(blue, dark, poly):
    h, w = blue.shape
    ys, xs = np.where(blue)
    minx, miny, maxx, maxy = poly.bounds
    wm = (maxx - minx) * KX; hm = (maxy - miny) * KY
    s0 = 0.5 * ((xs.max() - xs.min()) / wm + (ys.max() - ys.min()) / hm)
    cx0, cy0 = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    mx, my = ((minx + maxx) / 2 - LON0) * KX, ((miny + maxy) / 2 - LAT0) * KY
    p0 = np.array([s0, 0.0, cx0 - s0 * mx, cy0 + s0 * my])
    dist = ndimage.distance_transform_edt(~dark)
    pts = boundary_points(poly)
    def cham(p):
        q = apply(p, pts)
        xi = np.clip(np.round(q[:, 0]).astype(int), 0, w - 1); yi = np.clip(np.round(q[:, 1]).astype(int), 0, h - 1)
        return np.minimum(dist[yi, xi], 12).mean()          # truncated, so gaps in the printed outline do not dominate
    bounds = [(s0 * 0.8, s0 * 1.25), (np.radians(-6), np.radians(6)), (p0[2] - 60, p0[2] + 60), (p0[3] - 60, p0[3] + 60)]
    best = minimize(cham, p0, method='Powell', bounds=bounds, options={'xtol': 1e-4, 'ftol': 1e-7, 'maxiter': 80})
    # overlap with the blue fill, for reporting
    m = rasterize(poly, best.x, (w, h))
    iou = (m & blue).sum() / max(1, (m | blue).sum())
    return best.x, iou, cham(best.x), cham(p0)


def px_to_lonlat(x, y, p):
    s, th, tx, ty = p
    c, sn = np.cos(th), np.sin(th)
    u, v = (x - tx) / s, -(y - ty) / s           # metres in the rotated frame
    mx = c * u + sn * v; my = -sn * u + c * v
    return LON0 + mx / KX, LAT0 + my / KY


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pdf'); ap.add_argument('--page', type=int, default=116); ap.add_argument('--image'); ap.add_argument('--overlay', help='write a PNG with the fitted outline and detected dots, for checking')
    args = ap.parse_args()
    if not (args.pdf or args.image):
        ap.error('give --pdf or --image')
    im = load_image(args)
    a = np.array(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    map_box = (130, 95, 670, 520)                                # frame of the map on the 792 x 1102 page image
    blue = (b > 200) & (r < 200) & (r > 120) & (g > 150) & (b - r > 30)
    keep = np.zeros_like(blue); keep[map_box[1]:map_box[3] - 60, map_box[0]:map_box[2]] = True   # exclude legend and scale bar
    blue &= keep
    blue = ndimage.binary_closing(blue, iterations=3) | blue
    blue = ndimage.binary_fill_holes(ndimage.binary_closing(blue, iterations=6))
    poly = delhi_outline()
    dark = (r < 90) & (g < 90) & (b < 90)
    near = ndimage.binary_dilation(blue, iterations=5)
    dark &= near & ~ndimage.binary_erosion(blue, iterations=3)          # the thick black outer boundary, not text or district lines
    params, iou, cd, cd0 = fit_outline(blue, dark, poly)
    mpp = 1 / params[0]
    print('outline fit: mean boundary distance %.2f px (start %.2f), IoU %.3f, %.0f m per pixel, rotation %.2f deg' % (cd, cd0, iou, mpp, np.degrees(params[1])))

    # dots: saturated orange / red marks, excluding the legend and text
    dot = (r > 140) & (r - b > 20)                                   # orange, red and pale tan marks; not blue, white or grey
    dot[: map_box[1]] = False; dot[map_box[3] - 90:] = False; dot[:, : map_box[0]] = False; dot[:, map_box[2]:] = False
    dot[470:, :300] = False
    dot = ndimage.binary_opening(dot, iterations=1)
    lab, n = ndimage.label(dot)
    areas = ndimage.sum(dot, lab, range(1, n + 1))
    single = np.median(areas[(areas > 30) & (areas < 110)]) if len(areas) else 60
    print('components', n, 'median single-dot area', single)
    dots = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(xs) < 20:
            continue
        k = max(1, int(round(len(xs) / single)))
        if k == 1:
            centres = [(xs.mean(), ys.mean())]
        else:
            pts = np.column_stack([xs, ys]).astype(float)
            cen, _ = kmeans2(pts, k, minit='++', seed=1)
            centres = [tuple(c) for c in cen]
        for cx, cy in centres:
            patch = a[int(max(cy - 2, 0)):int(cy + 3), int(max(cx - 2, 0)):int(cx + 3)].reshape(-1, 3).mean(0)
            lon, lat = px_to_lonlat(cx, cy, params)
            dots.append({'x': round(float(cx), 1), 'y': round(float(cy), 1), 'lon': round(float(lon), 5), 'lat': round(float(lat), 5),
                         'rgb': [int(v) for v in patch], 'component_dots': k})
    print('dots detected', len(dots), '(report says 111)')
    out = {
        'source': 'Delhi Road Crash Report 2024 (Delhi Traffic Police), Map 6.1 Road Crash Prone Zones-2024 (111), PDF page %d' % args.page,
        'method': 'Raster registered to the Delhi outline by maximising overlap (similarity transform); dots found by colour, merged blobs split by k-means on area.',
        'georeference': {'mean_boundary_distance_px': round(float(cd), 2), 'iou_with_delhi_outline': round(float(iou), 3), 'metres_per_pixel': round(float(mpp), 1), 'rotation_deg': round(float(np.degrees(params[1])), 2)},
        'caveat': 'About 150 m per pixel and dots about 1 km wide: positions are good to a few hundred metres at best, and dots overlap in the centre.',
        'dots_detected': len(dots), 'dots': dots,
    }
    if args.overlay:
        ov = im.copy(); d = ImageDraw.Draw(ov)
        o = rasterize(poly, params, im.size)
        edge = o ^ ndimage.binary_erosion(o)
        arr = np.array(ov); arr[edge] = (0, 150, 0); ov = Image.fromarray(arr); d = ImageDraw.Draw(ov)
        for q in dots:
            d.ellipse([q['x'] - 4, q['y'] - 4, q['x'] + 4, q['y'] + 4], outline=(0, 0, 255))
        ov.crop(map_box).resize(((map_box[2] - map_box[0]) * 3, (map_box[3] - map_box[1]) * 3), Image.LANCZOS).save(args.overlay)
    json.dump(out, open(OUT, 'w'), indent=1)
    print('wrote', OUT)


if __name__ == '__main__':
    main()
