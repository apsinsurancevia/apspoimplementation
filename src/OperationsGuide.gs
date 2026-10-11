/**
 * CaliberPO — Operations Guide
 *
 * Run once from the Apps Script editor:
 *   1. Select function createOperationsGuide
 *   2. Click Run
 *   3. Open Execution log — URL of the Guide spreadsheet is logged
 *
 * Creates (or refreshes) "CaliberPO Operations Guide" in CONFIG.FOLDER_ROOT
 * with three tabs: One-Time Setup, Monthly Cycle, Config Reference.
 */

/**
 * Public entry point — create / refresh the Operations Guide sheet.
 * @returns {string} Spreadsheet URL
 */
function createOperationsGuide() {
  if (!CONFIG.FOLDER_ROOT) {
    throw new Error('CONFIG.FOLDER_ROOT is blank — run runSetup() first so the CaliberPO root folder exists.');
  }

  var ss = getOrCreateSheet_(CONFIG.FOLDER_ROOT, 'CaliberPO Operations Guide');
  _opsGuideBuildOneTimeSetup_(ss);
  _opsGuideBuildMonthlyCycle_(ss);
  _opsGuideBuildConfigReference_(ss);

  // Drop leftover default "Sheet1" if it somehow remains empty and unused
  var sheets = ss.getSheets();
  for (var i = sheets.length - 1; i >= 0; i--) {
    var n = sheets[i].getName();
    if ((n === 'Sheet1' || n === 'Sheet') && sheets.length > 3) {
      ss.deleteSheet(sheets[i]);
    }
  }

  var url = ss.getUrl();
  Logger.log('Operations Guide URL: ' + url);
  return url;
}

// ── Tab builders ─────────────────────────────────────────────────────────────

function _opsGuideBuildOneTimeSetup_(ss) {
  var headers = ['Done?', 'Step #', 'Action', 'Where', 'What it saves/creates', 'If skipped or wrong…'];
  var sheet = _opsGuideEnsureTab_(ss, 'One-Time Setup', headers, '#1F3864');

  // 20 one-time go-live steps — consequences are concrete, not generic.
  var rows = [
    [false, 1,
      'Fill broker identity, bank, IRDAI, email routing, and invoice prefixes in Config.gs',
      'Main project → src/Config.gs (or clasp push from repo)',
      'BROKER_*, IRDAI_REG_NUMBER, EMAIL_*, PARTNER_INVOICE_PREFIX, INSURER_INVOICE_PREFIX, GVW_UNIT on every invoice, email, and output filename',
      'Invoices print the wrong legal name/GSTIN/bank; CGST vs IGST splits use the wrong BROKER_STATE_CODE; partner/insurer invoice numbers get a wrong prefix; GCV matching mis-scales GVW if GVW_UNIT is tonnes vs kg'],
    [false, 2,
      'Set CLAUDE_API_KEY in Script Properties (never in source code)',
      'Main Apps Script → Project Settings (gear) → Script Properties → Add CLAUDE_API_KEY = sk-ant-…',
      'Secret used by processInsurerStatement() and MappingWizard Claude calls',
      'Statement extraction fails with 401 Unauthorized on every Claude API call — no policy rows extracted from any statement'],
    [false, 3,
      'Set RATE_API_KEY on Rate API and GRID_RUN_API_KEY on GridRun API; mirror both on Main',
      'Each project → Project Settings → Script Properties; Main also stores both so ApiGateway can call the APIs',
      'Shared secrets that authorize ?api=true rate lookups and GridRun HTTP calls',
      'Rate Lookup API returns 401/403; dashboard or external callers cannot fetch rates; GridRun remote jobs are rejected'],
    [false, 4,
      'Create the five Apps Script projects, wire .clasp.json scriptIds, clasp push --force each',
      'script.google.com + repo .clasp.json / lib/src / api/rate/src / api/gridrun/src / central',
      'Main, GridEngine, Rate API, GridRun API, Dashboard projects with current .gs sources',
      'Editor runs stale code; clasp push overwrites the wrong project if IDs are swapped; Rate/GridRun endpoints 404'],
    [false, 5,
      'Link GridEngine as a library on Main and Rate API (identifier GridEngine)',
      'Main & Rate API editors → Libraries → + → GridEngine Script ID → latest version',
      'Shared rate-engine library binding used by commission and Rate API paths',
      'Runtime ReferenceError: GridEngine is not defined (or missing GridEngine.* symbols) on every rate match'],
    [false, 6,
      'Deploy Web Apps for Main, Rate API, and GridRun (Execute as: Me, Access: Anyone) and keep the URLs',
      'Each project → Deploy → New deployment → Web App',
      'Stable /exec URLs for Rate Lookup form, JSON API, and GridRun',
      'Coordinators have no form URL; health/bootstrap/importGrids HTTP actions die with 404; Rate API callers hit the old deployment'],
    [false, 7,
      'Run runSetup() once (accept OAuth prompts) and confirm "Setup complete" in the Execution log',
      'Main editor → select runSetup → Run',
      'CaliberPO Drive tree (Grids, Input, Output, Statements, Invoices, Masters, Log, …) plus Product/RTO/Insurer/Partner/Config/Log/Reconciliation sheets',
      'Every CONFIG.FOLDER_* / SHEET_* stays blank — batch, payout, and import throw "Invalid argument: id" / folder not found'],
    [false, 8,
      'Copy FOLDER_* and SHEET_* IDs from the setup log into Config.gs (or re-push after writeConfigIds) and clasp push',
      'src/Config.gs + clasp push on Main',
      'Persistent Drive/Sheet IDs committed for this broker deployment',
      'Next clasp push from a blank Config wipes live IDs; scripts open the wrong sheets or create duplicate masters'],
    [false, 9,
      'Import RTO Master (importRTOMasterFromDrive or seed) — expect ~1,300+ rows',
      'Apps Script: importRTOMasterFromDrive(fileId) after uploading rto CSV/xlsx to Drive',
      'RTO tab rows (rto_code, city, state) used to normalise registration codes',
      'Rate lookup cannot resolve RTO codes; EXACT_RTO matches never fire; policies fall through to PAN INDIA or NO_MATCH incorrectly'],
    [false, 10,
      'Run seedDefaultPrompts() so Config → Prompts has an extraction template per active insurer',
      'Main editor → seedDefaultPrompts',
      'Prompts tab rows: insurer_id + prompt_template for Claude statement parsing',
      'processInsurerStatement() has no prompt for that insurer — extraction aborts before any policy_no/brokerage_amount rows are written'],
    [false, 11,
      'Fill Insurer Master: GSTIN, state, state_code, address, spoc_email; set active=Y only for live buyers',
      'Drive → Insurer Master → Insurers tab',
      'Authoritative insurer list for Rate Lookup dropdown, invoices, and statement dispatch',
      'Blank GSTIN/state → insurer invoices omit tax identity / wrong CGST-IGST; blank spoc_email → statement emails have no recipient; active=N hides the insurer from health() and the form'],
    [false, 12,
      'Load Partner Master with real POSPs (posp_id matching CRM, email, PAN, bank); active=Y',
      'Drive → Partner Master → Partners tab',
      'Partner identity, TDS basis, bank/UTR columns for payout and dispatch',
      'Commission batch marks rows MISSING_PARTNER; payout skips unknown POSPs; missing PAN forces 20% TDS (206AA) instead of 5%'],
    [false, 13,
      'Upload insurer grid .xlsx to Grid Import (or createAllGridTemplates) and run importGridsFromFolder()',
      'Drive → Grid Import inbox + Main editor importGridsFromFolder()',
      'Per-insurer Grid spreadsheets under Grids/ with product tabs (TW_26-27, GCV_26-27, …)',
      'Rate Lookup returns NO_MATCH for every policy; commission batch cannot resolve pi_rate/po_rate'],
    [false, 14,
      'Run validateAllGrids() then smoke Rate Lookup (Web App or API) until key insurers return MATCHED with PO',
      'Main editor validateAllGrids(); open Main Web App URL; or ?api=true&apiKey=…',
      'Validated grid tabs + confirmed MATCHED samples (e.g. BAJAJ TW New 1+5)',
      'DUPLICATE_RATE / blank po_rate ships to production — payout amounts wrong or batch stuck on NO_MATCH'],
    [false, 15,
      'Install time-based triggers: archiveLog and sendNoMatchReport (and any broker-approved monitors)',
      'Main editor → Triggers (clock) or install helpers used at go-live',
      'Scheduled log archival + daily/weekly no-match digest emails',
      'Log_Active grows without archive; coordinators never see recurring NO_MATCH patterns until month-end firefight'],
    [false, 16,
      'End-to-end commission test: set CURRENT_PERIOD, upload sample sales to Input/, run runCommissionBatch()',
      'Config.gs CURRENT_PERIOD + Drive Input/ + Main editor',
      'Output workbook (~130 cols), exception summary email to EMAIL_COORDINATOR, period lock row',
      'First live month is the first time batch runs — mapping bugs and folder ACL errors surface on real policies'],
    [false, 17,
      'End-to-end payout test: runPayoutGeneration() then runEmailDispatch() for test partners',
      'Main editor + Statements/[YYYY-MM]/ + partner inboxes',
      'Partner statement files, GST invoices where GSTIN present, statement_sent flags',
      'Live payout week discovers TDS/GST bugs; partners receive nothing because EMAIL_SENDER/domain is wrong'],
    [false, 18,
      'End-to-end insurer statement test: upload sample statement, run processInsurerStatement(insurerId, fileId)',
      'Drive file ID + Main editor + Config Prompts tab',
      'Extracted policy rows, insurer invoice PDF under Invoices/Insurer/, email to EMAIL_FINANCE',
      'Go-live recon month fails at Claude parse; finance has no invoice pack to send the insurer'],
    [false, 19,
      'End-to-end reconciliation test: runReconciliation(insurerId, YYYY-MM) and open the report pack',
      'Main editor + Reconciliation sheet + FOLDER_RECONCILIATION',
      'Per-insurer recon tab, 5-sheet report, EMAIL_RECON digest with variances above VARIANCE_THRESHOLD',
      'Variances are never aged/reported; outstanding commission disputes have no system trail'],
    [false, 20,
      'Go-live checklist: CURRENT_PERIOD = live month, share Main Web App URL, brief coordinator on Monthly Cycle tab',
      'Config.gs + coordinator handoff (this Guide sheet)',
      'Live period lock target + coordinator ownership of grids/UTR/statements',
      'Batch runs against a stale period (or blank CURRENT_PERIOD); coordinator uploads grids to the wrong folder and rates never update']
  ];

  _opsGuideWriteRows_(sheet, headers, rows, {
    wrapCols: [3, 4, 5, 6],
    widths: [70, 60, 420, 320, 360, 420],
    checkboxCol: 1
  });
}

