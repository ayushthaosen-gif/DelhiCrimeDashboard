"""Extract the Delhi block of NCRB Table 1.14 (district-wise IPC) by word position.
usage: python -I extract_district.py <year> <firstPage> <lastPage>   (pages 1-based)"""
import sys, json, re
import pdfplumber

year, p1, p2 = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
spill = len(sys.argv) > 4 and sys.argv[4] == "spill"
out = {"year": year, "pages": []}
is_num = lambda t: re.fullmatch(r"-?\d+", t) is not None
with pdfplumber.open(f"{year}-district.pdf") as pdf:
    for p in range(p1, p2 + 1):
        page = pdf.pages[p - 1]
        words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
        head = next((w for w in words if w["text"] == "DELHI"), None)
        if not head:
            out["pages"].append({"page": p, "error": "no DELHI heading"})
            continue
        nxt = next((w for w in words if w["text"] == "LAKSHADWEEP" and w["top"] > head["top"]), None)
        y_end = nxt["top"] - 1 if nxt else head["top"] + 400
        block = sorted([w for w in words if head["top"] - 2 <= w["top"] < y_end], key=lambda w: (w["top"], w["x0"]))
        rows = []
        for w in block:
            r = next((r for r in rows if abs(r["y"] - w["top"]) < 3.2), None)
            if r: r["w"].append(w)
            else: rows.append({"y": w["top"], "w": [w]})
        pr = []
        for r in rows:
            r["w"].sort(key=lambda w: w["x0"])
            nums = [{"v": int(w["text"]), "x1": round(w["x1"], 1)} for w in r["w"] if is_num(w["text"]) and w["x0"] > 150]
            label = " ".join(w["text"] for w in r["w"] if not (is_num(w["text"]) and w["x0"] > 150))
            pr.append({"y": round(r["y"], 1), "label": label, "nums": nums})
        # rows of the Delhi block that spill onto the top of the following column-group page (three pages per section)
        if p + 3 <= len(pdf.pages) and spill:
            w2 = pdf.pages[p + 3 - 1].extract_words()
            hdr = next((w for w in w2 if w["text"] == "(1)"), None)
            if hdr:
                rows2 = []
                for w in sorted([w for w in w2 if w["top"] > hdr["top"] + 2], key=lambda w: (w["top"], w["x0"])):
                    r = next((r for r in rows2 if abs(r["y"] - w["top"]) < 3.2), None)
                    if r: r["w"].append(w)
                    else: rows2.append({"y": w["top"], "w": [w]})
                for r in rows2:
                    r["w"].sort(key=lambda w: w["x0"])
                    label = " ".join(w["text"] for w in r["w"] if not (is_num(w["text"]) and w["x0"] > 150))
                    if re.match(r"^(\d+\s+)?(WEST|TOTAL|[A-Z.\-() ]+)$", label) is None: break
                    if not (re.match(r"^\d+ ", label) or label == "TOTAL"): break
                    nums = [{"v": int(w["text"]), "x1": round(w["x1"], 1)} for w in r["w"] if is_num(w["text"]) and w["x0"] > 150]
                    pr.append({"y": round(r["y"], 1), "label": label, "nums": nums, "spill": True})
        out["pages"].append({"page": p, "rows": pr})
json.dump(out, open(f"district_raw_{year}.json", "w"))
for pg in out["pages"]:
    if "error" in pg:
        print(year, pg["page"], pg["error"]); continue
    print("--- page", pg["page"])
    for r in pg["rows"]:
        print(str(r["y"]).rjust(6), r["label"].ljust(24), " ".join(f'{n["v"]}@{n["x1"]}' for n in r["nums"]))
