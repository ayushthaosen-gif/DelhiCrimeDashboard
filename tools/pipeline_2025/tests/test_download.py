import json
from types import SimpleNamespace

import httpx

from delhi_data_2025.http import SafeHttpClient, allowed, redact_url, signature_ok
from delhi_data_2025.pipeline import _download_manifest


def test_allowlist_and_redaction():
    assert allowed("https://sub.delhi.gov.in/a", ["delhi.gov.in"])
    assert not allowed("https://delhi.gov.in.evil.test/a", ["delhi.gov.in"])
    assert "secret" not in redact_url("https://x.test/a?token=secret&year=2025")


def test_signatures():
    assert signature_ok(b"%PDF-1.7 data", "application/pdf", ".pdf")
    assert signature_ok(b'{"ok":true}', "application/json", ".json")
    assert not signature_ok(b"<html>error</html>", "application/pdf", ".pdf")


def test_checksum_cache_behavior(tmp_path):
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200, content=b"a,b\n1,2\n", headers={"content-type": "text/csv"}, request=request
        )
    )
    client = SafeHttpClient("test", rate=1000, transport=transport)
    dest = tmp_path / "data.csv"
    _, first, unchanged1 = client.download(
        "https://official.test/data.csv", ["official.test"], dest
    )
    _, second, unchanged2 = client.download(
        "https://official.test/data.csv", ["official.test"], dest
    )
    client.close()
    assert first == second and unchanged1 is False and unchanged2 is True


def test_manifest_paths_rebase_after_repository_move(tmp_path):
    manifests = tmp_path / "manifests"
    raw = tmp_path / "raw"
    current = raw / "official_source" / "source.pdf"
    manifests.mkdir()
    current.parent.mkdir(parents=True)
    current.write_bytes(b"%PDF-1.7")
    manifest_path = manifests / "download_manifest_2025.json"
    manifest_path.write_text(
        json.dumps(
            {
                "year": 2025,
                "downloads": [
                    {
                        "source_id": "official_source",
                        "local_path": "C:/obsolete/location/source.pdf",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    result = _download_manifest(SimpleNamespace(manifests=manifests, raw=raw), 2025)

    assert result["downloads"][0]["local_path"] == str(current)
    assert json.loads(manifest_path.read_text(encoding="utf-8"))["downloads"][0][
        "local_path"
    ] == str(current)