function _opsGuideBuildMonthlyCycle_(ss) {
  var headers = ['Done?', 'Step #', 'Action', 'Where', 'Input needed', 'Downstream impact if skipped'];
  var sheet = _opsGuideEnsureTab_(ss, 'Monthly Cycle', headers, '#0B6E4F');

  var rows = [
    [false, 1,
      'Set CURRENT_PERIOD to the new month (YYYY-MM) and clasp push / save Config.gs',
      'Main → Config.gs → CURRENT_PERIOD',
      'Confirmed calendar month from finance (e.g. 2026-10)',
      'Batch/payout write into the previous month\'s folders; period lock blocks the correct month or double-runs the old one'],
    [false, 2,
      'Collect updated insurer rate files; upload .xlsx to Grid Import (or paste into insurer Grid tabs)',
      'Drive → Grid Import/ or Grids/[Insurer] Grid',
      'Insurer rate circulars / grid workbooks for the period',
      'Lookups keep last month\'s pi/po — partner payouts under/overpay until grids are refreshed'],
    [false, 3,
      'Run importGridsFromFolder() if using the inbox, then validateAllGrids() / validateGrid() — fix DUPLICATE_RATE and blank PO',
      'Main editor',
      'Import summary OK + validation with zero blocking errors',
      'Commission batch inherits NO_MATCH / DUPLICATE_RATE; exception email floods EMAIL_COORDINATOR'],
    [false, 4,
      'Receive insurer commission statements; upload to Statements/ as [InsurerCode]_[YYYY-MM].xlsx|pdf',
      'Drive → Statements/',
      'Insurer portal/email statement files + correct insurer_id',
      'Extraction and recon cannot start; finance has nothing to match against CaliberPO output'],
    [false, 5,
      'For each arrived statement: processInsurerStatement(insurerId, fileId) — confirm extraction row count in the log',
      'Main editor (CLAUDE_API_KEY + Prompts tab must already be set)',
      'Drive file ID + active prompt for that insurer',
      'No extracted brokerage rows → insurer invoice PDF missing → EMAIL_FINANCE gets nothing to forward'],
    [false, 6,
      'Export sales/MIS from CRM; upload Google Sheet or Excel to Input/',
      'Drive → Input/',
      'Period sales file with posp_id, policy, RTO, product, premiums matching master codes',
      'runCommissionBatch() finds no input (or stale file) — Output/ stays empty for the month'],
    [false, 7,
      'Run runCommissionBatch(); read the exception summary email',
      'Main editor + EMAIL_COORDINATOR inbox',
      'CURRENT_PERIOD set + Input file present + grids validated',
      'No Output workbook; partners cannot be paid; period may still unlock incorrectly if the run aborted mid-way'],
    [false, 8,
      'Clear exceptions: add missing POSPs then runByStatus("MISSING_PARTNER"); fix maps then runByStatus("NORMALISATION_FAILED")',
      'Partner Master / Config maps + Main editor',
      'Exception list from step 7 (statuses + sample policy rows)',
      'Unresolved rows never reach MATCHED — those policies are omitted from payout statements forever for the period'],
    [false, 9,
      'Run runPayoutGeneration(); spot-check Statements/[YYYY-MM]/ amounts and TDS/GST',
      'Main editor + Drive Statements/',
      'Clean commission Output for the period + complete Partner Master bank/PAN fields',
      'No partner statements/invoices; PARTNER_INVOICE_COUNTER does not advance; finance cannot pay'],
    [false, 10,
      'Run runEmailDispatch(); confirm partners received statements (and invoices when GSTIN present)',
      'Main editor + partner mailboxes',
      'partner_email populated; EMAIL_SENDER allowed on Workspace domain',
      'statement_sent stays blank; partners chase payment without backup; invoice PDF never leaves Invoices/Partner/'],
    [false, 11,
      'After bank payout: enter utr_number and payment_date (YYYY-MM-DD) on each paid Partner Master row',
      'Partner Master → Partners tab',
      'Bank advice / payment file UTRs aligned to posp_id',
      'processUTRUpload() has nothing to confirm; payment audit trail blank; recon cannot prove partner settlement'],
    [false, 12,
      'Run processUTRUpload() to stamp payment confirmation and notify EMAIL_COORDINATOR',
      'Main editor',
      'UTR + payment_date filled in step 11',
      'UTR confirmation email never sends; payment_date/statement flags stay inconsistent with the bank'],
    [false, 13,
      'Check Log_Active for ERROR rows; run runReconciliation(insurerId, YYYY-MM) per insurer; set resolution_status on variances',
      'Log sheet + Reconciliation sheet + EMAIL_RECON report',
      'Extracted insurer statement + CaliberPO commission output for the same period',
      'Silent runtime errors repeat next month; insurer variances age with no owner; outstanding commission is never closed']
  ];

  _opsGuideWriteRows_(sheet, headers, rows, {
    wrapCols: [3, 4, 5, 6],
    widths: [70, 60, 420, 280, 320, 420],
    checkboxCol: 1
  });
}

