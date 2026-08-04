from __future__ import annotations

from pathlib import Path

import yaml

from .models import PipelinePaths, SourceConfig

PACKAGE_ROOT = Path(__file__).resolve().parents[2]


def load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def load_sources(path: Path | None = None) -> tuple[dict, dict[str, SourceConfig]]:
    document = load_yaml(path or PACKAGE_ROOT / "config" / "sources.yml")
    sources = {
        source_id: SourceConfig(source_id=source_id, **value)
        for source_id, value in document.get("sources", {}).items()
    }
    return document.get("settings", {}), sources


def output_paths(root: Path | None = None) -> PipelinePaths:
    base = root or PACKAGE_ROOT / "output"
    paths = PipelinePaths(
        root=base,
        raw=base / "raw",
        manifests=base / "manifests",
        extracted=base / "extracted",
        processed=base / "processed",
        review_queue=base / "review_queue",
        reports=base / "reports",
        proposed_patch=base / "proposed_dashboard_patch",
    )
    for value in paths.model_dump().values():
        Path(value).mkdir(parents=True, exist_ok=True)
    return paths
