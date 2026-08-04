import json

from typer.testing import CliRunner

from delhi_data_2025.cli import app
from delhi_data_2025.extraction.crime_monitor import monitor_crime
from delhi_data_2025.models import SourceConfig
from delhi_data_2025.pipeline import collect, prepare_dashboard_patch

runner = CliRunner()


def test_cli_help():
    assert runner.invoke(app, ["--help"]).exit_code == 0


def test_absent_crime_is_not_published():
    source = SourceConfig(
        source_id="ncrb",
        agency="NCRB",
        dataset="crime",
        year=2025,
        page_url="https://ncrb.gov.in/",
        allowed_domains=["ncrb.gov.in"],
        mode="monitor",
    )
    result = monitor_crime(source, [])
    assert result.status.value == "not_published" and result.collected_year == 2024


def test_offline_fixture_pipeline_and_safe_gate(tmp_path):
    manifests = tmp_path / "manifests"
    manifests.mkdir(parents=True)
    (manifests / "source_manifest_2025.json").write_text(
        json.dumps({"year": 2025, "sources": []}), encoding="utf-8"
    )
    (manifests / "download_manifest_2025.json").write_text(
        json.dumps({"year": 2025, "downloads": []}), encoding="utf-8"
    )
    collect(2025, offline=True, root=tmp_path)
    assert (tmp_path / "reports" / "coverage_report_2025.md").exists()
    assert "currently 2024" in (tmp_path / "reports" / "coverage_report_2025.md").read_text()
    proposal = prepare_dashboard_patch(2025, root=tmp_path)
    assert proposal["SAFE_TO_INTEGRATE"] is False and proposal["production_files_modified"] is False
