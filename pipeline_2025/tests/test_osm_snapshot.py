from delhi_data_2025.osm.normalize import normalize_collection
from delhi_data_2025.osm.ohsome import SNAPSHOT, request_payload
from delhi_data_2025.validation.geojson import validate_geojson


def test_exact_snapshot_and_attribution():
    payload = request_payload({"type": "Polygon", "coordinates": []}, "amenity=atm")
    assert payload["time"] == "2025-12-31T23:59:59Z" == SNAPSHOT
    out = normalize_collection({"features": []}, "atms")
    assert "OpenStreetMap" in out["attribution"] and "not a complete" in out["inventory_warning"]


def test_geojson_coordinate_validation():
    good = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {"type": "Point", "coordinates": [77.2, 28.6]},
            }
        ],
    }
    assert validate_geojson(good) == []
