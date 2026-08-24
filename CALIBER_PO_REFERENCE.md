# CaliberPO — System Reference
_Last updated: 2026-08-21_

---

## What It Is

CaliberPO is a commission management system for an insurance broker, built entirely on Google Apps Script + Google Sheets/Drive. It handles the full commission lifecycle: rate lookup → commission calculation → payout → statement processing → reconciliation.

**Workspaces:**
- `novoup` — development/template workspace (this repo)
- `aps-production` — client deployment (APS broker), not yet created

**Repo:** `caliber-po` on GitHub. Active branch: `novoup-staging`. Main branch: `main`.

---

## Architecture

| Layer | Tech | Notes |
|-------|------|-------|
| Runtime | Google Apps Script V8 | `var` throughout — no const/let |
| Storage | Google Sheets + Drive | All data in Sheets, files in Drive folders |
| Web UI | Apps Script Web App | `doGet()` → `HtmlService` |
| Automation | Apps Script Triggers | Time-based + event-based |
| AI extraction | Claude API | Statement → JSON via `UrlFetchApp` |
| Monitoring | CommandCentre (novoup) | Separate Apps Script project in `central/` |

**Key constraint:** `clasp push` can sync silently without updating the editor. If a change isn't appearing, paste the file manually into the editor.

---

## File Structure

```
caliber-po/
├── src/                        # Broker workspace (clasp rootDir)
│   ├── appsscript.json
│   ├── Config.gs               # All IDs and constants — no secrets
│   ├── RateLookup.gs           # Web form + API + grid lookup engine
│   ├── CommissionApplication.gs# Batch commission processing + validateGrid()
│   ├── PayoutGeneration.gs     # Payout statements + partner invoices
│   ├── StatementProcessing.gs  # Insurer statement extraction (Claude API)
│   ├── Reconciliation.gs       # 5-sheet reconciliation report
│   ├── Logging.gs              # logCall(), logError(), logInfo(), logRunEvent()
│   ├── Normalisation.gs        # Pure functions + 46 unit tests
│   ├── SheetUtils.gs           # getSheetData(), appendRow() with LockService
│   ├── DriveUtils.gs           # findFileInFolder(), exportSheetAsPDF()
│   ├── MonitoringSync.gs       # syncToMonitoring() → CommandCentre
│   ├── Code.gs                 # wrapWithErrorHandling(), setupTriggers()
│   ├── setup.gs                # runSetup(), createAllGridTemplates(), RTO import
│   └── index.html              # Rate lookup web form
├── central/                    # CommandCentre (separate clasp project)
│   ├── .clasp.json             # gitignored — deployment specific
│   ├── appsscript.json
│   ├── CentralReceiver.gs      # doGet() dashboard + doPost() signal receiver
│   ├── HealthLogic.gs          # Broker health scoring
│   ├── AlertEngine.gs          # Amber digest + Red alerts
│   ├── Dashboard.gs            # getDashboardData()
│   ├── setup_central.gs        # setupCommandCentre(), setupAlertTriggers()
│   └── dashboard.html          # Dark-theme ops dashboard
├── masters/
│   └── rto_master.csv.xlsx     # RTO reference data (import via importRTOMasterFromDrive)
├── PICKUP_NOTES.md             # Detailed task checklist
├── CALIBER_PO_REFERENCE.md     # This file
└── setup_deployment.md         # Client deployment checklist + 10 test cases
```

---

## Drive Folder Structure (created by runSetup())

```
CaliberPO/                      # FOLDER_ROOT
├── Grids/                      # FOLDER_GRIDS — insurer commission grids
├── Input/                      # FOLDER_INPUT — uploaded statements, RTO CSV
├── Output/                     # FOLDER_OUTPUT — commission batch outputs
├── Statements/                 # FOLDER_STATEMENTS — insurer statement files
├── Invoices/
│   ├── Partner/                # FOLDER_INVOICES_PARTNER
│   └── Insurer/                # FOLDER_INVOICES_INSURER
├── Reconciliation/             # FOLDER_RECONCILIATION
├── Masters/                    # FOLDER_MASTERS — Product/RTO/Insurer/Partner masters
├── Log/                        # FOLDER_LOG
└── Backup/                     # FOLDER_BACKUP
```

**Master sheets (all created by runSetup()):**
- `Product Master` — Motor + Misc D tabs, one row per sub-sub-type (50 rows)
- `RTO Master` — RTO tab, imported via `importRTOMasterFromDrive(fileId)`
- `Insurer Master` — Insurers tab (8 insurers) + Insurer_Code_Map tab
- `Broker Config Sheet` — Config, Field_Mapping, Grid_Config, Invoice_Config, Normalization, Prompts tabs
- `Partner Master` — Partners tab
- `Reconciliation` — Index tab (insurer tabs added at runtime)
- `CaliberPO Log` — Log_Active, Log_Summary, Log_Dashboard, processed_policies tabs

