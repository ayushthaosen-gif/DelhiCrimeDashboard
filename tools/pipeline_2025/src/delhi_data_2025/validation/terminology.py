from __future__ import annotations

from ..models import ValidationIssue

BANNED = [
    ("complete official inventory", "OSM data must not be called complete"),
    ("delhi police recommendation", "Model output must not be attributed to Delhi Police"),
    ("totalIPC2025", "2025 is BNS-era; do not create IPC-labelled 2025 fields"),
]


def validate_terminology(text: str) -> list[ValidationIssue]:
    low = text.lower()
    return [
        ValidationIssue(severity="error", code="unsafe_terminology", message=message)
        for phrase, message in BANNED
        if phrase.lower() in low
    ]
