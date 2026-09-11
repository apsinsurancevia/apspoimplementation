# CaliberPO — Data Management Guide

_For data managers with Drive access. No Apps Script access required._

---

## Contents

1. [What You Are Managing](#1-what-you-are-managing)
2. [Drive Folder Map](#2-drive-folder-map)
3. [Understanding the Commission Grid](#3-understanding-the-commission-grid)
4. [Uploading a New Grid File (Monthly Rate Update)](#4-uploading-a-new-grid-file-monthly-rate-update)
5. [Adding a New Insurer](#5-adding-a-new-insurer)
6. [Managing the Insurer Master](#6-managing-the-insurer-master)
7. [Managing the Partner Master](#7-managing-the-partner-master)
8. [Monthly Workflow — Your Responsibilities](#8-monthly-workflow--your-responsibilities)
9. [What NOT to Touch](#9-what-not-to-touch)
10. [Quick Reference — Allowed Values](#10-quick-reference--allowed-values)

---

## 1. What You Are Managing

CaliberPO is the commission management system. It calculates how much commission the broker earns from each insurer for every policy sold, generates payouts for partners (POSPs/dealers), and produces invoices.

**Your role** is to keep the underlying data accurate:
- Commission rate grids (what each insurer pays, for which product, in which region)
- Insurer Master (the list of insurers the system knows about)
- Partner Master (the list of partners/POSPs who receive payouts)

**What the system does automatically** (you do not trigger these):
- Commission calculation once sales data is uploaded
- Payout statements and invoice generation
- Statement reconciliation

**Who triggers the automation:** The system administrator (the person with Apps Script access). Your job is to ensure the data is correct before they run anything.

---

## 2. Drive Folder Map

All your work happens inside the shared **CaliberPO** folder in Google Drive. Here is what each sub-folder is for.

```
CaliberPO/
│
├── Grid Import/          ← You upload insurer Excel rate files here
├── Grid Archive/         ← Auto-populated. Do not edit. One sub-folder per insurer.
├── Grids/                ← Auto-populated Google Sheets, one per insurer. You can view but not rearrange.
│
├── Input/                ← Sales data and import files go here
├── Output/               ← Commission batch outputs. Read only for you.
│
├── Statements/           ← Insurer commission statements go here (for reconciliation)
├── Invoices/
│   ├── Partner/          ← Partner payout PDFs (auto-generated)
│   └── Insurer/          ← Insurer invoice PDFs (auto-generated)
│
├── Reconciliation/       ← Reconciliation reports (auto-generated)
│
├── Masters/              ← Master data sheets — your main editing area
│   ├── Insurer Master    ← List of all insurers
│   ├── Partner Master    ← List of all partners/POSPs
│   ├── Product Master    ← Product types (reference only — do not edit)
│   └── RTO Master        ← RTO codes (reference only — do not edit)
│
├── Log/                  ← System logs (read only)
└── Backup/               ← Auto-backups (do not edit)
```

**Folders you actively work in:**
- `Grid Import` — for uploading rate files
- `Masters` → Insurer Master — to add/update insurers
- `Masters` → Partner Master — to add/update partners

---

## 3. Understanding the Commission Grid

### What a grid is

Each insurer has **one Google Sheet** in the `Grids/` folder, named `[Insurer Name] Grid`. Inside that sheet there are tabs — one per product type per financial year.

| Tab name | Product |
|---|---|
| `TW_26-27` | Two-Wheeler (FY 2026-27) |
| `PC_26-27` | Private Car |
| `GCV_26-27` | Goods Carrying Vehicle |
| `PCV_26-27` | Passenger Carrying Vehicle |
| `MiscD_26-27` | Tractor + Construction Equipment |

The `26-27` suffix is the financial year (April 2026 – March 2027). When a new FY starts, new tabs are created automatically.

### How the system uses the grid

When a policy is processed, the system finds the right row in the grid by filtering in sequence:

1. **Which insurer?** — from the policy record
2. **Which product tab?** — from product type + financial year
3. **Is the rate currently valid?** — `effective_from_date` ≤ policy date ≤ `effective_to_date`
4. **Which sub-type?** — e.g., Comprehensive vs TP Only
5. **Which RTO zone?** — exact RTO match first, then "All" (pan-India) as fallback
6. **Which vehicle params?** — CC range, GVW, seating, fuel type
7. **Which slab tier?** — based on premium amount (Base, Slab 1, 2, or 3)

If the system finds exactly one matching row, it returns the rate. If it finds none, it returns NO_MATCH. If it finds more than one identical row, it returns DUPLICATE_RATE (a data error — fix the grid).

### The 64-column grid structure

Every grid tab (whether you fill it directly or via Excel upload) has exactly 64 columns with the following headers in row 1. **Row 1 is managed by the system — never edit it.**

Data starts from row 2. Each data row = one rate entry.

#### Identity columns (always required)

| # | Column name | What to enter | Example |
|---|---|---|---|
| 0 | `insurance_company` | Insurer's full official name | `TATA AIG GENERAL INSURANCE CO LTD` |
| 1 | `insurer_code` | Short code matching Insurer Master | `TATA` |
| 2 | `scheme_name` | Scheme or circular name from insurer (optional) | `Q1-FY27-TW-Std` |
| 3 | `product_type` | Product category (fixed values — see §10) | `TW` |
| 4 | `product_sub_type` | Policy structure (fixed values — see §10) | `1+1` |
| 5 | `product_sub_sub_type` | Vehicle sub-category (fixed values — see §10) | `Scooter` |
| 6 | `product_category` | Free-text grouping label (optional) | `Motor` |

#### Rate validity (always required)

| # | Column name | What to enter | Example |
|---|---|---|---|
| 7 | `effective_from_date` | Rate start date in `YYYY-MM-DD` format | `2026-04-01` |
| 8 | `effective_to_date` | Rate end date in `YYYY-MM-DD` format | `2026-06-30` |

> **Important:** Dates must be in `YYYY-MM-DD` format. The system rejects other formats silently.
> A rate effective for a full month would be e.g. `2026-08-01` to `2026-08-31`.
> Leave `effective_to_date` blank only if the rate has no end date (ongoing).

#### Vehicle description (leave blank if not applicable)

| # | Column name | When to fill | Example |
|---|---|---|---|
| 9 | `vehicle_age_band` | Optional label | `New` / `Old` |
| 10 | `vehicle_age_notes` | Free text notes | `New = current year registration` |
| 11 | `fuel_type` | Fill when rate differs by fuel | `Petrol` / `Diesel` / `Electric` / blank = all fuels |
| 12 | `vehicle_type_desc` | Free text description | `2-Wheeler Scooter <75cc` |
| 13 | `vehicle_segment` | Optional segment label | `Entry` |

#### CC (engine capacity) — for Two-Wheeler and Private Car only

| # | Column name | What to enter |
|---|---|---|
| 14 | `vehicle_cc_lower_limit` | Minimum CC (inclusive). Leave blank if no CC filter. |
| 15 | `vehicle_cc_upper_limit` | Maximum CC (inclusive). Leave blank for "and above". |
| 16 | `cc_range_notes` | Free text, e.g. `<75cc` |
| 17 | `cc_segment_label` | Label like `Small` / `Mid` / `Large` |

> Example: A TW slab for 75–150cc → `vehicle_cc_lower_limit` = 75, `vehicle_cc_upper_limit` = 150.

#### Seating capacity — for PCV only

| # | Column name | What to enter |
|---|---|---|
| 18 | `seating_capacity_lower_limit` | Minimum seating |
| 19 | `seating_capacity_upper_limit` | Maximum seating |

#### GVW (Gross Vehicle Weight) — for GCV and Tractor only

| # | Column name | What to enter |
|---|---|---|
| 20 | `gvw_lower_limit` | Minimum GVW |
| 21 | `gvw_upper_limit` | Maximum GVW |
| 22 | `gvw_unit` | `tonnes` or `kg` — must match the system config |
| 23 | `tonnage_notes` | Free text |

#### RTO zone (always required — critical for rate matching)

| # | Column name | What to enter | Example |
|---|---|---|---|
| 24 | `region_zone` | Zone label (optional) | `Metro` |
| 25 | `rto_list` | **Required.** Comma-separated RTO codes, OR the word `All` for pan-India | `MH-12,MH-14,MH-20` or `All` |
| 26 | `rto_zone` | Zone code (optional) | `Z1` |
| 27 | `rto_notes` | Free text | `Pune + Nashik + Aurangabad` |

> **RTO logic:**
> - The system first tries to find a row whose `rto_list` contains the policy's RTO code (exact match).
> - If no exact match, it falls back to rows where `rto_list` = `All`.
> - If neither matches, the policy is declined for that insurer.
> - Do not use partial codes. `MH-12` is valid. `MH12` is not.

#### Condition adjustments (blank = insurer does not differentiate)

These three columns store the **differential** the insurer applies to PI commission based on whether a policy condition is absent. They are percentages (positive or negative numbers).

| # | Column name | When to fill | Logic |
|---|---|---|---|
| 28 | `ncb_adj` | When insurer pays differently for NCB policies | Applied to PI when policy has **no NCB** |
| 29 | `ncb_rate_notes` | Free text notes | |
| 30 | `ncb_notes` | Free text notes | |
| 31 | `age_lower_limit` | Age band lower limit (optional) | |
| 32 | `age_upper_limit` | Age band upper limit (optional) | |
| 33 | `nil_dep_adj` | When insurer adjusts for Nil Depreciation | Applied to PI when policy has **no Nil Dep add-on** |
| 34 | `nil_dep_notes` | Free text notes | |
| 35 | `cpa_adj` | When insurer adjusts for CPA | Applied to PI when policy has **no CPA add-on** |

> **Adjustment logic example:**
> `ncb_adj` = -5 means: the insurer pays 5% less PI when there is no NCB on the policy.
> If this column is blank, the system applies no adjustment regardless of NCB status.
> The base `pi_rate` (see below) assumes all conditions are present.

#### Commission rates (the core data)

| # | Column name | What to enter | Example |
|---|---|---|---|
| 36 | `pi_rate` | PI commission percentage (primary) | `12.5` |
| 37 | `pi_rate_on` | What base the PI % applies to | `OD` / `TP` / `NET` / `FLAT` / `TP1Y` |
| 38 | `pi_rate1` | Second PI rate (for split OD + TP grids) | `10.0` |
| 39 | `pi_rate1_on` | Base for second PI rate | `TP` |
| 40 | `retention` | Retention % (if applicable) | |
| 41 | `retention1` | Second retention % | |
| 42 | `po_rate` | PO commission percentage (primary) | `5.0` |
| 43 | `po_rate_on` | What base the PO % applies to | `OD` / `TP` / `NET` / `FLAT` |
| 44 | `po_rate_1` | Second PO rate (for split grids) | |
| 45 | `po_rate1_on` | Base for second PO rate | |

> **PI vs PO:**
> - **PI** (Policy Income) = the full commission the insurer pays the broker.
> - **PO** (Partner Output) = the share of that commission paid out to the partner/POSP.
> - Both are percentages. Enter as numbers without the % sign (e.g., `12.5` not `12.5%`).
>
> **Rate bases:**
> - `OD` — applied to OD premium only
> - `TP` — applied to TP premium only
> - `NET` — applied to total net premium
> - `FLAT` — fixed flat amount (not a %)
> - `TP1Y` — applied to 1-year TP equivalent premium

#### Premium slab tiers (optional — only if insurer has slab-based rates)

Some insurers offer better rates at higher premium volumes. If the insurer's grid has slabs, fill these. Otherwise leave all slab columns blank.

| # | Column name | What it means |
|---|---|---|
| 46 | `slab_1_from` | Minimum premium to qualify for Slab 1 |
| 47 | `slab_1_to` | Maximum premium for Slab 1 |
| 48 | `slab_1__pi_rate` | PI rate % at Slab 1 |
| 49 | `slab_1_rate_on` | Base for Slab 1 PI rate |
| 50 | `slab_1_retention` | Retention % at Slab 1 |
| 51 | `slab_1__po_rate` | PO rate % at Slab 1 |
| 52–57 | `slab_2_*` | Same structure for Slab 2 |
| 58–63 | `slab_3_*` | Same structure for Slab 3 |

> If slab columns are present, the system picks the best matching slab based on the policy's premium. If no slabs are filled, the base `po_rate` / `pi_rate` always applies.

---

## 4. Uploading a New Grid File (Monthly Rate Update)

### When this happens

At the start of each month (or when an insurer revises rates), you receive a new rate file from the insurer. This file must be in the **standardised 64-column Excel format** that CaliberPO uses. If the insurer sends their own proprietary format, it needs to be converted to the standard format first — that conversion is a separate step done before uploading.

### What the standardised Excel file looks like

- File format: `.xlsx`
- Row 1: Header row (64 column names exactly matching the grid column names listed in §3)
- Row 2 onward: One data row per rate rule
- The `insurer_code` in column B (row 2) tells the system which insurer this file belongs to

### Step-by-step upload

**Step 1 — Check the file**

Before uploading, verify:
- Column B (row 2) contains the insurer's code (e.g., `TATA`, `BAJAJ`, `OR`). If it's blank or wrong, the import will fail.
- Dates in columns H and I (`effective_from_date` and `effective_to_date`) are in `YYYY-MM-DD` format.
- The `rto_list` column (column Z) contains either RTO codes separated by commas, or the word `All`.
- Rate columns (`pi_rate`, `po_rate`) contain numbers only — no % signs, no text.

**Step 2 — Upload to Grid Import folder**

1. Open the shared **CaliberPO** folder in Google Drive.
2. Navigate to `Grid Import/`.
3. Upload your `.xlsx` file. You can upload multiple insurer files at once.

**Step 3 — Notify the system administrator**

The system administrator will run the import. Notify them that new files are in the Grid Import folder, specifying:
- Which insurer(s)
- Which period (e.g., "September 2026 rates")

**Step 4 — Verify after import**

After the administrator confirms the import is done:
1. Navigate to `Grids/` in Drive.
2. Open the relevant `[Insurer Name] Grid` sheet.
3. Open the correct product tab (e.g., `TW_26-27`).
4. Scroll to the bottom of the data and confirm the new rows are there with correct dates and rates.
5. Check that the old rows for the same period are gone (replaced) while rows from other periods remain untouched.

**What the import does automatically (for your reference):**
- Converts the Excel file to a temporary Google Sheet
- Identifies the insurer from column B
- For each product tab: removes existing rows whose effective date range matches the incoming data, then inserts the new rows
- Moves the Excel file to `Grid Archive/[Insurer Name]/` as a permanent record
- Deletes the temporary Sheet

If the insurer is new (not yet in the system), the import creates their grid sheet automatically and archives to a new sub-folder. See §5 for the full new insurer process.

### Correcting a bad import

If the imported data has errors, the original Excel file is still in `Grid Archive/[Insurer Name]/`. You can:
1. Find the correct file in Grid Archive
2. Move a copy back to `Grid Import/`
3. Ask the administrator to re-run the import

---

## 5. Adding a New Insurer

Adding a new insurer requires two things: a row in the Insurer Master, and a grid file.

### Step 1 — Add to Insurer Master

1. Open `Masters/` → `Insurer Master` in Drive.
2. Go to the `Insurers` tab.
3. Add a new row at the bottom with the following fields:

| Column | What to enter |
|---|---|
| `insurer_id` | Short code in UPPER_SNAKE_CASE, e.g. `NEW_INC`. This is permanent — do not change it later. |
| `insurer_name` | Full official name exactly as it appears on the insurer's letterhead and policy documents. |
| `insurer_gstin` | 15-character GSTIN of the insurer |
| `insurer_state` | State name, e.g. `MAHARASHTRA` |
| `insurer_state_code` | 2-digit GST state code, e.g. `27` |
| `insurer_address` | Full registered address |
| `sac_code` | SAC code for insurance services — use `997131` unless advised otherwise |
| `spoc_email` | Primary contact email at the insurer |
| `active` | Enter `Y` to activate. `N` = inactive (excluded from all processing). |

> **Critical:** The `insurer_name` you enter here must exactly match what the insurer will use in column A of their Excel files. The system uses this name to find the right grid sheet. One character difference will cause the import to fail.

### Step 2 — Notify administrator to create archive folder

After saving the Insurer Master, ask the system administrator to run `setupGridArchiveFolders()`. This creates the archive sub-folder for the new insurer inside `Grid Archive/`.

### Step 3 — Upload the grid file

Follow the standard upload process in §4. Because this is a new insurer, the system will:
- Create a new `[Insurer Name] Grid` sheet in the `Grids/` folder
- Create tabs for all 5 product types (TW, PC, GCV, PCV, MiscD)
- Import the data rows into the matching tab

### Step 4 — Verify

1. Open `Grids/` → `[New Insurer Name] Grid`
2. Check that the correct tabs exist with data in them
3. Notify the administrator to run `validateAllGrids()` on the new sheet before it goes live

---

## 6. Managing the Insurer Master

The Insurer Master is the single source of truth for which insurers are active in the system. It lives at `Masters/` → `Insurer Master` → `Insurers` tab.

### Fields

| Field | Required? | Notes |
|---|---|---|
| `insurer_id` | Yes | Short code. Set once, never change. |
| `insurer_name` | Yes | Full official name. Must match grid file exactly. |
| `insurer_gstin` | Yes | Used on invoices |
| `insurer_state` | Yes | Used for CGST/IGST determination on invoices |
| `insurer_state_code` | Yes | 2-digit GST state code |
| `insurer_address` | Yes | Used on invoices |
| `sac_code` | Yes | Default `997131` |
| `spoc_email` | Yes | For statement and invoice dispatch |
| `active` | Yes | `Y` = active, `N` = deactivated |

### Deactivating an insurer

Set `active` to `N`. The system will stop including them in new rate lookups and batch processing. Existing historical data is unaffected.

### Things you must NOT change

- `insurer_id` — changing this will break all historical rate links
- The column order — the system reads columns by position

---

## 7. Managing the Partner Master

The Partner Master holds every partner (POSP, dealer, or agent) who receives a commission payout. It lives at `Masters/` → `Partner Master` → `Partners` tab.

### Fields

#### Identity

| Field | Required? | Notes |
|---|---|---|
| `posp_id` | Yes | Unique partner code from your CRM/source system. Must match the ID in sales data. |
| `posp_name` | Yes | Partner's name |
| `dealer_name` | No | Dealer or dealership name (if applicable) |
| `manager` | No | Reporting manager name |
| `rm` | No | Relationship manager name |

#### Contact

| Field | Required? | Notes |
|---|---|---|
| `partner_email` | Yes | Used to send payout statements |
| `partner_mobile` | No | For records |

#### Tax

| Field | Required? | Notes |
|---|---|---|
| `pan_number` | Recommended | Without PAN, TDS is deducted at 20% (Section 206AA) instead of 5% |
| `gstin` | No | If partner is GST registered, GST is charged and an invoice is generated |
| `partner_legal_name` | Required if GSTIN filled | Legal name for invoice |
| `partner_address` | Required if GSTIN filled | For invoice |
| `partner_state` | Required if GSTIN filled | For CGST/IGST split |
| `partner_state_code` | Required if GSTIN filled | 2-digit state code |
| `partner_pan` | Same as `pan_number` | Duplicate for legacy reasons — fill both |
| `tds_rate_override` | No | Leave blank to use system default (5% with PAN, 20% without). Fill only to override for a specific partner. |

#### Bank details (for payment records)

| Field | Notes |
|---|---|
| `bank_account_name` | Account holder name |
| `bank_name` | Bank name |
| `bank_branch` | Branch name |
| `account_number` | Account number |
| `ifsc_code` | IFSC code |
| `account_type` | `Savings` / `Current` |

#### Status

| Field | Notes |
|---|---|
| `active` | `Y` = active, `N` = excluded from payouts. Set to `N` if a partner is no longer active. |
| `statement_sent` | Auto-updated by system after payout statement is emailed |
| `utr_number` | Enter the UTR/transaction reference after payment is made |
| `payment_date` | Enter the payment date after payment in `YYYY-MM-DD` format |

### Adding a new partner

Add a row at the bottom of the `Partners` tab. Fill at minimum:
- `posp_id` (must match CRM exactly)
- `posp_name`
- `partner_email`
- `active` = `Y`

Everything else can be added progressively, but PAN and bank details should be completed before the first payout.

### Deactivating a partner

Set `active` to `N`. They will be excluded from future payout runs. Do not delete rows — historical data depends on them.

---

## 8. Monthly Workflow — Your Responsibilities

### At the start of each month

**1. Collect rate files from insurers**

Contact each active insurer's SPOC to confirm whether rates have changed for the new month. Collect `.xlsx` files for any insurer that has updated rates.

**2. Verify the files are in standard format**

Check:
- Column B row 2 has the correct insurer code
- Dates are in `YYYY-MM-DD` format
- `rto_list` contains RTO codes or `All`
- Rate columns are numbers only

**3. Upload to Grid Import**

Place all files in `CaliberPO/Grid Import/`. Notify the administrator with the list of files uploaded and which period they cover.

**4. Update Insurer Master if needed**

If a new insurer is being added this month, follow §5. If an existing insurer's contact email or address has changed, update the Insurer Master accordingly.

**5. Update Partner Master if needed**

- Add new partners who started this month
- Deactivate partners who have left (set `active` = `N`)
- Update bank details or PAN for any partner who provided corrections

### Mid-month — after batch is run

The administrator will run the commission batch after sales data is received. After they confirm it has run:

**6. Record UTR and payment date**

After payout is processed, enter:
- `utr_number` — the transaction reference number from the bank
- `payment_date` — the date payment was made (in `YYYY-MM-DD` format)

in the Partner Master for each partner paid that month.

**7. Upload insurer statements**

When insurer commission statements arrive (via email or portal download), upload them to `CaliberPO/Statements/`. Name them consistently: `[InsurerCode]_[YYYY-MM].[xlsx or pdf]`. Notify the administrator that statements are ready for reconciliation.

### New financial year (April each year)

When March ends and April begins, new grid tabs need to be created for `27-28` (or whichever new FY). The administrator runs `createAllGridTemplates()` to set these up. After that:
- Collect new FY rate files from all insurers
- Upload to Grid Import as usual
- The system detects the new FY from the effective dates and places data in the correct tab

---

## 9. What NOT to Touch

### Never edit these

| Item | Why |
|---|---|
| **Row 1 in any grid sheet** (header row) | Managed by the system. Editing will break imports and validation. |
| **Grids/ folder structure** | Do not rename, move, or delete any grid sheet. |
| **Grid Archive/ folder** | Permanent audit trail. Do not delete or move archived files. |
| **Product Master** | Fixed reference data. Contact the administrator if a product type needs to be added. |
| **RTO Master** | Reference data. Updated by the administrator via a controlled import process. |
| **CaliberPO Config sheet** | System configuration. Only the administrator edits this. |
| **Log/ folder** | System logs. Read-only. |
| **Output/ folder** | Commission batch outputs. Do not edit or delete these. |
| **Invoices/ folder** | Auto-generated PDFs. Do not edit. |

### Never enter these formats

| Column | Wrong format | Correct format |
|---|---|---|
| `effective_from_date` | `01-08-2026` or `01/08/2026` or `Aug 1` | `2026-08-01` |
| `effective_to_date` | Same | Same |
| `pi_rate` / `po_rate` | `12.5%` | `12.5` |
| `rto_list` | `MH12, MH14` (spaces matter, codes are `MH-12`) | `MH-12,MH-14` |
| `active` (any master) | `Yes` / `yes` / `TRUE` | `Y` |
| `insurer_id` | `tata` (lowercase) | `TATA` (UPPER_CASE) |

---

## 10. Quick Reference — Allowed Values

### product_type

| Value | Applies to |
|---|---|
| `TW` | Two-Wheeler |
| `Pvt Car` | Private Car |
| `GCV` | Goods Carrying Vehicle |
| `PCV` | Passenger Carrying Vehicle |
| `Tractor` | Tractor |
| `Construction Eqpt` | Construction Equipment |

### product_sub_type

| Value | Typical usage |
|---|---|
| `New (1+5)` | TW new business — 1Y OD + 5Y TP bundle |
| `New (5+5)` | TW new business — 5Y OD + 5Y TP bundle |
| `New (1+3)` | Pvt Car new business — 1Y OD + 3Y TP bundle |
| `New (3+3)` | Pvt Car new business — 3Y OD + 3Y TP bundle |
| `1+1` | Annual comprehensive — applies to TW, Pvt Car, GCV, PCV, Tractor |
| `SAOD` | Standalone OD policy |
| `SATP` | Standalone TP policy |
| `Comprehensive` | Used in API inputs; maps to `1+1` in some contexts |
| `TP Only` | Used in API inputs; maps to `SATP` in some contexts |

### product_sub_sub_type

| Product type | Values |
|---|---|
| TW | `Scooter`, `Bike` |
| Pvt Car | _(leave blank)_ |
| GCV | `3W`, `Tanker`, `Water Tanker`, `Car Carrier`, `Flatbed`, `Oil Tanker` |
| PCV | `3W`, `Taxi 4+1`, `Taxi 5+1`, `Taxi>7`, `Bus<12`, `Bus>12<36`, `Bus>36`, `School Bus`, `Staff Bus` |
| Tractor | `Excavator`, `Harvester`, `Agri Tractor` |
| Construction Eqpt | _(leave blank)_ |

### fuel_type

`Petrol` / `Diesel` / `Electric` / `Bio Fuel` / _(blank = all fuels)_

### pi_rate_on / po_rate_on

| Value | Meaning |
|---|---|
| `OD` | Rate applied to OD premium |
| `TP` | Rate applied to TP premium |
| `NET` | Rate applied to total net premium |
| `FLAT` | Fixed flat rupee amount |
| `TP1Y` | Rate applied to 1-year TP equivalent |

### active (in all masters)

`Y` = active / `N` = inactive

### insurer codes (current active insurers)

| Code | Full name |
|---|---|
| `OR` | THE ORIENTAL INSURANCE CO LTD |
| `NIC` | NATIONAL INSURANCE CO LTD |
| `UIIC` | UNITED INDIA INSURANCE CO LTD |
| `USGI` | UNIVERSAL SOMPO GENERAL INSURANCE CO LTD |
| `TATA` | TATA AIG GENERAL INSURANCE CO LTD |
| `BAJAJ` | BAJAJ ALLIANZ GENERAL INSURANCE CO LTD |
| `GO` | GO DIGIT GENERAL INSURANCE LTD |
| `INDUSIND` | INDUSIND GENERAL INSURANCE CO LTD |
| `RELIANCE` | RELIANCE GENERAL INSURANCE CO LTD |
| `ROYALSU` | ROYAL SUNDARAM GENERAL INSURANCE CO LTD |

---

_Questions? Contact the system administrator._
