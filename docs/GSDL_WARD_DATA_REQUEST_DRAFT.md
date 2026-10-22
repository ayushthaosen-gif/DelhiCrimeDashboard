# Draft: request to Geospatial Delhi Limited for the 2022 MCD ward boundaries

**This is a draft for the project owner to review, adapt and send. Nothing has been sent.**
Fill in the bracketed parts, decide whether to send it as an email first (suggested) or file an RTI, and check the contact details on https://gsdl.org.in before sending. Contacts listed on the site: general `cs.gsdl@gmail.com`; the data portal page names the Chief Technology Officer, Shri P. S. Acharya (`psa@nic.in`), for clarifications. The 250-ward layer stays "not implemented" in `data/series_status.json` until a reply arrives and the reuse terms are known.

Why this request, and what not to do meanwhile: the official ward map (identifier GSDL/MCD/16.01.2023/01) is marked "restricted for departmental use only" and prohibits reproduction without GSDL's written permission. We have not digitised it, traced it or reconstructed wards from it, and we should not (its linework forms 921 faces, not 250 wards). The only legitimate route is permission and the original data from GSDL.

---

**To:** Geospatial Delhi Limited (GSDL), 3rd Level, C-Wing, Vikas Bhawan-II, Civil Lines, New Delhi 110054
(Attention: Chief Technology Officer / the officer who handles data-sharing requests)

**Subject:** Request for written permission and the digital boundaries of the 250 MCD wards (2022 delimitation) for a public-interest road-safety project

Dear Sir or Madam,

I am writing about the "Zone & Ward Map of Municipal Corporation of Delhi" published by GSDL (map identifier GSDL/MCD/16.01.2023/01), which shows the 250 wards fixed by the Final Delimitation Order of 17 October 2022.

I run [project name], an open, non-commercial project that publishes road-crash and public-safety information for Delhi from official sources, for residents, journalists and researchers: [project URL, https://ayushthaosen-gif.github.io/DelhiCrimeDashboard/]. Our ward-level views currently use an older, 290-polygon ward layer from before the 2022 delimitation, which we label as legacy because it no longer matches the Municipal Corporation's wards. We would like to move to the current boundaries, and we do not want to reconstruct them from your printed map, which carries a restriction on reproduction.

**We request**
1. The digital (vector) layer of the 250 MCD ward boundaries and, if available, the 12 zone boundaries, with the ward number and ward name for each polygon.
2. The coordinate reference system, the version or date of the data, and any known accuracy limits.
3. Your **written permission and terms of reuse**: whether we may publish the boundaries, or derived products (for example ward-level maps and counts), openly on the web under an attribution notice, and under what licence, conditions or restrictions.

**What we offer**
- Attribution to GSDL and the Government of NCT of Delhi on every page that uses the data, in the form you prefer, and a statement of the data's version date.
- No use for legal, boundary-determination or other critical purposes: we will repeat your disclaimer that the data is not a legal document.
- If redistribution of the raw boundaries is not permitted, we will use them only to produce aggregated, derived statistics and maps, and will not publish the boundary file itself.
- We will not share the data with anyone else without your permission.

If the data cannot be released in this way, we would be grateful to know whether a published, reusable version exists anywhere, or whether a formal application (for example under the Right to Information Act, 2005) is the right route.

Thank you for your time.

Yours faithfully,
[Name]
[Role / organisation, if any]
[Postal address]
[Email] · [Phone]
[Date]

---

*After sending:* record the date and the person addressed in `data/series_status.json` (the `wards_mcd_2022_250` note currently says no request has been sent) and in `docs/AGENT_CHANGELOG.md`. Do not use the layer, even informally, until the reuse terms are in writing.