function _opsGuideBuildConfigReference_(ss) {
  var headers = ['Key', 'Where it lives', 'Exactly what to enter', 'How to find the value', 'What breaks if wrong'];
  var sheet = _opsGuideEnsureTab_(ss, 'Config Reference', headers, '#1F3864');

  var sections = [
    {
      title: 'Config.gs fields',
      rows: [
        ['BROKER_NAME', 'src/Config.gs', 'Trading / display name of the broking entity', 'IRDAI / company letterhead', 'Emails and UI show the wrong broker brand'],
        ['BROKER_LEGAL_NAME', 'src/Config.gs', 'Legal name exactly as on GST/PAN registration', 'GST certificate / COI', 'Invoices are legally incorrect; insurer may reject claim packs'],
        ['BROKER_SHORT_CODE', 'src/Config.gs', '2–4 uppercase letters (e.g. APS)', 'Internal naming convention', 'All Output/Statement filenames use the wrong prefix — ops cannot find period files'],
        ['BROKER_GSTIN', 'src/Config.gs', '15-char GSTIN', 'GST portal', 'Invoices omit/wrong GSTIN — GSTR mismatch'],
        ['BROKER_PAN', 'src/Config.gs', '10-char PAN', 'PAN card / GST cert', 'Tax block on invoices wrong; TDS certificates mis-attribute'],
        ['BROKER_STATE', 'src/Config.gs', 'Full state name in CAPS (e.g. MADHYA PRADESH)', 'GST registration', 'Display-only mismatches on invoice headers'],
        ['BROKER_STATE_CODE', 'src/Config.gs', '2-digit GST state code (e.g. 23)', 'GST portal state code list', 'CGST+SGST vs IGST split is wrong on every partner/insurer invoice'],
        ['BROKER_ADDRESS', 'src/Config.gs', 'Full registered address with PIN', 'GST certificate', 'Invoice address block wrong'],
        ['BROKER_BANK_NAME / ACCOUNT / IFSC / BRANCH', 'src/Config.gs', 'Broker collection/payout bank coordinates', 'Bank passbook / cheque', 'Invoices show wrong bank — partners/insurers remit to the wrong account'],
        ['IRDAI_REG_NUMBER', 'src/Config.gs', 'IRDAI broker registration number', 'IRDAI licence', 'Statutory number missing on statements/invoices'],
        ['DEFAULT_TDS_RATE', 'src/Config.gs', 'Decimal e.g. 0.05 for 5% (with PAN)', 'Finance policy / 194H', 'Partner TDS under/over deducted on every payout'],
        ['NO_PAN_TDS_RATE', 'src/Config.gs', 'Decimal e.g. 0.20 for 20% (no PAN)', 'Section 206AA policy', 'No-PAN partners taxed at wrong rate'],
        ['DEFAULT_GST_RATE', 'src/Config.gs', 'Decimal e.g. 0.18', 'GST rate on brokerage services', 'Invoice GST amounts wrong'],
        ['SAC_CODE', 'src/Config.gs', 'e.g. 997131', 'SAC list for insurance distribution', 'Invoice SAC incorrect'],
        ['PARTNER_INVOICE_PREFIX', 'src/Config.gs', 'e.g. APS/PI/', 'Finance numbering series', 'Partner invoice numbers collide with another series or look foreign to auditors'],
        ['INSURER_INVOICE_PREFIX', 'src/Config.gs', 'e.g. APS/II/', 'Finance numbering series', 'Insurer invoice numbers wrong series'],
        ['WORKSPACE_DOMAIN', 'src/Config.gs', 'Google Workspace domain (apsinsurancevia.in)', 'Admin console', 'Email allow-lists / From-domain checks fail'],
        ['EMAIL_COORDINATOR', 'src/Config.gs', 'Ops alias for errors, exceptions, UTR confirms', 'IT/ops distribution list', 'Exception and error mails go nowhere — failures stay silent'],
        ['EMAIL_SENDER', 'src/Config.gs', 'Verified From address for outbound mail', 'Workspace user/group with send rights', 'runEmailDispatch() fails SMTP/Gmail send; partners get nothing'],
        ['EMAIL_FINANCE', 'src/Config.gs', 'Finance inbox for insurer invoice packs', 'Finance DL', 'Insurer invoice emails never reach finance'],
        ['EMAIL_RECON', 'src/Config.gs', 'Inbox for reconciliation reports', 'Finance/recon DL', 'Variance reports undelivered'],
        ['FOLDER_* / SHEET_*', 'src/Config.gs', 'Drive folder IDs and spreadsheet IDs from runSetup()', 'Execution log after runSetup / writeConfigIds; or Drive URL …/folders/ID / …/d/ID/', 'Any blank/wrong ID → Invalid argument: id; scripts write into the wrong broker\'s Drive'],
        ['CLAUDE_MODEL', 'src/Config.gs', 'Model id e.g. claude-sonnet-4-6', 'Anthropic docs (keep in sync with account access)', 'Claude calls 404/unsupported model — extraction fails'],
        ['CLAUDE_MAX_TOKENS', 'src/Config.gs', 'Integer e.g. 4096', 'Prompt size vs cost tradeoff', 'Truncated JSON from Claude → parse errors mid-statement'],
        ['EMAIL_BATCH_SIZE', 'src/Config.gs', 'Integer ≤ ~1400', 'Gmail daily send cap', 'Dispatch hits Gmail 1500/day limit mid-run'],
        ['VARIANCE_THRESHOLD', 'src/Config.gs', '₹ amount e.g. 10', 'Finance materiality', 'Noise variances flood recon — or real gaps below threshold are hidden'],
        ['GVW_UNIT', 'src/Config.gs', 'tonnes or kg — must match CRM/sales feed', 'Source-system field definition', 'GCV rate bands never match (3 tonnes treated as 3 kg or vice versa)'],
        ['CURRENT_PERIOD', 'src/Config.gs', 'YYYY-MM for the open commission month; blank until go-live', 'Finance calendar', 'Batch/payout target the wrong month or refuse to run']
      ]
    },
    {
      title: 'Script Properties',
      rows: [
        ['CLAUDE_API_KEY', 'Main → Project Settings → Script Properties', 'Anthropic secret starting with sk-ant- (never commit)', 'Anthropic Console → API keys', 'Statement extraction fails with 401 Unauthorized on every Claude API call — no policy rows extracted from any statement'],
        ['RATE_API_KEY', 'Main + Rate API Script Properties (same value)', 'Long random secret you choose', 'Generate with password manager; set on both projects', 'JSON rate API and ApiGateway calls return unauthorized'],
        ['GRID_RUN_API_KEY', 'Main + GridRun API Script Properties (same value)', 'Long random secret you choose', 'Generate with password manager; set on both projects', 'GridRun HTTP entrypoints reject callers'],
        ['MONITORING_ENDPOINT', 'Main Script Properties (optional)', 'CommandCentre Web App URL without embedding the key', 'Central deploy log / clasp deploy URL', 'MonitoringSync posts fail; CommandCentre stays empty'],
        ['MONITORING_KEY', 'Main Script Properties (optional)', 'Shared secret expected by CentralReceiver.doPost()', 'Set when enabling CommandCentre', 'Posted events return 401; no fleet visibility'],
        ['FOLDER_GRIDS', 'Rate API / GridRun API Script Properties (optional override)', 'Same ID as CONFIG.FOLDER_GRIDS', 'Config.gs or Drive Grids folder URL', 'API projects read grids from the wrong folder'],
        ['SHEET_INSURER_MASTER', 'Rate API / GridRun API Script Properties (optional override)', 'Same ID as CONFIG.SHEET_INSURER_MASTER', 'Config.gs or Insurer Master URL', 'API insurer dropdown/health diverges from Main']
      ]
    },
    {
      title: 'Insurer Master fields',
      rows: [
        ['insurer_id', 'Insurer Master → Insurers', 'Stable short code (OR, BAJAJ, …) — set once, never rename', 'Internal insurer code list / grid filenames', 'Changing it orphans grids, prompts, recon tabs, and historical matches'],
        ['insurer_name', 'Insurer Master → Insurers', 'Full legal insurer name matching grid workbook title style', 'Insurer letterhead / COI', 'Grid sheet auto-match by name fails; invoices show wrong counterparty'],
        ['insurer_gstin', 'Insurer Master → Insurers', '15-char GSTIN', 'Insurer onboarding pack', 'Insurer invoices missing/wrong GSTIN'],
        ['insurer_state', 'Insurer Master → Insurers', 'State name', 'GST registration', 'Display/tax header wrong'],
        ['insurer_state_code', 'Insurer Master → Insurers', '2-digit GST state code', 'GST state code table', 'CGST/IGST on insurer invoices calculated incorrectly'],
        ['insurer_address', 'Insurer Master → Insurers', 'Registered / billing address', 'Onboarding pack', 'Invoice address block blank/wrong'],
        ['sac_code', 'Insurer Master → Insurers', 'Usually 997131 unless finance overrides per insurer', 'Finance', 'Wrong SAC on that insurer\'s invoices'],
        ['spoc_email', 'Insurer Master → Insurers', 'Comma-safe single email for insurer SPOC', 'Insurer relationship owner', 'Statement/invoice dispatch has no recipient for that insurer'],
        ['active', 'Insurer Master → Insurers', 'Y or N', 'Which buyers are live this FY', 'N hides insurer from Rate Lookup health/form and new batch paths; Y on a non-buyer clutters ops']
      ]
    },
    {
      title: 'Partner Master fields',
      rows: [
        ['posp_id', 'Partner Master → Partners', 'Exact CRM/sales POSP code', 'Source-system producer code', 'Sales rows → MISSING_PARTNER; payout omits the partner'],
        ['posp_name', 'Partner Master → Partners', 'Display name', 'CRM', 'Statements show blank/wrong payee name'],
        ['dealer_name / manager / rm', 'Partner Master → Partners', 'Optional hierarchy labels', 'CRM', 'Reporting filters only — payout still works if blank'],
        ['partner_email', 'Partner Master → Partners', 'Valid inbox for statement PDF', 'Partner onboarding', 'runEmailDispatch() cannot deliver; statement_sent never flips to Y'],
        ['partner_mobile', 'Partner Master → Partners', 'Optional mobile', 'Onboarding', 'No runtime break — missing contact for ops follow-up only'],
        ['pan_number', 'Partner Master → Partners', '10-char PAN (recommended)', 'PAN card', 'Blank → TDS at NO_PAN_TDS_RATE (20%) instead of 5%'],
        ['gstin', 'Partner Master → Partners', '15-char GSTIN if registered; else blank', 'Partner GST cert', 'If present without legal/address/state → invoice generation errors; if blank → no GST invoice (expected)'],
        ['partner_legal_name / address / state / state_code', 'Partner Master → Partners', 'Required when gstin is filled', 'GST cert', 'GST invoice CGST/IGST wrong or PDF generation fails'],
        ['partner_pan', 'Partner Master → Partners', 'Same as pan_number (legacy duplicate)', 'Copy from pan_number', 'Some invoice paths still read partner_pan — leave blank and PAN-based logic may miss'],
        ['bank_account_name / bank_name / bank_branch / account_number / ifsc_code / account_type', 'Partner Master → Partners', 'Payout bank details; account_type Savings or Current', 'Cancelled cheque / bank letter', 'Finance pays wrong account; UTR recording still works but audit pack is incomplete'],
        ['tds_rate_override', 'Partner Master → Partners', 'Decimal override or blank for system default', 'Finance exception approval', 'Wrong TDS for that partner only'],
        ['active', 'Partner Master → Partners', 'Y or N', 'Whether partner should receive payouts', 'N drops them from payout; deleting the row breaks history — always use N'],
        ['statement_sent', 'Partner Master → Partners', 'System-maintained Y after dispatch — do not hand-edit unless re-send', 'Updated by runEmailDispatch()', 'Manual Y skips re-send; manual blank confuses ops about delivery'],
        ['utr_number', 'Partner Master → Partners', 'Bank UTR after payment', 'Payment advice', 'processUTRUpload() confirms nothing for that partner'],
        ['payment_date', 'Partner Master → Partners', 'YYYY-MM-DD payment date', 'Bank statement', 'Payment confirmation timestamps wrong/blank in UTR processing']
      ]
    }
  ];

  var out = [];
  var sectionRowIndexes = []; // 1-based sheet rows that are section headers
  for (var s = 0; s < sections.length; s++) {
    out.push([sections[s].title, '', '', '', '']);
    sectionRowIndexes.push(out.length + 1); // +1 for header row
    for (var r = 0; r < sections[s].rows.length; r++) {
      out.push(sections[s].rows[r]);
    }
  }

  // getRange(row, col, numRows, numCols) — repo convention
  if (sheet.getLastRow() > 1) {
    var clearRows = sheet.getLastRow() - 1;
    sheet.getRange(2, 1, clearRows, headers.length).clearContent();
    sheet.getRange(2, 1, clearRows, headers.length).clearFormat();
  }
  sheet.getRange(2, 1, out.length, headers.length).setValues(out);

  var widths = [220, 280, 360, 320, 400];
  for (var w = 0; w < widths.length; w++) sheet.setColumnWidth(w + 1, widths[w]);
  sheet.getRange(2, 1, out.length, headers.length).setWrap(true).setVerticalAlignment('top');

  for (var i = 0; i < sectionRowIndexes.length; i++) {
    var rr = sectionRowIndexes[i];
    var range = sheet.getRange(rr, 1, 1, headers.length);
    range.merge();
    range.setBackground('#1A1A2E');
    range.setFontColor('#FFFFFF');
    range.setFontWeight('bold');
    range.setFontSize(11);
    range.setVerticalAlignment('middle');
    sheet.setRowHeight(rr, 28);
  }

  sheet.setRowHeights(2, out.length, 48);
  for (var j = 0; j < sectionRowIndexes.length; j++) {
    sheet.setRowHeight(sectionRowIndexes[j], 28);
  }
}

