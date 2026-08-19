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
  FOLDER_ROOT:              "1eTGGOWeTa2UDDW97KWLp8jkbPm3E29ga",
  FOLDER_GRIDS:             "1RN40wTc9mbm_owpjbMnPR_f6AAQ7-IGb",
  FOLDER_INPUT:             "1_nreiggRLbt2PVvBHozh9v6MaImAwVcX",
  FOLDER_OUTPUT:            "1nayKtoQ-A47-7A6js8p2r_ofpTbF9q1p",
  FOLDER_STATEMENTS:        "1R4ef11FndMPaB0L240X6qdpO42wS-3CG",
  FOLDER_INVOICES:          "1yNDcN4w0rHGVxf8V9mYxcza-xd09bE89",
  FOLDER_INVOICES_PARTNER:  "1Tn452gPpTDuVUnD1gOnVH8MRQKcLxQBv",
  FOLDER_INVOICES_INSURER:  "1EcJtRgvZRfO-0bLnC0X6I4NRwrOJV6Ua",
  FOLDER_RECONCILIATION:    "16jcqs9iaa3qfKLZNG9TsgtX7dn15AcPp",
  FOLDER_MASTERS:           "1akKWbEMjT7IYo8IcwUmYOWwRQ5qbXe_7",
  FOLDER_BACKUP:            "1TEcaSg7dWUVCf-s_Vo4hEJwqFoO-KII3",
  FOLDER_LOG:               "1DeTkpz83Iy8Ke5xOh27yz50vhauzxZh5",

  // ── SHEET IDs ─────────────────────────────────────────────────────────────
  // Populated automatically by setup.gs — do not edit manually
  SHEET_PRODUCT_MASTER:     "1cLy_LOn7r0ycdC5ngt7PGm6eSkyquLHH6dorEpfXBgo",
  SHEET_RTO_MASTER:         "1MxsTTAb8UGjcnunxxi-pdwm-YXGlzFlg8Zg7CTp8HB4",
  SHEET_INSURER_MASTER:     "1WifGNspoWlND6DCvI6Hw_VO-_vQ7Bb08uuqPA4Sr96s",
  SHEET_BROKER_CONFIG:      "1tyQ8DmCMjOx0WykAhz4TU6Mdyy5fdbVYOrQhYz3b5gQ",
  SHEET_PARTNER_MASTER:     "1MfYrxI-7DNOTeYHYYkB0bOZTlYvh_1mMX4Elxpocalg",
  SHEET_RECONCILIATION:     "1ImilmSWqnrXKT7cdI3l0D3SH9eDog5ZkAv2Ohy0z08I",
  SHEET_LOG:                "11Obz7hrSo4RirUY12Z6YY0i6Ba_HpzenpWa-gFT1R0o",

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
