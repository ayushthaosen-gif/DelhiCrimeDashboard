import httpx

from delhi_data_2025.http import SafeHttpClient, allowed, redact_url, signature_ok


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
