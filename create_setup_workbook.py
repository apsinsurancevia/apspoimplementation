"""
create_setup_workbook.py
------------------------
Creates CaliberPO_Setup.xlsx with two sheets:
  - Broker Setup   : label-value config (user fills col B once at deployment)
  - Insurer Master : pre-headed table for the broker's insurer roster

Run once per deployment. Output: /mnt/user-data/outputs/CaliberPO_Setup.xlsx
"""

import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT_DIR  = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = "CaliberPO_Setup.xlsx"

DARK_BLUE   = "1F3864"
LIGHT_GREY  = "F2F2F2"
YELLOW      = "FFFF99"     # input-cell signal colour

THIN = Side(style='thin')


def thin_border():
    return Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


# ---------------------------------------------------------------------------
# Sheet 1 — Broker Setup
# Labels map directly to Config.gs field names so generate_invoice.py can
# look them up by exact string.
# ---------------------------------------------------------------------------

BROKER_FIELDS = [
    "Broker Name",
    "Address Line 1",
    "Address Line 2",
    "City",
    "State",
    "State Code (2-digit GST)",
    "PIN Code",
    "GSTIN/UIN",
    "PAN",
    "IRDAI Licence Number",
    "Licence Expiry Date",
    "Bank Name",
    "Account Number",
    "IFSC Code",
    "Account Type",
    "Contact Email",
    "Mobile No.",
]


def build_broker_setup(wb: Workbook) -> None:
    ws = wb.create_sheet("Broker Setup")

    # Column widths
    ws.column_dimensions['A'].width = 30
    ws.column_dimensions['B'].width = 45

    # ── Header row (row 1) ──────────────────────────────────────────────────
    ws.merge_cells('A1:B1')
    hdr = ws['A1']
    hdr.value = "BROKER SETUP — Fill once at deployment"
    hdr.font  = Font(name='Calibri', bold=True, size=13, color='FFFFFF')
    hdr.fill  = PatternFill(fill_type='solid', fgColor=DARK_BLUE)
    hdr.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 24

    # ── Field rows (rows 2 onwards) ─────────────────────────────────────────
    label_font  = Font(name='Calibri', bold=True, size=10)
    label_fill  = PatternFill(fill_type='solid', fgColor=LIGHT_GREY)
    value_fill  = PatternFill(fill_type='solid', fgColor=YELLOW)
    label_align = Alignment(horizontal='left', vertical='center')
    value_align = Alignment(horizontal='left', vertical='center')

    for i, field in enumerate(BROKER_FIELDS, start=2):
        # Label cell (col A)
        lc = ws.cell(row=i, column=1, value=field)
        lc.font      = label_font
        lc.fill      = label_fill
        lc.alignment = label_align
        lc.border    = thin_border()

        # Value cell (col B) — empty, user fills
        vc = ws.cell(row=i, column=2, value='')
        vc.fill      = value_fill
        vc.alignment = value_align
        vc.border    = thin_border()
        ws.row_dimensions[i].height = 18

    # Freeze below header
    ws.freeze_panes = 'A2'

    print(f"  Broker Setup sheet: {len(BROKER_FIELDS)} fields")


# ---------------------------------------------------------------------------
# Sheet 2 — Insurer Master
# Exact schema from StatementProcessing.gs:38 — getSheetDataAsObjects() reads
# row 1 as headers, so column names here must match what the .gs code expects.
# ---------------------------------------------------------------------------

INSURER_HEADERS = [
    "insurer_id",
    "insurer_name",
    "insurer_gstin",
    "insurer_state",
    "insurer_state_code",
    "insurer_address",
    "sac_code",
    "spoc_email",
    "active",
]

INSURER_COL_WIDTHS = {
    "insurer_id":         10,
    "insurer_name":       40,
    "insurer_gstin":      22,
    "insurer_state":      20,
    "insurer_state_code": 14,
    "insurer_address":    50,
    "sac_code":           12,
    "spoc_email":         35,
    "active":              8,
}

