"""
generate_invoice.py
-------------------
Generates a one-page GST Tax Invoice (Excel) for an insurance broker's
commission claim against an insurer for a given statement period.

SELLER  = Broker  (APS Insurance Broking Services Pvt Ltd)
BUYER   = Insurer (read from Insurer Master)

Usage:
  python generate_invoice.py \
    --statement /path/to/statement_file \
    --insurer_id BAJAJ \
    --period "July 2026" \
    --invoice_date "10-08-2026" \
    --setup /path/to/CaliberPO_Setup.xlsx

  --invoice_no is optional; auto-generated from invoice_counter.json if omitted.

Dependencies:
  pip install openpyxl pandas pdfplumber pyxlsb "xlrd==1.2.0"
"""

# ---------------------------------------------------------------------------
# TATA AIG openpyxl colour bug — patch at module level before any import
# that triggers load_workbook() internally.
# ---------------------------------------------------------------------------
import openpyxl.styles.colors as _oc
_orig_rgb_set = _oc.RGB.__set__


def _lenient_rgb_set(self, instance, value):
    try:
        _orig_rgb_set(self, instance, value)
    except (ValueError, AttributeError):
        object.__setattr__(instance, self.name, 'FF000000')


_oc.RGB.__set__ = _lenient_rgb_set
# ---------------------------------------------------------------------------

import argparse
import json
import os
import sys
import traceback
from datetime import datetime

import openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

import pandas as pd
import pdfplumber

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DARK_BLUE  = "1F3864"
LIGHT_BLUE = "EBF3FB"
TOTALS_BLU = "BDD7EE"
LIGHT_GREY = "F2F2F2"
GREEN_GREY = "E2EFDA"

OUT_DIR = "/mnt/user-data/outputs"

INDIAN_FMT = '#,##,##0.00'
GST_RATE   = 0.18
SAC_DEFAULT = "997131"

THIN = Side(style='thin')


def thin_border():
    return Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def outer_border(ws, min_row, min_col, max_row, max_col):
    """Draw a border only on the outer edges of a rectangular block."""
    for row in ws.iter_rows(min_row=min_row, max_row=max_row,
                             min_col=min_col, max_col=max_col):
        for cell in row:
            l = THIN if cell.column == min_col   else Side(style=None)
            r = THIN if cell.column == max_col   else Side(style=None)
            t = THIN if cell.row    == min_row   else Side(style=None)
            b = THIN if cell.row    == max_row   else Side(style=None)
            cell.border = Border(left=l, right=r, top=t, bottom=b)


def set_currency(cell, value):
    cell.value        = round(float(value or 0), 2)
    cell.number_format = INDIAN_FMT
    cell.alignment    = Alignment(horizontal='right', vertical='center')


def fmt_inr(amount: float) -> str:
    """Return amount as an Indian-formatted string: e.g. 3,85,470.80"""
    if amount is None:
        return ''
    neg = amount < 0
    val = abs(round(float(amount), 2))
    int_part = int(val)
    dec_part = round((val - int_part) * 100)
    s = str(int_part)
    if len(s) <= 3:
        grouped = s
    else:
        grouped = s[-3:]
        s = s[:-3]
        while s:
            chunk = s[-2:] if len(s) >= 2 else s
            grouped = chunk + ',' + grouped
            s = s[:-len(chunk)]
    return ('-' if neg else '') + grouped + '.' + f'{dec_part:02d}'


# ---------------------------------------------------------------------------
# Step 1 — Read Broker Setup
# ---------------------------------------------------------------------------

def read_broker_setup(setup_path: str) -> dict:
    wb = openpyxl.load_workbook(setup_path, data_only=True)
    ws = wb["Broker Setup"]
    broker = {}
    warnings = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        label = row[0]
        value = row[1] if len(row) > 1 else None
        if not label or str(label).strip() == '':
            continue
        label = str(label).strip()
        val   = str(value).strip() if value is not None else ''
        if not val:
            val = '[NOT CONFIGURED]'
            warnings.append(f"  WARNING: '{label}' not configured in Broker Setup.")
        broker[label] = val

    if warnings:
        print("Broker Setup — missing fields:")
        for w in warnings:
            print(w)
    return broker


# ---------------------------------------------------------------------------
# Step 2 — Read Insurer Master
# ---------------------------------------------------------------------------

