"""Extract the archived WGS84 shapefile without modifying the original ZIP.

Requires pyshp==2.3.1. Run from any directory; paths resolve to the repository.
The generated GeoJSON is checked in so ordinary Node builds require no Python.
"""
import hashlib
import io
import json
from pathlib import Path
import zipfile
import shapefile

BASE = Path(__file__).resolve().parents[1] / 'data/staged/police_geography_history'
raw = (BASE / 'raw/police_stations_2014.zip').read_bytes()
assert hashlib.sha256(raw).hexdigest() == '72d35143e8dbbc1b76f55db22ab315449ca89a080a3c894436b5b402770c9049'
with zipfile.ZipFile(io.BytesIO(raw)) as archive:
    # Read fixed members in memory rather than extracting arbitrary archive paths.
    stem = 'police stations/delhipolicestations'
    projection = archive.read(stem + '.prj').decode()
    assert 'WGS_1984' in projection
    reader = shapefile.Reader(**{ext: io.BytesIO(archive.read(stem + '.' + ext)) for ext in ('shp', 'shx', 'dbf')})
    assert len(reader) == 163
    features = [{'type': 'Feature', 'properties': row.record.as_dict(), 'geometry': row.shape.__geo_interface__} for row in reader.iterShapeRecords()]
    (BASE / 'raw/stations_2014.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False) + '\n', encoding='utf-8')
print('Extracted 163 archived station polygons in WGS84.')