# Pre-populate the 9 APS insurer IDs known from seedDefaultPrompts() in setup.gs.
# User fills GSTIN, address, etc. after deployment.
APS_INSURERS = [
    {"insurer_id": "GO",       "insurer_name": "Go Digit General Insurance Limited",                    "insurer_gstin": "09AACCO4128Q1ZY", "insurer_state": "UTTAR PRADESH",  "insurer_state_code": "09", "insurer_address": "1st Floor, Halwasiyas Commerce House, Habibullah Estate, 11 Mahatma Gandhi Marg, Hazratganj, Pin: 226001", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "ICICI",    "insurer_name": "ICICI Lombard General Insurance Co Ltd",               "insurer_gstin": "23AAACI7904G1ZV", "insurer_state": "MADHYA PRADESH", "insurer_state_code": "23", "insurer_address": "5th Floor, Maple High Street, Opposite Aashima Mall, Hoshangabad Road, Bhopal, Pin: 462026", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "INDUSIND", "insurer_name": "IndusInd General Insurance Company Limited",           "insurer_gstin": "27AABCR6747B1ZG", "insurer_state": "MAHARASHTRA",    "insurer_state_code": "27", "insurer_address": "119, Ayodhya Building, Near Bajaj Nagar Chowk, Behind Akruti Furniture, Bajaj Nagar, Nagpur – 440010", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "NIC",      "insurer_name": "National Insurance Company Limited",                   "insurer_gstin": "09AAACN9967E1Z1", "insurer_state": "UTTAR PRADESH",  "insurer_state_code": "09", "insurer_address": "C-7/34, Goras Building, Lahurabir, Varanasi, Pin: 221001", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "TATA",     "insurer_name": "Tata AIG General Insurance Co Ltd",                    "insurer_gstin": "09AABCT3518Q1ZU", "insurer_state": "UTTAR PRADESH",  "insurer_state_code": "09", "insurer_address": "Plot No E-1, 1st and 2nd Floor, Sector-8, Noida, District Gautam Budh Nagar, Noida – 201301", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "SBI",      "insurer_name": "SBI General Insurance Company Ltd",                    "insurer_gstin": "23AAMCS8857L1ZK", "insurer_state": "MADHYA PRADESH", "insurer_state_code": "23", "insurer_address": "2nd Floor, State Bank of India TT Nagar Main Branch Building, New Market, Bhopal", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "NIA",      "insurer_name": "The New India Assurance Co Ltd",                       "insurer_gstin": "23AAACN4165C1ZZ", "insurer_state": "MADHYA PRADESH", "insurer_state_code": "23", "insurer_address": "313-316, Shekhar Central, New Palasia Square, Indore, 452001", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "OR",       "insurer_name": "The Oriental Insurance Company Limited",               "insurer_gstin": "23AAACT0627R4Z4", "insurer_state": "MADHYA PRADESH", "insurer_state_code": "23", "insurer_address": "Ida Building, 4th Floor, 7, Race Course Road, Indore", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "USGI",     "insurer_name": "Universal Sompo General Insurance Company Limited",    "insurer_gstin": "23AAACU8917F1ZE", "insurer_state": "MADHYA PRADESH", "insurer_state_code": "23", "insurer_address": "M 12 to M 16, Part Commerce House, 7 Race Course Road, R.S. Bhandari Marg, Indore - 452001", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "KOTAK",    "insurer_name": "Zurich Kotak General Insurance Company (India) Limited","insurer_gstin": "07AAFCK7016C1ZV", "insurer_state": "DELHI",          "insurer_state_code": "07", "insurer_address": "H 78, 23 Himalaya House, 7th Floor, KG Marg, New Delhi -110001", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "BAJAJ",    "insurer_name": "Bajaj General Insurance Limited",                     "insurer_gstin": "23AABCB5730G1Z5", "insurer_state": "MADHYA PRADESH", "insurer_state_code": "23", "insurer_address": "4th Floor, 409, Commerce House, 7 Race Course Road, Indore, Pin: 452001", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "IFFCO",    "insurer_name": "IFFCO-Tokio General Insurance Company Limited",        "insurer_gstin": "23AAACI7573H1ZK", "insurer_state": "MADHYA PRADESH", "insurer_state_code": "23", "insurer_address": "2nd Floor, 214, Zone-1, Bhagwan Complex, MP Nagar, Bhopal, Pin: 462011", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "KSHEMA",   "insurer_name": "Kshema General Insurance Limited",                     "insurer_gstin": "36AAHCK1849H1ZD", "insurer_state": "TELANGANA",      "insurer_state_code": "36", "insurer_address": "4th Floor, 413, My Home Tycoon Building, Kundan Bagh, Begumpet, Hyderabad, Pin: 500016", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "ROYAL",    "insurer_name": "Royal Sundaram General Insurance Co Ltd",              "insurer_gstin": "23AABCR7106G1ZR", "insurer_state": "MADHYA PRADESH", "insurer_state_code": "23", "insurer_address": "3rd and 4th Floor, 11, Alankar Complex, Zone II, MP Nagar, Bhopal, Pin: 462011", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "SHRIRAM",  "insurer_name": "Shriram General Insurance Company Limited",            "insurer_gstin": "23AAKCS2509K1ZB", "insurer_state": "MADHYA PRADESH", "insurer_state_code": "23", "insurer_address": "5th Floor, 502 and 503, Ashima Corporate Zone, Ashima The Lake City Mall, Hoshangabad Road, Bhopal, Pin: 462026", "sac_code": "997131", "active": "Y"},
    {"insurer_id": "UIIC",     "insurer_name": "United India Insurance Company Limited",               "insurer_gstin": "23AAACU5552C1ZR", "insurer_state": "MADHYA PRADESH", "insurer_state_code": "23", "insurer_address": "2, Second Block, Paryawas Bhawan, Jail Road, Arera Hills, Bhopal, Pin: 462011", "sac_code": "997131", "active": "Y"},
]


