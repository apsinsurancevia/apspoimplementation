# CaliberPO — Client Deployment Checklist

Complete setup and go-live guide for a new broker deployment.
Each broker is a separate Git branch. Only `Config.gs` changes between deployments.

---

## STEP 1 — Prerequisites

Confirm all of the following before starting:

- [ ] Google Workspace account for the broker domain (e.g. `novoup.com`)
- [ ] Google account with Drive access for the Apps Script project
- [ ] Node.js ≥ 18 installed (required by clasp)
- [ ] clasp installed globally: `npm install -g @google/clasp`
- [ ] Git installed and repo cloned: `git clone [repo-url] caliber-po`
- [ ] Broker identity information collected (see STEP 5)
- [ ] CLAUDE_API_KEY obtained from Anthropic console

---

## STEP 2 — Create Client Branch

```bash
git checkout main
git pull origin main
git checkout -b [clientcode]-production
# e.g. git checkout -b aps-production
```

---

## STEP 3 — Create Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **New project**
3. Name it `CaliberPO — [BrokerName]`
4. Copy the **Script ID** from Project Settings → IDs

---

## STEP 4 — Configure clasp

In the repo root:

```bash
clasp login
```

Update `.clasp.json` with the new Script ID:

```json
{
  "scriptId": "[PASTE_SCRIPT_ID_HERE]",
  "rootDir": "./src"
}
```

Push all source files:

```bash
clasp push --force
```

Confirm all 14 files pushed (check clasp output).

---

## STEP 5 — Fill Config.gs — Broker Identity

Open `src/Config.gs`. Fill every field in the **BROKER IDENTITY** section:

| Field | Source |
|-------|--------|
| `BROKER_NAME` | Trading name from registration |
| `BROKER_LEGAL_NAME` | Legal entity name for invoices |
| `BROKER_SHORT_CODE` | 2-4 letters — used in file names |
| `BROKER_GSTIN` | 15-character GSTIN |
| `BROKER_PAN` | 10-character PAN |
| `BROKER_STATE` | State name e.g. `MAHARASHTRA` |
| `BROKER_STATE_CODE` | 2-digit GST state code e.g. `27` |
| `BROKER_ADDRESS` | Full registered address |
| `BROKER_BANK_NAME` | Bank name |
| `BROKER_BANK_ACCOUNT` | Account number |
| `BROKER_BANK_IFSC` | IFSC code |
| `BROKER_BANK_BRANCH` | Branch name |
| `IRDAI_REG_NUMBER` | IRDAI broker registration number |
| `PARTNER_INVOICE_PREFIX` | e.g. `APS-PINV` |
| `INSURER_INVOICE_PREFIX` | e.g. `APS-IINV` |
| `GVW_UNIT` | `tonnes` or `kg` — confirm from source system |

Fill **EMAIL ROUTING** section:

| Field | Value |
|-------|-------|
| `WORKSPACE_DOMAIN` | e.g. `novoup.com` |
| `EMAIL_COORDINATOR` | All errors and alerts |
| `EMAIL_SENDER` | From address for outbound emails |
| `EMAIL_FINANCE` | Insurer invoices |
| `EMAIL_RECON` | Reconciliation reports |

Leave `CLAUDE_MODEL` as `claude-sonnet-4-6`.
Leave `CURRENT_PERIOD` blank — set at start of each month.
Leave all `FOLDER_*` and `SHEET_*` blank — populated in STEP 7.

Push Config.gs:

```bash
clasp push --force
```

---

## STEP 6 — Run setup.gs

In the Apps Script editor:

1. Open `setup.gs`
2. Select function `runSetup`
3. Click **Run**
4. Accept all permission prompts
5. Open **Execution log**
6. Copy the JSON block that begins `{` and ends `}`

