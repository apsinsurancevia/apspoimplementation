"""
Generate local master CSVs from seed arrays in src/setup.gs (single source of truth).

Outputs under masters/:
  product_master.csv, insurer_master.csv, partner_master.csv,
  field_mapping.csv, insurer_code_map.csv, product_map.csv, derivation_rules.csv
  (rto_master.csv is generated separately from rto_master_import.csv)
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETUP = ROOT / "src" / "setup.gs"
OUT = ROOT / "masters"

PARTNER_HEADERS = [
    "posp_id", "posp_name", "dealer_name", "manager", "rm",
    "partner_email", "partner_mobile", "pan_number", "gstin",
    "partner_legal_name", "partner_address", "partner_state", "partner_state_code", "partner_pan",
    "bank_account_name", "bank_name", "bank_branch", "account_number", "ifsc_code", "account_type",
    "tds_rate_override", "active", "statement_sent", "utr_number", "payment_date",
]

PARTNER_ROWS = [
    ["P001", "Test Partner A (No PAN)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Y", "", "", ""],
    ["P002", "Test Partner B (PAN only)", "", "", "", "", "", "ABCDE1234F", "", "", "", "", "", "ABCDE1234F", "", "", "", "", "", "", "", "Y", "", "", ""],
    ["P003", "Test Partner C (PAN+GST)", "", "", "", "", "", "FGHIJ5678K", "23AAAAA0000A1Z5", "", "", "MADHYA PRADESH", "23", "FGHIJ5678K", "", "", "", "", "", "", "", "Y", "", "", ""],
]

SPECS = [
    ("PRODUCT_MASTER_DATA", "product_master.csv",
     ["product_vertical", "product_type", "product_sub_type", "product_sub_sub_type", "policy_type", "active"]),
    ("INSURER_MASTER_DATA", "insurer_master.csv",
     ["insurer_id", "insurer_name", "insurer_gstin", "insurer_state", "insurer_state_code",
      "insurer_address", "sac_code", "spoc_email", "active"]),
    ("FIELD_MAPPING_DATA", "field_mapping.csv",
     ["broker_field", "standard_field", "transform", "notes"]),
    ("INSURER_CODE_MAP_DATA", "insurer_code_map.csv",
     ["broker_value", "caliber_insurer_id", "notes"]),
    ("PRODUCT_MAP_DATA", "product_map.csv",
     ["broker_field", "broker_value", "caliber_field", "caliber_value", "notes"]),
    ("DERIVATION_RULES_DATA", "derivation_rules.csv",
     ["rule_type", "keyword", "derived_value", "notes"]),
]


def extract_js_array(src: str, var_name: str) -> list[list[str]]:
    marker = f"var {var_name} ="
    start = src.find(marker)
    if start < 0:
        raise ValueError(f"{var_name} not found in setup.gs")
    i = src.find("[", start)
    depth = 0
    end = None
    for j in range(i, len(src)):
        ch = src[j]
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = j
                break
    if end is None:
        raise ValueError(f"Unclosed array for {var_name}")
    body = src[i + 1:end]
    rows: list[list[str]] = []
    for row_m in re.finditer(r"\[(.*?)\]", body, flags=re.S):
        cells = re.findall(r"'(?:\\'|[^'])*'|\"(?:\\\"|[^\"])*\"", row_m.group(1))
        if not cells:
            continue
        cleaned = []
        for c in cells:
            s = c[1:-1]
            s = s.replace("\\'", "'").replace('\\"', '"')
            cleaned.append(s)
        rows.append(cleaned)
    return rows


def write_csv(path: Path, headers: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(headers)
        w.writerows(rows)


def main() -> None:
    src = SETUP.read_text(encoding="utf-8")
    OUT.mkdir(parents=True, exist_ok=True)
    summary = []

    for var_name, filename, headers in SPECS:
        rows = extract_js_array(src, var_name)
        # Drop comment-only false positives (none expected); keep rows matching header width
        rows = [r for r in rows if len(r) == len(headers)]
        out = OUT / filename
        write_csv(out, headers, rows)
        summary.append((filename, len(rows)))

    write_csv(OUT / "partner_master.csv", PARTNER_HEADERS, PARTNER_ROWS)
    summary.append(("partner_master.csv", len(PARTNER_ROWS)))

    # Keep RTO note if present
    rto = OUT / "rto_master.csv"
    if rto.exists():
        with rto.open(encoding="utf-8") as f:
            rto_n = max(0, sum(1 for _ in f) - 1)
        summary.append(("rto_master.csv (existing)", rto_n))

    print("Generated masters/:")
    for name, n in summary:
        print(f"  {name}: {n} rows")


if __name__ == "__main__":
    main()
