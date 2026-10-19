"""Put the checked-in raw source files where the offline pipeline expects them.

``output/raw/`` is not committed, but the exact official files the 2025 collection used are kept in
``data/releases/2025/raw_sources/``. This copies each file to ``output/raw/<source_id>/<name>`` when
its SHA-256 equals the one recorded in the download manifest, so an offline run on a clean checkout
(for example in CI) starts from the same inputs as the run that produced the committed reports.
A file whose checksum does not match is never restored: it would not be the file the manifest names.

    python -m delhi_data_2025.raw_restore [--from data/releases/2025/raw_sources]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from .config import PACKAGE_ROOT, output_paths, portable_path

DEFAULT_SOURCE = PACKAGE_ROOT.parents[1] / "data" / "releases" / "2025" / "raw_sources"


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def restore(raw_sources: Path = DEFAULT_SOURCE, root: Path | None = None, year: int = 2025) -> dict:
    """-> {"restored": [...], "present": [...], "unmatched": [...]} using portable paths."""
    paths = output_paths(root)
    manifest = json.loads((paths.manifests / f"download_manifest_{year}.json").read_text("utf-8"))
    by_hash = {}
    if raw_sources.is_dir():
        for candidate in sorted(raw_sources.iterdir()):
            if candidate.is_file():
                by_hash.setdefault(_sha256(candidate), candidate)
    result = {"restored": [], "present": [], "unmatched": []}
    for item in manifest.get("downloads", []):
        relative = portable_path(item["local_path"])
        destination = paths.root / relative
        if destination.exists():
            result["present"].append(relative)
        elif item["sha256"] in by_hash:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(by_hash[item["sha256"]], destination)
            result["restored"].append(relative)
        else:
            result["unmatched"].append(relative)
    return result


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--from", dest="source", type=Path, default=DEFAULT_SOURCE)
    args = ap.parse_args(argv)
    result = restore(args.source)
    for key in ("restored", "present", "unmatched"):
        print(f"{key}: {len(result[key])}", *result[key])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
