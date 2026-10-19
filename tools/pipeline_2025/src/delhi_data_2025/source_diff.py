"""Compare a fresh source-discovery manifest with the committed baseline.

The weekly monitor runs discovery only. This module turns "something changed" into a short
Markdown note that the workflow posts to one GitHub issue, so a person reviews it. It never
downloads, collects or integrates anything.

To keep the note worth reading, it leaves out links that are not candidates for data (images,
media, low-scoring pages), links already collected (``--known-urls``), and reachability changes
that are only timeouts. A source that cannot be reached this week cannot be said to have lost
its links, so its "gone" links are not reported.

    python -m delhi_data_2025.source_diff --baseline <committed manifest> \
        --current <fresh manifest> --out diff.md [--known-urls source_links.json] \
        [--github-output "$GITHUB_OUTPUT"]
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

IGNORED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "mp4", "css", "js"}
DOCUMENT_EXTENSIONS = {"pdf", "xls", "xlsx", "csv", "zip", "json", "geojson", "xml", "ods"}
MIN_PAGE_SCORE = 50


def _extension(url: str | None) -> str:
    tail = (url or "").split("?")[0].rsplit("/", 1)[-1]
    return tail.rsplit(".", 1)[-1].lower() if "." in tail else ""


def is_candidate(cand: dict) -> bool:
    """Documents are always worth a look; pages only when the pipeline scored them highly."""
    ext = _extension(cand.get("url"))
    if ext in IGNORED_EXTENSIONS:
        return False
    if cand.get("selected") or ext in DOCUMENT_EXTENSIONS:
        return True
    return (cand.get("score") or 0) >= MIN_PAGE_SCORE


def is_transient(error: str | None) -> bool:
    text = (error or "").lower()
    return "timed out" in text or "timeout" in text


def load_known_urls(path: str | Path) -> set[str]:
    """Public URLs of reports already collected (data/derived/irad_monthly/source_links.json)."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    urls = set()
    for entry in (data.get("files") or {}).values():
        for field in ("public_url", "page_url"):
            if entry.get(field):
                urls.add(entry[field])
    return urls


def _index(manifest: dict) -> tuple[dict, dict]:
    """-> ({(source_id, url): candidate}, {source_id: error or None})"""
    candidates, errors = {}, {}
    for source in manifest.get("sources", []):
        sid = source.get("source_id")
        errors[sid] = source.get("error")
        for cand in source.get("candidates") or []:
            candidates[(sid, cand.get("url"))] = cand
    return candidates, errors


def diff_sources(baseline: dict, current: dict, known_urls: set[str] | None = None) -> dict:
    """New candidate links, selected links that vanished, and reachability changes."""
    known = known_urls or set()
    old, old_err = _index(baseline)
    new, new_err = _index(current)
    added, skipped_noise, skipped_known = [], 0, 0
    for key, cand in new.items():
        if key in old:
            continue
        if key[1] in known:
            skipped_known += 1
        elif not is_candidate(cand):
            skipped_noise += 1
        else:
            added.append(
                {
                    "source_id": key[0],
                    "url": key[1],
                    "title": cand.get("title"),
                    "score": cand.get("score"),
                    "selected": bool(cand.get("selected")),
                }
            )
    removed, unverifiable = [], 0
    for key, cand in old.items():
        if key in new or not cand.get("selected"):
            continue
        if new_err.get(key[0]):
            unverifiable += 1  # the source failed this week; absence proves nothing
        else:
            removed.append({"source_id": key[0], "url": key[1], "title": cand.get("title")})
    status = [
        {"source_id": sid, "before": old_err.get(sid), "after": err}
        for sid, err in new_err.items()
        if sid in old_err
        and bool(old_err[sid]) != bool(err)
        and not is_transient(old_err[sid])
        and not is_transient(err)
    ]
    added.sort(
        key=lambda c: (not c["selected"], -(c["score"] or 0), c["source_id"], c["url"] or "")
    )
    return {
        "added": added,
        "removed_selected": removed,
        "status_changed": status,
        "skipped_noise": skipped_noise,
        "skipped_known": skipped_known,
        "unverifiable_removed": unverifiable,
        "changed": bool(added or removed or status),
    }


def render(result: dict, baseline_path: str, limit: int = 25) -> str:
    lines = [
        "# Source monitor: new or changed official sources",
        "",
        "The weekly discovery run found differences from the committed baseline "
        f"(`{baseline_path}`).",
        "",
        "**Nothing was downloaded, collected or integrated.** Review the links below. If a source "
        "qualifies, collect it with the pipeline, validate it, and open a pull request; the "
        "dashboard changes only after that is approved.",
        "",
    ]
    if result["added"]:
        shown = min(limit, len(result["added"]))
        lines += [
            f"## New links ({len(result['added'])}; showing {shown}, "
            "selected and best-scored first)",
            "",
        ]
        for c in result["added"][:limit]:
            label = "SELECTED" if c["selected"] else "candidate"
            title = (c["title"] or c["url"] or "").replace("|", " ")[:120]
            score = f" (score {c['score']})" if c["score"] is not None else ""
            lines.append(f"- `{c['source_id']}` {label}: [{title}]({c['url']}){score}")
        lines.append("")
    if result["removed_selected"]:
        lines += ["## Previously selected links that are gone", ""]
        lines += [f"- `{c['source_id']}`: {c['url']}" for c in result["removed_selected"]]
        lines.append("")
    if result["status_changed"]:
        lines += ["## Sources whose reachability changed", ""]
        for c in result["status_changed"]:
            before, after = c["before"] or "ok", c["after"] or "ok"
            lines.append(f"- `{c['source_id']}`: before `{before}`, now `{after}`")
        lines.append("")
    left_out = []
    if result.get("skipped_noise"):
        left_out.append(
            f"{result['skipped_noise']} new links that are images, media or low-scoring pages"
        )
    if result.get("skipped_known"):
        left_out.append(f"{result['skipped_known']} new links to reports already collected")
    if result.get("unverifiable_removed"):
        left_out.append(
            f"{result['unverifiable_removed']} selected links of sources that could not be reached"
        )
    if left_out:
        lines += ["## Left out of this note", ""] + [f"- {item}" for item in left_out] + [""]
    body = "\n".join(lines).rstrip() + "\n"
    return body + f"\n<!-- monitor-digest: {digest(body)} -->\n"


def digest(body: str) -> str:
    """Short fingerprint of the note, so an unchanged note is not posted twice."""
    return hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--baseline", required=True)
    ap.add_argument("--current", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--known-urls", help="source_links.json of reports already collected")
    ap.add_argument("--github-output", help="append changed=true|false to this file")
    args = ap.parse_args(argv)
    baseline = json.loads(Path(args.baseline).read_text(encoding="utf-8"))
    current = json.loads(Path(args.current).read_text(encoding="utf-8"))
    known = load_known_urls(args.known_urls) if args.known_urls else set()
    result = diff_sources(baseline, current, known)
    note = render(result, args.baseline)
    Path(args.out).write_text(note, encoding="utf-8")
    if args.github_output:
        with open(args.github_output, "a", encoding="utf-8") as fh:
            fh.write(f"changed={'true' if result['changed'] else 'false'}\n")
            fh.write("digest=" + note.rsplit("monitor-digest: ", 1)[1].split()[0] + "\n")
    print(
        "changed" if result["changed"] else "no change",
        f"| new links {len(result['added'])}",
        f"| gone {len(result['removed_selected'])}",
        f"| status {len(result['status_changed'])}",
        f"| left out {result['skipped_noise'] + result['skipped_known']}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
