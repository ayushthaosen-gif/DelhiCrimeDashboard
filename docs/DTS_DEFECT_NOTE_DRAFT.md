# Draft note to the Delhi Transport Stack / DMRC data team (not sent)

For the owner to review and send, if wanted. The dataset licence (clause 3.3.2) asks data consumers to tell the Data Publisher promptly of defects they find. Nothing has been sent.

**To:** Delhi Transport Stack support (the contact address on the portal) · **Dataset:** Delhi Metro: Gate Locations (dataset 3, version 1, last updated 2024-12-02), file `dmrc_station_and_gate_locations.xlsx`

Hello,

We use the Delhi Metro gate locations to count gates per ward in an open research dashboard (derived counts only; the licence is respected and the source is credited). While doing so we noticed the following in the `gates` sheet, which you may want to correct in the next update:

1. 61 of 687 gate rows have a blank station code (the gate name and location are present).
2. 37 station codes used in the gates sheet do not appear in the stations sheet.
3. One row (station code APOT) has no latitude or longitude.
4. 48 station code and gate name pairs appear more than once; 6 rows are exact duplicates (same code, gate name and position).
5. 313 rows share a recorded position with another row. Many gates of one station appear to carry the station-level position, so gate locations cannot be told apart.
6. The stations sheet has 268 non-empty station codes but 264 distinct ones.
7. The file was last updated on 2024-12-02, so newer stations and gates are not in it.

We counted these and did not change the data. Thank you for publishing it.

(Name and organisation of the sender.)
