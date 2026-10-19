"""Compare a fresh source-discovery manifest with the committed baseline and say what is new.

The weekly monitor runs discovery only. This module turns "something changed" into a short Markdown note that the workflow posts to one GitHub issue,
so a person reviews it. It never downloads, collects or integrates anything.

    python -m delhi_data_2025.source_diff --baseline <committed manifest> --current <fresh manifest> --out diff.md [--github-output "$GITHUB_OUTPUT"]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def _index(manifest: dict) -> tuple[dict, dict]:
    """-> ({(source_id, url): candidate}, {source_id: error or None})"""
    candidates, errors = {}, {}
    for source in manifest.get('sources', []):
        sid = source.get('source_id')
        errors[sid] = source.get('error')
        for cand in source.get('candidates') or []:
            candidates[(sid, cand.get('url'))] = cand
    return candidates, errors


def diff_sources(baseline: dict, current: dict) -> dict:
    """New candidate links, links that were selected before and are no longer present, sources whose error status changed."""
    old, old_err = _index(baseline)
    new, new_err = _index(current)
    added = [dict(source_id=k[0], url=k[1], title=v.get('title'), score=v.get('score'), selected=bool(v.get('selected'))) for k, v in new.items() if k not in old]
    removed = [dict(source_id=k[0], url=k[1], title=v.get('title')) for k, v in old.items() if k not in new and v.get('selected')]
    status = [dict(source_id=sid, before=old_err.get(sid), after=err) for sid, err in new_err.items() if sid in old_err and bool(old_err[sid]) != bool(err)]
    added.sort(key=lambda c: (not c['selected'], -(c['score'] or 0), c['source_id'], c['url'] or ''))
    return {'added': added, 'removed_selected': removed, 'status_changed': status, 'changed': bool(added or removed or status)}


def render(result: dict, baseline_path: str, limit: int = 25) -> str:
    lines = ['# Source monitor: new or changed official sources', '',
             'The weekly discovery run found differences from the committed baseline (`%s`).' % baseline_path, '',
             '**Nothing was downloaded, collected or integrated.** Review the links below. If a source qualifies, collect it with the pipeline, validate it, and open a pull request; the dashboard changes only after that is approved.', '']
    if result['added']:
        lines += ['## New links (%d; showing up to %d, selected and best-scored first)' % (len(result['added']), limit), '']
        for c in result['added'][:limit]:
            lines.append('- `%s` %s: [%s](%s)%s' % (c['source_id'], 'SELECTED' if c['selected'] else 'candidate', (c['title'] or c['url'] or '').replace('|', ' ')[:120], c['url'], ' (score %s)' % c['score'] if c['score'] is not None else ''))
        lines.append('')
    if result['removed_selected']:
        lines += ['## Previously selected links that are gone', '']
        lines += ['- `%s`: %s' % (c['source_id'], c['url']) for c in result['removed_selected']] + ['']
    if result['status_changed']:
        lines += ['## Sources whose reachability changed', '']
        lines += ['- `%s`: before `%s`, now `%s`' % (c['source_id'], c['before'] or 'ok', c['after'] or 'ok') for c in result['status_changed']] + ['']
    return '\n'.join(lines).rstrip() + '\n'


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--baseline', required=True)
    ap.add_argument('--current', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--github-output', help='append changed=true|false to this file (the GITHUB_OUTPUT path)')
    args = ap.parse_args(argv)
    baseline = json.loads(Path(args.baseline).read_text(encoding='utf-8'))
    current = json.loads(Path(args.current).read_text(encoding='utf-8'))
    result = diff_sources(baseline, current)
    Path(args.out).write_text(render(result, args.baseline), encoding='utf-8')
    if args.github_output:
        with open(args.github_output, 'a', encoding='utf-8') as fh:
            fh.write('changed=%s\n' % ('true' if result['changed'] else 'false'))
    print('changed' if result['changed'] else 'no change', '| new links', len(result['added']), '| gone', len(result['removed_selected']), '| status', len(result['status_changed']))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
