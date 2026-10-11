"""Print 10 Commission Rate Lookup test samples from split grid files."""
from __future__ import annotations

import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1] / "masters" / "grid_import_split"
VEHICLE = {
    "2w", "scooter", "bike", "ev", "scooter/scooty", "scooty",
    "upto 350cc", "4w", "3w", "4w taxi",
}


def map_sub(pt: str, sub: str, sub_sub: str, scheme: str) -> str:
    blob = f"{sub} {sub_sub} {scheme}".lower()
    vehicle = sub.lower() in VEHICLE
    if not (vehicle or (pt == "TW" and sub and not re.match(r"^(new|1\+1|saod|satp)", sub, re.I))):
        return sub
    if pt == "TW":
        if "5+5" in blob:
            return "New (5+5)"
        if "1+5" in blob or "fresh" in blob or "bundled" in blob:
            return "New (1+5)"
        if "saod" in blob or "1+0" in blob:
            return "SAOD"
        if "satp" in blob:
            return "SATP"
        if "1+1" in blob:
            return "1+1"
        return "New (1+5)"
    if pt in ("GCV", "PCV", "Tractor", "Construction Eqpt"):
        return "SATP" if "satp" in blob else "1+1"
    return sub


def first_rto(raw) -> tuple[str, str]:
    s = re.sub(r"\([^)]*\)", "", str(raw or ""))
    codes = [c.strip() for c in re.split(r"[,|;]", s) if re.match(r"^[A-Za-z]{2}-?\d+", c.strip())]
    if not codes:
        return "", "PAN_INDIA"
    code = codes[0].upper()
    m = re.match(r"^([A-Z]{2})-?(\d+)$", code.replace(" ", ""))
    if m:
        code = f"{m.group(1)}-{m.group(2).zfill(2)}"
    return code, "EXACT_RTO"


def main() -> None:
    samples = []
    for path in sorted(ROOT.glob("*_grid_26-27.xlsx")):
        wb = openpyxl.load_workbook(path, data_only=True)
        for tab in wb.sheetnames:
            rows = list(wb[tab].iter_rows(values_only=True))
            if len(rows) < 2:
                continue
            hdr = list(rows[0])

            def g(row, col):
                return row[hdr.index(col)] if col in hdr else None

            for row in rows[1:]:
                if not row or not g(row, "insurer_code"):
                    continue
                pi = g(row, "pi_rate")
                try:
                    pif = float(pi) if pi is not None and str(pi).strip() != "" else None
                except (TypeError, ValueError):
                    pif = None
                if pif is None:
                    continue
                pi_pct = round(pif * 100, 2) if 0 < pif <= 1 else pif
                pt = str(g(row, "product_type") or "").strip()
                sub = str(g(row, "product_sub_type") or "").strip()
                sub_sub = str(g(row, "product_sub_sub_type") or "").strip()
                mapped = map_sub(pt, sub, sub_sub, str(g(row, "scheme_name") or ""))
                rto, match = first_rto(g(row, "rto_list"))
                from_d = str(g(row, "effective_from_date") or "")
                issue = "2026-09-01" if "16-08" in from_d or "2026-08-16" in from_d else "2026-08-01"
                samples.append({
                    "insurer": str(g(row, "insurer_code")).strip(),
                    "product": pt,
                    "sub": mapped,
                    "sub_sub": sub_sub or (sub if sub.lower() in VEHICLE else ""),
                    "rto": rto or "(leave blank / any)",
                    "issue": issue,
                    "pi": pi_pct,
                    "on": g(row, "pi_rate_on") or "NET",
                    "match": match,
                    "cc": 110 if pt == "TW" else "",
                    "gvw": 5 if pt == "GCV" else "",
                    "seat": 4 if pt == "PCV" else "",
                    "fuel": "Petrol" if pt in ("TW", "Pvt Car", "PCV", "GCV") else "",
                    "net": 5000,
                })

    exact = [s for s in samples if s["match"] == "EXACT_RTO"]
    pan = [s for s in samples if s["match"] != "EXACT_RTO"]
    picked, seen = [], set()
    for bucket in (exact, pan):
        for s in bucket:
            key = (s["insurer"], s["product"], s["sub"], s["rto"], s["pi"])
            if key in seen:
                continue
            # skip known multi-row PAN duplicates for clean demos when better exists
            seen.add(key)
            picked.append(s)
            if len(picked) >= 10:
                break
        if len(picked) >= 10:
            break

    print("| # | Insurer | Product | Sub type | Sub-sub | RTO | Issue date | CC/Fuel | Expected PI % | Match |")
    print("|---|---------|---------|----------|---------|-----|------------|---------|---------------|-------|")
    for i, s in enumerate(picked, 1):
        extras = []
        if s["cc"] != "":
            extras.append(f"CC={s['cc']}")
        if s["fuel"]:
            extras.append(s["fuel"])
        if s["gvw"] != "":
            extras.append(f"GVW={s['gvw']}t")
        if s["seat"] != "":
            extras.append(f"Seats={s['seat']}")
        extras.append(f"Net=Rs{s['net']}")
        print(
            f"| {i} | {s['insurer']} | {s['product']} | {s['sub']} | {s['sub_sub'] or '-'} | "
            f"{s['rto']} | {s['issue']} | {', '.join(extras)} | **{s['pi']}** on {s['on']} | {s['match']} |"
        )

    print()
    print("Form URL:")
    print("https://script.google.com/macros/s/AKfycbyTM-OpjCtov-a_CCRaN9qZZ9n2xWkHd_w0TDKUtAdk3Ez8bkCDymsRaVldPMcVb9XK/exec")
    print()
    print("Notes:")
    print("- Use product sub type as listed (normalized from extract 2W/Scooter → New (1+5) / 1+1).")
    print("- BAJAJ/UIIC/etc. may not appear in the insurer dropdown (APS buyer list); API/grid lookup still works by code.")
    print("- Avoid INDUSIND TW with blank RTO for demos — multiple zone rows can return DUPLICATE_RATE.")


if __name__ == "__main__":
    main()