---

## Commission Grid Structure

**One Google Sheet per insurer** named `[insurer_name] Grid` in FOLDER_GRIDS.

**Tabs per product × financial year:**
| Product Type | Tab Name | Notes |
|---|---|---|
| TW | `TW_26-27` | Two-Wheeler |
| Pvt Car | `PC_26-27` | Private Car |
| GCV | `GCV_26-27` | Goods Carrying Vehicle |
| PCV | `PCV_26-27` | Passenger Carrying Vehicle |
| Tractor / Construction Eqpt | `MiscD_26-27` | Shared tab |

**FY naming:** April–March. `26-27` = FY 2026-27. Derived by `getGridTabName(productType, period)` in Normalisation.gs.

**64 columns** — key ones:
| Col | Header | Purpose |
|-----|--------|---------|
| A (0) | insurance_company | Insurer ID |
| D (3) | product_type | TW / Pvt Car / GCV / PCV / Tractor |
| E (4) | product_sub_type | 1+1 / SAOD / SATP / New (1+5) etc. |
| F (5) | product_sub_sub_type | Scooter / Bike / 3W / Tanker etc. |
| H (7) | effective_from_date | Rate validity start (YYYY-MM-DD) |
| I (8) | effective_to_date | Rate validity end (YYYY-MM-DD) |
| L (11) | fuel_type | Petrol / Diesel / EV / blank = all |
| O (14) | vehicle_cc_lower_limit | CC range start (TW) |
| P (15) | vehicle_cc_upper_limit | CC range end |
| T (19) | seating_capacity_lower/upper | For PCV |
| U–V (20–21) | gvw_lower/upper_limit | For GCV, in tonnes |
| Z (25) | rto_list | RTO codes comma-separated or "All" |
| AC (28) | is_no_claim_bonus_considered | Y / blank |
| AH (33) | is_zero_dip_considered | Y / blank |
| AJ (35) | custom_condition_notes | Free text |
| AK (36) | pi_rate | PI commission % |
| AL (37) | pi_rate_on | OD / TP / NET / FLAT / TP1Y |
| AM (38) | pi_rate1 | Second PI rate (dual rate) |
| AN (39) | pi_rate1_on | Base for second PI rate |
| AQ (42) | po_rate | PO commission % |
| AR (43) | po_rate_on | Rate base for PO |
| AS (44) | po_rate_1 | Second PO rate (dual rate — TP) |
| AT–BL | slab_1/2/3_* | Premium slab tiers |

**Grid lookup flow in lookupRate():**
1. Find sheet: `findInsurerGridSheet(insurerId)` → searches FOLDER_GRIDS by `[insurer_name] Grid`
2. Get tab: `getGridTabName(productType, period)` → e.g. `TW_26-27`
3. Filter by effective date → sub type → sub-sub-type → RTO (EXACT then PAN India) → vehicle params → select best tier
4. Return: `{ poRate, piOn, poRate2, piOn2, matchType, matchStatus, ... }`

**Result display (form):**
- Single rate: PO Rate % + PO Rate On
- Dual rate (when `poRate2` non-null): PO Rate (OD) + PO Rate On + PO Rate (TP) + PO Rate On
- Match type badge: EXACT RTO / PAN INDIA
- PI Rate is NOT shown in the form (internal only)

---

## Insurers (APS)

| ID | Name (in Insurer Master + Grid sheet name) |
|----|---------------------------------------------|
| OR | THE ORIENTAL INSURANCE CO LTD |
| NIC | NATIONAL INSURANCE CO LTD |
| UIIC | UNITED INDIA INSURANCE CO LTD |
| USGI | UNIVERSAL SOMPO GENERAL INSURANCE CO LTD |
| TATA | TATA AIG GENERAL INSURANCE CO LTD |
| BAJAJ | BAJAJ ALLIANZ GENERAL INSURANCE CO LTD |
| GO | GO DIGIT GENERAL INSURANCE LTD |
| INDUSIND | INDUSIND GENERAL INSURANCE CO LTD |

---

## Product Master (50 rows, one per sub-sub-type)

| Product Type | Sub Types | Sub Sub Types |
|---|---|---|
| TW | New(1+5), New(5+5), 1+1, SAOD, SATP | Scooter, Bike |
| Pvt Car | New(1+3), New(3+3), 1+1, SAOD, SATP | — |
| GCV | 1+1, SATP | 3W, Tanker, Water Tanker, Car Carrier, Flatbed, Oil Tanker |
| PCV | 1+1, SATP | 3W, Taxi 4+1, Taxi 5+1, Taxi>7, Bus<12, Bus>12<36, Bus>36, School Bus, Staff Bus |
| Tractor | 1+1, SATP | Excavator, Harvester, Agri Tractor |
| Construction Eqpt | 1+1, SATP | — |

---

## What Is Complete ✓

