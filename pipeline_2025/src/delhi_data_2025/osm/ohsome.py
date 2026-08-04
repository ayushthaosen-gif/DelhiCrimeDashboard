from __future__ import annotations

import json

SNAPSHOT = "2025-12-31T23:59:59Z"


def request_payload(boundary_geojson: dict, tag_filter: str, snapshot: str = SNAPSHOT) -> dict:
    return {
        "bpolys": json.dumps(boundary_geojson, separators=(",", ":")),
        "filter": tag_filter,
        "time": snapshot,
        "properties": "tags,metadata",
    }


def collect_layer(
    client, endpoint: str, domains: list[str], boundary: dict, tag_filter: str
) -> dict:
    if not endpoint.startswith("https://api.ohsome.org/"):
        raise ValueError("Unexpected ohsome endpoint")
    response = client.client.post(
        endpoint,
        data=request_payload(boundary, tag_filter),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    response.raise_for_status()
    return response.json()
