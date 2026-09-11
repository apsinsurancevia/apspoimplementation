# CaliberPO — Pickup Notes
_Last updated: 2026-08-20_

Everything needed to finish, test, and deploy. Work top to bottom.

---

## SECTION A — Code Gaps (fix before testing)

### A1. productSubSubType not wired into rate engine
**Gap:** The form collects `productSubSubType` and `getFormConfig()` returns it,
but `lookupRate()` never passes it to any filter function.
If grids ever differentiate by sub-sub-type (e.g., "3W" vs "Taxi 4+1" in PCV),
lookups will over-match.

**Fix needed in RateLookup.gs:**
- Add `filterByProductSubSubType(rows, colIdx, productSubSubType)` — same pattern
  as `filterByProductSubType()`, matching against a `product_sub_sub_type` column
- Call it in `lookupRate()` after `filterByProductSubType()`, before the RTO passes
- Also wire in `CommissionApplication.gs` processRow() if sub-sub-type is derived there

**Verify first:** Check whether any active grid tabs have a `product_sub_sub_type`
column populated. If no grid uses it yet, document and defer — don't build dead code.

---

### A2. External API mode check inconsistency
**Gap:** `doGet()` routes to `handleAPIRequest()` when `e.parameter.api === 'true'`
(i.e., URL param `?api=true`). But the deployment checklist Test 2 suggests
`?mode=api`. These don't match — external callers using `?mode=api` get the HTML
form back, not JSON.

**Fix needed in RateLookup.gs doGet():**
```javascript
if (e && e.parameter &&
    (e.parameter.api === 'true' || e.parameter.mode === 'api')) {
  return handleAPIRequest(e);
}
```

---

### A3. logCall() doesn't capture new params
**Gap:** `logCall()` in Logging.gs logs only `insurerId`, `productType`, `rto`,
`matchType`, `matchStatus`, `responseMs`, `notes`. New fields (`fuelType`,
`nilDep`, `ncb`, `yom`, `vehicleAge`) are not captured in Log_Active.

**Fix options (pick one):**
- Extend the Log_Active sheet headers + logCall() to include these columns
- OR leave log slim — just add `notes` field to carry derived values as a string

**Recommended:** Add `fuelType` and `yom` to the log. These are the most useful
for debugging NO_MATCH cases. `nilDep` and `ncb` can stay out (low diagnostic value).

---

### A4. vehicleAge not used in grid filtering
**Status:** By design — `vehicleAge` (New/Old) is returned in the result for
display and for CommissionApplication.gs to write into the output. Grid filtering
uses `productSubType` (e.g., "1+1", "New (1+5)") instead.
**Action:** Confirm with APS that grids don't have a separate New/Old filter column.
If they do, add it to `filterByVehicleParams()`.

---

## SECTION B — Configuration to collect from APS

All of these must be in hand before filling Config.gs:

| Field | Status |
|-------|--------|
| BROKER_NAME | ☐ |
| BROKER_LEGAL_NAME | ☐ |
| BROKER_GSTIN (15 chars) | ☐ |
| BROKER_PAN (10 chars) | ☐ |
| BROKER_STATE | ☐ |
| BROKER_STATE_CODE (2-digit GST) | ☐ |
| BROKER_ADDRESS (full, for invoices) | ☐ |
| BROKER_BANK_NAME | ☐ |
| BROKER_BANK_ACCOUNT | ☐ |
| BROKER_BANK_IFSC | ☐ |
| BROKER_BANK_BRANCH | ☐ |
| IRDAI_REG_NUMBER | ☐ |
| EMAIL_COORDINATOR | ☐ |
| EMAIL_SENDER | ☐ |
| EMAIL_FINANCE | ☐ |
| EMAIL_RECON | ☐ |
| WORKSPACE_DOMAIN | ☐ |
| GVW_UNIT (tonnes or kg — from Caliber CRM export) | ☐ |
| Anthropic API key (CLAUDE_API_KEY) | ☐ |

**Already confirmed for APS:**
- BROKER_SHORT_CODE: `APS`
- PARTNER_INVOICE_PREFIX: `APS-PINV`
- INSURER_INVOICE_PREFIX: `APS-IINV`
- Active insurers: OR, NIC, UIIC, USGI, TATA, INDUSIND, GO, BAJAJ
- Source system: Caliber CRM

---

## SECTION C — Insurer grid files needed

One Google Sheet per insurer, named `[InsurerName] Grid`, placed in the
`CaliberPO/Grids/` Drive folder. Each needs at minimum one product tab
named `[ProductType]_YYYY-MM` (e.g., `TW_2026-08`).

| Insurer | Grid sheet exists? | First tab ready? | Validated? |
|---------|-------------------|-----------------|-----------|
| OR | ☐ | ☐ | ☐ |
| NIC | ☐ | ☐ | ☐ |
| UIIC | ☐ | ☐ | ☐ |
| USGI | ☐ | ☐ | ☐ |
| TATA | ☐ | ☐ | ☐ |
| INDUSIND | ☐ | ☐ | ☐ |
| GO | ☐ | ☐ | ☐ |
| BAJAJ | ☐ | ☐ | ☐ |