def build_insurer_master(wb: Workbook) -> None:
    ws = wb.create_sheet("Insurer Master")

    # Column widths
    for i, col in enumerate(INSURER_HEADERS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = INSURER_COL_WIDTHS[col]

    # ── Header row ──────────────────────────────────────────────────────────
    hdr_font  = Font(name='Calibri', bold=True, size=10, color='FFFFFF')
    hdr_fill  = PatternFill(fill_type='solid', fgColor=DARK_BLUE)
    hdr_align = Alignment(horizontal='center', vertical='center')

    for i, col in enumerate(INSURER_HEADERS, start=1):
        cell = ws.cell(row=1, column=i, value=col)
        cell.font      = hdr_font
        cell.fill      = hdr_fill
        cell.alignment = hdr_align
        cell.border    = thin_border()

    ws.row_dimensions[1].height = 20
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = f"A1:{get_column_letter(len(INSURER_HEADERS))}1"

    # ── Pre-populated APS insurer rows ──────────────────────────────────────
    data_font  = Font(name='Calibri', size=10)
    data_align = Alignment(horizontal='left', vertical='center')

    for row_idx, ins in enumerate(APS_INSURERS, start=2):
        for col_idx, col in enumerate(INSURER_HEADERS, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=ins.get(col, ''))
            cell.font      = data_font
            cell.alignment = data_align
            cell.border    = thin_border()
        ws.row_dimensions[row_idx].height = 16

    print(f"  Insurer Master sheet: {len(INSURER_HEADERS)} columns, "
          f"{len(APS_INSURERS)} pre-populated rows")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, OUT_FILE)

    wb = Workbook()
    wb.remove(wb.active)   # remove default Sheet

    print("\nBuilding CaliberPO_Setup.xlsx ...")
    build_broker_setup(wb)
    build_insurer_master(wb)

    wb.save(out_path)
    print(f"\nSaved: {out_path}")
    print("Next steps:")
    print("  1. Open CaliberPO_Setup.xlsx")
    print("  2. Fill in Broker Setup column B (yellow cells)")
    print("  3. Fill in Insurer Master — GSTIN, state code, address, SPOC email per insurer")


if __name__ == "__main__":
    main()
