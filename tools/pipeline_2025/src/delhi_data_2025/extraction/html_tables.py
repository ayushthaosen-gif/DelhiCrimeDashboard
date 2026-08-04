from __future__ import annotations

from io import StringIO

import pandas as pd


def extract_tables(html: str) -> list[list[dict]]:
    try:
        return [
            frame.where(frame.notna(), None).to_dict("records")
            for frame in pd.read_html(StringIO(html))
        ]
    except ValueError:
        return []