def read_insurer_master(setup_path: str, insurer_id: str) -> dict:
    wb = openpyxl.load_workbook(setup_path, data_only=True)
    ws = wb["Insurer Master"]
    headers = [str(c).strip() if c else '' for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    for row in ws.iter_rows(min_row=2, values_only=True):
        row_dict = dict(zip(headers, row))
        if str(row_dict.get('insurer_id', '')).strip().upper() == insurer_id.strip().upper():
            return row_dict
    print(f"ERROR: Insurer ID '{insurer_id}' not found in Insurer Master.")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Step 3 — Statement parsers
# Column names match create_insurer_templates.py exactly.
# ---------------------------------------------------------------------------

def _to_float(val) -> float:
    try:
        return float(str(val).replace(',', '').strip())
    except Exception:
        return 0.0


def _group(rows: list) -> list:
    """Aggregate a flat list of {product, premium, commission} by product."""
    groups: dict = {}
    for r in rows:
        p = r['product']
        if p not in groups:
            groups[p] = {'premium': 0.0, 'commission': 0.0}
        groups[p]['premium']    += r['premium']
        groups[p]['commission'] += r['commission']
    return [
        {'product': p, 'premium': round(v['premium'], 2), 'commission': round(v['commission'], 2)}
        for p, v in groups.items()
    ]


def _df_to_rows(df, product_col, premium_col, commission_col) -> list:
    rows = []
    for _, row in df.iterrows():
        rows.append({
            'product':    normalise_product(row.get(product_col, '')),
            'premium':    _to_float(row.get(premium_col,    0)),
            'commission': _to_float(row.get(commission_col, 0)),
        })
    return _group(rows)


# BAJAJ — xlsx, sheet=irdaPayoutReport, header on row index 4 (skip 4 rows)
def parse_bajaj(path: str) -> list:
    df = pd.read_excel(path, sheet_name='irdaPayoutReport', header=4, engine='openpyxl')
    df = df[df['TOTAL COMMISSION'].notna()]
    return _df_to_rows(df, 'PRODUCT', 'NET PREMIUM', 'TOTAL COMMISSION')


# GODIGIT — xlsb
def parse_godigit(path: str) -> list:
    df = pd.read_excel(path, sheet_name='AAZCA5637P', header=0, engine='pyxlsb')
    return _df_to_rows(df, 'product_lob', 'net_premium', 'TOTAL_AMT')


# ICICI — CSV, drop unnamed first col, filter TRANSACTION_STATUS
def parse_icici(path: str) -> list:
    df = pd.read_csv(path, header=0)
    df = df.loc[:, ~df.columns.str.match(r'^Unnamed')]
    if 'TRANSACTION_STATUS' in df.columns:
        df = df[df['TRANSACTION_STATUS'] == 'COMMISSIONCALCULATEDINVOICE']
    return _df_to_rows(df, 'PRODUCT_NAME', 'GWP', 'ACTUAL_COMMISSION')


# KOTAK — CSV
def parse_kotak(path: str) -> list:
    df = pd.read_csv(path, header=0)
    return _df_to_rows(df, 'LOB NAME', 'OUR SHARE OF PREMIUM GWP', 'Total Commission')


# NATIONAL — PDF, pdfplumber
def parse_national(path: str) -> list:
    rows = []
    with pdfplumber.open(path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            try:
                for table in (page.extract_tables() or []):
                    if not table:
                        continue
                    header, data_start = None, 0
                    for i, row in enumerate(table):
                        if row and any('Premium' in str(c) or 'Commission' in str(c) for c in row if c):
                            header     = [str(c).strip() if c else '' for c in row]
                            data_start = i + 1
                            break
                    if not header:
                        continue
                    prod_i = next((i for i, h in enumerate(header) if any(k in h for k in ('Dept', 'Department', 'Product'))), None)
                    prem_i = next((i for i, h in enumerate(header) if 'Premium' in h), None)
                    comm_i = next((i for i, h in enumerate(header) if 'Commission' in h), None)
                    if None in (prod_i, prem_i, comm_i):
                        continue
                    for row in table[data_start:]:
                        if not row or len(row) <= max(prod_i, prem_i, comm_i):
                            continue
                        comm = _to_float(row[comm_i])
                        if comm == 0:
                            continue
                        rows.append({
                            'product':    normalise_product(row[prod_i]),
                            'premium':    _to_float(row[prem_i]),
                            'commission': comm,
                        })
            except Exception as e:
                print(f"  WARNING: NATIONAL page {page_num + 1}: {e}")
    return _group(rows)


# NEWINDIA — PDF, Policy Detail table only
def parse_newindia(path: str) -> list:
    rows = []
    with pdfplumber.open(path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            try:
                for table in (page.extract_tables() or []):
                    if not table:
                        continue
                    header, data_start = None, 0
                    for i, row in enumerate(table):
                        if row and any('LOB' in str(c) or 'Brokerage' in str(c) for c in row if c):
                            header     = [str(c).strip() if c else '' for c in row]
                            data_start = i + 1
                            break
                    if not header:
                        continue
                    lob_i  = next((i for i, h in enumerate(header) if 'LOB' in h), None)
                    prem_i = next((i for i, h in enumerate(header) if 'Premium' in h), None)
                    brok_i = next((i for i, h in enumerate(header) if 'Brokerage' in h), None)
                    if None in (lob_i, prem_i, brok_i):
                        continue
                    for row in table[data_start:]:
                        if not row or len(row) <= max(lob_i, prem_i, brok_i):
                            continue
                        lob = str(row[lob_i]).strip() if row[lob_i] else ''
                        if lob == '31':
                            lob = 'Motor'
                        rows.append({
                            'product':    normalise_product(lob),
                            'premium':    _to_float(row[prem_i]),
                            'commission': _to_float(row[brok_i]),
                        })
            except Exception as e:
                print(f"  WARNING: NEWINDIA page {page_num + 1}: {e}")
    return _group(rows)


# ORIENTAL — PDF, group OD+TP by Policy No. before summing
def parse_oriental(path: str) -> list:
    policy_map: dict = {}
    with pdfplumber.open(path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            try:
                for table in (page.extract_tables() or []):
                    if not table:
                        continue
                    header, data_start = None, 0
                    for i, row in enumerate(table):
                        if row and any('Premium' in str(c) or 'Comm' in str(c) for c in row if c):
                            header     = [str(c).strip() if c else '' for c in row]
                            data_start = i + 1
                            break
                    if not header:
                        continue
                    dept_i = next((i for i, h in enumerate(header) if 'Dept' in h), None)
                    pol_i  = next((i for i, h in enumerate(header) if 'Policy' in h and 'No' in h), None)
                    prem_i = next((i for i, h in enumerate(header) if 'Premium' in h), None)
                    comm_i = next((i for i, h in enumerate(header) if 'Comm' in h and 'Rate' not in h), None)
                    if None in (prem_i, comm_i):
                        continue
                    for row in table[data_start:]:
                        if not row:
                            continue
                        pol  = str(row[pol_i]).strip()  if pol_i  is not None and row[pol_i]  else 'UNKNOWN'
                        dept = str(row[dept_i]).strip() if dept_i is not None and row[dept_i] else 'Motor'
                        if pol not in policy_map:
                            policy_map[pol] = {'product': dept, 'premium': 0.0, 'commission': 0.0}
                        policy_map[pol]['premium']    += _to_float(row[prem_i])
                        policy_map[pol]['commission'] += _to_float(row[comm_i])
            except Exception as e:
                print(f"  WARNING: ORIENTAL page {page_num + 1}: {e}")

    rows = [
        {'product': normalise_product(v['product']), 'premium': v['premium'], 'commission': v['commission']}
        for v in policy_map.values()
    ]
    return _group(rows)


# RELIANCE — CSV, FinalIRDAComm + RewardCommission
def parse_reliance(path: str) -> list:
    df = pd.read_csv(path, header=0)
    code_map = {'2375': 'Two Wheeler', '2312': 'Misc D', 2375: 'Two Wheeler', 2312: 'Misc D'}
    if 'ProductCode' in df.columns:
        df['ProductCode'] = df['ProductCode'].apply(lambda x: code_map.get(x, code_map.get(str(x), str(x))))
    reward = df['RewardCommission'].fillna(0) if 'RewardCommission' in df.columns else 0
    df['_comm'] = df['FinalIRDAComm'].fillna(0) + reward
    return _df_to_rows(df, 'ProductCode', 'NET_PREMIUM', '_comm')


# SHRIRAM — XLS (xlrd 1.2.0)
def parse_shriram(path: str) -> list:
    df = pd.read_excel(path, header=0, engine='xlrd')
    code_map = {'PCCV': 'Private Car', 'GCCV': 'GCV'}
    if 'ProdDesc' in df.columns:
        df['ProdDesc'] = df['ProdDesc'].apply(lambda x: code_map.get(str(x), str(x)))
    return _df_to_rows(df, 'ProdDesc', 'GrossAmt', 'TotalCommAmt')


# TATA AIG — xlsx, RGB patch already applied at module top
def parse_tata_aig(path: str) -> list:
    df = pd.read_excel(path, sheet_name='Report', header=0, engine='openpyxl')
    if 'table_name' in df.columns:
        df = df[df['table_name'] != 'TDS']
    if 'Policy_No' in df.columns and 'table_name' in df.columns:
        df = df.groupby(['Policy_No', 'table_name'], as_index=False).first()
    return _df_to_rows(df, 'table_name', 'Total_Premium', 'Total_commission')


# UNITED INDIA — xlsx, merge OD+TP by Policy No
def parse_united_india(path: str) -> list:
    df = pd.read_excel(path, sheet_name='Sheet1', header=0, engine='openpyxl')
    od_tp = {'31 - Motor', '32 - Motor TP', '31', '32'}
    if 'Dep No' in df.columns:
        df['_product'] = df['Dep No'].apply(lambda x: 'Motor' if str(x).strip() in od_tp else str(x))
    else:
        df['_product'] = 'Motor'

    if 'Policy No' in df.columns:
        agg: dict = {}
        for _, row in df.iterrows():
            pol = str(row.get('Policy No', '')).strip()
            if not pol:
                continue
            if pol not in agg:
                agg[pol] = {'product': row.get('_product', 'Motor'), 'premium': 0.0, 'commission': 0.0}
            agg[pol]['premium']    += _to_float(row.get('Premium Amt', 0))
            agg[pol]['commission'] += _to_float(row.get('Comm Amt', 0))
        rows = [
            {'product': normalise_product(v['product']), 'premium': v['premium'], 'commission': v['commission']}
            for v in agg.values()
        ]
        return _group(rows)

    return _df_to_rows(df, '_product', 'Premium Amt', 'Comm Amt')


# UNIVERSAL SOMPO — xlsx, MOTOR + NON-MOTOR sheets, header_row=1
def parse_universal_sompo(path: str) -> list:
    rows = []
    for sheet in ('MOTOR', 'NON-MOTOR'):
        try:
            df = pd.read_excel(path, sheet_name=sheet, header=1, engine='openpyxl')
            rows.extend(_df_to_rows(df, 'product_Name', 'net_Premium', 'total_amount'))
        except Exception as e:
            print(f"  WARNING: Universal Sompo sheet '{sheet}': {e}")
    return _group(rows)


# ---------------------------------------------------------------------------
# Format dispatch — insurer_id is the routing key (string codes from codebase)
# ---------------------------------------------------------------------------

PARSERS = {
    'BAJAJ':    parse_bajaj,
    'GO':       parse_godigit,
    'GODIGIT':  parse_godigit,
    'ICICI':    parse_icici,
    'KOTAK':    parse_kotak,
    'NIC':      parse_national,
    'NATIONAL': parse_national,
    'NIA':      parse_newindia,
    'NEWINDIA': parse_newindia,
    'OR':       parse_oriental,
    'ORIENTAL': parse_oriental,
    'RELIANCE': parse_reliance,
    'SHRIRAM':  parse_shriram,
    'TATA':     parse_tata_aig,
    'TATA_AIG': parse_tata_aig,
    'UIIC':     parse_united_india,
    'UNITED':   parse_united_india,
    'USGI':     parse_universal_sompo,
    'UNIVERSAL':parse_universal_sompo,
}


def detect_and_parse(path: str, insurer_id: str) -> list:
    key = insurer_id.strip().upper()
    if key not in PARSERS:
        # Fallback: try to match from filename
        name = os.path.basename(path).upper()
        matched = next((k for k in PARSERS if k in name), None)
        if matched:
            print(f"  Detected format from filename: {matched}")
            key = matched
        else:
            print(f"ERROR: No parser for insurer_id='{insurer_id}'.")
            print(f"Supported IDs: {', '.join(sorted(PARSERS))}")
            sys.exit(1)
    return PARSERS[key](path)


# ---------------------------------------------------------------------------
# Product name normalisation
# ---------------------------------------------------------------------------

def normalise_product(raw) -> str:
    if raw is None or str(raw).strip() == '':
        return 'Unknown'
    s = str(raw).upper().strip()

    if 'TWO WHEEL' in s or 'SCOOTER' in s or 'BIKE' in s:
        return 'Two Wheeler'
    if s in ('TW', '2W') or s.startswith('TW ') or s.startswith('2W '):
        return 'Two Wheeler'
    if 'GCV' in s or 'GOODS' in s or 'GCCV' in s or 'TRUCK' in s or 'TANKER' in s:
        return 'GCV'
    if 'PCV' in s or 'BUS' in s or 'TAXI' in s or 'PASSENGER' in s:
        return 'PCV'
    if 'PRIV' in s or 'PCCV' in s or 'CAR' in s:
        return 'Private Car'
    if 'MISC' in s or 'TRACTOR' in s or 'AGRI' in s:
        return 'Misc D'
    if 'MARINE' in s:
        return 'Marine'
    if 'ENGG' in s or 'ENGINEERING' in s:
        return 'Engineering'
    if 'HEALTH' in s or 'GHI' in s or 'GPA' in s or s == 'PA' or 'PERSONAL ACCIDENT' in s:
        return 'Health / PA'
    if 'FIRE' in s or 'PROPERTY' in s:
        return 'Fire & Property'
    if 'LIABILITY' in s:
        return 'Liability'
    if 'MOTOR' in s:
        return 'Motor'
    return str(raw).strip()


# ---------------------------------------------------------------------------
# Step 4 — GST determination
# ---------------------------------------------------------------------------

def determine_gst(broker_state_code, insurer_state_code) -> str:
    b = str(broker_state_code or '').strip()
    i = str(insurer_state_code or '').strip()
    if not b or not i or b == '[NOT CONFIGURED]' or i == '[NOT CONFIGURED]':
        print("WARNING: State code missing — defaulting to IGST 18%.")
        return 'IGST'
    return 'CGST_SGST' if b == i else 'IGST'


# ---------------------------------------------------------------------------
# Number to words (Indian denominations)
# ---------------------------------------------------------------------------

_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
         'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
         'Seventeen', 'Eighteen', 'Nineteen']
_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']


def _below_100(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return (_TENS[n // 10] + (' ' + _ONES[n % 10] if n % 10 else '')).strip()


def _below_1000(n: int) -> str:
    if n < 100:
        return _below_100(n)
    return _ONES[n // 100] + ' Hundred' + (' ' + _below_100(n % 100) if n % 100 else '')


def number_to_words(amount: float) -> str:
    amount  = round(float(amount), 2)
    integer = int(amount)
    paise   = round((amount - integer) * 100)
    parts   = []

    if integer >= 10_000_000:
        parts.append(_below_1000(integer // 10_000_000) + ' Crore')
        integer %= 10_000_000
    if integer >= 100_000:
        parts.append(_below_1000(integer // 100_000) + ' Lakh')
        integer %= 100_000
    if integer >= 1_000:
        parts.append(_below_100(integer // 1_000) + ' Thousand')
        integer %= 1_000
    if integer > 0:
        parts.append(_below_1000(integer))

    result = ' '.join(parts) if parts else 'Zero'
    if paise:
        result += ' and ' + _below_100(paise) + ' Paise'
    return 'INR ' + result + ' Only'


# ---------------------------------------------------------------------------
# Invoice counter — persisted in invoice_counter.json beside the setup file
# ---------------------------------------------------------------------------

def next_invoice_number(setup_path: str, insurer_id: str) -> str:
    counter_path = os.path.join(os.path.dirname(os.path.abspath(setup_path)),
                                'invoice_counter.json')
    counters: dict = {}
    if os.path.exists(counter_path):
        with open(counter_path, encoding='utf-8') as f:
            counters = json.load(f)

    key = f"INS_{insurer_id.upper()}"
    counters[key] = counters.get(key, 0) + 1

    with open(counter_path, 'w', encoding='utf-8') as f:
        json.dump(counters, f, indent=2)

    now = datetime.now()
    fy  = f"{now.year}-{str(now.year + 1)[2:]}" if now.month >= 4 \
          else f"{now.year - 1}-{str(now.year)[2:]}"
    return f"INV/{fy}/{insurer_id.upper()}/{str(counters[key]).zfill(3)}"


# ---------------------------------------------------------------------------
# Step 5 — Build invoice workbook
# Layout: 8 columns (A-H), A4 portrait.
#
# Column widths:  A=4  B=28  C=12  D=12  E=12  F=12  G=12  H=14
# Left half  A:D — seller block / Sl+Particulars / left content
# Right half E:H — invoice meta / HSN+Amount / right content
#
# Sections (top to bottom):
#   Row 1          : Title "Tax Invoice" | "e-Invoice"
#   Rows 2-4       : IRN block (A:D) + QR placeholder (E:H)
#   Rows 5-11      : Seller block (A:D) | Invoice meta grid (E:H)
#   Rows 12-18     : Buyer block (A:H)
#   Row 19         : Line-items table header
#   Rows 20-32     : Line-items content (data + GST sub-rows + filler)
#   Row 33         : Total row
#   Rows 34-35     : Amount in words
#   Rows 36-38     : HSN/SAC tax summary (IGST or CGST+SGST variant)
#   Rows 39-42     : Tax words + bank details
#   Rows 43-47     : Remarks + signatory block
#   Row 48         : Footer
# ---------------------------------------------------------------------------

# Column index constants
_A, _B, _C, _D, _E, _F, _G, _H = 1, 2, 3, 4, 5, 6, 7, 8
_LAST = _H

_SELLER_L, _SELLER_R = _A, _D   # A:D = seller block / left half
_META_L,   _META_R   = _E, _H   # E:H = meta / right half
_SL_COL              = _A       # Sl No.
_PART_L,   _PART_R   = _B, _D   # B:D = Particulars
_HSN_L,    _HSN_R    = _E, _F   # E:F = HSN/SAC
_AMT_L,    _AMT_R    = _G, _H   # G:H = Amount
_M_LBL1,   _M_VAL1  = _E, _F   # meta label1 / value1
_M_LBL2,   _M_VAL2  = _G, _H   # meta label2 / value2


def build_invoice(broker: dict, insurer: dict,
                  invoice_no: str, invoice_date: str, period: str,
                  taxable_amount: float, gst_type: str,
                  particulars_note: str = '',
                  round_off: float = 0.0,
                  reference_no_and_date: str = '',
                  signatory_name: str = 'SRIJAN KUMAR SINGH') -> Workbook:

    wb = Workbook()
    ws = wb.active
    ws.title = 'Tax Invoice'

    # Page setup — A4 portrait
    ws.page_setup.paperSize   = ws.PAPERSIZE_A4
    ws.page_setup.orientation = ws.ORIENTATION_PORTRAIT
    ws.page_setup.fitToPage   = True
    ws.page_setup.fitToWidth  = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins.left   = 0.5
    ws.page_margins.right  = 0.5
    ws.page_margins.top    = 0.5
    ws.page_margins.bottom = 0.5

    # Column widths: A=4 B=28 C=12 D=12 E=12 F=12 G=12 H=14
    for col_letter, w in zip('ABCDEFGH', [4, 28, 12, 12, 12, 12, 12, 14]):
        ws.column_dimensions[col_letter].width = w

    T = Side(border_style='thin')
    N = Side(border_style=None)

    # Column index aliases (1-based)
    A, B, C, D, E, F, G, H = 1, 2, 3, 4, 5, 6, 7, 8

    def mc(r1, c1, r2, c2, v='', bold=False, italic=False, sz=9,
           ha='left', va='center', wrap=True):
        """Merge r1,c1:r2,c2 and write styled value to top-left cell."""
        if r1 != r2 or c1 != c2:
            ws.merge_cells(start_row=r1, start_column=c1,
                           end_row=r2, end_column=c2)
        cell = ws.cell(row=r1, column=c1)
        if v is not None:
            cell.value = v
        cell.font = Font(name='Arial', size=sz, bold=bold, italic=italic)
        cell.alignment = Alignment(horizontal=ha, vertical=va, wrap_text=wrap)
        return cell

    def sc(r, c, v='', bold=False, italic=False, sz=9,
           ha='left', va='center', wrap=True):
        return mc(r, c, r, c, v, bold, italic, sz, ha, va, wrap)

    def rh(r, h):
        ws.row_dimensions[r].height = h

    def apply_box(r1, c1, r2, c2):
        """Thin border on outer edges only; interior cells untouched."""
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                ws.cell(row=r, column=c).border = Border(
                    top    = T if r == r1 else N,
                    bottom = T if r == r2 else N,
                    left   = T if c == c1 else N,
                    right  = T if c == c2 else N,
                )

    def apply_grid(r1, c1, r2, c2):
        """Thin border on every cell in rectangle."""
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                ws.cell(row=r, column=c).border = Border(
                    top=T, bottom=T, left=T, right=T)

    def add_outer_border(r1, c1, r2, c2):
        """Merge outer border onto existing borders (non-destructive)."""
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                if c not in (c1, c2) and r not in (r1, r2):
                    continue
                cell = ws.cell(row=r, column=c)
                ex = cell.border
                cell.border = Border(
                    left   = T if c == c1 else ex.left,
                    right  = T if c == c2 else ex.right,
                    top    = T if r == r1 else ex.top,
                    bottom = T if r == r2 else ex.bottom,
                )

    # ── Compute GST ───────────────────────────────────────────────────────────
    gst_lc = (gst_type or 'igst').strip().lower()
    if gst_lc == 'igst':
        igst_rate   = 18.0
        igst_amount = round(taxable_amount * igst_rate / 100, 2)
        cgst_rate   = sgst_rate = 0.0
        cgst_amount = sgst_amount = 0.0
        total_tax   = igst_amount
    else:
        cgst_rate   = sgst_rate = 9.0
        cgst_amount = round(taxable_amount * cgst_rate / 100, 2)
        sgst_amount = round(taxable_amount * sgst_rate / 100, 2)
        igst_rate   = 0.0
        igst_amount = 0.0
        total_tax   = cgst_amount + sgst_amount

    total_invoice_amount = round(taxable_amount + total_tax + round_off, 2)

    row = 1  # running row pointer

    # =========================================================================
    # Row 1 — Title
    # =========================================================================
    rh(row, 22)
    mc(row, A, row, G, 'Tax Invoice', bold=True, sz=12, ha='center')
    sc(row, H, 'e-Invoice', bold=True, sz=9, ha='right')
    apply_grid(row, A, row, H)
    row += 1

    # =========================================================================
    # Rows 2-4 — IRN block (A:D) + QR placeholder (E:H spans 3 rows)
    # =========================================================================
    irn_start = row
    rh(row, 28)
    mc(row, A, row, D, 'IRN       : ', sz=9, ha='left', va='top')
    mc(row, E, row + 2, H, '', sz=8, ha='center', va='center')
    row += 1
    rh(row, 14)
    mc(row, A, row, D, 'Ack No.   : ', sz=9)
    row += 1
    rh(row, 14)
    mc(row, A, row, D, 'Ack Date  : ', sz=9)
    row += 1
    apply_box(irn_start,     A, irn_start + 2, D)
    apply_box(irn_start,     E, irn_start + 2, H)

    # =========================================================================
    # Rows 5-11 — Seller block (A:D) | Invoice meta 2×2 grid (E:H)
    # =========================================================================
    hdr_start = row

    seller_rows = [
        ('APS INSURANCE BROKING SERVICES PRIVATE LIMITED', True,  9),
        ('68,SUNDAR NAGAR EXT,INDORE,DDU AGAR,INDORE,INDORE',    False, 9),
        ('MADHYA PRADESH, INDIA',                                  False, 9),
        ('Pin Code : 452010',                                      False, 9),
        ('GSTIN/UIN: 23AAZCA5637P1ZT',                           False, 9),
        ('State Name : Madhya Pradesh, Code : 23',                False, 9),
        ('CIN: U66220MP2023PTC068251',                            False, 9),
    ]

    meta_rows_data = [
        ('Invoice No.',           invoice_no,             'Dated',                 invoice_date),
        ('Delivery Note',         '',                      'Mode/Terms of Payment', ''),
        ('Reference No. & Date.', reference_no_and_date,  'Other References',      ''),
        ("Buyer's Order No.",     '',                      'Dated',                 ''),
        ('Dispatch Doc No.',      '',                      'Delivery Note Date',    ''),
        ('Dispatched through',    '',                      'Destination',           ''),
        None,  # Terms of Delivery — spans full right side
    ]

    for i, (seller_text, bold, sz) in enumerate(seller_rows):
        r = hdr_start + i
        rh(r, 16 if i == 0 else 14)
        mc(r, A, r, D, seller_text, bold=bold, sz=sz)

        meta = meta_rows_data[i]
        if meta is None:
            mc(r, E, r, H, 'Terms of Delivery', bold=True, sz=9)
            apply_grid(r, E, r, H)
        else:
            lbl1, val1, lbl2, val2 = meta
            sc(r, E, lbl1, bold=True, sz=8)
            sc(r, F, val1, sz=9)
            sc(r, G, lbl2, bold=True, sz=8)
            sc(r, H, val2, sz=9)
            apply_grid(r, E, r, H)

    hdr_end = hdr_start + len(seller_rows) - 1
    apply_box(hdr_start, A, hdr_end, D)
    row = hdr_end + 1

    # =========================================================================
    # Buyer block (full width A:H)
    # =========================================================================
    buyer_start = row
    ins_name    = str(insurer.get('insurer_name',     '') or '').upper()
    ins_addr    = str(insurer.get('insurer_address',  '') or '')
    ins_gstin   = str(insurer.get('insurer_gstin',    '') or '')
    ins_state   = str(insurer.get('insurer_state',    '') or '')
    ins_sc      = str(insurer.get('insurer_state_code', '') or '')

    buyer_lines = [
        ('Buyer (Bill to)', False, 9),
        (ins_name,          True,  10),
        (ins_addr,          False, 9),
        (f'GSTIN/UIN : {ins_gstin}',                         False, 9),
        (f'State Name : {ins_state}, Code : {ins_sc}',       False, 9),
    ]
    for txt, bold, sz in buyer_lines:
        rh(row, 18 if bold else 14)
        mc(row, A, row, H, txt, bold=bold, sz=sz)
        row += 1
    apply_box(buyer_start, A, row - 1, H)

    # =========================================================================
    # Line items table header
    # =========================================================================
    rh(row, 18)
    sc(row, A,        'Sl No.',     bold=True, sz=9, ha='center')
    mc(row, B, row, D, 'Particulars', bold=True, sz=9, ha='center')
    mc(row, E, row, F, 'HSN/SAC',    bold=True, sz=9, ha='center')
    mc(row, G, row, H, 'Amount',     bold=True, sz=9, ha='right')
    apply_grid(row, A, row, H)
    row += 1

    # =========================================================================
    # Line items content — data row, GST sub-rows, filler
    # =========================================================================
    li_start = row

    # Data row 1: sl=1, "Insurance Commision" (bold), 997161, taxable_amount
    rh(row, 16)
    sc(row, A,        '1',                   sz=9, ha='center')
    mc(row, B, row, D, 'Insurance Commision', bold=True, sz=9)
    mc(row, E, row, F, '997161',              sz=9, ha='center')
    mc(row, G, row, H, fmt_inr(taxable_amount), sz=9, ha='right')
    apply_grid(row, A, row, H)
    row += 1

    # Data row 2: particulars note (italic, smaller)
    if particulars_note:
        rh(row, 13)
        sc(row, A, '', sz=9)
        mc(row, B, row, D, particulars_note, italic=True, sz=8)
        mc(row, E, row, F, '', sz=9)
        mc(row, G, row, H, '', sz=9)
        apply_grid(row, A, row, H)
        row += 1

    # GST sub-rows (label in Particulars col, amount in Amount col)
    if gst_lc == 'igst':
        gst_sub = [(f'Output Igst @{igst_rate:.0f}%', igst_amount)]
    else:
        gst_sub = [
            (f'Output Cgst@ {cgst_rate:.0f}%', cgst_amount),
            (f'Output Sgst @ {sgst_rate:.0f}%', sgst_amount),
        ]

    for lbl, amt in gst_sub:
        rh(row, 13)
        sc(row, A, '', sz=9)
        mc(row, B, row, D, lbl, sz=9)
        mc(row, E, row, F, '', sz=9)
        mc(row, G, row, H, fmt_inr(amt), sz=9, ha='right')
        apply_grid(row, A, row, H)
        row += 1

    # Round-off row (optional)
    if round_off != 0.0:
        rh(row, 13)
        sc(row, A, '', sz=9)
        ro_lbl = 'Less: Round Off' if round_off < 0 else 'Round Off'
        ro_val = (f'(-){fmt_inr(abs(round_off))}' if round_off < 0
                  else fmt_inr(round_off))
        mc(row, B, row, D, ro_lbl, sz=9)
        mc(row, E, row, F, '', sz=9)
        mc(row, G, row, H, ro_val, sz=9, ha='right')
        apply_grid(row, A, row, H)
        row += 1

    # Blank filler rows
    filler = max(4, 11 - (row - li_start))
    for _ in range(filler):
        rh(row, 13)
        sc(row, A, '', sz=9)
        mc(row, B, row, D, '', sz=9)
        mc(row, E, row, F, '', sz=9)
        mc(row, G, row, H, '', sz=9)
        apply_grid(row, A, row, H)
        row += 1

    # =========================================================================
    # Total row
    # =========================================================================
    rh(row, 18)
    sc(row, A, '', sz=9)
    mc(row, B, row, F, 'Total', bold=True, sz=9, ha='right')
    mc(row, G, row, H, fmt_inr(total_invoice_amount), bold=True, sz=9, ha='right')
    apply_grid(row, A, row, H)
    row += 1

    # =========================================================================
    # Amount in words
    # =========================================================================
    rh(row, 14)
    mc(row, A, row, F, 'Amount Chargeable (in words)', sz=9)
    mc(row, G, row, H, 'E. & O.E', sz=9, ha='right')
    apply_box(row, A, row, H)
    row += 1

    rh(row, 16)
    mc(row, A, row, H, number_to_words(total_invoice_amount), bold=True, sz=9)
    apply_box(row, A, row, H)
    row += 1

    # =========================================================================
    # HSN/SAC tax summary (layout depends on GST type)
    # =========================================================================
    if gst_lc == 'igst':
        # 5-column: HSN/SAC | Taxable Value | IGST Rate | IGST Amount | Total Tax Amount
        # Mapped onto 8 cells: A | B:C | D:E | F:G | H
        rh(row, 16)
        sc(row, A,        'HSN/SAC',          bold=True, sz=9, ha='center')
        mc(row, B, row, C, 'Taxable Value',   bold=True, sz=9, ha='center')
        mc(row, D, row, E, 'IGST Rate',       bold=True, sz=9, ha='center')
        mc(row, F, row, G, 'IGST Amount',     bold=True, sz=9, ha='center')
        sc(row, H,        'Total Tax Amount', bold=True, sz=8, ha='center', wrap=True)
        apply_grid(row, A, row, H)
        row += 1

        rh(row, 14)
        sc(row, A, '997161',                  sz=9, ha='center')
        mc(row, B, row, C, fmt_inr(taxable_amount), sz=9, ha='right')
        mc(row, D, row, E, f'{igst_rate:.0f}%',     sz=9, ha='center')
        mc(row, F, row, G, fmt_inr(igst_amount),    sz=9, ha='right')
        sc(row, H, fmt_inr(igst_amount),            sz=9, ha='right')
        apply_grid(row, A, row, H)
        row += 1

        rh(row, 14)
        sc(row, A, 'Total',                         bold=True, sz=9, ha='right')
        mc(row, B, row, C, fmt_inr(taxable_amount), bold=True, sz=9, ha='right')
        mc(row, D, row, E, '',                      sz=9)
        mc(row, F, row, G, fmt_inr(igst_amount),    bold=True, sz=9, ha='right')
        sc(row, H, fmt_inr(igst_amount),            bold=True, sz=9, ha='right')
        apply_grid(row, A, row, H)
        row += 1

    else:
        # 7-column: HSN/SAC | Taxable | CGST Rate | CGST Amt | SGST Rate | SGST Amt | Total Tax
        # Mapped: A | B:C | D | E | F | G | H
        rh(row, 20)
        sc(row, A,        'HSN/SAC',              bold=True, sz=9, ha='center')
        mc(row, B, row, C, 'Taxable Value',       bold=True, sz=9, ha='center')
        sc(row, D,        'CGST Rate',            bold=True, sz=8, ha='center', wrap=True)
        sc(row, E,        'CGST Amount',          bold=True, sz=8, ha='center', wrap=True)
        sc(row, F,        'SGST/UTGST Rate',      bold=True, sz=8, ha='center', wrap=True)
        sc(row, G,        'SGST/UTGST Amount',    bold=True, sz=8, ha='center', wrap=True)
        sc(row, H,        'Total Tax Amount',     bold=True, sz=8, ha='center', wrap=True)
        apply_grid(row, A, row, H)
        row += 1

        rh(row, 14)
        sc(row, A, '997161',                       sz=9, ha='center')
        mc(row, B, row, C, fmt_inr(taxable_amount), sz=9, ha='right')
        sc(row, D, f'{cgst_rate:.0f}%',            sz=9, ha='center')
        sc(row, E, fmt_inr(cgst_amount),           sz=9, ha='right')
        sc(row, F, f'{sgst_rate:.0f}%',            sz=9, ha='center')
        sc(row, G, fmt_inr(sgst_amount),           sz=9, ha='right')
        sc(row, H, fmt_inr(total_tax),             sz=9, ha='right')
        apply_grid(row, A, row, H)
        row += 1

        rh(row, 14)
        sc(row, A, 'Total',                        bold=True, sz=9, ha='right')
        mc(row, B, row, C, fmt_inr(taxable_amount), bold=True, sz=9, ha='right')
        sc(row, D, '',                             sz=9)
        sc(row, E, fmt_inr(cgst_amount),           bold=True, sz=9, ha='right')
        sc(row, F, '',                             sz=9)
        sc(row, G, fmt_inr(sgst_amount),           bold=True, sz=9, ha='right')
        sc(row, H, fmt_inr(total_tax),             bold=True, sz=9, ha='right')
        apply_grid(row, A, row, H)
        row += 1

    # =========================================================================
    # Tax amount in words + Bank details (two-column)
    # =========================================================================
    rh(row, 14)
    mc(row, A, row, D,
       f'Tax Amount (in words) :   {number_to_words(total_tax)}',
       sz=9, wrap=True)
    mc(row, E, row, H, "Company's Bank Details", bold=True, sz=9)
    apply_box(row, A, row, D)
    apply_box(row, E, row, H)
    row += 1

    for bank_lbl, bank_val in [
        ('Bank Name',         ': ICICI Bank'),
        ('A/c No.',           ': 656905601822'),
        ('Branch & IFS Code', ': INDORE M G ROAD & ICIC0006569'),
    ]:
        rh(row, 14)
        mc(row, A, row, D, '', sz=9)
        sc(row, E, bank_lbl, bold=True, sz=9)
        mc(row, F, row, H, bank_val, sz=9)
        apply_box(row, A, row, D)
        apply_grid(row, E, row, H)
        row += 1

    # =========================================================================
    # Remarks + signatory block (two-column)
    # =========================================================================
    remarks_month = ''
    if period:
        p = period.strip().split()
        if len(p) >= 2:
            remarks_month = f"{p[0][:3].upper()},{str(p[1])[2:]}"

    rh(row, 14)
    mc(row, A, row, D, 'Remarks:', bold=True, sz=9)
    mc(row, E, row, H,
       'for APS INSURANCE BROKING SERVICES PRIVATE LIMITED',
       bold=True, sz=9, ha='center')
    apply_box(row, A, row, D)
    apply_box(row, E, row, H)
    row += 1

    rh(row, 14)
    mc(row, A, row, D,
       f'BEING INVOICE RAISED MONTH OF {remarks_month}', sz=9)
    mc(row, E, row, H, '', sz=9)
    apply_box(row, A, row, D)
    apply_box(row, E, row, H)
    row += 1

    rh(row, 14)
    mc(row, A, row, D, "Company's PAN : AAZCA5637P", sz=9)
    mc(row, E, row, H, '', sz=9)
    apply_box(row, A, row, D)
    apply_box(row, E, row, H)
    row += 1

    rh(row, 28)
    mc(row, A, row, D, '', sz=9)
    mc(row, E, row, H,
       f'Digitally signed by {signatory_name}',
       italic=True, sz=8, ha='center', va='center')
    apply_box(row, A, row, D)
    apply_box(row, E, row, H)
    row += 1

    rh(row, 16)
    mc(row, A, row, D, '', sz=9)
    mc(row, E, row, H, 'Authorised Signatory', bold=True, sz=9, ha='center')
    apply_box(row, A, row, D)
    apply_box(row, E, row, H)
    row += 1

    # =========================================================================
    # Footer
    # =========================================================================
    rh(row, 14)
    mc(row, A, row, H,
       'This is a Computer Generated Invoice',
       italic=True, sz=8, ha='center')
    apply_box(row, A, row, H)
    last_row = row

    # Reinforce the overall outer border (non-destructive)
    add_outer_border(1, A, last_row, H)

    ws.print_area = f'A1:H{last_row}'
    return wb


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description='CaliberPO — APS Tax Invoice Generator')
    ap.add_argument('--statement',    required=True,
                    help='Path to insurer statement file')
    ap.add_argument('--insurer_id',   required=True,
                    help='Insurer ID e.g. BAJAJ, OR, NIC')
    ap.add_argument('--period',       required=True,
                    help='Statement period e.g. "August 2026"')
    ap.add_argument('--invoice_no',   default=None,
                    help='Invoice number (auto-generated if omitted)')
    ap.add_argument('--invoice_date', default=None,
                    help='Invoice date DD-MM-YYYY (default: today)')
    ap.add_argument('--reference',    default='',
                    help='Reference No. & Date for invoice meta')
    ap.add_argument('--round_off',    default='0',
                    help='Round-off adjustment amount (e.g. -0.80)')
    ap.add_argument('--setup',        required=True,
                    help='Path to CaliberPO_Setup.xlsx')
    ap.add_argument('--out_dir',      default=None,
                    help='Output directory (default: OUT_DIR constant)')
    args = ap.parse_args()

    for p, label in [(args.statement, 'statement'), (args.setup, 'setup')]:
        if not os.path.exists(p):
            print(f"ERROR: {label} file not found: {p}")
            sys.exit(1)

    print(f"\n{'='*55}")
    print(f"  CaliberPO Invoice Generator")
    print(f"{'='*55}")
    print(f"  Statement  : {args.statement}")
    print(f"  Insurer ID : {args.insurer_id}")
    print(f"  Period     : {args.period}")

    broker  = read_broker_setup(args.setup)
    insurer = read_insurer_master(args.setup, args.insurer_id)

    invoice_no   = args.invoice_no or next_invoice_number(args.setup, args.insurer_id)
    invoice_date = args.invoice_date or datetime.now().strftime('%d-%m-%Y')
    round_off    = float(args.round_off or 0)

    print(f"  Invoice No : {invoice_no}")
    print(f"  Date       : {invoice_date}")

    print(f"\nParsing statement ...")
    line_items = detect_and_parse(args.statement, args.insurer_id)
    print(f"  {len(line_items)} product line(s):")
    for item in line_items:
        print(f"    {item['product']:<25}  premium: {item['premium']:>14,.2f}  "
              f"commission: {item['commission']:>14,.2f}")

    taxable_amount = sum(i['commission'] for i in line_items)

    gst_type = determine_gst(
        broker.get('State Code (2-digit GST)', ''),
        insurer.get('insurer_state_code', '')
    )
    print(f"  GST type   : {gst_type}")
    print(f"  Taxable    : {taxable_amount:,.2f}")

    # Derive particulars note from period ("August 2026" → "Brokerage for the month of Aug,26")
    p = args.period.strip().split()
    if len(p) >= 2:
        particulars_note = f"Brokerage for the month of {p[0][:3]},{str(p[1])[2:]}"
    else:
        particulars_note = args.period

    wb = build_invoice(
        broker, insurer,
        invoice_no, invoice_date, args.period,
        taxable_amount, gst_type,
        particulars_note=particulars_note,
        round_off=round_off,
        reference_no_and_date=args.reference,
    )

    out_dir = args.out_dir or OUT_DIR
    os.makedirs(out_dir, exist_ok=True)
    period_slug = args.period.replace(' ', '').replace('/', '-')
    inv_slug    = invoice_no.replace('/', '-').replace(' ', '_')
    filename    = f"INV_{args.insurer_id.upper()}_{period_slug}_{inv_slug}.xlsx"
    out_path    = os.path.join(out_dir, filename)
    wb.save(out_path)

    gst_amount = round(taxable_amount * (0.18 if gst_type == 'IGST' else 0.18), 2)
    inv_total  = round(taxable_amount + gst_amount + round_off, 2)

    print(f"\n{'='*55}")
    print(f"  File            : {filename}")
    print(f"  Insurer         : {insurer.get('insurer_name', '')}")
    print(f"  Period          : {args.period}")
    print(f"  Products        : {len(line_items)} line(s)")
    print(f"  Taxable (comm)  : {taxable_amount:>14,.2f}")
    print(f"  GST ({gst_type:<9}): {gst_amount:>14,.2f}")
    if round_off:
        print(f"  Round Off       : {round_off:>14,.2f}")
    print(f"  Invoice Total   : {inv_total:>14,.2f}")
    print(f"  Saved to        : {out_path}")
    print(f"{'='*55}\n")
if __name__ == '__main__':
    main()
