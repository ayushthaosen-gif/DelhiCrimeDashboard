from __future__ import annotations

from collections import defaultdict

NUMBERS = [
    "fatal_accidents",
    "serious_injury_accidents",
    "minor_injury_accidents",
    "non_injury_accidents",
    "simple_accidents",
    "total_accidents",
    "persons_killed",
    "persons_injured",
]


def aggregate_by_police_district(rows: list[dict]) -> list[dict]:
    grouped = defaultdict(lambda: {key: 0 for key in NUMBERS})
    seen = defaultdict(lambda: {key: False for key in NUMBERS})
    for row in rows:
        district = row.get("police_district")
        if not district:
            continue
        for key in NUMBERS:
            if row.get(key) is not None:
                grouped[district][key] += row[key]
                seen[district][key] = True
    return [
        {
            "police_district": district,
            **{k: totals[k] if seen[district][k] else None for k in NUMBERS},
        }
        for district, totals in sorted(grouped.items())
    ]
