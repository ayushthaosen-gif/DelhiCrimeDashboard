"""Assemble the staged 2001-2010 Delhi district, crime-head and city files from the checked extractions."""
import json, csv, hashlib, os, re
OUT = "C:/Users/ayush/DelhiCrimeDashboard/data/staged/delhi_ut_total_2001_2010/"
LABELS = {
    "murder": "Murder", "attempt_to_commit_murder": "Attempt to commit murder", "culpable_homicide_not_murder": "Culpable homicide not amounting to murder",
    "rape_total": "Rape (total)", "rape_custodial": "Rape (custodial)", "rape_other": "Rape (other)",
    "kidnapping_abduction_total": "Kidnapping and abduction (total)", "kidnapping_of_women_girls": "Kidnapping and abduction of women and girls", "kidnapping_others": "Kidnapping and abduction (others)",
    "dacoity": "Dacoity", "preparation_assembly_dacoity": "Preparation and assembly for dacoity", "robbery": "Robbery", "burglary": "Burglary",
    "theft_total": "Theft (total)", "theft_auto": "Theft: auto theft", "theft_other": "Theft: other", "riots": "Riots",
    "criminal_breach_of_trust": "Criminal breach of trust", "cheating": "Cheating", "counterfeiting": "Counterfeiting", "arson": "Arson", "hurt": "Hurt",
    "dowry_death": "Dowry deaths", "molestation": "Molestation", "sexual_harassment": "Sexual harassment", "cruelty_by_husband_relatives": "Cruelty by husband and relatives",
    "importation_of_girls": "Importation of girls", "causing_death_by_negligence": "Causing death by negligence", "other_ipc": "Other IPC crimes", "total_cognizable_ipc": "Total cognizable IPC crimes"}
TERRITORIAL = {"CENTRAL", "EAST", "NEW DELHI", "NORTH", "NORTH-EAST", "NORTH-WEST", "OUTER", "SOUTH", "SOUTH-EAST", "SOUTH-WEST", "WEST"}
ORDER_NOTE = {"DRP": "label as printed in 2005; not expanded in the table", "SPL CELL": "special cell", "STF": "special task force", "CAW": "label as printed; not expanded in the table",
              "EOW": "economic offences wing", "CRIME BRANCH": "crime branch", "GRP(RLY)": "government railway police", "IGI AIRPORT": "airport police"}

src = {}
for line in open("jobs.tsv").read().splitlines():
    u, f = line.split("\t")
    src[f] = u
src["2001-district.pdf"] = "https://www.ncrb.gov.in/uploads/2022/July/11/custom/crime-in-india/TABLE-8-2001.pdf"
def sha(f): return hashlib.sha256(open(f, "rb").read()).hexdigest()

years = {}
# 2001: first ten columns only; read from the page image (the PDF text layer interleaves rows)
c2001 = ["murder", "attempt_to_commit_murder", "culpable_homicide_not_murder", "rape_total", "rape_custodial", "rape_other", "kidnapping_abduction_total", "kidnapping_of_women_girls", "kidnapping_others", "dacoity"]
u2001 = {"CENTRAL": [29, 42, 4, 28, 0, 28, 62, 42, 20, 3], "EAST": [56, 51, 15, 24, 0, 24, 163, 39, 124, 4], "GRP(RLY)": [11, 4, 0, 1, 0, 1, 7, 7, 0, 1],
         "IGI AIRPORT": [2, 2, 1, 0, 0, 0, 4, 1, 3, 0], "NEW DELHI": [11, 14, 0, 9, 0, 9, 27, 19, 8, 1], "NORTH": [28, 33, 5, 28, 0, 28, 99, 53, 46, 2],
         "NORTH-EAST": [62, 79, 5, 36, 0, 36, 157, 123, 34, 3], "NORTH-WEST": [134, 107, 13, 103, 0, 103, 518, 298, 220, 14], "STF": [0] * 10,
         "SOUTH": [83, 75, 7, 65, 0, 65, 265, 170, 95, 9], "SOUTH-WEST": [61, 52, 1, 42, 0, 42, 174, 113, 61, 9], "WEST": [70, 51, 12, 45, 0, 45, 151, 99, 52, 2]}
t2001 = [547, 510, 63, 381, 0, 381, 1627, 964, 663, 48]
years[2001] = {"columns": c2001, "units": u2001, "total": t2001, "method": "page image"}
for y in range(2002, 2011):
    d = json.load(open(f"district_{y}.json"))
    years[y] = {"columns": d["columns"], "units": d["units"], "total": d["printed_total"], "method": "PDF text by position" + ("; specialised-unit cells read from page images" if y in (2008, 2009) else "")}

out = {"title": "Delhi UT district-wise cognizable IPC crimes, 2001 to 2010, as NCRB prints them (reporting units of each year, not today's districts)", "status": "staged",
       "scope": "NCRB Crime in India district-wise table (Table 1.14; Table 8 in 2001), Delhi block. Each year's units are exactly those NCRB printed that year. No unit is allocated to a later district, and no rate is calculated.",
       "checks": "For every year and every column printed, the unit rows add to the printed TOTAL row; the total IPC column equals the Delhi UT total in delhi_ut_total_ipc_2001_2010.json (read from the page images).",
       "limits": ["2001: the file NCRB serves for that year holds only the first ten columns (murder to dacoity), so nothing else is available for 2001.",
                  "Units mix territorial districts with specialised units (railway police, airport, STF, crime branch and so on). Sum all rows for the Delhi total; do not read a specialised unit as a district.",
                  "Offence heads and the principal-offence counting rule are those of each year's NCRB format; compare across 2013/2014 with care."],
       "columns": [{"id": k, "label": v} for k, v in LABELS.items()], "years": {}}
