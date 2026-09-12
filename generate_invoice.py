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
# Layout: 10 columns (A-J), fits on one A4 page.
#   Rows 1-15 : title / broker / invoice meta / buyer
#   Row  17   : line-items table header (cols A-E)
#   Rows 18+  : one row per product (cols A-E)
#   After items: GST rows, totals, amount-in-words, tax summary, bank+signatory
# ---------------------------------------------------------------------------

def build_invoice(broker: dict, insurer: dict, line_items: list,
                  invoice_no: str, invoice_date: str, period: str,
                  gst_type: str) -> Workbook:

    wb = Workbook()
    ws = wb.active
    ws.title = "Tax Invoice"

    # ── Page setup ────────────────────────────────────────────────────────────
    ws.page_setup.paperSize        = ws.PAPERSIZE_A4
    ws.page_setup.orientation      = ws.ORIENTATION_PORTRAIT
    ws.page_setup.fitToPage        = True
    ws.page_setup.fitToWidth       = 1
    ws.page_setup.fitToHeight      = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    # ── Column widths ─────────────────────────────────────────────────────────
    for col, w in zip('ABCDEFGHIJ', [6, 35, 14, 20, 22, 20, 26, 8, 8, 8]):
        ws.column_dimensions[col].width = w

    # ── Helpers ───────────────────────────────────────────────────────────────
    def hfont(**kw):  return Font(name='Arial', **kw)
    def hfill(hex_):  return PatternFill(fill_type='solid', fgColor=hex_)
    def halign(h='left', v='center', wrap=False):
        return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

    def write(row, col, value, bold=False, size=10, color='000000',
              italic=False, fill=None, align_h='left', align_v='center',
              wrap=False, num_fmt=None, border=None):
        c = ws.cell(row=row, column=col, value=value)
        c.font      = hfont(bold=bold, size=size, color=color, italic=italic)
        c.alignment = halign(align_h, align_v, wrap)
        if fill:
            c.fill = hfill(fill)
        if num_fmt:
            c.number_format = num_fmt
        if border:
            c.border = border
        return c

    r = 1  # row pointer

    # ── ROW 1: Title ──────────────────────────────────────────────────────────
    ws.merge_cells(f'A{r}:J{r}')
    write(r, 1, 'Tax Invoice', bold=True, size=16, color='FFFFFF',
          fill=DARK_BLUE, align_h='center')
    ws.row_dimensions[r].height = 26
    r += 1

    # ── ROW 2: Blank ──────────────────────────────────────────────────────────
    ws.row_dimensions[r].height = 5
    r += 1

    # ── ROWS 3-10: Broker (left A-E) + Invoice meta (right F-J) ──────────────
    block_start = r

    broker_lines = [
        (broker.get('Broker Name', '[NOT CONFIGURED]'),          True,  11),
        (broker.get('Address Line 1', ''),                       False, 10),
        ((broker.get('Address Line 2', '') + ', ' +
          broker.get('City', '')).strip(', '),                   False, 10),
        (broker.get('State', '') + ', Code: ' +
         broker.get('State Code (2-digit GST)', '') +
         '   PIN: ' + broker.get('PIN Code', ''),                False, 10),
        ('GSTIN/UIN: ' + broker.get('GSTIN/UIN', '[NOT CONFIGURED]'), False, 10),
        ('E-Mail: '   + broker.get('Contact Email', '[NOT CONFIGURED]'), False, 10),
        ('Mob No.: '  + broker.get('Mobile No.', '[NOT CONFIGURED]'), False, 10),
        ('IRDAI Lic: '+ broker.get('IRDAI Licence Number', '[NOT CONFIGURED]'), False, 9),
    ]

    meta_lines = [
        ('Invoice No.',              invoice_no),
        ('Dated',                    invoice_date),
        ('Delivery Note',            ''),
        ('Mode/Terms of Payment',    ''),
        ("Supplier's Ref.",          ''),
        ('Other Reference(s)',       ''),
        ('Period',                   period),
        ('SAC Code',                 str(insurer.get('sac_code') or SAC_DEFAULT)),
    ]

    for (btxt, bbold, bsz), (lbl, val) in zip(broker_lines, meta_lines):
        ws.merge_cells(f'A{r}:E{r}')
        write(r, 1, btxt, bold=bbold, size=bsz)
        ws.row_dimensions[r].height = 16

        write(r, 6, lbl, bold=True, size=9, fill=LIGHT_GREY, align_h='right')
        ws.merge_cells(f'G{r}:J{r}')
        write(r, 7, val, size=9, align_h='left')
        r += 1

    outer_border(ws, block_start, 1, r - 1, 5)   # broker block
    outer_border(ws, block_start, 6, r - 1, 10)  # meta block

    # ── ROWS 11-15: Buyer (Insurer) ───────────────────────────────────────────
    buyer_start = r
    ws.merge_cells(f'A{r}:J{r}')
    write(r, 1, 'Buyer', bold=True, size=10, fill=LIGHT_GREY)
    ws.row_dimensions[r].height = 16
    r += 1

    ws.merge_cells(f'A{r}:J{r}')
    write(r, 1, str(insurer.get('insurer_name', '')).upper(), bold=True, size=11)
    ws.row_dimensions[r].height = 16
    r += 1

    ws.merge_cells(f'A{r}:J{r}')
    write(r, 1, str(insurer.get('insurer_address', '')), size=10, wrap=True)
    ws.row_dimensions[r].height = 20
    r += 1

    ws.merge_cells(f'A{r}:J{r}')
    write(r, 1, 'GSTIN/UIN: ' + str(insurer.get('insurer_gstin', '')), size=10)
    ws.row_dimensions[r].height = 16
    r += 1

    ws.merge_cells(f'A{r}:J{r}')
    write(r, 1, 'State Name: ' + str(insurer.get('insurer_state', '')) +
          ',  Code: ' + str(insurer.get('insurer_state_code', '')), size=10)
    ws.row_dimensions[r].height = 16
    r += 1

    outer_border(ws, buyer_start, 1, r - 1, 10)

    # ── ROW 16: Blank ─────────────────────────────────────────────────────────
    ws.row_dimensions[r].height = 5
    r += 1

    # ── ROW 17: Line items header ─────────────────────────────────────────────
    tbl_headers = ['SI No.', 'Description of Goods', 'HSN/SAC',
                   'Premium (Rs.)', 'Commission Amount (Rs.)']
    for ci, hdr in enumerate(tbl_headers, start=1):
        write(r, ci, hdr, bold=True, size=10, color='FFFFFF',
              fill=DARK_BLUE, align_h='center', border=thin_border())
    ws.row_dimensions[r].height = 18
    r += 1

    # ── ROWS 18+: Line items ──────────────────────────────────────────────────
    sac       = str(insurer.get('sac_code') or SAC_DEFAULT)
    tot_prem  = 0.0
    tot_comm  = 0.0
    item_start = r

    for idx, item in enumerate(line_items, start=1):
        row_fill = 'FFFFFF' if idx % 2 == 1 else LIGHT_BLUE
        write(r, 1, idx,             size=10, fill=row_fill, align_h='center', border=thin_border())
        write(r, 2, item['product'], size=10, fill=row_fill, align_h='left',   border=thin_border())
        write(r, 3, sac,             size=10, fill=row_fill, align_h='center', border=thin_border())

        c4 = ws.cell(row=r, column=4)
        set_currency(c4, item['premium'])
        c4.font   = hfont(size=10)
        c4.fill   = hfill(row_fill)
        c4.border = thin_border()

        c5 = ws.cell(row=r, column=5)
        set_currency(c5, item['commission'])
        c5.font   = hfont(size=10)
        c5.fill   = hfill(row_fill)
        c5.border = thin_border()

        tot_prem += item['premium']
        tot_comm += item['commission']
        ws.row_dimensions[r].height = 16
        r += 1

    item_end = r - 1

    # ── Blank row ─────────────────────────────────────────────────────────────
    ws.row_dimensions[r].height = 6
    r += 1

    # ── GST rows ──────────────────────────────────────────────────────────────
    gst_amount = round(tot_comm * GST_RATE, 2)
    half_gst   = round(tot_comm * 0.09, 2)

    if gst_type == 'CGST_SGST':
        for lbl, amt in [('CGST 9%', half_gst), ('SGST 9%', half_gst)]:
            write(r, 4, lbl, size=10, align_h='right')
            c = ws.cell(row=r, column=5)
            set_currency(c, amt)
            c.font = hfont(size=10)
            ws.row_dimensions[r].height = 15
            r += 1
    else:
        write(r, 4, 'IGST 18%', size=10, align_h='right')
        c = ws.cell(row=r, column=5)
        set_currency(c, gst_amount)
        c.font = hfont(size=10)
        ws.row_dimensions[r].height = 15
        r += 1

    # ── Totals row ────────────────────────────────────────────────────────────
    grand_total = round(tot_comm + gst_amount, 2)

    write(r, 2, 'Total', bold=True, size=10, fill=TOTALS_BLU,
          align_h='right', border=thin_border())

    c4 = ws.cell(row=r, column=4)
    set_currency(c4, tot_prem)
    c4.font   = hfont(bold=True, size=10)
    c4.fill   = hfill(TOTALS_BLU)
    c4.border = thin_border()

    c5 = ws.cell(row=r, column=5)
    set_currency(c5, grand_total)
    c5.font   = hfont(bold=True, size=10)
    c5.fill   = hfill(TOTALS_BLU)
    c5.border = thin_border()

    ws.row_dimensions[r].height = 18
    r += 2  # totals row + blank

    # ── Amount in words ───────────────────────────────────────────────────────
    ws.merge_cells(f'A{r}:E{r}')
    write(r, 1, 'Amount Chargeable (in words):', bold=True, size=10)
    ws.row_dimensions[r].height = 15
    r += 1

    ws.merge_cells(f'A{r}:E{r}')
    write(r, 1, number_to_words(grand_total), bold=True, italic=True, size=10)
    ws.row_dimensions[r].height = 15
    r += 2  # words row + blank

    # ── Tax summary table ─────────────────────────────────────────────────────
    tax_hdrs = ['HSN/SAC', 'Taxable Value', 'Central Tax\nRate', 'Central Tax\nAmt',
                'State Tax\nRate', 'State Tax\nAmt', 'Total Tax\nAmt']
    for ci, h in enumerate(tax_hdrs, start=1):
        write(r, ci, h, bold=True, size=9, fill=GREEN_GREY,
              align_h='center', wrap=True, border=thin_border())
    ws.row_dimensions[r].height = 28
    r += 1

    if gst_type == 'CGST_SGST':
        tax_data = [sac, tot_comm, '9%', half_gst, '9%', half_gst, gst_amount]
    else:
        tax_data = [sac, tot_comm, '18%', gst_amount, '-', 0, gst_amount]

    for ci, val in enumerate(tax_data, start=1):
        c = ws.cell(row=r, column=ci, value=val)
        c.font   = hfont(size=9)
        c.border = thin_border()
        if isinstance(val, float) and ci > 1:
            c.number_format = INDIAN_FMT
            c.alignment = halign('right')
        else:
            c.alignment = halign('center')
    ws.row_dimensions[r].height = 16
    r += 1

    # Tax table totals row
    tax_totals = ['Total', tot_comm, '', gst_amount, '', gst_amount, gst_amount]
    for ci, val in enumerate(tax_totals, start=1):
        c = ws.cell(row=r, column=ci, value=val if val != '' else None)
        c.font   = hfont(bold=True, size=9)
        c.fill   = hfill(GREEN_GREY)
        c.border = thin_border()
        if isinstance(val, float) and ci > 1:
            c.number_format = INDIAN_FMT
            c.alignment = halign('right')
        else:
            c.alignment = halign('right' if ci == 1 else 'center')
    ws.row_dimensions[r].height = 16
    r += 1

    # ── Tax amount in words ───────────────────────────────────────────────────
    ws.merge_cells(f'A{r}:E{r}')
    write(r, 1, 'Tax Amount (in words): ' + number_to_words(gst_amount),
          bold=True, size=9)
    ws.row_dimensions[r].height = 15
    r += 2  # + blank

    # ── Bank details (left A-E) + Signatory (right F-J) ──────────────────────
    bank_start = r
    bank_lines = [
        ("Company's PAN: " + broker.get('PAN', '[NOT CONFIGURED]'),     True),
        ("Company's Bank Details",                                        True),
        ('Bank:   ' + broker.get('Bank Name', '[NOT CONFIGURED]'),       False),
        ('A/c No: ' + broker.get('Account Number', '[NOT CONFIGURED]'),  False),
        ('Branch & IFS Code: ' + broker.get('City', '') +
         ' & ' + broker.get('IFSC Code', '[NOT CONFIGURED]'),            False),
    ]
    for txt, bold in bank_lines:
        ws.merge_cells(f'A{r}:E{r}')
        write(r, 1, txt, bold=bold, size=10)
        ws.row_dimensions[r].height = 15
        r += 1

    # Signatory — anchored at bank_start on the right
    ws.merge_cells(f'F{bank_start}:J{bank_start}')
    write(bank_start, 6, 'For ' + broker.get('Broker Name', '[NOT CONFIGURED]'),
          bold=True, size=10, align_h='center')
    for sr in range(bank_start + 1, bank_start + 4):
        ws.merge_cells(f'F{sr}:J{sr}')
        ws.row_dimensions[sr].height = 15
    ws.merge_cells(f'F{bank_start + 4}:J{bank_start + 4}')
    write(bank_start + 4, 6, 'Authorised Signatory', bold=True, size=10, align_h='center')

    r += 1  # blank after bank block

    # ── Declaration ───────────────────────────────────────────────────────────
    decl = [
        ('Declaration', True, False),
        ('We declare that this invoice shows the actual brokerage payable for the', False, True),
        ('services rendered and that all particulars are true and correct.', False, True),
    ]
    for txt, bold, italic in decl:
        ws.merge_cells(f'A{r}:E{r}')
        write(r, 1, txt, bold=bold, italic=italic, size=9)
        ws.row_dimensions[r].height = 13
        r += 1

    # ── Outer border around full invoice ──────────────────────────────────────
    last_row = r - 1
    for row_obj in ws.iter_rows(min_row=1, max_row=last_row, min_col=1, max_col=10):
        for cell in row_obj:
            existing = cell.border
            cell.border = Border(
                left   = THIN if cell.column == 1        else existing.left,
                right  = THIN if cell.column == 10       else existing.right,
                top    = THIN if cell.row    == 1        else existing.top,
                bottom = THIN if cell.row    == last_row else existing.bottom,
            )

    ws.print_area = f'A1:J{last_row}'

    return wb


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description='CaliberPO — Tax Invoice Generator')
    ap.add_argument('--statement',   required=True,  help='Path to insurer statement file')
    ap.add_argument('--insurer_id',  required=True,  help='Insurer ID e.g. BAJAJ, OR, NIC')
    ap.add_argument('--period',      required=True,  help='Statement period e.g. "July 2026"')
    ap.add_argument('--invoice_no',  default=None,   help='Invoice number (auto-generated if omitted)')
    ap.add_argument('--invoice_date',default=None,   help='Invoice date DD-MM-YYYY (default: today)')
    ap.add_argument('--setup',       required=True,  help='Path to CaliberPO_Setup.xlsx')
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

    # Steps 1-2
    broker  = read_broker_setup(args.setup)
    insurer = read_insurer_master(args.setup, args.insurer_id)

    invoice_no   = args.invoice_no   or next_invoice_number(args.setup, args.insurer_id)
    invoice_date = args.invoice_date or datetime.now().strftime('%d-%m-%Y')

    print(f"  Invoice No : {invoice_no}")
    print(f"  Date       : {invoice_date}")

    # Step 3
    print(f"\nParsing statement ...")
    line_items = detect_and_parse(args.statement, args.insurer_id)
    print(f"  {len(line_items)} product line(s) extracted")
    for item in line_items:
        print(f"    {item['product']:<25} Premium: {item['premium']:>14,.2f}   "
              f"Commission: {item['commission']:>14,.2f}")

    # Step 4
    gst_type = determine_gst(
        broker.get('State Code (2-digit GST)', ''),
        insurer.get('insurer_state_code', '')
    )
    print(f"  GST type   : {gst_type}")

    # Step 5
    wb = build_invoice(broker, insurer, line_items, invoice_no, invoice_date,
                       args.period, gst_type)

    # Step 6
    os.makedirs(OUT_DIR, exist_ok=True)
    period_slug = args.period.replace(' ', '').replace('/', '-')
    inv_slug    = invoice_no.replace('/', '-').replace(' ', '_')
    filename    = f"INV_{args.insurer_id.upper()}_{period_slug}_{inv_slug}.xlsx"
    out_path    = os.path.join(OUT_DIR, filename)
    wb.save(out_path)

    tot_prem   = sum(i['premium']    for i in line_items)
    tot_comm   = sum(i['commission'] for i in line_items)
    gst_amount = round(tot_comm * GST_RATE, 2)
    inv_total  = round(tot_comm + gst_amount, 2)

    print(f"\n{'='*55}")
    print(f"  File            : {filename}")
    print(f"  Insurer         : {insurer.get('insurer_name', '')}")
    print(f"  Period          : {args.period}")
    print(f"  Products        : {len(line_items)} line(s)")
    print(f"  Total Premium   : {tot_prem:>14,.2f}")
    print(f"  Total Commission: {tot_comm:>14,.2f}")
    print(f"  GST ({gst_type:<9}): {gst_amount:>14,.2f}")
    print(f"  Invoice Total   : {inv_total:>14,.2f}")
    print(f"  Saved to        : {out_path}")
    print(f"{'='*55}\n")


if __name__ == '__main__':
    main()