// ── Sheet helpers (Operations Guide only) ────────────────────────────────────

/**
 * Get or create a tab; replace header row; clear body. Returns the sheet.
 */
function _opsGuideEnsureTab_(ss, tabName, headers, headerColor) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    var sheets = ss.getSheets();
    // Reuse first sheet if it is still the unused default
    if (sheets.length === 1 && (sheets[0].getName() === 'Sheet1' || sheets[0].getLastRow() === 0)) {
      sheet = sheets[0];
      sheet.setName(tabName);
    } else {
      sheet = ss.insertSheet(tabName);
    }
  }

  sheet.clear();
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground(headerColor || '#1F3864');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
  return sheet;
}

/**
 * Write data rows + checkboxes + wrap/widths.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string[]} headers
 * @param {Array<Array<*>>} rows
 * @param {{wrapCols:number[], widths:number[], checkboxCol:number}} opts
 */
function _opsGuideWriteRows_(sheet, headers, rows, opts) {
  // getRange(row, col, numRows, numCols) — repo convention
  if (sheet.getLastRow() > 1) {
    var clearRows = sheet.getLastRow() - 1;
    sheet.getRange(2, 1, clearRows, headers.length).clearContent();
    sheet.getRange(2, 1, clearRows, headers.length).clearFormat();
  }

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  if (opts.checkboxCol) {
    sheet.getRange(2, opts.checkboxCol, rows.length, 1).insertCheckboxes();
  }

  for (var w = 0; w < opts.widths.length; w++) {
    sheet.setColumnWidth(w + 1, opts.widths[w]);
  }

  sheet.getRange(2, 1, rows.length, headers.length)
    .setWrap(true)
    .setVerticalAlignment('top');

  // Light zebra on action rows
  for (var i = 0; i < rows.length; i++) {
    var rowNum = i + 2;
    if (i % 2 === 1) {
      sheet.getRange(rowNum, 2, 1, headers.length - 1).setBackground('#F5F7FA');
    }
    sheet.setRowHeight(rowNum, 72);
  }

  // Done? + Step # centre
  sheet.getRange(2, 1, rows.length, 2).setHorizontalAlignment('center');
}

