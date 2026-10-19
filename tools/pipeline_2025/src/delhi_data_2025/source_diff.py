"""Compare a fresh source-discovery manifest with the committed baseline.

The weekly monitor runs discovery only. This module turns "something changed" into a short
Markdown note that the workflow posts to one GitHub issue, so a person reviews it. It never
downloads, collects or integrates anything.

    python -m delhi_data_2025.source_diff --baseline <committed manifest> \
        --current <fresh manifest> --out diff.md [--github-output "$GITHUB_OUTPUT"]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def _index(manifest: dict) -> tuple[dict, dict]:
    """-> ({(source_id, url): candidate}, {source_id: error or None})"""
    candidates, errors = {}, {}
    for source in manifest.get("sources", []):
        sid = source.get("source_id")
        errors[sid] = source.get("error")
        for cand in source.get("candidates") or []:
            candidates[(sid, cand.get("url"))] = cand
    return candidates, errors


def diff_sources(baseline: dict, current: dict) -> dict:
    """New candidate links, selected links that vanished, and sources whose error status changed."""
    old, old_err = _index(baseline)
    new, new_err = _index(current)
    added = [
        {
            "source_id": key[0],
            "url": key[1],
            "title": cand.get("title"),
            "score": cand.get("score"),
            "selected": bool(cand.get("selected")),
        }
        for key, cand in new.items()
        if key not in old
    ]
    removed = [
        {"source_id": key[0], "url": key[1], "title": cand.get("title")}
        for key, cand in old.items()
        if key not in new and cand.get("selected")
    ]
    status = [
        {"source_id": sid, "before": old_err.get(sid), "after": err}
        for sid, err in new_err.items()
        if sid in old_err and bool(old_err[sid]) != bool(err)
    ]
    added.sort(
        key=lambda c: (not c["selected"], -(c["score"] or 0), c["source_id"], c["url"] or "")
    )
    return {
        "added": added,
        "removed_selected": removed,
        "status_changed": status,
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
    return "\n".join(lines).rstrip() + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--baseline", required=True)
    ap.add_argument("--current", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--github-output", help="append changed=true|false to this file")
    args = ap.parse_args(argv)
    baseline = json.loads(Path(args.baseline).read_text(encoding="utf-8"))
    current = json.loads(Path(args.current).read_text(encoding="utf-8"))
    result = diff_sources(baseline, current)
    Path(args.out).write_text(render(result, args.baseline), encoding="utf-8")
    if args.github_output:
        with open(args.github_output, "a", encoding="utf-8") as fh:
            fh.write(f"changed={'true' if result['changed'] else 'false'}\n")
    print(
        "changed" if result["changed"] else "no change",
        f"| new links {len(result['added'])}",
        f"| gone {len(result['removed_selected'])}",
        f"| status {len(result['status_changed'])}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
