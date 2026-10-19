import json

from delhi_data_2025.source_diff import diff_sources, main, render


def manifest(*sources):
    return {'year': 2025, 'sources': list(sources)}


def source(sid, urls, error=None):
    return {'source_id': sid, 'error': error, 'candidates': [{'source_id': sid, 'url': u, 'title': 'T ' + u, 'score': s, 'selected': sel} for u, s, sel in urls]}


def test_no_change_means_no_issue():
    m = manifest(source('ncrb', [('https://a/1.pdf', 40, False)]))
    assert diff_sources(m, m)['changed'] is False


def test_a_new_link_is_reported_selected_first():
    old = manifest(source('ncrb', [('https://a/1.pdf', 40, False)]))
    new = manifest(source('ncrb', [('https://a/1.pdf', 40, False), ('https://a/2.pdf', 30, False), ('https://a/3.xlsx', 10, True)]))
    r = diff_sources(old, new)
    assert r['changed'] and [c['url'] for c in r['added']] == ['https://a/3.xlsx', 'https://a/2.pdf']


def test_a_selected_link_that_disappears_and_a_reachability_change_are_reported():
    old = manifest(source('x', [('https://x/1', 50, True)]), source('y', []))
    new = manifest(source('x', []), source('y', [], error='HTTP 500'))
    r = diff_sources(old, new)
    assert r['changed'] and r['removed_selected'][0]['url'] == 'https://x/1' and r['status_changed'][0]['source_id'] == 'y'


def test_the_note_says_nothing_was_integrated():
    old = manifest(source('ncrb', []))
    new = manifest(source('ncrb', [('https://a/2.pdf', 30, False)]))
    text = render(diff_sources(old, new), 'baseline.json')
    assert 'Nothing was downloaded' in text and 'https://a/2.pdf' in text


def test_cli_writes_the_note_and_the_github_output(tmp_path):
    base, cur, out, gh = tmp_path / 'b.json', tmp_path / 'c.json', tmp_path / 'o.md', tmp_path / 'gh.txt'
    base.write_text(json.dumps(manifest(source('s', []))), encoding='utf-8')
    cur.write_text(json.dumps(manifest(source('s', [('https://s/new', 20, False)]))), encoding='utf-8')
    assert main(['--baseline', str(base), '--current', str(cur), '--out', str(out), '--github-output', str(gh)]) == 0
    assert 'changed=true' in gh.read_text(encoding='utf-8') and 'https://s/new' in out.read_text(encoding='utf-8')
