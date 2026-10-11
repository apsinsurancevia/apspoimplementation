/**
 * CaliberPO — Configuration
 *
 * DEPLOYMENT INSTRUCTIONS:
 * This is the ONLY file that changes between broker deployments.
 * All broker-specific values live here. Nothing hardcoded elsewhere.
 *
 * FOLDER_* and SHEET_* values are populated automatically by setup.gs on first run.
 * CLAUDE_API_KEY is NEVER stored here — set in Apps Script Script Properties only.
 *
 * To deploy for a new broker:
 *   1. Pull main branch
 *   2. Create client branch: git checkout -b [clientcode]-production
 *   3. Fill in all values below
 *   4. Run setup.gs to populate FOLDER_* and SHEET_* IDs
 *   5. Commit client branch
 */

const CONFIG = {

  // ── BROKER IDENTITY ──────────────────────────────────────────────────────
  BROKER_NAME:              "APS Insurance Broking Services Private Limited",
  BROKER_LEGAL_NAME:        "APS Insurance Broking Services Private Limited",
  BROKER_SHORT_CODE:        "APS",
  BROKER_GSTIN:             "23AAZCA5637P1ZT",
  BROKER_PAN:               "AAZCA5637P",
  BROKER_STATE:             "MADHYA PRADESH",
  BROKER_STATE_CODE:        "23",
  BROKER_ADDRESS:           "68, Sundar Nagar Ext, Indore, DDU Agar, Indore, Madhya Pradesh, India — Pin: 452010",
  BROKER_BANK_NAME:         "ICICI Bank",
  BROKER_BANK_ACCOUNT:      "656905601822",
  BROKER_BANK_IFSC:         "ICIC0006569",
  BROKER_BANK_BRANCH:       "Indore M G Road",
  IRDAI_REG_NUMBER:         "1054",   // IRDAI Licensed Insurance Broker | CIN: U66220MP2023PTC068251

  // ── TAX & INVOICE ─────────────────────────────────────────────────────────
  DEFAULT_TDS_RATE:         0.05,   // Section 194H — 5% with PAN
  NO_PAN_TDS_RATE:          0.20,   // Section 206AA — 20% without PAN
  DEFAULT_GST_RATE:         0.18,   // 18% GST on commission
  SAC_CODE:                 "997131", // SAC code for insurance distribution services
  PARTNER_INVOICE_PREFIX:   "APS/PI/",
  INSURER_INVOICE_PREFIX:   "APS/II/",

  // ── EMAIL ROUTING ─────────────────────────────────────────────────────────
  WORKSPACE_DOMAIN:         "apsinsurancevia.in",
  EMAIL_COORDINATOR:        "it@apsinsurancevia.in",
  EMAIL_SENDER:             "it@apsinsurancevia.in",
  EMAIL_FINANCE:            "it@apsinsurancevia.in",
  EMAIL_RECON:              "it@apsinsurancevia.in",

  // ── DRIVE FOLDER IDs ──────────────────────────────────────────────────────
  // Leave blank for fresh deploy — populated by setup.gs / runSetup()
  FOLDER_ROOT:              "1KZBvUZyt1Y8l0-hfNa6nz5SLkENEnsue",
  FOLDER_GRIDS:             "125lwRE7R-NSNnHolBGIBA_z3kLm4-vT2",
  FOLDER_INPUT:             "1hsnV7phJt7f1qDQc4zp8YZ732z8VtUX0",
  FOLDER_OUTPUT:            "17UeDCGTHhHNRJtJtVZ1U8I2CQmeCEUxT",
  FOLDER_STATEMENTS:        "1R03oxUxSQeP2y-ja2KKjqEJOvGAg3oDw",
  FOLDER_INVOICES:          "19GAc9faQ9Sw0LPTNATvpRdmrKbIeHydL",
  FOLDER_INVOICES_PARTNER:  "1QXeJVhcfeWnNdR_nNZseRuspzVm5-4Gq",
  FOLDER_INVOICES_INSURER:  "1BJz9UVDYvWgo4J_FUY2OHwiddaSZhrJN",
  FOLDER_RECONCILIATION:    "133awcnVEAqUYqBBMhjIO5_F0DXpI-jJy",
  FOLDER_MASTERS:           "1hxNk6XjbZwUfeeFgOtbFSJKi9J7rMokz",
  FOLDER_BACKUP:            "1xL3CSTCAi_iDZwTcgx-32mSyPwcoTmvj",
  FOLDER_LOG:               "1W4HxYC7fZbaV7TaaxUNGWBRqOT9P2mun",
  FOLDER_GRID_IMPORT:       "1-h1bFSfpP8yZxejdK95IEXXbmfjnbBb7",  // Inbox — drop .xlsx files here, run importGridsFromFolder()
  FOLDER_GRID_ARCHIVE:      "1bpxRcEnSxnjnss2cgvFgydRbtmF4ACMv",  // Permanent archive — one sub-folder per insurer, auto-populated

  // ── SHEET IDs ─────────────────────────────────────────────────────────────
  SHEET_PRODUCT_MASTER:     "1N9-fAHpnouCU-XHgTX_fEUQIuKW-JPyobPLr6BYZGDQ",
  SHEET_RTO_MASTER:         "1VOHj4g-FsGwluMoJ3p_LYSmuHc3xyahEYm72Og6DyGA",
  SHEET_INSURER_MASTER:     "1NKyVjVDPVb4jmVqbG7IbklLiBqYp1_hV0GRzYMDfBrc",
  SHEET_BROKER_CONFIG:      "1coA6EzEuOI46J9Qzdc2wR0ztvRFbhsdkpb62m_6d8Q4",
  SHEET_PARTNER_MASTER:     "1ar2mJyH7FA84FGkrhesVmculB-UoDLIc0g7LWtMzjWU",
  SHEET_RECONCILIATION:     "1wztETZxR4eQVmFbcduBz9fpQfQ4d-pERqwpft8ECZ1M",
  SHEET_LOG:                "1vferagc11KKa8DIPdrYg_M7AQkumnrIG1CCsrYyK3bQ",

  // ── CLAUDE API ────────────────────────────────────────────────────────────
  // API key is NEVER stored here — set in Apps Script Script Properties
  // Project Settings → Script Properties → Key: CLAUDE_API_KEY

  // ── MONITORING (set in Script Properties — never in code) ─────────────────
  // MONITORING_ENDPOINT — Web App URL of the NovoUp CommandCentre receiver
  //                       Append ?key=MONITORING_KEY when posting — do NOT
  //                       embed the key in this URL.
  // MONITORING_KEY      — Shared secret validated by CentralReceiver.doPost()
  CLAUDE_MODEL:             "claude-sonnet-4-6",
  CLAUDE_MAX_TOKENS:        4096,

  // ── PROCESSING ────────────────────────────────────────────────────────────
  EMAIL_BATCH_SIZE:         1400,    // Stay under Gmail 1,500/day limit
  VARIANCE_THRESHOLD:       10,      // Minimum variance in ₹ to report
  GVW_UNIT:                 "tonnes", // "tonnes" or "kg" — confirm per broker from source system
  CURRENT_PERIOD:           "",      // Set to "YYYY-MM" at start of each month before running batch

};
