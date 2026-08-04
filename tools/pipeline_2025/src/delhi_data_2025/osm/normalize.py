from __future__ import annotations

REQUIRED_METADATA = ["@osmId", "@version", "@changesetId", "@lastEdit", "@snapshotTimestamp"]


def normalize_collection(collection: dict, layer: str) -> dict:
    result = {
        "type": "FeatureCollection",
        "features": [],
        "attribution": "OpenStreetMap contributors, ODbL",
        "inventory_warning": "Historical OSM snapshot; not a complete infrastructure inventory.",
    }
    for feature in collection.get("features", []):
        props = dict(feature.get("properties", {}))
        props["layer"] = layer
        for key in REQUIRED_METADATA:
            props.setdefault(key, None)
        result["features"].append(
            {"type": "Feature", "geometry": feature.get("geometry"), "properties": props}
        )
    return result
