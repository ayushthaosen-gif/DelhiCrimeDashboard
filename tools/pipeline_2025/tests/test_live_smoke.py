import httpx
import pytest


@pytest.mark.live
def test_source_pages_reachable():
    for url in ["https://ncrb.gov.in/", "https://traffic.delhipolice.gov.in/"]:
        response = httpx.get(
            url,
            timeout=20,
            follow_redirects=True,
            headers={"User-Agent": "DelhiCrimeDashboard-2025-Pipeline-Smoke/0.1"},
        )
        assert response.status_code < 500