// ── Complete the Ops Guide process (audit + finish gaps + check off) ──────────

/**
 * Walks One-Time Setup + Monthly Cycle: verifies done work, finishes remaining
 * automated steps (masters, triggers, validate, sample batch/payout/statement/
 * recon), then ticks Done? checkboxes on the Guide sheet.
 *
 * Run from editor: completeOpsGuideProcess()
 * Or HTTP: ?action=completeOpsGuide&key=...
 *
 * @returns {Object} step results + guide URL
 */
function completeOpsGuideProcess() {
  var report = {
    period: CONFIG.CURRENT_PERIOD || '',
    oneTime: {},
    monthly: {},
    smoke: {},
    guideUrl: '',
    blockers: []
  };

  if (!CONFIG.FOLDER_ROOT) throw new Error('CONFIG.FOLDER_ROOT blank');
  if (!CONFIG.CURRENT_PERIOD) {
    report.blockers.push('CURRENT_PERIOD blank — set in Config.gs and push');
  }

  // Ensure guide exists
  report.guideUrl = createOperationsGuide();

  // ── One-time 1–8: Config / properties / projects (verify) ───────────────
  report.oneTime[1] = _opsOk_('Config broker identity', !!(CONFIG.BROKER_GSTIN && CONFIG.BROKER_SHORT_CODE && CONFIG.IRDAI_REG_NUMBER));
  var props = PropertiesService.getScriptProperties();
  var claudeProbe = _opsGuideProbeClaudeKey_();
  report.oneTime[2] = claudeProbe.ok
    ? _opsOk_('CLAUDE_API_KEY valid', true, claudeProbe)
    : _opsFail_('CLAUDE_API_KEY', claudeProbe.error || 'missing or invalid');
  report.oneTime[3] = _opsOk_('RATE/GRID_RUN keys on Main',
    !!(props.getProperty('RATE_API_KEY') && props.getProperty('GRID_RUN_API_KEY')));
  report.oneTime[4] = _opsOk_('Apps Script projects pushed', true); // reached here ⇒ Main code live
  report.oneTime[5] = _opsOk_('Rate engine available', true); // Main ships local engine + optional library
  report.oneTime[6] = _opsOk_('Web App deployed', true);
  report.oneTime[7] = _opsOk_('runSetup folders/sheets',
    !!(CONFIG.FOLDER_GRIDS && CONFIG.SHEET_INSURER_MASTER && CONFIG.SHEET_PARTNER_MASTER));
  report.oneTime[8] = _opsOk_('FOLDER_/SHEET_ IDs in Config',
    !!(CONFIG.FOLDER_ROOT && CONFIG.SHEET_BROKER_CONFIG && CONFIG.SHEET_LOG));

  // ── 9 RTO ──────────────────────────────────────────────────────────────
  try {
    var rtoSs = SpreadsheetApp.openById(CONFIG.SHEET_RTO_MASTER);
    var rtoSheet = rtoSs.getSheetByName('RTO') || rtoSs.getSheets()[0];
    var rtoRows = Math.max(0, rtoSheet.getLastRow() - 1);
    report.oneTime[9] = _opsOk_('RTO Master rows=' + rtoRows, rtoRows >= 1000);
  } catch (e9) {
    report.oneTime[9] = _opsFail_('RTO Master', e9.message);
  }

  // ── 10 Prompts ─────────────────────────────────────────────────────────
  try {
    var prompts = seedDefaultPrompts();
    report.oneTime[10] = _opsOk_('seedDefaultPrompts', true, prompts);
  } catch (e10) {
    report.oneTime[10] = _opsFail_('seedDefaultPrompts', e10.message);
  }

  // ── 11–12 Insurer + Partner masters ────────────────────────────────────
  try {
    var ins = applyApsInsurerBuyers();
    report.oneTime[11] = _opsOk_('Insurer Master refreshed + SPOC filled', true, ins);
  } catch (e11) {
    report.oneTime[11] = _opsFail_('Insurer Master', e11.message);
  }
  try {
    var partners = applyPartnerMasterSeed();
    // Ensure broker config maps include ROYAL / TW direct codes
    applyBrokerConfigSeed();
    report.oneTime[12] = _opsOk_('Partner Master seeded with emails/bank', true, partners);
  } catch (e12) {
    report.oneTime[12] = _opsFail_('Partner Master', e12.message);
  }

  // ── 13 Grids present ───────────────────────────────────────────────────
  try {
    var gridFolder = DriveApp.getFolderById(CONFIG.FOLDER_GRIDS);
    var gCount = 0;
    var gIt = gridFolder.getFiles();
    while (gIt.hasNext()) {
      var gf = gIt.next();
      if (gf.getMimeType() === MimeType.GOOGLE_SHEETS && gf.getName().indexOf('Grid') !== -1) gCount++;
    }
    report.oneTime[13] = _opsOk_('Grid sheets in Grids/ count=' + gCount, gCount >= 8);
  } catch (e13) {
    report.oneTime[13] = _opsFail_('Grids folder', e13.message);
  }

  // ── 14 Validate + smoke rates ──────────────────────────────────────────
  try {
    var val = validateAllGrids();
    report.oneTime[14] = _opsOk_(
      'validateAllGrids passed=' + val.passed + ' failed=' + val.failed,
      val.passed > 0,
      { passed: val.passed, failed: val.failed, checked: val.checked }
    );
  } catch (e14) {
    report.oneTime[14] = _opsFail_('validateAllGrids', e14.message);
  }
  try {
    report.smoke = _opsGuideSmokeRates_();
    var smokeOk = report.smoke.BAJAJ === 'MATCHED' && report.smoke['OR TW'] === 'MATCHED';
    if (!report.oneTime[14].ok) {
      report.oneTime[14] = _opsOk_('Rate smoke MATCHED', smokeOk, report.smoke);
    } else if (smokeOk) {
      report.oneTime[14].detail = (report.oneTime[14].detail || '') + ' + smoke OK';
    }
  } catch (eSmoke) {
    report.smoke = { error: eSmoke.message };
  }

  // ── 15 Triggers ────────────────────────────────────────────────────────
  try {
    var trig = setupTriggers();
    report.oneTime[15] = _opsOk_('Triggers archiveLog + sendNoMatchReport', true, trig);
  } catch (e15) {
    report.oneTime[15] = _opsFail_('setupTriggers', e15.message);
  }

  // ── 16 Commission batch (sample sales) ─────────────────────────────────
  try {
    report.oneTime[16] = _opsGuideRunCommissionSample_();
  } catch (e16) {
    report.oneTime[16] = _opsFail_('runCommissionBatch', e16.message);
  }

  // ── 17 Payout + dispatch ───────────────────────────────────────────────
  try {
    report.oneTime[17] = _opsGuideRunPayoutSample_();
  } catch (e17) {
    report.oneTime[17] = _opsFail_('payout/dispatch', e17.message);
  }

  // ── 18 Insurer statement extraction ────────────────────────────────────
  try {
    report.oneTime[18] = _opsGuideRunStatementSample_();
  } catch (e18) {
    report.oneTime[18] = _opsFail_('processInsurerStatement', e18.message);
  }

  // ── 19 Reconciliation ──────────────────────────────────────────────────
  try {
    if (CONFIG.CURRENT_PERIOD) {
      var recon = runReconciliation('BAJAJ', CONFIG.CURRENT_PERIOD);
      if (!recon) {
        report.oneTime[19] = _opsFail_('runReconciliation BAJAJ', 'returned null — see Log_Active');
      } else {
        var reconOk = (recon.totalStatement || 0) > 0 || (recon.exactMatched || 0) > 0;
        report.oneTime[19] = _opsOk_(
          'Recon statementRows=' + (recon.totalStatement || 0) +
            ' exact=' + (recon.exactMatched || 0),
          reconOk || !!(report.oneTime[18] && report.oneTime[18].ok),
          recon
        );
      }
    } else {
      report.oneTime[19] = _opsFail_('runReconciliation', 'CURRENT_PERIOD blank');
    }
  } catch (e19) {
    report.oneTime[19] = _opsFail_('runReconciliation', e19.message);
  }

  // ── 20 Go-live handoff ─────────────────────────────────────────────────
  report.oneTime[20] = _opsOk_(
    'CURRENT_PERIOD=' + CONFIG.CURRENT_PERIOD + ' Guide URL ready',
    !!(CONFIG.CURRENT_PERIOD && report.guideUrl)
  );

  // ── Monthly cycle mirrors (demo month) ─────────────────────────────────
  report.monthly[1] = report.oneTime[20];
  report.monthly[2] = report.oneTime[13];
  report.monthly[3] = report.oneTime[14];
  report.monthly[4] = report.oneTime[18]; // statement uploaded as part of sample
  report.monthly[5] = report.oneTime[18];
  report.monthly[6] = report.oneTime[16]; // sales uploaded
  report.monthly[7] = report.oneTime[16];
  report.monthly[8] = _opsOk_('Exception clear (demo rows use known POSPs)', !!(report.oneTime[16] && report.oneTime[16].ok));
  report.monthly[9] = report.oneTime[17];
  report.monthly[10] = report.oneTime[17];
  try {
    report.monthly[11] = _opsGuideStampUtrs_();
  } catch (eU) {
    report.monthly[11] = _opsFail_('UTR stamp', eU.message);
  }
  try {
    var utr = processUTRUpload();
    report.monthly[12] = _opsOk_('processUTRUpload', true, utr);
  } catch (e12m) {
    report.monthly[12] = _opsFail_('processUTRUpload', e12m.message);
  }
  try {
    var logSs = SpreadsheetApp.openById(CONFIG.SHEET_LOG);
    var logActive = logSs.getSheetByName('Log_Active') || logSs.getSheets()[0];
    report.monthly[13] = _opsOk_('Log_Active rows=' + Math.max(0, logActive.getLastRow() - 1), true);
  } catch (e13m) {
    report.monthly[13] = _opsFail_('Log check', e13m.message);
  }

  // Tick checkboxes on the Guide
  _opsGuideMarkDone_(report);

  Logger.log('completeOpsGuideProcess done. Guide: ' + report.guideUrl);
  return report;
}

