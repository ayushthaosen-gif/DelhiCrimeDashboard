"""Turn district_raw_<year>.json into one row per reporting unit with 30 named columns, and check every column sums to the printed TOTAL."""
import json, re, sys
COLS = ["murder", "attempt_to_commit_murder", "culpable_homicide_not_murder", "rape_total", "rape_custodial", "rape_other",
        "kidnapping_abduction_total", "kidnapping_of_women_girls", "kidnapping_others", "dacoity",
        "preparation_assembly_dacoity", "robbery", "burglary", "theft_total", "theft_auto", "theft_other", "riots",
        "criminal_breach_of_trust", "cheating", "counterfeiting", "arson", "hurt", "dowry_death", "molestation",
        "sexual_harassment", "cruelty_by_husband_relatives", "importation_of_girls", "causing_death_by_negligence",
        "other_ipc", "total_cognizable_ipc"]
UT_TOTAL = {2001: 54384, 2002: 49137, 2003: 47404, 2004: 53623, 2005: 56065, 2006: 57963, 2007: 56065, 2008: 49350, 2009: 50251, 2010: 51292}
ALIAS = {"GRPRLY": "GRP(RLY)", "IGIAIRPORT": "IGI AIRPORT", "SPLCELL": "SPL CELL", "STF": "STF"}
def canon(label):
    k = re.sub(r"[^A-Z]", "", label.upper())
    return ALIAS.get(k, label)
def anchors(pg):
    cols = [[] for _ in range(10)]
    for r in pg.get("rows", []):
        if len(r["nums"]) == 10:
            for i, n in enumerate(r["nums"]): cols[i].append(n["x1"])
    return [sorted(c)[len(c) // 2] if c else None for c in cols]
# Cells read off the page images where the PDF text layer misplaces numbers (specialised units, 2008 and 2009)
Z = [0] * 10
OVERRIDE = {
    (2008, "CAW"): {0: Z, 1: Z}, (2008, "CRIME BRANCH"): {0: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0], 1: [0, 0, 0, 1, 0, 1, 0, 0, 14, 1]}, (2008, "EOW"): {0: Z, 1: [0, 0, 0, 0, 0, 0, 0, 8, 137, 0]},
    (2009, "CAW"): {0: Z, 1: Z}, (2009, "CRIME BRANCH"): {0: [1, 8, 0, 2, 0, 2, 0, 0, 0, 0], 1: [0, 1, 0, 4, 0, 4, 0, 0, 39, 6]}, (2009, "EOW"): {0: Z, 1: [0, 0, 0, 0, 0, 0, 0, 4, 184, 0]},
    (2008, "STF"): {1: [1, 0, 0, 0, 0, 0, 0, 0, 10, 5]}, (2009, "STF"): {1: [0, 0, 0, 0, 0, 0, 0, 1, 7, 4]},
}
summary = {}
for year in range(2002, 2011):
    raw = json.load(open(f"district_raw_{year}.json"))
    units, total, problems = {}, None, []
    for pg_i, pg in enumerate(raw["pages"]):
        for r in pg.get("rows", []):
            label = canon(re.sub(r"^\d+\s+", "", r["label"]).strip())
            if label == "" or (not r["nums"] and label in ("DELHI", "DELHI UT")):
                continue
            if (year, label) in OVERRIDE and pg_i in OVERRIDE[(year, label)]:
                units.setdefault(label, [None] * 30)[pg_i * 10:(pg_i + 1) * 10] = OVERRIDE[(year, label)][pg_i]
                continue
            vals = [n["v"] for n in r["nums"]]
            if len(vals) != 10:
                A = anchors(pg); vals = [None] * 10
                for n in r["nums"]:
                    j = min(range(10), key=lambda k: abs(A[k] - n["x1"]))
                    if abs(A[j] - n["x1"]) > 14 or vals[j] is not None: problems.append(f"{year} p{pg['page']} {label!r}: cannot place {n}")
                    else: vals[j] = n["v"]
                problems.append(f"{year} p{pg['page']} {label!r}: {len(r['nums'])} numbers placed by position")
            tgt = total if False else None
            if label == "TOTAL":
                total = total or [None] * 30
                total[pg_i * 10:(pg_i + 1) * 10] = vals
            else:
                units.setdefault(label, [None] * 30)[pg_i * 10:(pg_i + 1) * 10] = vals
    sums = [sum((u[i] or 0) for u in units.values()) for i in range(30)]
    bad = [(COLS[i], sums[i], total[i]) for i in range(30) if total and total[i] != sums[i]]
    ok_total = sums[29] == UT_TOTAL[year]
    summary[year] = {"units": list(units), "n_units": len(units), "col_sum_mismatch": bad, "problems": problems, "sum_total_ipc": sums[29], "printed_total_row": total[29] if total else None, "matches_verified_UT_total": ok_total}
    json.dump({"year": year, "columns": COLS, "units": units, "printed_total": total}, open(f"district_{year}.json", "w"))
for y, s in summary.items():
    print(y, s["n_units"], "units; sum", s["sum_total_ipc"], "printed total row", s["printed_total_row"], "UT check", s["matches_verified_UT_total"], "mismatches", s["col_sum_mismatch"], s["problems"])
    print("    ", ", ".join(s["units"]))
