from __future__ import annotations

from ..models import ValidationIssue


def _coords(value):
    if isinstance(value, list) and value and isinstance(value[0], (int, float)):
        yield value
    elif isinstance(value, list):
        for child in value:
            yield from _coords(child)


def validate_geojson(collection: dict) -> list[ValidationIssue]:
    issues = []
    if collection.get("type") != "FeatureCollection":
        issues.append(
            ValidationIssue(
                severity="error", code="geojson_type", message="Expected FeatureCollection"
            )
        )
    for feature in collection.get("features", []):
        geometry = feature.get("geometry") or {}
        for point in _coords(geometry.get("coordinates", [])):
            if len(point) < 2 or not (-180 <= point[0] <= 180 and -90 <= point[1] <= 90):
                issues.append(
                    ValidationIssue(
                        severity="error",
                        code="coordinate_range",
                        message="Coordinate outside valid longitude/latitude range",
                        record=feature,
                    )
                )
    return issues
