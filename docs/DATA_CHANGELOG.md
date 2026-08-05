# Data Changelog

This tracks revisions to **already-published figures** — a number that
existed in a prior `data/releases/<year>/` snapshot and later changed value,
scope, or meaning. It is separate from [`AGENT_CHANGELOG.md`](AGENT_CHANGELOG.md),
which is a dev-facing log of every change to this repo (UI, build scripts,
new datasets, bug fixes) regardless of whether it touched a published
number.

If you cited a figure from this project before a date below, and that
figure appears in the "What changed" column, re-check it against the
current release before reusing it or reprinting it in something already
published.

Adding a *new* dataset, extending coverage into a year that was previously
absent, or fixing something that never shipped (a UI bug, a stale label) is
**not** a data-changelog entry — those go in `AGENT_CHANGELOG.md` only. This
file is only for a value someone could already have cited that has since
changed.

## Format

```
## YYYY-MM-DD - <dataset> - <one-line summary>

| Field | Old value | New value | Why |
|---|---|---|---|
| ... | ... | ... | ... |

Affected releases: data/releases/<years>/...
```

---

_No revisions recorded yet — this changelog began tracking on 2026-08-05,
the date `data/releases/` was first published. Every figure currently in
`data/releases/2016/` through `data/releases/2024/` is the first published
version of that figure._
