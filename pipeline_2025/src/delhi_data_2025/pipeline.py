from __future__ import annotations

import csv
import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from .config import PACKAGE_ROOT, load_sources, load_yaml, output_paths
from .discovery import discover_source
from .download import download_candidate
from .extraction.crime_monitor import monitor_crime
from .extraction.html_tables import extract_tables
from .extraction.irad import INTEGER_FIELDS, extract_irad, extract_irad_pdf_tables
from .extraction.liquor_vends import extract_vends
from .extraction.pdf_text import extract_pdf_text
from .http import SafeHttpClient, redact_url
from .models import Candidate, DatasetResult, DatasetStatus, DownloadRecord, ProvenanceRecord
from .normalization.police_stations import apply_crosswalk, load_crosswalk
from .normalization.road_crashes import aggregate_by_police_district
from .osm.normalize import normalize_collection
from .osm.ohsome import request_payload
from .provenance import append_jsonl, write_audit_csv
from .reporting import coverage_markdown, validation_markdown, write_json, write_review_csv
from .validation.police_stations import validate_station_mapping
from .validation.road_crashes import validate_road_crashes

LOG = logging.getLogger("delhi_data_2025")


def _json(path: Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _client(settings):
    return SafeHttpClient(
        settings.get("user_agent", "DelhiCrimeDashboard-2025-Pipeline/0.1"),
        settings.get("request_timeout_seconds", 30),
        settings.get("requests_per_second_per_host", 1),
        settings.get("max_file_size_bytes", 52_428_800),
    )


def discover(year=2025, source_id=None, offline=False, root=None):
    paths = output_paths(root)
    settings, sources = load_sources()
    manifest = {"year": year, "generated_at": datetime.now(UTC).isoformat(), "sources": []}
    old = paths.manifests / f"source_manifest_{year}.json"
    if offline:
        if not old.exists():
            raise RuntimeError("Offline discovery requires an existing source manifest")
        return _json(old, {})
    client = _client(settings)
    try:
        for sid, source in sources.items():
            if source.year != year or (source_id and sid != source_id):
                continue
            entry = {
                "source_id": sid,
                "agency": source.agency,
                "dataset": source.dataset,
                "mode": source.mode.value,
                "page_url": str(source.page_url or source.endpoint),
                "candidates": [],
                "error": None,
            }
            try:
                if source.endpoint and not source.page_url:
                    entry["candidates"] = [
                        Candidate(
                            source_id=sid,
                            title=f"ohsome historical snapshot {year}",
                            url=str(source.endpoint),
                            score=100,
                            reasons=["configured exact snapshot endpoint"],
                            selected=True,
                        ).model_dump(mode="json")
                    ]
                else:
                    entry["candidates"] = [
                        c.model_dump(mode="json") for c in discover_source(source, client)
                    ]
            except Exception as exc:
                entry["error"] = str(exc)
                LOG.error(
                    json.dumps(
                        {
                            "event": "discovery_error",
                            "source_id": sid,
                            "url": redact_url(entry["page_url"]),
                            "error": str(exc),
                        }
                    )
                )
            manifest["sources"].append(entry)
    finally:
        client.close()
    write_json(old, manifest)
    return manifest


def _download_osm(source, client, paths) -> list[DownloadRecord]:
    filters = load_yaml(PACKAGE_ROOT / "config" / "osm_filters.yml")["filters"]
    boundary_path = PACKAGE_ROOT.parent / "data" / "dashboard_boundaries_simplified.geojson"
    boundary = json.loads(boundary_path.read_text(encoding="utf-8"))
    records = []
    for layer, tag_filter in filters.items():
        response = client.post_form(
            str(source.endpoint),
            source.allowed_domains,
            request_payload(boundary, tag_filter, source.snapshot_time.isoformat()),
        )
        payload = response.content
        digest = hashlib.sha256(payload).hexdigest()
        destination = paths.raw / source.source_id / f"{layer}-{digest[:12]}.geojson"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            destination.write_bytes(payload)
        records.append(
            DownloadRecord(
                source_id=source.source_id,
                agency=source.agency,
                dataset=source.dataset,
                year=source.year,
                landing_page_url=str(source.endpoint),
                download_url=str(source.endpoint),
                resolved_url=str(response.url),
                retrieved_at_utc=datetime.now(UTC),
                http_status=response.status_code,
                content_type=response.headers.get("content-type"),
                content_length=len(payload),
                sha256=digest,
                etag=response.headers.get("etag"),
                last_modified=response.headers.get("last-modified"),
                local_path=str(destination),
                licence_or_terms="OpenStreetMap contributors, ODbL",
                snapshot_date=source.snapshot_time.isoformat(),
            )
        )
    return records


def download(year=2025, source_id=None, offline=False, root=None):
    paths = output_paths(root)
    settings, sources = load_sources()
    manifest = _json(paths.manifests / f"source_manifest_{year}.json", None)
    if manifest is None:
        raise RuntimeError("Run discover before download")
    if offline:
        return _json(
            paths.manifests / f"download_manifest_{year}.json", {"year": year, "downloads": []}
        )
    client = _client(settings)
    records = []
    errors = []
    try:
        for entry in manifest["sources"]:
            sid = entry["source_id"]
            if source_id and sid != source_id:
                continue
            source = sources[sid]
            if source.mode.value == "monitor":
                continue
            if source.endpoint:
                try:
                    records.extend(_download_osm(source, client, paths))
                except Exception as exc:
                    errors.append({"source_id": sid, "error": str(exc)})
                continue
            for item in entry.get("candidates", []):
                if not item.get("selected"):
                    continue
                try:
                    records.append(
                        download_candidate(
                            source, Candidate.model_validate(item), client, paths.raw
                        )
                    )
                except Exception as exc:
                    errors.append({"source_id": sid, "error": str(exc)})
    finally:
        client.close()
    result = {
        "year": year,
        "downloads": [r.model_dump(mode="json") for r in records],
        "errors": errors,
    }
    write_json(paths.manifests / f"download_manifest_{year}.json", result)
    return result


def extract(year=2025, source_id=None, offline=False, root=None):
    paths = output_paths(root)
    _, sources = load_sources()
    downloads = _json(paths.manifests / f"download_manifest_{year}.json", {"downloads": []})
    extracted = []
    review = []
    for item in downloads["downloads"]:
        if source_id and item["source_id"] != source_id:
            continue
        source = sources[item["source_id"]]
        path = Path(item["local_path"])
        tables = []
        pdf_text = None
        pdf_rows = []
        try:
            content_type = str(item.get("content_type") or "").lower()
            if path.suffix.lower() in {".html", ".htm"} or "html" in content_type:
                tables = extract_tables(path.read_text(encoding="utf-8", errors="replace"))
            elif path.suffix.lower() == ".pdf":
                pdf_text, status = extract_pdf_text(path)
                if source.dataset == "irad_edar":
                    pdf_rows = extract_irad_pdf_tables(path, source.source_id)
                if status == "needs_manual_review":
                    review.append(
                        {
                            "source_id": source.source_id,
                            "source_file": str(path),
                            "reason": "insufficient extractable PDF text",
                        }
                    )
            if source.dataset == "irad_edar":
                rows, status = (
                    (pdf_rows, "extracted")
                    if pdf_rows
                    else extract_irad(tables, pdf_text, source.source_id)
                )
                extracted += rows
                if status == "needs_manual_review":
                    review.append(
                        {
                            "source_id": source.source_id,
                            "source_file": str(path),
                            "reason": "no supported iRAD table layout matched",
                        }
                    )
            elif source.dataset.startswith("liquor_vends"):
                vend_rows = extract_vends(
                    tables, source.source_id, source.agency, source.mode.value == "collect"
                )
                for vend in vend_rows:
                    vend["source_file"] = str(path)
                extracted += vend_rows
        except Exception as exc:
            review.append(
                {"source_id": source.source_id, "source_file": str(path), "reason": str(exc)}
            )
    write_json(paths.extracted / f"extracted_{year}.json", extracted)
    write_review_csv(
        paths.review_queue / f"pdf_extraction_review_{year}.csv",
        ["source_id", "source_file", "reason"],
        review,
    )
    return {"rows": len(extracted), "review": len(review)}


def _write_csv(path: Path, rows: list[dict], headers: list[str]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def normalize(year=2025, source_id=None, offline=False, root=None):
    paths = output_paths(root)
    rows = _json(paths.extracted / f"extracted_{year}.json", [])
    crash = [r for r in rows if "fatal_accidents" in r]
    vends = [r for r in rows if "vend_name" in r]
    crosswalk = load_crosswalk(PACKAGE_ROOT / "config" / "police_station_crosswalk.csv")
    crash, unmapped = apply_crosswalk(crash, crosswalk)
    districts = aggregate_by_police_district(crash)
    crash_headers = [
        "source_id",
        "source_file",
        "source_page",
        "revenue_district",
        "police_station_raw",
        "police_station_normalized",
        "police_district",
        "period_start",
        "period_end",
        *INTEGER_FIELDS,
        "extraction_method",
        "extraction_confidence",
        "review_status",
        "notes",
    ]
    _write_csv(paths.processed / f"road_crashes_by_police_station_{year}.csv", crash, crash_headers)
    _write_csv(
        paths.processed / f"road_crashes_by_police_district_{year}.csv",
        districts,
        ["police_district", *INTEGER_FIELDS],
    )
    _write_csv(
        paths.processed / f"liquor_vends_{year}.csv",
        vends,
        list(vends[0])
        if vends
        else [
            "source_id",
            "agency",
            "corporation",
            "vend_name",
            "address",
            "licence_number",
            "licence_type",
            "status",
            "valid_from",
            "valid_to",
            "snapshot_date",
            "temporal_status",
            "latitude",
            "longitude",
            "coordinate_source",
            "coordinate_confidence",
            "coordinate_is_approximate",
            "geocode_review_status",
            "source_file",
            "source_page",
        ],
    )
    downloads = _json(paths.manifests / f"download_manifest_{year}.json", {"downloads": []})
    provenance = [
        ProvenanceRecord(
            source_id=item["source_id"],
            agency=item["agency"],
            source_title=item["dataset"],
            source_url=item["resolved_url"],
            landing_page_url=item["landing_page_url"],
            source_file=item["local_path"],
            source_year=item["year"],
            retrieval_date=str(item["retrieved_at_utc"]),
            extraction_method="automated download; dataset-specific parser",
            extraction_confidence=0.8,
            review_status="needs_review",
            notes="Raw source retained immutably; missing values remain null.",
        )
        for item in downloads.get("downloads", [])
    ]
    append_jsonl(paths.processed / f"provenance_{year}.jsonl", provenance)
    write_audit_csv(paths.reports / f"source_audit_{year}.csv", provenance)
    osm_features = []
    osm_layer_dir = paths.processed / f"osm_layers_{year}"
    osm_layer_dir.mkdir(parents=True, exist_ok=True)
    for item in downloads.get("downloads", []):
        if item["source_id"] != "osm_snapshot_2025":
            continue
        raw_path = Path(item["local_path"])
        layer = raw_path.stem.rsplit("-", 1)[0]
        normalized = normalize_collection(_json(raw_path, {}), layer)
        write_json(osm_layer_dir / f"{layer}.geojson", normalized)
        osm_features.extend(normalized["features"])
    osm_output = paths.processed / f"osm_infrastructure_{year}.geojson"
    if osm_features:
        write_json(
            osm_output,
            {
                "type": "FeatureCollection",
                "features": osm_features,
                "attribution": "OpenStreetMap contributors, ODbL",
                "inventory_warning": "Historical mapped coverage; not a complete inventory.",
            },
        )
    elif not osm_output.exists():
        write_json(
            osm_output,
            {
                "type": "FeatureCollection",
                "features": [],
                "metadata": {
                    "status": "not_collected",
                    "snapshot": f"{year}-12-31T23:59:59Z",
                    "warning": "Empty means unavailable, not zero infrastructure.",
                    "attribution": "© OpenStreetMap contributors, ODbL",
                },
            },
        )
    _write_csv(paths.review_queue / f"unmapped_police_stations_{year}.csv", unmapped, crash_headers)
    _write_csv(
        paths.review_queue / f"temporal_ambiguity_{year}.csv",
        [v for v in vends if v.get("temporal_status") == "unclear"],
        list(vends[0]) if vends else ["source_id", "vend_name", "temporal_status"],
    )
    return {
        "road_crashes": len(crash),
        "districts": len(districts),
        "liquor_vends": len(vends),
        "unmapped": len(unmapped),
    }


def validate(year=2025, strict=False, root=None):
    paths = output_paths(root)
    extracted = _json(paths.extracted / f"extracted_{year}.json", [])
    crash = [r for r in extracted if "fatal_accidents" in r]
    crosswalk = load_crosswalk(PACKAGE_ROOT / "config" / "police_station_crosswalk.csv")
    crash, _ = apply_crosswalk(crash, crosswalk)
    issues = validate_road_crashes(crash, strict) + validate_station_mapping(crash) if crash else []
    result = {
        "year": year,
        "strict": strict,
        "valid": not any(i.severity == "error" for i in issues),
        "issues": [i.model_dump(mode="json") for i in issues],
    }
    write_json(paths.reports / f"validation_report_{year}.json", result)
    (paths.reports / f"validation_report_{year}.md").write_text(
        validation_markdown(issues), encoding="utf-8"
    )
    return result


def report(year=2025, root=None):
    paths = output_paths(root)
    _, sources = load_sources()
    manifest = _json(paths.manifests / f"source_manifest_{year}.json", {"sources": []})
    by_id = {e["source_id"]: e for e in manifest["sources"]}
    downloads = _json(paths.manifests / f"download_manifest_{year}.json", {"downloads": []})
    downloaded_ids = {item["source_id"] for item in downloads.get("downloads", [])}
    results = []
    for sid, source in sources.items():
        entry = by_id.get(sid, {"candidates": [], "error": None})
        candidates = [Candidate.model_validate(c) for c in entry.get("candidates", [])]
        if source.dataset == "crime":
            results.append(monitor_crime(source, candidates))
            continue
        selected = next((c for c in candidates if c.selected), None)
        status = (
            DatasetStatus.FAILED
            if entry.get("error")
            else DatasetStatus.COLLECTED_NEEDS_REVIEW
            if selected and sid in downloaded_ids
            else DatasetStatus.USER_INPUT_REQUIRED
            if selected
            else DatasetStatus.NOT_PUBLISHED
            if source.mode.value == "monitor"
            else DatasetStatus.NOT_AVAILABLE
        )
        results.append(
            DatasetResult(
                source_id=sid,
                dataset=source.dataset,
                requested_year=year,
                collected_year=year if sid in downloaded_ids else None,
                status=status,
                coverage="downloaded; requires extraction validation"
                if sid in downloaded_ids
                else "official candidate discovered; not downloaded"
                if selected
                else "No qualifying official 2025 source discovered",
                source=str(selected.url) if selected else str(source.page_url or source.endpoint),
                blocking_issues=[entry["error"]] if entry.get("error") else [],
            )
        )
    results += [
        DatasetResult(
            source_id="streetlights_legacy",
            dataset="streetlights",
            requested_year=year,
            collected_year=None,
            status=DatasetStatus.RETAINED_LEGACY_YEAR,
            coverage="No authoritative 2025 replacement configured",
            source="Existing PAPL survey",
            blocking_issues=["Do not relabel legacy survey as 2025"],
        ),
        DatasetResult(
            source_id="underpasses_legacy",
            dataset="underpasses",
            requested_year=year,
            collected_year=None,
            status=DatasetStatus.RETAINED_LEGACY_YEAR,
            coverage="No authoritative 2025 replacement configured",
            source="Existing PAPL survey",
            blocking_issues=["Do not relabel legacy survey as 2025"],
        ),
    ]
    text = coverage_markdown(results)
    (paths.reports / f"coverage_report_{year}.md").write_text(text, encoding="utf-8")
    return [r.model_dump(mode="json") for r in results]


def prepare_dashboard_patch(year=2025, root=None):
    paths = output_paths(root)
    validation = _json(
        paths.reports / f"validation_report_{year}.json", {"valid": False, "issues": []}
    )
    coverage = report(year, root)
    crime = next(r for r in coverage if r["dataset"] == "crime")
    unresolved = paths.review_queue / f"unmapped_police_stations_{year}.csv"
    has_unresolved = (
        unresolved.exists() and len(unresolved.read_text(encoding="utf-8").splitlines()) > 1
    )
    safe = (
        bool(validation.get("valid")) and crime["status"] != "not_published" and not has_unresolved
    )
    proposal = {
        "SAFE_TO_INTEGRATE": safe,
        "year": year,
        "field_mapping": {
            "road_crashes": "candidate only after reviewed crosswalk",
            "crime": "BNS terminology; no totalIPC2025",
            "osm": "latest historical snapshot with ODbL attribution",
        },
        "schema_differences": [
            "Revenue districts are not police districts",
            "2025 crime is BNS-era",
            "Coordinates may be approximate",
        ],
        "unresolved_records": has_unresolved,
        "production_files_modified": False,
    }
    write_json(paths.proposed_patch / "integration_readiness.json", proposal)
    (paths.proposed_patch / "proposed_changes.patch").write_text(
        "# Human-reviewed patch placeholder; production files intentionally unchanged.\n",
        encoding="utf-8",
    )
    return proposal


def collect(year=2025, source_id=None, offline=False, root=None):
    discover(year, source_id, offline, root)
    download(year, source_id, offline, root)
    extract(year, source_id, offline, root)
    normalize(year, source_id, offline, root)
    validation = validate(year, False, root)
    coverage = report(year, root)
    return {"validation": validation, "coverage": coverage}
