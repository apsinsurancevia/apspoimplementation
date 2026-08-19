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
  FOLDER_ROOT:              "",
  FOLDER_GRIDS:             "",
  FOLDER_INPUT:             "",
  FOLDER_OUTPUT:            "",
  FOLDER_STATEMENTS:        "",
  FOLDER_INVOICES:          "",
  FOLDER_INVOICES_PARTNER:  "",
  FOLDER_INVOICES_INSURER:  "",
  FOLDER_RECONCILIATION:    "",
  FOLDER_MASTERS:           "",
  FOLDER_BACKUP:            "",
  FOLDER_LOG:               "",

  // ── SHEET IDs ─────────────────────────────────────────────────────────────
  // Populated automatically by setup.gs — do not edit manually
  SHEET_PRODUCT_MASTER:     "",
  SHEET_RTO_MASTER:         "",
  SHEET_INSURER_MASTER:     "",
  SHEET_BROKER_CONFIG:      "",
  SHEET_PARTNER_MASTER:     "",
  SHEET_RECONCILIATION:     "",
  SHEET_LOG:                "",

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