This creates:
- Drive folder structure (12 folders under the script's parent folder)
- All required Google Sheets (Product Master, RTO Master, Insurer Master,
  Broker Config, Partner Master, Log Sheet, Reconciliation Sheet)

---

## STEP 7 — Populate Config.gs with IDs

In the Apps Script editor:

1. Select function `writeConfigIds`
2. In the function body, replace the argument with the JSON copied in STEP 6
3. Click **Run**
4. Copy the `FOLDER_*` and `SHEET_*` values from the execution log
5. Paste them into `src/Config.gs` replacing the empty strings

Push updated Config.gs:

```bash
clasp push --force
git add src/Config.gs
git commit -m "Config: [clientcode] — folder and sheet IDs populated"
```

---

## STEP 8 — Seed RTO Master

1. Obtain `rto_master.csv` (standard file from build team)
2. Upload to `CaliberPO/Input/` folder in Drive
3. Copy the file ID from the Drive URL
4. In Apps Script editor, run:

```javascript
importRTOMasterFromDrive('PASTE_FILE_ID_HERE')
```

Confirm: execution log shows `RTO Master imported: [N] rows`.

---

## STEP 9 — Upload Insurer Rate Grids

For each active insurer:

1. Open the insurer's Grid Sheet (created in STEP 6, named `[InsurerName] Grid`)
   — or create it: `SpreadsheetApp.create('[InsurerName] Grid')` and move to
   `CaliberPO/Grids/` folder, then note the ID.
2. Add a tab named `[ProductType]_YYYY-MM` e.g. `TW_2026-08`
3. Paste the rate grid — minimum 64 columns, row 1 = headers
4. Validate the tab in Apps Script editor:

```javascript
validateGrid('[spreadsheetId]', 'TW_2026-08')
```

5. Fix any errors reported. Re-run until no errors.

Required grid columns (first 8):
`insurer_id`, `product_type`, `product_sub_type`, `rto_list`,
`effective_from`, `effective_to`, `pi_rate`, `pi_rate_on`

---

## STEP 10 — Add Extraction Prompts

For each insurer that will send statements:

1. Open the Broker Config Sheet → `Prompts` tab
2. Add a row: `insurer_id` | `prompt_template` | `notes`

The prompt template should instruct Claude to return a JSON array where each
object has at minimum: `policy_no`, `brokerage_amount`. Include any
insurer-specific field names observed from sample statements.

Test the Claude API connection:

```javascript
testClaudeAPIConnection()
```

Confirm: returns success in execution log.

---

## STEP 11 — Add Partners to Partner Master

1. Open Partner Master Sheet → `Partners` tab
2. Add at least 3 test partners (used in Test 6):
   - Partner A: no PAN (`pan_number` blank)
   - Partner B: PAN filled, `gstin` blank
   - Partner C: PAN filled, `gstin` filled, `partner_state_code` set
3. Confirm `active` = `Y` for all test partners

---

## STEP 12 — Set CLAUDE_API_KEY in Script Properties

In Apps Script editor:

1. Click **Project Settings** (gear icon)
2. Scroll to **Script Properties**
3. Click **Add script property**
4. Key: `CLAUDE_API_KEY`
5. Value: Anthropic API key (starts with `sk-ant-`)
6. Click **Save**

**CRITICAL: The key must never appear in any source file or commit.**

---

## STEP 13 — Pre-Go-Live Testing

Run all 10 tests in order. Do not proceed to STEP 14 until all pass.

---

### Test 1 — Web App (Rate Lookup Form)

1. In Apps Script editor → **Deploy** → **Manage Deployments**
2. Create a new deployment (type: Web App, Execute as: Me, Access: Anyone)
3. Copy the Web App URL
4. Open URL in browser

Pass criteria:
- [ ] Form loads with no browser console errors
- [ ] Insurer dropdown populated from Insurer Master
- [ ] Selecting insurer populates Product Type dropdown
- [ ] Selecting product type populates Product Sub Type dropdown
- [ ] CC/GVW/Seating fields show/hide correctly per product type
- [ ] "Get Rate" returns a result badge (EXACT / PAN INDIA / NO MATCH)
- [ ] Result panel shows rate %, premium base, and calculated amounts

---

### Test 2 — Rate Lookup API (JSON)

Open the Web App URL with query parameters:

```
[webAppUrl]?mode=api&insurerId=OR&productType=TW&productSubType=1%2B1
  &rto=MH-01&vehicleAge=new&effectiveDate=2026-08-01&netPremium=5000
```

Pass criteria:
- [ ] Returns valid JSON response
- [ ] `matchStatus` field present and equals `MATCHED` or `NO_MATCH`
- [ ] `matchType` field present
- [ ] Logged in Log_Active

---

### Test 3 — Commission Batch

1. Set `CONFIG.CURRENT_PERIOD = "2026-08"` in Config.gs and push
2. Upload a sample sales file (Google Sheet) to `CaliberPO/Input/`
3. Run `runCommissionBatch()` in Apps Script editor

Pass criteria:
- [ ] Output file created in `CaliberPO/Output/`
- [ ] File has 130 columns
- [ ] Row 1: section headers with navy/green styling
- [ ] Row 2: column headers with styling
- [ ] Spot-check 5 rows — commission amounts correct
- [ ] Exception summary email received at EMAIL_COORDINATOR

---

### Test 4 — DY Status Values

In test data ensure at least one row each of:
- [ ] Unknown Posp Id → status `MISSING_PARTNER`
- [ ] Valid Posp Id with no matching rate → status `NO_MATCH`
- [ ] Valid Posp Id with rate → status `MATCHED`

---

### Test 5 — Period Lock

Run `runCommissionBatch()` again for same period.

Pass criteria:
- [ ] Script halts immediately
- [ ] Period lock email received at EMAIL_COORDINATOR
- [ ] No second output file created in `CaliberPO/Output/`

---

### Test 6 — Payout Generation

1. Add 3 test partners to Partner Master:
   - Partner A: no PAN (verify TDS @ 20%)
   - Partner B: PAN + no GSTIN (verify TDS @ 5%, no invoice)
   - Partner C: PAN + GSTIN (verify TDS @ 5%, invoice generated)
2. Run `runPayoutGeneration()`

Pass criteria:
- [ ] Statement files created in `CaliberPO/Statements/[YYYY-MM]/`
- [ ] 42 columns in each statement
- [ ] Invoice PDF created for Partner C only
- [ ] CGST/IGST applied correctly based on state codes
- [ ] PARTNER_INVOICE_COUNTER incremented in Counters tab
- [ ] Payout summary email received at EMAIL_COORDINATOR

---

### Test 7 — Statement Dispatch + UTR

1. Run `runEmailDispatch()`
2. Verify emails arrive at test partner email addresses
3. Enter test UTR numbers in Partner Master for Partners A, B, C
4. Run `processUTRUpload()`

Pass criteria:
- [ ] Statement emails received with correct attachments
- [ ] Partner C email has both statement + invoice attached
- [ ] `statement_sent` column set to `Y` for dispatched partners
- [ ] `payment_date` set after UTR upload
- [ ] UTR confirmation email received at EMAIL_COORDINATOR

---

### Test 8 — Insurer Statement Processing

1. Upload a sample insurer statement for one active insurer to any Drive folder
2. Get the file ID
3. Verify extraction prompt exists in Prompts tab for that insurer
4. Run `processInsurerStatement("OR", "[fileId]")`

Pass criteria:
- [ ] Claude API extracts data (verify row count in execution log)
- [ ] Invoice PDF created in `CaliberPO/Invoices/Insurer/[YYYY-MM]/`
- [ ] Statement summary Excel created
- [ ] INSURER_INVOICE_COUNTER incremented
- [ ] Email received at EMAIL_FINANCE with both attachments

---

### Test 9 — Reconciliation

Run `runReconciliation("OR", "2026-08")`

Pass criteria:
- [ ] OR tab created in Reconciliation Sheet
- [ ] Matched rows show `EXACT` or `FUZZY_MATCH` in match_type
- [ ] Variance rows show correct variance amount
- [ ] Unknown rows appended for unmatched statement rows
- [ ] 5-sheet report created in `CaliberPO/Reconciliation/OR/`
- [ ] Email received at EMAIL_RECON with report attached
- [ ] Outstanding by Age sheet excludes rows below variance threshold

---

### Test 10 — Error Alerting

1. Temporarily set `CONFIG.FOLDER_OUTPUT = "INVALID_ID"` in Config.gs
2. Push and run `runCommissionBatch()`
3. Restore correct folder ID immediately after

Pass criteria:
- [ ] Error email received at EMAIL_COORDINATOR within 5 minutes
- [ ] Email contains function name and error message
- [ ] Error logged in Log_Active tab

---

## STEP 14 — Go Live

All 10 tests passed? Proceed:

1. Set `CONFIG.CURRENT_PERIOD` to current month `YYYY-MM`
2. Push final Config.gs
3. Share Web App URL with client coordinator
4. Brief coordinator on monthly workflow (see below)
5. Confirm first live run date

```bash
git add src/Config.gs
git commit -m "Config: [clientcode] go-live — period set to [YYYY-MM]"
git push origin [clientcode]-production
```

Confirm:
- [ ] All 10 tests passed
- [ ] CURRENT_PERIOD set to live month
- [ ] Web App URL shared with coordinator
- [ ] Coordinator briefed on monthly workflow

---

## MONTHLY WORKFLOW REFERENCE (for coordinator)

Give this to the client coordinator. Repeat every month.

### Start of Month
1. Update `CURRENT_PERIOD` in Config.gs to new month (`YYYY-MM`)
2. Upload new commission grid tabs to insurer Grid Sheets
   (`TW_YYYY-MM`, `Pvt Car_YYYY-MM` etc.)
3. Run `validateGrid()` for each new tab — fix any errors

### Commission Run
4. Export sales data from source system (Caliber CRM etc.)
5. Upload as Google Sheet to `CaliberPO/Input/`
6. Run `runCommissionBatch()` from Apps Script editor
7. Review exception summary email
8. For MISSING_PARTNER exceptions: add partners to Partner Master,
   then run `runByStatus("MISSING_PARTNER")`
9. For NORMALISATION_FAILED: update Config Sheet mappings,
   then run `runByStatus("NORMALISATION_FAILED")`
10. Repeat until exceptions are resolved or accepted

### Payout
11. Run `runPayoutGeneration()`
12. Review statements in `CaliberPO/Statements/[YYYY-MM]/`
13. Run `runEmailDispatch()` to send statements to partners
14. After payment is made: enter UTR numbers in Partner Master
15. Run `processUTRUpload()` to confirm payments

### Insurer Reconciliation (per insurer)
16. Receive insurer statement file
17. Upload to Drive, get file ID
18. Run `processInsurerStatement("[insurerId]", "[fileId]")`
19. Finance team receives invoice — forward to insurer
20. Run `runReconciliation("[insurerId]", "[YYYY-MM]")`
21. Review reconciliation report
22. Update `resolution_status` in Reconciliation Sheet for variances
23. Follow up with insurer on outstanding variances

---

## MAINTENANCE REFERENCE

| Task | Frequency | Who | How |
|------|-----------|-----|-----|
| Upload grid tabs | Monthly | Coordinator | Drive → insurer Grid Sheet → new tab |
| Validate grid tabs | Monthly | Coordinator | `validateGrid(sheetId, tabName)` |
| Update Partner Master | As needed | Coordinator | Open sheet, edit directly |
| Add new insurer label | As needed | Coordinator | Insurer_Code_Map tab in Config Sheet |
| Add new product mapping | As needed | Coordinator | Product_Map tab in Config Sheet |
| Add new RTO code | As needed | Coordinator | RTO Master sheet → add row |
| Update extraction prompt | As needed | Coordinator | Prompts tab in Config Sheet |
| Archive recon rows | Annually | Coordinator | `archiveMatchedRows("[insurerId]")` |
| Rotate API key | Annually | Admin | Script Properties → update CLAUDE_API_KEY |
| Merge fixes to main | As needed | Build team | `git checkout main && git merge [fix-branch]` |
| Deploy fix to client | As needed | Build team | Cherry-pick to client branch, `clasp push` |

---

## TROUBLESHOOTING QUICK REFERENCE

| Symptom | Check | Fix |
|---------|-------|-----|
| Form shows no insurers | Insurer Master → active = Y | Set active = Y for insurers |
| Rate lookup returns NO_MATCH | Grid tab name, effective dates, rto_list | Check tab naming, date ranges |
| MISSING_PARTNER in batch | Partner Master → posp_id | Add partner to Partner Master |
| NORMALISATION_FAILED | Config Sheet → Insurer_Code_Map or Product_Map | Add mapping row |
| Claude API error | Script Properties → CLAUDE_API_KEY | Verify key, check quota |
| Email not received | EMAIL_* in Config.gs, Gmail daily limit | Verify addresses, check batch size |
| Invoice wrong tax type | BROKER_STATE_CODE vs partner/insurer state code | Verify state codes in masters |
| Period lock firing | Output folder has file for period | Delete output file to re-run |

---

## APS-SPECIFIC DEPLOYMENT VALUES

When deploying for APS use these confirmed values:

| Variable | Value |
|----------|-------|
| BROKER_SHORT_CODE | APS |
| PARTNER_INVOICE_PREFIX | APS-PINV |
| INSURER_INVOICE_PREFIX | APS-IINV |
| GVW_UNIT | [confirm from Caliber CRM export] |
| Active insurers | OR, NIC, UIIC, USGI, TATA, INDUSIND, GO, BAJAJ |
| Source system | Caliber CRM |

All other values (GSTIN, PAN, address, emails, bank details)
to be collected from APS before deployment.

---

## GIT REFERENCE

```bash
# Check which branch you are on
git branch

# See what changed in Config.gs vs main
git diff main src/Config.gs

# Push latest changes to remote
git push origin [clientcode]-production

# If main has been updated with bug fixes, bring them in
git fetch origin
git cherry-pick [commit-hash]

# Check commit history
git log --oneline -10
```
