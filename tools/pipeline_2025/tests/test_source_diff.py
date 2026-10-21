import json

from delhi_data_2025.source_diff import (
    diff_sources,
    is_candidate,
    load_known_urls,
    main,
    render,
)


def manifest(*sources):
    return {"year": 2025, "sources": list(sources)}


def source(sid, urls, error=None):
    cands = [
        {"source_id": sid, "url": u, "title": "T " + u, "score": s, "selected": sel}
        for u, s, sel in urls
    ]
    return {"source_id": sid, "error": error, "candidates": cands}


def test_no_change_means_no_issue():
    m = manifest(source("ncrb", [("https://a/1.pdf", 40, False)]))
    assert diff_sources(m, m)["changed"] is False


def test_a_new_link_is_reported_selected_first():
    old = manifest(source("ncrb", [("https://a/1.pdf", 40, False)]))
    new = manifest(
        source(
            "ncrb",
            [
                ("https://a/1.pdf", 40, False),
                ("https://a/2.pdf", 30, False),
                ("https://a/3.xlsx", 10, True),
            ],
        )
    )
    r = diff_sources(old, new)
    assert r["changed"]
    assert [c["url"] for c in r["added"]] == ["https://a/3.xlsx", "https://a/2.pdf"]


def test_images_and_low_scoring_pages_are_left_out_but_documents_and_strong_pages_stay():
    assert not is_candidate({"url": "https://x/Gallery/1.JPG", "score": 90})
    assert not is_candidate({"url": "https://x/award-ceremony", "score": 30})
    assert is_candidate({"url": "https://x/report", "score": 60})
    assert is_candidate({"url": "https://x/files/table.xlsx", "score": 10})
    assert is_candidate({"url": "https://x/page", "score": 5, "selected": True})
    old = manifest(source("t", []))
    junk = [("https://x/Gallery/1.JPG", 40, False), ("https://x/p", 30, False)]
    new = manifest(source("t", junk))
    r = diff_sources(old, new)
    assert not r["changed"] and r["skipped_noise"] == 2


def test_links_to_reports_already_collected_are_left_out(tmp_path):
    links = tmp_path / "source_links.json"
    links.write_text(
        json.dumps({"files": {"a.pdf": {"public_url": "https://a/2.pdf", "page_url": "https://a/p"}}}),
        encoding="utf-8",
    )
    known = load_known_urls(links)
    old = manifest(source("s", []))
    new = manifest(source("s", [("https://a/2.pdf", 40, False), ("https://a/9.pdf", 40, False)]))
    r = diff_sources(old, new, known)
    assert [c["url"] for c in r["added"]] == ["https://a/9.pdf"]
    assert r["skipped_known"] == 1


def test_a_selected_link_that_disappears_and_a_reachability_change_are_reported():
    old = manifest(source("x", [("https://x/1", 50, True)]), source("y", []))
    new = manifest(source("x", []), source("y", [], error="HTTP 500"))
    r = diff_sources(old, new)
    assert r["changed"]
    assert r["removed_selected"][0]["url"] == "https://x/1"
    assert r["status_changed"][0]["source_id"] == "y"


def test_an_unreachable_source_is_not_said_to_have_lost_its_links_and_timeouts_are_transient():
    old = manifest(source("x", [("https://x/1", 50, True)]))
    new = manifest(source("x", [], error="timed out"))
    r = diff_sources(old, new)
    assert not r["changed"] and r["unverifiable_removed"] == 1
    flaky_old = manifest(source("z", []))
    flaky_new = manifest(source("z", [], error="timed out"))
    assert not diff_sources(flaky_old, flaky_new)["changed"]
    ssl_new = manifest(source("z", [], error="[SSL: CERTIFICATE_VERIFY_FAILED]"))
    assert diff_sources(flaky_old, ssl_new)["status_changed"][0]["source_id"] == "z"


def test_the_note_says_nothing_was_integrated_and_what_was_left_out():
    old = manifest(source("ncrb", []))
    new = manifest(
        source("ncrb", [("https://a/2.pdf", 30, False), ("https://a/pic.jpg", 30, False)])
    )
    text = render(diff_sources(old, new), "baseline.json")
    assert "Nothing was downloaded" in text
    assert "https://a/2.pdf" in text
    assert "Left out of this note" in text and "1 new links that are images" in text


def test_the_note_carries_a_digest_that_changes_only_when_the_content_changes():
    old = manifest(source("s", []))
    one = manifest(source("s", [("https://s/a.pdf", 20, False)]))
    two = manifest(source("s", [("https://s/b.pdf", 20, False)]))
    first = render(diff_sources(old, one), "b.json")
    again = render(diff_sources(old, one), "b.json")
    other = render(diff_sources(old, two), "b.json")
    assert first == again and "monitor-digest:" in first
    assert first.split("monitor-digest: ")[1] != other.split("monitor-digest: ")[1]


def test_cli_writes_the_note_and_the_github_output(tmp_path):
    base, cur = tmp_path / "b.json", tmp_path / "c.json"
    out, gh = tmp_path / "o.md", tmp_path / "gh.txt"
    base.write_text(json.dumps(manifest(source("s", []))), encoding="utf-8")
    new = manifest(source("s", [("https://s/new.pdf", 20, False)]))
    cur.write_text(json.dumps(new), encoding="utf-8")
    argv = ["--baseline", str(base), "--current", str(cur), "--out", str(out)]
    assert main([*argv, "--github-output", str(gh)]) == 0
    assert "changed=true" in gh.read_text(encoding="utf-8")
    assert "digest=" in gh.read_text(encoding="utf-8")
    assert "https://s/new.pdf" in out.read_text(encoding="utf-8")


def exact(sid, url="https://a/report.pdf", error=None):
    s = source(sid, [(url, 90, True)], error)
    s["candidates"][0]["reasons"] = ["dataset title pattern", "requested year"]
    return s


def test_release_watch_reports_each_family_and_a_new_lead_triggers_the_note():
    old = manifest(source("ncrb_crime_monitor", []), source("delhi_traffic_report_monitor", [], "timed out"))
    new = manifest(exact("ncrb_crime_monitor"), source("delhi_traffic_report_monitor", [], "timed out"))
    r = diff_sources(old, new)
    assert r["new_release_leads"] == ["NCRB Crime in India"]
    assert r["changed"]
    states = {w["family"]: (w["before"], w["now"]) for w in r["release_watch"]}
    assert states["NCRB Crime in India"] == ("none", "lead")
    assert states["Delhi Traffic Police annual road crash report"] == ("unreachable", "unreachable")
    text = render(r, "baseline.json")
    assert "## Release watch" in text and "a link matches the dataset and the year" in text
    assert "not proof of a release" in text


def test_a_lead_that_was_already_in_the_baseline_does_not_trigger_again():
    m = manifest(exact("ncrb_crime_monitor"))
    r = diff_sources(m, m)
    assert r["new_release_leads"] == [] and r["changed"] is False
