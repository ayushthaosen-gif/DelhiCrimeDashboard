import hashlib
import json

from delhi_data_2025.config import portable_path
from delhi_data_2025.pipeline import _download_manifest
from delhi_data_2025.raw_restore import restore


def _paths(root):
    from delhi_data_2025.config import output_paths

    return output_paths(root)


def test_portable_path_drops_the_machine_specific_prefix():
    windows = r"C:\Users\someone\.codex\x\tools\pipeline_2025\output\raw\irad_west\a-123.pdf"
    posix = "/home/runner/work/repo/tools/pipeline_2025/output/raw/irad_west/a-123.pdf"
    assert portable_path(windows) == "raw/irad_west/a-123.pdf"
    assert portable_path(posix) == "raw/irad_west/a-123.pdf"
    assert portable_path("raw/irad_west/a-123.pdf") == "raw/irad_west/a-123.pdf"
    assert portable_path("somefile.html") == "somefile.html"


def _write_manifest(paths, local_path, sha):
    item = {"source_id": "irad_west", "local_path": local_path, "sha256": sha}
    manifest = {"year": 2025, "downloads": [item], "errors": []}
    target = paths.manifests / "download_manifest_2025.json"
    target.write_text(json.dumps(manifest), encoding="utf-8")
    return target


def test_the_manifest_is_rewritten_with_portable_paths_and_callers_get_an_absolute_one(tmp_path):
    paths = _paths(tmp_path)
    target = _write_manifest(paths, r"D:\somewhere\output\raw\irad_west\f.pdf", "0" * 64)
    resolved = _download_manifest(paths, 2025)
    on_disk = json.loads(target.read_text(encoding="utf-8"))
    assert on_disk["downloads"][0]["local_path"] == "raw/irad_west/f.pdf"
    assert "portable_path" not in on_disk["downloads"][0]
    item = resolved["downloads"][0]
    assert item["portable_path"] == "raw/irad_west/f.pdf"
    assert item["local_path"] == str(tmp_path / "raw" / "irad_west" / "f.pdf")


def test_restore_copies_only_files_whose_checksum_matches(tmp_path):
    root, store = tmp_path / "output", tmp_path / "raw_sources"
    store.mkdir()
    good = b"the official file"
    (store / "official.pdf").write_bytes(good)
    (store / "other.pdf").write_bytes(b"a different file")
    paths = _paths(root)
    _write_manifest(paths, "raw/irad_west/f.pdf", hashlib.sha256(good).hexdigest())
    result = restore(store, root)
    assert result["restored"] == ["raw/irad_west/f.pdf"]
    assert (root / "raw" / "irad_west" / "f.pdf").read_bytes() == good
    assert restore(store, root)["present"] == ["raw/irad_west/f.pdf"]


def test_restore_never_substitutes_a_file_with_a_different_checksum(tmp_path):
    root, store = tmp_path / "output", tmp_path / "raw_sources"
    store.mkdir()
    (store / "changed.pdf").write_bytes(b"not the bytes the manifest names")
    paths = _paths(root)
    _write_manifest(paths, "raw/irad_west/f.pdf", "1" * 64)
    result = restore(store, root)
    assert result["unmatched"] == ["raw/irad_west/f.pdf"]
    assert not (root / "raw" / "irad_west" / "f.pdf").exists()