Run `validateGrid(sheetId, tabName)` for each tab. Fix all errors before testing.

---

## SECTION D — Extraction prompts needed

In the Broker Config Sheet → Prompts tab, add one row per insurer.
The prompt template must instruct Claude to return a JSON array where
each object includes at least: `policy_no`, `brokerage_amount`.

Prompts needed for: OR, NIC, UIIC, USGI, TATA, INDUSIND, GO, BAJAJ

- Have sample statement files from APS to write prompts against? ☐
- All 8 prompts written and in the Prompts tab? ☐

---

## SECTION E — Setup steps (follow setup_deployment.md)

In order:

- [ ] Fix code gaps A1, A2, A3 above → `clasp push --force` → commit
- [ ] Collect all Section B values from APS
- [ ] Create `aps-production` branch: `git checkout main && git checkout -b aps-production`
- [ ] Fill src/Config.gs with APS values → push → commit
- [ ] Create Apps Script project for APS → update `.clasp.json` → `clasp push --force`
- [ ] Run `runSetup()` in editor → copy JSON from log
- [ ] Run `writeConfigIds(json)` → paste FOLDER_* and SHEET_* back into Config.gs → push
- [ ] Upload `rto_master.csv` to Input folder → run `importRTOMasterFromDrive(fileId)`
- [ ] Upload all 8 insurer grid sheets to Grids folder
- [ ] Run `validateGrid()` for every grid tab — fix all errors
- [ ] Add extraction prompts to Prompts tab for all 8 insurers
- [ ] Add CLAUDE_API_KEY to Script Properties (Project Settings → Script Properties)
- [ ] Run `testClaudeAPIConnection()` — confirm success in log
- [ ] Add 3 test partners to Partner Master (A: no PAN, B: PAN only, C: PAN + GSTIN)
- [ ] Deploy Web App (Manage Deployments → New Deployment → Web App → Execute as Me)
- [ ] Run `setupTriggers()` once — sets up archiveLog (1st of month) + sendNoMatchReport (Monday)

---

## SECTION F — Tests (setup_deployment.md Tests 1-10)

- [ ] Test 1 — Web App form loads, dropdowns work, Get Rate returns badge
- [ ] Test 2 — Rate Lookup API returns valid JSON (`?api=true` in URL)
- [ ] Test 3 — Commission batch creates output, 130 cols, styling correct
- [ ] Test 4 — DY status values: MISSING_PARTNER, NO_MATCH, MATCHED all appear
- [ ] Test 5 — Period lock fires on second batch run for same period
- [ ] Test 6 — Payout: statement for all, invoice PDF for Partner C only, CGST/IGST correct
- [ ] Test 7 — Email dispatch delivers, UTR upload sets payment_date
- [ ] Test 8 — Insurer statement processing: Claude extracts, invoice PDF created, email sent
- [ ] Test 9 — Reconciliation: 5-sheet report, correct match_type, email delivered
- [ ] Test 10 — Error alerting: bad FOLDER_OUTPUT triggers email to coordinator

---

## SECTION G — Git / Infrastructure

- [ ] **GitHub default branch** — still `master` on remote. Change to `main` in
  GitHub → Settings → Branches → Default branch
- [ ] `aps-production` branch should be cut from `main` (clean codebase),
  NOT from `novoup-staging` (which has dev history)
- [ ] `novoup-staging` branch — verify all fixes are cherry-picked to `main`
  before cutting `aps-production`:
  `git checkout main && git log novoup-staging --not main --oneline`
- [ ] After all tests pass, push: `git push origin aps-production`

---

## SECTION H — Go-live checklist

- [ ] All 10 tests passed on APS Apps Script project
- [ ] `CONFIG.CURRENT_PERIOD` set to current month (`2026-08`)
- [ ] `clasp push --force` with live Config.gs
- [ ] Commit: `git commit -m "Config: aps go-live — period set to 2026-08"`
- [ ] Web App URL shared with APS coordinator
- [ ] Coordinator briefed on monthly workflow (see setup_deployment.md)
- [ ] Confirm first live commission run date with APS

---

## SECTION I — Form UX (deferred, do before go-live)

- [ ] Iframe height optimisation — the "Get Rate" button can be cut off below
  the viewport in the Apps Script iframe. Test at actual deployed URL and
  adjust `min-height` or add scrolling if needed. (Deferred per user on 2026-08-19)

---

## Quick reference — files changed this session

| File | What changed |
|------|-------------|
| src/RateLookup.gs | getFormConfig(), deriveVehicleAge(), extended filterByVehicleParams(), buildColumnIndex() new cols, API params extended, vehicleAge in result |
| src/index.html | Full replacement — data-driven show/hide, single config load, new vehicle fields |
| src/Reconciliation.gs | New file — Step V complete |
| src/CommissionApplication.gs | validateGrid() consolidated here (removed from setup.gs) |
| src/StatementProcessing.gs | Excel extraction fixed (SpreadsheetApp.openById) |
| setup_deployment.md | New file — full deployment checklist |
| README.md | Deployment + Monthly Workflow + Troubleshooting sections added |