rows_csv = []
for y, v in years.items():
    f = f"{y}-district.pdf"
    units = []
    for name, vals in v["units"].items():
        kind = "territorial district" if name in TERRITORIAL else "specialised unit"
        rec = {"unit": name, "kind": kind, "values": {c: vals[i] for i, c in enumerate(v["columns"])}}
        if name in ORDER_NOTE: rec["note"] = ORDER_NOTE[name]
        units.append(rec)
        for i, c in enumerate(v["columns"]): rows_csv.append([y, name, kind, c, vals[i]])
    out["years"][str(y)] = {"source_url": src[f], "sha256": sha(f), "columns_printed": len(v["columns"]), "read_by": v["method"],
                            "territorial_districts": sum(1 for u in units if u["kind"] == "territorial district"), "specialised_units": sum(1 for u in units if u["kind"] != "territorial district"),
                            "printed_total": {c: v["total"][i] for i, c in enumerate(v["columns"])}, "units": units}
json.dump(out, open(OUT + "delhi_district_ipc_2001_2010.json", "w"), indent=1)
with open(OUT + "delhi_district_ipc_2001_2010.csv", "w", newline="") as fh:
    w = csv.writer(fh); w.writerow(["year", "unit", "kind", "measure", "value"]); w.writerows(rows_csv)
with open(OUT + "delhi_ut_crime_heads_2001_2010.csv", "w", newline="") as fh:
    w = csv.writer(fh); w.writerow(["year"] + list(LABELS))
    for y, v in years.items():
        t = dict(zip(v["columns"], v["total"])); w.writerow([y] + [t.get(c, "") for c in LABELS])

# reporting units by year
first = {}
table = {}
for y, v in years.items():
    table[y] = sorted(v["units"])
    for u in v["units"]: first.setdefault(u, y)
ru = {"purpose": "Which reporting units NCRB printed for Delhi in each year, as printed. 'First printed' is the first year of this 2001-2010 run in which the unit appears, not a creation date.",
      "years": {str(y): {"territorial_districts": [u for u in table[y] if u in TERRITORIAL], "specialised_units": [u for u in table[y] if u not in TERRITORIAL]} for y in table},
      "first_printed_in_run": first,
      "reading": ["Nine territorial districts (Central, East, New Delhi, North, North-East, North-West, South, South-West, West) in every year 2001 to 2006.",
                  "Outer appears from 2007 and South-East from 2008, giving the eleven territorial districts that the MHA annual reports state for 2010-11 to 2014-15 (see data/staged/police_geography_history/structure_evidence_2010_2016.json).",
                  "Specialised units vary: 2005 prints DRP and Spl Cell, 2008 to 2010 print CAW, Crime Branch and EOW. Their counts are in the Delhi total but are not territorial districts."]}
json.dump(ru, open(OUT + "reporting_units_by_year.json", "w"), indent=1)

city = [(2001, 49343, 17.0, 385.8, 11, "TABLE%205-2001.pdf"), (2002, 44158, 14.8, 345.2, 15, None), (2003, 41961, 14.4, 328.1, 15, None), (2004, 48677, 15.7, 380.6, 12, None), (2005, 51010, 16.2, 398.8, 10, None),
        (2006, 53007, 16.2, 414.4, 12, None), (2007, 50895, 15.1, 397.9, 12, None), (2008, 44573, 12.8, 348.5, 19, None), (2009, 45247, 13.2, 353.7, 18, None), (2010, 45994, 12.5, 359.6, 18, None)]
ut = json.load(open(OUT + "delhi_ut_total_ipc_2001_2010.json"))
urls = {r["year"]: (r["source_url"], r["sha256"], r["table"]) for r in ut["rows"]}
cj = {"title": "Delhi (City) total cognizable IPC crimes, 2001 to 2010, as NCRB prints them", "status": "staged",
      "scope": "The 'Delhi (City)' row of the cities part of the same NCRB table as the Delhi UT row (Table 5 in 2001, Table 1.6 from 2002). This is NCRB's mega-city series, a different geography from the Delhi UT row; the two are not interchangeable and the city is not a sum of the district table.",
      "population_note": "NCRB uses the same population for every year (127.91 lakh, from the 2001 census) for the city, so city rates in this run are not adjusted for growth. Incidence divided by 127.91 reproduces each printed rate.",
      "pct_note": "pct_of_all_city_total is the share of the all-city total NCRB prints in the same table.",
      "rows": [{"year": y, "table": urls[y][2], "incidence": inc, "pct_of_all_city_total": pct, "population_lakh": 127.91, "rate": rate, "rank": rk, "source_url": urls[y][0], "sha256": urls[y][1]} for (y, inc, pct, rate, rk, _) in city]}
json.dump(cj, open(OUT + "delhi_city_total_ipc_2001_2010.json", "w"), indent=1)
print("ok", {y: (o["territorial_districts"], o["specialised_units"]) for y, o in out["years"].items()})