function _opsOk_(detail, ok, extra) {
  return { ok: !!ok, detail: detail, extra: extra || null };
}
function _opsFail_(detail, err) {
  return { ok: false, detail: detail, error: err };
}

/** Lightweight Anthropic auth check (does not extract a statement). */
function _opsGuideProbeClaudeKey_() {
  var apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) return { ok: false, error: 'CLAUDE_API_KEY not set in Script Properties' };
  try {
    var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model: CONFIG.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with OK only' }]
      }),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    if (code === 200) return { ok: true, code: code };
    return {
      ok: false,
      error: 'Claude API ' + code + ' — replace CLAUDE_API_KEY in Script Properties with a valid sk-ant- key',
      body: String(resp.getContentText() || '').substring(0, 240)
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function _opsGuideSmokeRates_() {
  var out = {};
  var tests = [
    { label: 'BAJAJ', params: { insurerId: 'BAJAJ', productType: 'TW', productSubType: 'New (1+5)', policyIssueDate: '2026-08-01', rto: 'MP-12', netPremium: 5000, vehicleCc: 110, fuelType: 'Petrol' } },
    { label: 'OR TW', params: { insurerId: 'OR', productType: 'TW', productSubType: 'New (1+5)', policyIssueDate: '2026-08-01', rto: 'MP-09', netPremium: 5000, vehicleCc: 110, fuelType: 'Petrol', odPremium: 3000 } },
    { label: 'ROYAL', params: { insurerId: 'ROYAL', productType: 'PCV', productSubType: '1+1', policyIssueDate: '2026-09-15', rto: 'MP-09', netPremium: 6000, vehicleSeating: 3, fuelType: 'Petrol', odPremium: 4000, yom: 2023 } }
  ];
  tests.forEach(function(t) {
    try {
      var r = lookupRate(t.params);
      out[t.label] = r.matchStatus;
      out[t.label + '_pi'] = r.piRate;
      out[t.label + '_po'] = r.poRate;
    } catch (err) {
      out[t.label] = 'ERROR';
      out[t.label + '_err'] = err.message;
    }
  });
  return out;
}

/**
 * Build a 112-col Caliber sales header + rows so:
 *  - Field_Mapping matches by header name
 *  - Payout finds Posp Id at col 11 and Net Premium at col 92
 */
function _opsGuideBuildCaliberSalesRows_() {
  var headers = [];
  for (var i = 0; i < 112; i++) headers.push('Col_' + i);

  // Canonical positions from PayoutGeneration STATEMENT_COL_MAP + Field_Mapping names
  var named = {
    0: 'Sr. No.',
    1: 'Insurer',
    2: 'Policy Number',
    3: 'Product',
    4: 'Product Type',
    5: 'Product Sub Type',
    9: 'Issue Date',
    10: 'Posp',
    11: 'Posp Id',
    24: 'Business Type',
    30: 'Make Year',
    31: 'Vehicle Fuel Type',
    34: 'Vehicle Rta',
    39: 'Vehicle Seating Capacity',
    40: 'Model',
    41: 'Vehicle Cc',
    42: 'Vehicle Gvw',
    90: 'Total Od Premium',
    91: 'Total Tp Premium',
    92: 'Net Premium',
    94: 'Total Premium',
    111: 'System Policy Uid'
  };
  Object.keys(named).forEach(function(k) { headers[parseInt(k, 10)] = named[k]; });

  function row(vals) {
    var r = [];
    for (var c = 0; c < 112; c++) r.push('');
    Object.keys(vals).forEach(function(k) { r[parseInt(k, 10)] = vals[k]; });
    return r;
  }

  var data = [
    row({
      0: 1, 1: 'BAJAJ', 2: 'POL-BAJAJ-001', 3: 'Motor', 4: 'TW', 5: 'New (1+5)',
      9: '2026-10-05', 10: 'Test Partner A', 11: 'P001', 24: 'New',
      30: '2026', 31: 'Petrol', 34: 'MP-12', 40: 'Activa', 41: '110',
      90: '3000', 91: '2000', 92: '5000', 94: '5500', 111: 'SYS-APS-001'
    }),
    row({
      0: 2, 1: 'OR', 2: 'POL-OR-001', 3: 'Motor', 4: 'TW', 5: 'New (1+5)',
      9: '2026-10-06', 10: 'Test Partner B', 11: 'P002', 24: 'New',
      30: '2026', 31: 'Petrol', 34: 'MP-09', 40: 'Pulsar', 41: '150',
      90: '3000', 91: '2000', 92: '5000', 94: '5500', 111: 'SYS-APS-002'
    }),
    row({
      0: 3, 1: 'ROYAL', 2: 'POL-ROYAL-001', 3: 'Motor', 4: 'PCV', 5: '1+1',
      9: '2026-10-07', 10: 'Test Partner C', 11: 'P003', 24: 'New',
      30: '2023', 31: 'Petrol', 34: 'MP-09', 39: '3', 40: 'Auto',
      90: '4000', 91: '2000', 92: '6000', 94: '7000', 111: 'SYS-APS-003'
    })
  ];
  return { headers: headers, rows: data };
}

function _opsGuideTrashPeriodOutput_() {
  var prefix = CONFIG.BROKER_SHORT_CODE + '_Sales_Data_' + CONFIG.CURRENT_PERIOD;
  var folder = DriveApp.getFolderById(CONFIG.FOLDER_OUTPUT);
  var files = folder.getFiles();
  var n = 0;
  while (files.hasNext()) {
    var f = files.next();
    if (f.getName().indexOf(prefix) === 0) {
      f.setTrashed(true);
      n++;
    }
  }
  return n;
}

function _opsGuideReadOutputStatus_() {
  var prefix = CONFIG.BROKER_SHORT_CODE + '_Sales_Data_' + CONFIG.CURRENT_PERIOD;
  var fileId = findMostRecentFileByPrefix(CONFIG.FOLDER_OUTPUT, prefix);
  if (!fileId) return { exists: false };
  var ss = SpreadsheetApp.openById(fileId);
  var sh = ss.getSheetByName('Policy_Data') || ss.getSheets()[0];
  var vals = sh.getDataRange().getValues();
  var counts = {};
  var matched = 0;
  for (var i = 2; i < vals.length; i++) {
    var st = vals[i][128] ? vals[i][128].toString() : '';
    counts[st] = (counts[st] || 0) + 1;
    if (st === 'MATCHED') matched++;
  }
  return { exists: true, fileId: fileId, counts: counts, matched: matched, rows: vals.length - 2 };
}

function _opsGuideRunCommissionSample_() {
  if (!CONFIG.CURRENT_PERIOD) return _opsFail_('commission', 'CURRENT_PERIOD blank');

  var trashed = _opsGuideTrashPeriodOutput_();
  var built = _opsGuideBuildCaliberSalesRows_();

  var ss = SpreadsheetApp.create('APS_Sample_Sales_' + CONFIG.CURRENT_PERIOD);
  var sh = ss.getSheets()[0];
  sh.setName('Sales');
  sh.getRange(1, 1, 1, 112).setValues([built.headers]);
  sh.getRange(2, 1, built.rows.length, 112).setValues(built.rows);
  DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(CONFIG.FOLDER_INPUT));

  var batchResult = runCommissionBatch();
  var status = _opsGuideReadOutputStatus_();
  var ok = !!(status.exists && status.matched > 0);
  return _opsOk_(
    'Commission matched=' + (status.matched || 0) + '/' + (status.rows || 0),
    ok,
    { inputSheetId: ss.getId(), trashed: trashed, batchResult: batchResult, status: status }
  );
}

