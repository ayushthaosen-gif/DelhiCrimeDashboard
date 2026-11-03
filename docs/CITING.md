# Citing this project and getting a DOI

This repository is a compilation, not a primary source. For any figure, cite the original agency report as well (NCRB, Delhi Traffic Police); each release manifest and [DATA_SOURCES.md](DATA_SOURCES.md) name it.

[`CITATION.cff`](../CITATION.cff) is what GitHub's "Cite this repository" button reads. [`.zenodo.json`](../.zenodo.json) is the matching record Zenodo uses when it archives a release. A test (`test/citation.test.js`) keeps the two consistent and refuses a made-up DOI.

## Getting a DOI (Zenodo): the steps that need the repository owner

A DOI can only be minted by Zenodo after a GitHub release, so these cannot be done from the code:

1. Sign in at <https://zenodo.org> with GitHub and, under GitHub settings, switch this repository on.
2. Create a GitHub release with a version tag (for example `v1.0.0`, from the Releases page). Zenodo archives it and issues two DOIs: one for that version and one "concept" DOI that always points to the latest.
3. Put the concept DOI in two places: `identifiers` in `CITATION.cff` (type `doi`, value `10.5281/zenodo.NNNNNNN`) and a "Cite as" line near the top of the README (keep the README under 12,000 bytes; the test enforces it). Add `version` and `date-released` to `CITATION.cff` at the same time, matching the release.
4. Check that the creator name in `.zenodo.json` and `CITATION.cff` is how the owner wants to be credited. It currently uses the GitHub username.

Until then no DOI is stated anywhere, on purpose.