- [x] Full codebase — all 15 .gs files written and pushed
- [x] Rate lookup web form — cascade dropdowns (product type → sub type → sub-sub-type)
- [x] Rate lookup engine — FY-based grid tabs, RTO matching, vehicle param filters, dual rate
- [x] Commission Application — batch processing, validateGrid(), duplicate detection
- [x] Payout Generation — partner payout statements, PDF invoices
- [x] Statement Processing — Claude API extraction, Excel + PDF support
- [x] Reconciliation — 5-sheet report
- [x] Logging — Log_Active with fuel_type + yom columns
- [x] Run-level monitoring — wrapWithErrorHandling(), logRunEvent()
- [x] CommandCentre — deployed at novoup workspace, live dashboard, Amber digest trigger, 15-min health signals
- [x] Broker sheet setup — 13 Drive folders + all master sheets (runSetup() executed)
- [x] Product Master — 50 rows seeded
- [x] Insurer Master — 8 insurers seeded
- [x] Grid infrastructure — 8 insurer sheets × 5 tabs each (40 tabs), all validated
- [x] Normalisation unit tests — 46/46 passing
- [x] MonitoringSync — setupMonitoringTrigger() wired, MONITORING_ENDPOINT + MONITORING_KEY set
- [x] Rate lookup form result — PO Rate only (PI Rate removed from UI), dual rate display
- [x] Grid tab naming — FY-based (TW_26-27), short prefixes (PC, MiscD)

---

## What Is Pending ✗

### Immediate (novoup / testing)
- [ ] Rate data entry — populate grid rows for at least OR/TW to run full test suite
- [ ] RTO Master import — upload `rto_master.csv` to Input folder, run `importRTOMasterFromDrive(fileId)`
- [ ] Run 10 test cases from `setup_deployment.md`
- [ ] Git: change GitHub default branch from `master` to `main`

### APS Deployment
- [ ] Collect config values from APS (GSTIN, PAN, bank details, emails, GVW_UNIT — see PICKUP_NOTES.md Section B)
- [ ] Create `aps-production` git branch from `main`
- [ ] Create APS Apps Script project → update `.clasp.json` → push
- [ ] Fill Config.gs with APS values → run runSetup() → writeConfigIds()
- [ ] Upload 8 insurer grid sheets with real rates to APS Grids folder
- [ ] Run validateAllGrids() on APS grids
- [ ] Add extraction prompts to Broker Config Sheet → Prompts tab (one per insurer)
- [ ] Set CLAUDE_API_KEY in APS Script Properties
- [ ] Add test partners to Partner Master
- [ ] Deploy Web App for APS
- [ ] Run setupTriggers()
- [ ] Run all 10 tests → go-live

### Deferred
- [ ] Iframe height optimisation for the rate lookup form (Get Rate button may be cut off)
- [ ] APS go-live date confirmation

---

## Security Rules (never break these)

- `CLAUDE_API_KEY` — Script Properties only. Never in any .gs file.
- `MONITORING_ENDPOINT` + `MONITORING_KEY` — Script Properties only in both broker and central projects.
- `CLMS_SHEET_ID` — Script Properties only in novoup CommandCentre project.
- No secrets in `Config.gs`, no secrets in git.

---

## Key Functions Reference

| Function | File | Purpose |
|---|---|---|
| `runSetup()` | setup.gs | Creates all folders + sheets. Safe to re-run. |
| `writeConfigIds(json)` | setup.gs | Pastes folder/sheet IDs into log after runSetup() |
| `createAllGridTemplates()` | setup.gs | Creates 8×5 grid sheets in FOLDER_GRIDS |
| `validateAllGrids()` | setup.gs | Validates all 40 grid tabs |
| `createGridTemplate(id, pt)` | setup.gs | Single insurer × product grid |
| `importRTOMasterFromDrive(fileId)` | setup.gs | Imports RTO CSV from Drive |
| `lookupRate(params)` | RateLookup.gs | Core rate engine |
| `validateGrid(sheetId, tab)` | CommissionApplication.gs | Validates one grid tab |
| `runNormalisationTests()` | Normalisation.gs | 46 unit tests |
| `setupTriggers()` | Code.gs | Wires all time-based triggers |
| `setupMonitoringTrigger()` | MonitoringSync.gs | 15-min health signal to CommandCentre |
| `setupCommandCentre()` | central/setup_central.gs | One-time CommandCentre setup |
| `setupAlertTriggers()` | central/setup_central.gs | Daily Amber digest + 15-min receive trigger |

---

## Deployment Notes

- **clasp push can fail silently** — if a change isn't reflected in the editor, paste the .gs file manually.
- After `clasp push`, always create a **new deployment version** (not re-deploy same version) for `/exec` URL to pick up changes.
- CommandCentre is deployed as a separate Apps Script Web App in the novoup account.
- `central/.clasp.json` is gitignored — contains deployment-specific Script ID.
- Apps Script timezone must be set to `Asia/Kolkata` in Project Settings.