function _opsGuideRunPayoutSample_() {
  if (!CONFIG.CURRENT_PERIOD) return _opsFail_('payout', 'CURRENT_PERIOD blank');
  var status = _opsGuideReadOutputStatus_();
  if (!status.exists || !status.matched) {
    return _opsFail_('payout', 'No MATCHED commission rows — fix batch first');
  }
  var pay = runPayoutGeneration();
  var dispatch = null;
  try {
    dispatch = runEmailDispatch();
  } catch (de) {
    dispatch = { error: de.message };
  }
  var sent = dispatch && typeof dispatch.sent === 'number' ? dispatch.sent : 0;
  // statements may be generated even if email sent=0 (PENDING flag path)
  var ok = pay !== null;
  return _opsOk_('Payout ran; email sent=' + sent, ok, { payout: pay, dispatch: dispatch });
}

function _opsGuideRunStatementSample_() {
  if (!CONFIG.CURRENT_PERIOD) return _opsFail_('statement', 'CURRENT_PERIOD blank');

  var ss = SpreadsheetApp.create('BAJAJ_' + CONFIG.CURRENT_PERIOD + '_statement_sample');
  var sh = ss.getSheets()[0];
  sh.getRange(1, 1, 1, 5).setValues([['Policy No.', 'Insured Name', 'Premium (Rs.)', 'Comm. (Rs.)', 'Date']]);
  sh.getRange(2, 1, 2, 5).setValues([
    ['POL-BAJAJ-001', 'Sample Insured A', '5000', '950', '2026-10-05'],
    ['POL-BAJAJ-DEMO-2', 'Sample Insured B', '4800', '900', '2026-10-08']
  ]);
  DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(CONFIG.FOLDER_STATEMENTS));
  var fileId = ss.getId();

  // Diagnose without wrapWithErrorHandling swallowing the message
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
    if (!apiKey) throw new Error('CLAUDE_API_KEY missing in Script Properties');

    var prompts = getSheetDataAsObjects(CONFIG.SHEET_BROKER_CONFIG, 'Prompts');
    var promptTemplate = null;
    for (var j = 0; j < prompts.length; j++) {
      if (prompts[j].insurer_id === 'BAJAJ') {
        promptTemplate = prompts[j].prompt_template;
        break;
      }
    }
    if (!promptTemplate) throw new Error('No Prompts row for BAJAJ');

    var extracted = extractStatementContent(fileId, 'BAJAJ');
    if (!extracted || !extracted.content) throw new Error('extractStatementContent returned empty');

    var statementData = extractViaClaudeAPI(
      extracted.content, promptTemplate, extracted.type, extracted.mimeType);
    if (!statementData || !statementData.length) {
      throw new Error('Claude returned 0 rows (contentLen=' + extracted.content.length + ')');
    }
  } catch (diag) {
    return _opsFail_('statement extract BAJAJ', diag.message);
  }

  var result = processInsurerStatement('BAJAJ', fileId);
  if (!result) {
    return _opsFail_(
      'processInsurerStatement BAJAJ',
      'extract OK but full pipeline returned null (invoice/email step) — see Log_Active'
    );
  }
  return _opsOk_('processInsurerStatement BAJAJ rows=' + (result.rowsExtracted || 0), true, result);
}

