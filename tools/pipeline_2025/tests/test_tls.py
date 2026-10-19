import ssl
from pathlib import Path

import delhi_data_2025
from delhi_data_2025.http import tls_context


def test_tls_verification_is_on_and_adds_the_system_store():
    context = tls_context()
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True


def test_pipeline_never_turns_certificate_verification_off():
    source = Path(delhi_data_2025.__file__).parent
    for path in source.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        assert "verify=False" not in text, path.name
        assert "CERT_NONE" not in text, path.name
        assert "_create_unverified_context" not in text, path.name
