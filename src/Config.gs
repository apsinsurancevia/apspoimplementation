// ============================================================
// Config.gs — Single source of all deployment variables
// CLAUDE_API_KEY is NEVER here — use PropertiesService
// ============================================================

var CONFIG = {

  // ----------------------------------------------------------
  // Folder IDs — all populated by setup.gs after first run
  // ----------------------------------------------------------
  FOLDER_ROOT:        "",   // CaliberPO root folder in Drive
  FOLDER_SALES_DATA:  "",   // Sales_Data_Master files
  FOLDER_STATEMENTS:  "",   // Partner commission statements (PDFs)
  FOLDER_INVOICES:    "",   // Insurer invoices (PDFs)
  FOLDER_GRIDS:       "",   // Rate grid Sheets
  FOLDER_MASTERS:     "",   // Master data Sheets
  FOLDER_LOGS:        "",   // Execution logs

  // ----------------------------------------------------------
  // Sheet IDs — all populated by setup.gs after first run
  // ----------------------------------------------------------
  SHEET_BROKER_CONFIG:       "",   // Broker Config + Counters
  SHEET_SALES_DATA_MASTER:   "",   // Main 130-column data sheet
  SHEET_PARTNER_MASTER:      "",   // POSP / partner registry
  SHEET_PRODUCT_MASTER:      "",   // Product catalogue
  SHEET_RTO_MASTER:          "",   // RTO code registry
  SHEET_INSURER_MASTER:      "",   // Insurer registry
  SHEET_LOG:                 "",   // Execution log sheet

  // ----------------------------------------------------------
  // Internal email routing
  // ----------------------------------------------------------
  EMAIL_FINANCE:     "finance@novoup.com",
  EMAIL_RECON:       "recon@novoup.com",
  EMAIL_COORDINATOR: "coordinator@novoup.com",
  EMAIL_BATCH_SIZE:  1400,   // Gmail daily send limit (safe cap)

  // ----------------------------------------------------------
  // GST / Invoice
  // ----------------------------------------------------------
  CGST_RATE: 9,          // % — intra-state seller=buyer
  SGST_RATE: 9,          // % — intra-state seller=buyer
  IGST_RATE: 18,         // % — inter-state
  SAC_CODE:  "997131",   // Financial services - insurance

  // ----------------------------------------------------------
  // Sales_Data_Master column indices (0-based)
  // Cols A-DH (0-111) = original 112 fields
  // Cols DI-DZ (112-129) = 18 commission working columns
  // ----------------------------------------------------------
  COL_COMMISSION_START: 112,  // DI — first commission working col
  COL_MATCH_STATUS:     128,  // DY — control field for all processing
  COL_FLAG_NOTES:       129,  // DZ — free-text flag / notes
  TOTAL_COLS:           130,  // A through DZ

  // ----------------------------------------------------------
  // Commission working column layout (DI=112 … DZ=129)
  // ----------------------------------------------------------
  COMMISSION_COLS: {
    PARTNER_CODE:        112,  // DI
    PARTNER_NAME:        113,  // DJ
    PRODUCT_CODE:        114,  // DK
    CATEGORY:            115,  // DL  TW/Pvt Car/GCV/PCV/Misc D
    PREMIUM_BASE:        116,  // DM  OD/TP/NET/FLAT
    APPLICABLE_PREMIUM:  117,  // DN
    GRID_RATE_PCT:       118,  // DO
    GROSS_COMMISSION:    119,  // DP
    TDS_PCT:             120,  // DQ
    TDS_AMOUNT:          121,  // DR
    NET_COMMISSION:      122,  // DS
    INSURER_INVOICE_NO:  123,  // DT
    PARTNER_INVOICE_NO:  124,  // DU
    STATEMENT_MONTH:     125,  // DV  YYYY-MM
    PAYOUT_DATE:         126,  // DW
    RECON_STATUS:        127,  // DX
    MATCH_STATUS:        128,  // DY  ← COL_MATCH_STATUS
    FLAG_NOTES:          129   // DZ  ← COL_FLAG_NOTES
  },

  // ----------------------------------------------------------
  // Status values written to col DY (Match Status)
  // ----------------------------------------------------------
  STATUS: {
    MATCHED:              "MATCHED",
    NO_MATCH:             "NO_MATCH",
    MISSING_PARTNER:      "MISSING_PARTNER",
    MISSING_FIELD:        "MISSING_FIELD",
    NORMALISATION_FAILED: "NORMALISATION_FAILED",
    DUPLICATE:            "DUPLICATE",
    INACTIVE_PARTNER:     "INACTIVE_PARTNER",
    GRID_ERROR:           "GRID_ERROR",
    DUPLICATE_RATE:       "DUPLICATE_RATE"
  },

  // ----------------------------------------------------------
  // Rate grid tab name prefixes (suffix = _YYYY-MM)
  // ----------------------------------------------------------
  GRID_TABS: ["TW", "Pvt Car", "GCV", "PCV", "Misc D"],

  // ----------------------------------------------------------
  // Premium base priority (first non-zero/non-blank wins)
  // FLAT = rate value is the direct rupee amount, not a %
  // ----------------------------------------------------------
  PREMIUM_BASE_PRIORITY: ["OD", "TP", "NET", "FLAT"],

  // ----------------------------------------------------------
  // Rate grid column headers (standard layout across all tabs)
  // ----------------------------------------------------------
  GRID_COLS: {
    INSURER_CODE:       "insurer_code",
    RTO_CODE:           "rto_code",        // XX-00 or blank=PAN India
    VEHICLE_PARAM_LOW:  "param_low",       // CC / GVW / Seating lower bound
    VEHICLE_PARAM_HIGH: "param_high",      // inclusive upper bound
    PREMIUM_BASE:       "premium_base",    // OD/TP/NET/FLAT
    RATE_PCT:           "rate_pct",        // commission % (or flat amount)
    EFFECTIVE_FROM:     "effective_from",  // Date — YYYY-MM-DD
    EFFECTIVE_TO:       "effective_to",    // Date — YYYY-MM-DD
    ACTIVE:             "active"           // Y/N
  },

  // ----------------------------------------------------------
  // Vehicle parameter field names in Sales_Data_Master
  // Used by RateLookup to pick the right CC/GVW/Seating column
  // ----------------------------------------------------------
  VEHICLE_PARAM_COL: {
    "TW":      "cubic_capacity",
    "GCV":     "gvw",
    "Tractor": "gvw",
    "PCV":     "seating_capacity"
  },

  // ----------------------------------------------------------
  // LockService timeout (ms)
  // ----------------------------------------------------------
  LOCK_TIMEOUT_MS: 30000,

  // ----------------------------------------------------------
  // Invoice counter tab name in Broker Config Sheet
  // ----------------------------------------------------------
  COUNTERS_TAB: "Counters",

  // ----------------------------------------------------------
  // Named deployment (set after first deploy via Apps Script UI)
  // ----------------------------------------------------------
  DEPLOYMENT_ID: "",   // populated after clasp deploy

  // ----------------------------------------------------------
  // Broker identity (used on invoices)
  // ----------------------------------------------------------
  BROKER_NAME:       "Novoup Insurance Brokers Pvt Ltd",
  BROKER_GSTIN:      "",   // set after GST registration
  BROKER_STATE_CODE: "29", // Karnataka (update if different)
  BROKER_ADDRESS:    "",   // full registered address
  BROKER_PAN:        "",

  // ----------------------------------------------------------
  // Claude AI (model only — key via PropertiesService)
  // ----------------------------------------------------------
  CLAUDE_MODEL:      "claude-sonnet-4-6",
  CLAUDE_API_URL:    "https://api.anthropic.com/v1/messages",
  CLAUDE_MAX_TOKENS: 4096

};