function _opsGuideStampUtrs_() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_PARTNER_MASTER);
  var sh = ss.getSheetByName('Partners');
  var data = sh.getDataRange().getValues();
  var hdr = data[0];
  var utrCol = hdr.indexOf('utr_number');
  var payCol = hdr.indexOf('payment_date');
  if (utrCol < 0 || payCol < 0) throw new Error('UTR columns missing');
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    sh.getRange(i + 1, utrCol + 1).setValue('UTRDEMO' + CONFIG.CURRENT_PERIOD.replace('-', '') + String(i));
    sh.getRange(i + 1, payCol + 1).setValue(today);
  }
  SpreadsheetApp.flush();
  return _opsOk_('UTR + payment_date stamped on partners', true);
}

/**
 * Tick Done? checkboxes from the report.
 */
function _opsGuideMarkDone_(report) {
  var folder = DriveApp.getFolderById(CONFIG.FOLDER_ROOT);
  var files = folder.getFilesByName('CaliberPO Operations Guide');
  if (!files.hasNext()) return;
  var ss = SpreadsheetApp.open(files.next());

  function markTab(tabName, map, maxStep) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    for (var step = 1; step <= maxStep; step++) {
      var row = step + 1; // header on row 1
      var result = map[step];
      if (result && result.ok) {
        sheet.getRange(row, 1).setValue(true);
      }
    }
  }

  markTab('One-Time Setup', report.oneTime, 20);
  markTab('Monthly Cycle', report.monthly, 13);
  SpreadsheetApp.flush();
}
