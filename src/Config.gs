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
  BROKER_NAME:              "",   // Trading name e.g. "APS Insurance Broking"
  BROKER_LEGAL_NAME:        "",   // Legal entity name for invoices
  BROKER_SHORT_CODE:        "",   // 2-4 letters e.g. "APS" — used in file names and invoice prefixes
  BROKER_GSTIN:             "",   // 15-character GSTIN
  BROKER_PAN:               "",   // 10-character PAN
  BROKER_STATE:             "",   // State name e.g. "MAHARASHTRA"
  BROKER_STATE_CODE:        "",   // 2-digit GST state code e.g. "27"
  BROKER_ADDRESS:           "",   // Full registered address for invoices
  BROKER_BANK_NAME:         "",   // Bank name for invoice footer
  BROKER_BANK_ACCOUNT:      "",   // Account number
  BROKER_BANK_IFSC:         "",   // IFSC code
  BROKER_BANK_BRANCH:       "",   // Branch name
  IRDAI_REG_NUMBER:         "",   // IRDAI broker registration number

  // ── TAX & INVOICE ─────────────────────────────────────────────────────────
  DEFAULT_TDS_RATE:         0.05,   // Section 194H — 5% with PAN
  NO_PAN_TDS_RATE:          0.20,   // Section 206AA — 20% without PAN
  DEFAULT_GST_RATE:         0.18,   // 18% GST on commission
  SAC_CODE:                 "997131", // SAC code for insurance distribution services
  PARTNER_INVOICE_PREFIX:   "",   // e.g. "APS-PINV" — partner invoice number prefix
  INSURER_INVOICE_PREFIX:   "",   // e.g. "APS-IINV" — insurer invoice number prefix

  // ── EMAIL ROUTING ─────────────────────────────────────────────────────────
  WORKSPACE_DOMAIN:         "",   // Google Workspace domain e.g. "novoup.com"
  EMAIL_COORDINATOR:        "",   // All errors, alerts, exception reports
  EMAIL_SENDER:             "",   // From address for all outbound emails
  EMAIL_FINANCE:            "",   // Insurer invoices
  EMAIL_RECON:              "",   // Reconciliation reports

  // ── DRIVE FOLDER IDs ──────────────────────────────────────────────────────
  // Populated automatically by setup.gs — do not edit manually
  FOLDER_ROOT:              "15_wrWjP0LcE5t0HPyBySMkP75ghflOdI",
  FOLDER_GRIDS:             "15CJn8xIZBSRBw-e-O8kxZyW0RP7yx2mh",
  FOLDER_INPUT:             "1vEbWYxKgsfvcgfrvNlA2bt_1zRJZ1FII",
  FOLDER_OUTPUT:            "1NqXigXR53Itar0Oo9hlskV8qDgcD6wtU",
  FOLDER_STATEMENTS:        "1MqjFVSbIjbxBtpxGYQmsZhkkCm6YItiJ",
  FOLDER_INVOICES:          "1C6LYc-ck4JQOeddoGM86_6XhzTD2l9X_",
  FOLDER_INVOICES_PARTNER:  "1vS7xvWUq1CbKiCaBoB1O1jbN255VBIYp",
  FOLDER_INVOICES_INSURER:  "1iKB5MI0KeoK-TEfNJtQCVAEg5rseWaL9",
  FOLDER_RECONCILIATION:    "1tWADGbJ9EJKRl3NeVirAmPkcF7itdXq-",
  FOLDER_MASTERS:           "1DZHBZFTBMxHVmeW0-RWYomUJ_uM8v1nh",
  FOLDER_BACKUP:            "1oEX-shlNq9TSe0XIfPRj_pKPpfOs26hI",
  FOLDER_LOG:               "1TxWyL8SVAxZ1oQUAeiz_yreKIuWwm5q0",

  // ── SHEET IDs ─────────────────────────────────────────────────────────────
  // Populated automatically by setup.gs — do not edit manually
  SHEET_PRODUCT_MASTER:     "1F0kwAEEurcwrFMFn5AYj-I71ARDkh_j0MoJEAO2eX0s",
  SHEET_RTO_MASTER:         "1oG8r13qOqj0j1mJlLavxd1_VdTNC3nd9lA6mpaAhqig",
  SHEET_INSURER_MASTER:     "1GvECCDrVFsp_SXvlEZpL7hhO26sdADBVFQYdoTnRMZw",
  SHEET_BROKER_CONFIG:      "1xZgKqKHn9uxsVbTnwqe3gIKSA7_nI1J5xML31DqdcKU",
  SHEET_PARTNER_MASTER:     "1Hmh9URj-FThexpjhTJLuxb0XbuOu_2LZl6nih13Nj5w",
  SHEET_RECONCILIATION:     "1UxNAsDtlnA7EcJSrsVEnhADS8nxtJLSmPnkaHrD6scg",
  SHEET_LOG:                "1gp7RgWIANC13n7QP1JKOcl3MiaZiPUDA73ZxLWGxDfQ",

  // ── CLAUDE API ────────────────────────────────────────────────────────────
  // API key is NEVER stored here — set in Apps Script Script Properties
  // Project Settings → Script Properties → Key: CLAUDE_API_KEY
  CLAUDE_MODEL:             "claude-sonnet-4-6",
  CLAUDE_MAX_TOKENS:        4096,

  // ── PROCESSING ────────────────────────────────────────────────────────────
  EMAIL_BATCH_SIZE:         1400,    // Stay under Gmail 1,500/day limit
  VARIANCE_THRESHOLD:       10,      // Minimum variance in ₹ to report
  GVW_UNIT:                 "tonnes", // "tonnes" or "kg" — confirm per broker from source system
  CURRENT_PERIOD:           "",      // Set to "YYYY-MM" at start of each month before running batch

};
