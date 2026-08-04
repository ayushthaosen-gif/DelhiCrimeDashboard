from __future__ import annotations


def normalize_district(value: str | None, aliases: dict[str, list[str]]) -> str | None:
    if not value:
        return None
    key = " ".join(value.lower().replace("-", " ").split())
    for district, names in aliases.items():
        choices = [district, *names]
        if key in {" ".join(x.lower().replace("-", " ").split()) for x in choices}:
            return district
    return None
