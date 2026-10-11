/**
 * CaliberPO — Workspace Initialiser
 *
 * Run once per deployment from the Apps Script editor.
 * Creates all Drive folders and Google Sheets needed by the system.
 * Returns a JSON object of all folder and sheet IDs.
 *
 * After running:
 *   1. Copy the JSON from the execution log
 *   2. Run writeConfigIds(jsonString) to populate Config.gs
 */

// ── PRODUCT MASTER SEED DATA ─────────────────────────────────────────────────

var PRODUCT_MASTER_DATA = [
  // TW — one row per sub type × sub sub type
  ['Motor','TW','New (1+5)','Scooter','New Business','Y'],
  ['Motor','TW','New (1+5)','Bike','New Business','Y'],
  ['Motor','TW','New (5+5)','Scooter','New Business','Y'],
  ['Motor','TW','New (5+5)','Bike','New Business','Y'],
  ['Motor','TW','1+1','Scooter','New Business / Renewal','Y'],
  ['Motor','TW','1+1','Bike','New Business / Renewal','Y'],
  ['Motor','TW','SAOD','Scooter','New Business / Renewal','Y'],
  ['Motor','TW','SAOD','Bike','New Business / Renewal','Y'],
  ['Motor','TW','SATP','Scooter','New Business / Renewal','Y'],
  ['Motor','TW','SATP','Bike','New Business / Renewal','Y'],
  // Pvt Car — no sub sub type
  ['Motor','Pvt Car','New (1+3)','','New Business','Y'],
  ['Motor','Pvt Car','New (3+3)','','New Business','Y'],
  ['Motor','Pvt Car','1+1','','New Business / Renewal','Y'],
  ['Motor','Pvt Car','SAOD','','New Business / Renewal','Y'],
  ['Motor','Pvt Car','SATP','','New Business / Renewal','Y'],
  // GCV — one row per sub sub type
  ['Motor','GCV','1+1','3W','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','Water Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','Car Carrier','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','Flatbed','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','Oil Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','3W','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','Water Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','Car Carrier','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','Flatbed','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','Oil Tanker','New Business / Renewal','Y'],
  // PCV — one row per sub sub type
  ['Motor','PCV','1+1','3W','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Taxi 4+1','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Taxi 5+1','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Taxi>7','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Bus<12','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Bus>12<36','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Bus>36','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','School Bus','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Staff Bus','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','3W','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','Taxi 4+1','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','Bus<12','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','Bus>36','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','School Bus','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','Staff Bus','New Business / Renewal','Y'],
  // Tractor — one row per sub sub type
  ['Misc D','Tractor','1+1','Excavator','New Business / Renewal','Y'],
  ['Misc D','Tractor','1+1','Harvester','New Business / Renewal','Y'],
  ['Misc D','Tractor','1+1','Agri Tractor','New Business / Renewal','Y'],
  ['Misc D','Tractor','SATP','Excavator','New Business / Renewal','Y'],
  ['Misc D','Tractor','SATP','Harvester','New Business / Renewal','Y'],
  ['Misc D','Tractor','SATP','Agri Tractor','New Business / Renewal','Y'],
  // Construction Eqpt — no sub sub type
  ['Misc D','Construction Eqpt','1+1','','New Business / Renewal','Y'],
  ['Misc D','Construction Eqpt','SATP','','New Business / Renewal','Y']
];

// ── INSURER MASTER SEED DATA ──────────────────────────────────────────────────

var INSURER_MASTER_DATA = [
  ['OR','THE ORIENTAL INSURANCE CO LTD','[GSTIN]','DELHI','DL','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['NIC','NATIONAL INSURANCE CO LTD','[GSTIN]','WEST BENGAL','WB','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['UIIC','UNITED INDIA INSURANCE CO LTD','[GSTIN]','TAMILNADU','TN','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['USGI','UNIVERSAL SOMPO GENERAL INSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['TATA','TATA AIG GENERAL INSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['BAJAJ','BAJAJ ALLIANZ GENERAL INSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['GO','GO DIGIT GENERAL INSURANCE LTD','[GSTIN]','KARNATAKA','KA','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['INDUSIND','INDUSIND GENERAL INSURANCE CO LTD','[GSTIN]','[STATE]','[CODE]','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['NIA','THE NEW INDIA ASSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['ICICI','ICICI LOMBARD GENERAL INSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['KOTAK','ZURICH KOTAK GENERAL INSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['SBIG','SBI GENERAL INSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y']
];

// ── FIELD MAPPING SEED DATA ───────────────────────────────────────────────────

var FIELD_MAPPING_DATA = [
  ['Posp Id','partner_id','none','Join key to Partner Master and rate grid — critical'],
  ['Posp','partner_name','none',''],
  ['System Policy Uid','sys_ref_no','none',''],
  ['Policy Number','policy_no','none',''],
  ['Insurer','insurance_company','insurer_code_map','Full name to code via Insurer_Code_Map tab'],
  ['Product','product','none',''],
  ['Product Type','product_type','product_map','Via Product_Map tab'],
  ['Product Sub Type','product_sub_type','product_map','Via Product_Map tab'],
  ['Issue Date','policy_issue_date','date_format','Normalise to YYYY-MM-DD'],
  ['Business Type','business_type','none','New / Renewal — carried through'],
  ['Vehicle Rta','rto','rto_normalise','XX00 to XX-00 hyphenated format'],
  ['Model','vehicle_model','none','Used for sub-sub-type derivation'],
  ['Make Year','make_year','none','Integer year — for New/Old derivation'],
  ['Vehicle Fuel Type','vehicle_fuel_type','none','EV identification'],
  ['Vehicle Cc','vehicle_cc','none','Integer cc — for TW CC range matching'],
  ['Vehicle Gvw','vehicle_gvw','gvw_normalise','Normalise to tonnes per GVW_UNIT config'],
  ['Vehicle Seating Capacity','vehicle_seating','none','For PCV seating range matching'],
  ['Total Premium','gross_premium','none','Gross premium — fallback base'],
  ['Net Premium','net_premium','none','Primary commission base for TW'],
  ['Total Od Premium','od_premium','none','OD component — for OD-rate grids'],
  ['Total Tp Premium','tp_premium','none','TP component — for TP-rate grids']
];

// ── INSURER CODE MAP SEED DATA ────────────────────────────────────────────────

var INSURER_CODE_MAP_DATA = [
  ['OR','OR','Direct match'],
  ['ORIENTAL','OR','Alternate label'],
  ['The Oriental Insurance Co Ltd','OR','Full name variant'],
  ['Oriental','OR','Short name variant'],
  ['NIC','NIC','Direct match'],
  ['NATIONAL','NIC','Alternate label'],
  ['National Insurance','NIC','Short name variant'],
  ['UIIC','UIIC','Direct match'],
  ['UNITED INDIA','UIIC','Alternate label'],
  ['United India Insurance','UIIC','Short name variant'],
  ['USGI','USGI','Direct match'],
  ['UNIV. SOMPO','USGI','Rate card label'],
  ['Universal Sompo','USGI','Short name variant'],
  ['TATA AIG','TATA','Rate card label'],
  ['TATA','TATA','Short label'],
  ['Tata AIG','TATA','Mixed case variant'],
  ['BAJAJ','BAJAJ','Direct match'],
  ['Bajaj Allianz','BAJAJ','Short name variant'],
  ['GO','GO','Direct match'],
  ['Go Digit','GO','Short name variant'],
  ['GO DIGIT','GO','Uppercase variant'],
  ['INDUSIND','INDUSIND','Direct match'],
  ['IND','INDUSIND','Rate card short label'],
  ['IndusInd','INDUSIND','Mixed case variant'],
  ['Reliance General','INDUSIND','Former name — rebranded to IndusInd'],
  ['RELIANCE GENERAL','INDUSIND','Former name uppercase'],
  ['Reliance General Insurance','INDUSIND','Former full name'],
  ['RGICL','INDUSIND','Former rate card code'],
  ['NIA','NIA','Direct match'],
  ['NEW INDIA','NIA','Alternate label'],
  ['New India','NIA','Short name variant'],
  ['ICICI','ICICI','Direct match'],
  ['ICICI Lombard','ICICI','Short name variant'],
  ['ICICI LOMBARD','ICICI','Uppercase variant'],
  ['IL','ICICI','Rate card short label'],
  ['KOTAK','KOTAK','Direct match'],
  ['Kotak General','KOTAK','Short name variant'],
  ['KOTAK GENERAL','KOTAK','Uppercase variant'],
  ['Kotak Mahindra General','KOTAK','Former full name variant'],
  ['Zurich Kotak','KOTAK','Current rebranded name'],
  ['ZURICH KOTAK','KOTAK','Current rebranded uppercase'],
  ['Zurich Kotak General Insurance','KOTAK','Current full name'],
  ['ZKGI','KOTAK','GST / rate card abbreviation'],
  ['SBIG','SBIG','Direct match'],
  ['SBI General','SBIG','Short name variant'],
  ['SBI GENERAL','SBIG','Uppercase variant'],
  ['SBI General Insurance','SBIG','Full name variant'],
  ['SBI GENERAL INSURANCE','SBIG','Full name uppercase']
];

// ── PRODUCT MAP SEED DATA ─────────────────────────────────────────────────────

var PRODUCT_MAP_DATA = [
  ['Product Type','Two Wheeler','product_type','TW',''],
  ['Product Type','Tractor','product_type','Tractor','Misc D vertical'],
  ['Product Type','GCV','product_type','GCV',''],
  ['Product Type','PCV','product_type','PCV',''],
  ['Product Type','Private Car','product_type','Pvt Car',''],
  ['Product Type','Car','product_type','Pvt Car','Short label variant'],
  ['Product Type','Commercial Vehicle','product_type','GCV','Default to GCV if unspecified'],
  ['Product Sub Type','Bike','product_sub_type','Scooter/Bike',''],
  ['Product Sub Type','Scooter','product_sub_type','Scooter/Bike',''],
  ['Product Sub Type','EV','product_sub_type','Scooter/Bike','Flag vehicle_fuel_type as Electric'],
  ['Product Sub Type','Electric','product_sub_type','Scooter/Bike',''],
  ['Product Sub Type','New','product_sub_type','1+1','New business — also check make_year'],
  ['Product Sub Type','Old','product_sub_type','1+1','Renewal — prior year make'],
  ['Product Sub Type','SAOD','product_sub_type','SAOD','Direct match'],
  ['Product Sub Type','SATP','product_sub_type','SATP','Direct match'],
  ['Product Sub Type','1+1','product_sub_type','1+1','Direct match'],
  ['Product Sub Type','New (1+5)','product_sub_type','New (1+5)','Direct match'],
  ['Product Sub Type','New (5+5)','product_sub_type','New (5+5)','Direct match']
];

// ── STATEMENT HEADERS SEED DATA ──────────────────────────────────────────────
// Maps each insurer's actual statement column names to CaliberPO canonical fields.
// Used by seedDefaultPrompts() and the Python invoice generator.
//
// Columns: insurer_id | file_format | sheet_name | header_row
//        | policy_no_col | brokerage_col | premium_col
//        | insured_name_col | date_col | notes

var STATEMENT_HEADERS_DATA = [
  [
    'OR', 'pdf', '', 1,
    'Policy No.',
    'Comm. (Rs.) (Ref.)',
    'Premium (Rs.) (Ref.)',
    'Insured Name',
    'Policy Expiry Date',
    'PDF — structurally noisy; each policy spans TWO STACKED PHYSICAL LINES (not clean table rows): line 1 has Policy No./Colln. No./Insured Name; line 2 has Premium and Comm. figures split by OD/TP. Header block and broker details block repeat on every page. Footer has Department Total, Grand Total, cumulative figures. Requires special parsing — flag before building master-grid mapper.'
  ],
  [
    'NIC', 'pdf', '', 1,
    'Policy #-Endo#',
    'Commission Amount',
    'Premium Amount',
    'Insured Name',
    'Effective Date',
    'PDF; header block (Sales Channel / Office / License) and Grand Total footer row are irrelevant — extract data table rows only; Commission Amount = OD/Other Commission + TP/Terr. Comm combined'
  ],
  [
    'UIIC', 'xlsx', 'Sheet1', 1,
    'Policy No',
    'Comm Amt',
    'Premium Amt',
    'Insured Name',
    'Policy Exp Dt',
    'Dep No differentiates OD (31 - Motor) from TP (32 - Motor TP) rows; sum Comm Amt and Premium Amt across both rows per Policy No; Terrsm Loading is terrorism premium info only — no separate terrorism commission column; Comm Amt is the all-in total'
  ],
  [
    'USGI', 'xlsx', 'MOTOR', 2,
    'policyNo',
    'total_amount',
    'net_Premium',
    'customer_Name',
    'policy_Issue_Date',
    'Two sheets MOTOR + NON-MOTOR — header row is row 2; total_amount is final aggregate (after final_grid_payable + Total Instant Commission); customer_Name appears twice in headers (duplicate column — use first); co_Insurance_Type present — skip follower/co-insurance rows'
  ],
  [
    'TATA', 'xlsx', 'Report', 1,
    'Policy_No',
    'Total_commission',
    'Total_Premium',
    'Customer_name',
    'Policy_issue_date',
    'Skip table_name=TDS rows; skip rows where Subproducer_Code is non-empty; skip rows where Coinsurance_Flag indicates follower; Total_commission = OD_Commission + TP_Terrorism_commission (pre-summed); dedup by Policy_No+table_name'
  ],
  [
    'BAJAJ', 'xlsx', 'irdaPayoutReport', 5,
    'POLICY_REFERENCE',
    'TOTAL COMMISSION',
    'NET PREMIUM',
    'CUSTOMER NAME',
    'POLICY DATE',
    'Data starts at row 5 (first 4 rows blank); skip rows where TOTAL COMMISSION is 0 or blank'
  ],
  [
    'GO', 'xlsb', 'AAZCA5637P', 1,
    'policy_number',
    'TOTAL_AMT',
    'net_premium',
    'policy_holder',
    'policy_issue_date',
    'TOTAL_AMT = IRDA_AMT + REWARD_AMT; product_lob has LOB; all column names are lowercase except commission cols'
  ],
  [
    'INDUSIND', 'xlsx', '', 1,
    'PolicyNumber',
    'FinalIRDAComm+RewardCommission+FinalTPComm+FinalTerrorismComm',
    'NET_PREMIUM',
    'InsuredName',
    'Month',
    'No pre-summed total column — brokerage = FinalIRDAComm + RewardCommission + FinalTPComm + FinalTerrorismComm; formerly Reliance General Insurance'
  ],
  [
    'NIA', 'pdf', '', 1,
    'Policy Number',
    'Brokerage',
    'Premium',
    'Insured Name',
    'Policy Inception Date',
    'PDF has two tables: (1) Policy-level detail — extract this; (2) Tax summary — ignore entirely; header block (Broker Code/Name/License/GSTIN) is also irrelevant'
  ],
  [
    'ICICI', 'csv', '', 1,
    'POLICY_NUMBER',
    'ACTUAL_COMMISSION',
    'GWP',
    'INSURED_CUSTOMER_NAME',
    'POLICY_START_DATE',
    'CSV format; filter TRANSACTION_STATUS — skip reversed/cancelled rows; ACTUAL_COMMISSION includes both OD (ACTUAL_COMPR_OD_COMM) and TP (ACTUAL_COMPR_TP_COMM) components'
  ],
  [
    'KOTAK', 'csv', '', 1,
    'POLICY NO',
    'Total Commission',
    'OUR SHARE OF PREMIUM GWP',
    'CUSTOMER NAME',
    'Policy/Endorsement Issue Date',
    'Formerly Kotak General / Kotak Mahindra General, now Zurich Kotak General Insurance (ZKGI); Total Commission = OD/Basic commission + Motor TP commission + Terrisom commission (pre-TDS); Net Commission is post-TDS — do NOT use; TDS already deducted in Net Commission'
  ],
  [
    'SBIG', 'xlsx', '', 1,
    'POLICY_NO',
    'TOTAL_COMMISSION_AMOUNT',
    'GROSS_PREMIUM',
    'INSURED_NAME',
    'POLICY_ISSUE_DATE',
    'TOTAL_COMMISSION_AMOUNT = FIXED_COMMISSION_AMOUNT + TERRORISM_COMMISSION_AMT (pre-summed); for co-insurance rows include only where PAY_COMMISSION_TO_LEADER indicates leader; skip rows where TOTAL_COMMISSION_AMOUNT is 0 or blank'
  ]
];

// ── INSURER STATUS SEED DATA ──────────────────────────────────────────────────
// Master tracking view. Update this tab in the sheet as each item is completed.
// Columns: insurer_id | insurer_name | data_configured | grid_configured
//        | statement_configured | notes | last_updated
//
// data_configured  = Y once GSTIN, address, SPOC email filled in Insurer Master
// grid_configured  = Y once rate grids uploaded and validated
// statement_configured = Y / Pending / N

var INSURER_STATUS_DATA = [
  ['OR',      'THE ORIENTAL INSURANCE CO LTD',              'N','N','Y',      'PDF — two stacked physical lines per policy; special parser needed when building master-grid mapper',      '2026-10-11'],
  ['NIC',     'NATIONAL INSURANCE CO LTD',                  'N','N','Y',      'PDF — header block + Grand Total footer; 11-col data table confirmed',                                    '2026-10-11'],
  ['UIIC',    'UNITED INDIA INSURANCE CO LTD',              'N','N','Y',      'Excel Sheet1; 11 cols; OD (Dep 31) + TP (Dep 32) rows summed per policy',                                '2026-10-11'],
  ['USGI',    'UNIVERSAL SOMPO GENERAL INSURANCE CO LTD',   'N','N','Y',      'Excel 2 sheets (MOTOR+NON-MOTOR, header row 2); 130+ cols; customer_Name appears twice',               '2026-10-11'],
  ['TATA',    'TATA AIG GENERAL INSURANCE CO LTD',          'N','N','Y',      '3 filters: table_name≠TDS, Subproducer_Code blank, Coinsurance_Flag≠Follower',                         '2026-10-11'],
  ['BAJAJ',   'BAJAJ ALLIANZ GENERAL INSURANCE CO LTD',     'N','N','Pending','Awaiting statement from client — column names not yet confirmed',                                        '2026-10-11'],
  ['GO',      'GO DIGIT GENERAL INSURANCE LTD',             'N','N','Y',      'xlsb format; TOTAL_AMT = IRDA_AMT + REWARD_AMT; 80+ cols confirmed',                                   '2026-10-11'],
  ['INDUSIND','INDUSIND GENERAL INSURANCE CO LTD',          'N','N','Y',      'Formerly Reliance General; brokerage = sum of 4 cols (FinalIRDAComm+RewardComm+FinalTPComm+FinalTerrComm)','2026-10-11'],
  ['NIA',     'THE NEW INDIA ASSURANCE CO LTD',             'N','N','Y',      'PDF — 2 tables; extract Policy-level detail only; ignore Tax summary',                                  '2026-10-11'],
  ['ICICI',   'ICICI LOMBARD GENERAL INSURANCE CO LTD',     'N','N','Y',      'CSV; 63 cols; filter TRANSACTION_STATUS (skip reversed/cancelled)',                                     '2026-10-11'],
  ['KOTAK',   'ZURICH KOTAK GENERAL INSURANCE CO LTD',      'N','N','Y',      'Formerly Kotak/Kotak Mahindra; use Total Commission (pre-TDS), not Net Commission',                    '2026-10-11'],
  ['SBIG',    'SBI GENERAL INSURANCE CO LTD',               'N','N','Y',      '53 cols; co-insurance: PAY_COMMISSION_TO_LEADER = leader rows only',                                   '2026-10-11']
];

// ── DERIVATION RULES SEED DATA ────────────────────────────────────────────────

var DERIVATION_RULES_DATA = [
  ['model_keyword','Activa','Scooter','Honda Activa'],
  ['model_keyword','Dio','Scooter','Honda Dio'],
  ['model_keyword','Access','Scooter','Suzuki Access'],
  ['model_keyword','Maestro','Scooter','Hero Maestro'],
  ['model_keyword','Jupiter','Scooter','TVS Jupiter'],
  ['model_keyword','Ntorq','Scooter','TVS Ntorq'],
  ['model_keyword','Aviator','Scooter','Honda Aviator'],
  ['model_keyword','Pleasure','Scooter','Hero Pleasure'],
  ['model_keyword','Ray','Scooter','Yamaha Ray'],
  ['model_keyword','Burgman','Scooter','Suzuki Burgman'],
  ['model_keyword','Fascino','Scooter','Yamaha Fascino'],
  ['model_keyword','Grazia','Scooter','Honda Grazia'],
  ['model_keyword','Destini','Scooter','Hero Destini'],
  ['model_keyword','Chetak','Scooter','Bajaj Chetak EV'],
  ['model_keyword','Ola S1','Scooter','Ola Electric'],
  ['model_keyword','Ather','Scooter','Ather EV scooter']
];

// ── MAIN FUNCTION ─────────────────────────────────────────────────────────────

/**
 * Main entry point. Run from Apps Script editor.
 * Creates all folders and sheets. Returns JSON of all IDs.
 */
function runSetup() {
  try {
    Logger.log('CaliberPO Setup starting...');

    var ids = {
      folders: {},
      sheets: {}
    };

    // Step 1: Create Drive folder structure
    Logger.log('Step 1: Creating folder structure...');
    ids.folders = createFolderStructure_();

    // Step 2: Create Product Master
    Logger.log('Step 2: Creating Product Master...');
    ids.sheets.PRODUCT_MASTER = createProductMaster_(ids.folders.MASTERS);

    // Step 3: Create RTO Master (headers only — data seeded separately)
    Logger.log('Step 3: Creating RTO Master...');
    ids.sheets.RTO_MASTER = createRTOMaster_(ids.folders.MASTERS);

    // Step 4: Create Insurer Master
    Logger.log('Step 4: Creating Insurer Master...');
    ids.sheets.INSURER_MASTER = createInsurerMaster_(ids.folders.MASTERS);

    // Step 5: Create Broker Config Sheet
    Logger.log('Step 5: Creating Broker Config Sheet...');
    ids.sheets.BROKER_CONFIG = createBrokerConfig_(ids.folders.CONFIG);

    // Step 6: Create Partner Master
    Logger.log('Step 6: Creating Partner Master...');
    ids.sheets.PARTNER_MASTER = createPartnerMaster_(ids.folders.CONFIG);

    // Step 7: Create Log Sheet
    Logger.log('Step 7: Creating Log Sheet...');
    ids.sheets.LOG = createLogSheet_(ids.folders.LOG);

    // Step 8: Create Reconciliation Sheet
    Logger.log('Step 8: Creating Reconciliation Sheet...');
    ids.sheets.RECONCILIATION = createReconciliationSheet_(ids.folders.RECONCILIATION);

    var output = JSON.stringify(ids, null, 2);
    Logger.log('=== SETUP COMPLETE ===');
    Logger.log('Copy the JSON below and run writeConfigIds() with it:');
    Logger.log(output);

    return output;

  } catch (e) {
    Logger.log('SETUP FAILED: ' + e.message + '\n' + e.stack);
    throw e;
  }
}

// ── FOLDER CREATION ───────────────────────────────────────────────────────────

function createFolderStructure_() {
  // Use the folder that contains this script — works for every deployment
  var scriptFile = DriveApp.getFileById(ScriptApp.getScriptId());
  var root = scriptFile.getParents().next();
  Logger.log('Root folder: ' + root.getName() + ' (' + root.getId() + ')');

  var folders = {
    ROOT:            root.getId(),
    MASTERS:         getOrCreateFolder_(root, 'Masters').getId(),
    CONFIG:          getOrCreateFolder_(root, 'Config').getId(),
    GRIDS:           getOrCreateFolder_(root, 'Grids').getId(),
    GRID_IMPORT:     getOrCreateFolder_(root, 'Grid Import').getId(),
    GRID_ARCHIVE:    getOrCreateFolder_(root, 'Grid Archive').getId(),
    INPUT:           getOrCreateFolder_(root, 'Input').getId(),
    OUTPUT:          getOrCreateFolder_(root, 'Output').getId(),
    STATEMENTS:      getOrCreateFolder_(root, 'Statements').getId(),
    INVOICES:        getOrCreateFolder_(root, 'Invoices').getId(),
    RECONCILIATION:  getOrCreateFolder_(root, 'Reconciliation').getId(),
    BACKUP:          getOrCreateFolder_(root, 'Backup').getId(),
    LOG:             getOrCreateFolder_(root, 'Log').getId()
  };

  // Invoices subfolders
  var invoicesFolder = DriveApp.getFolderById(folders.INVOICES);
  folders.INVOICES_PARTNER = getOrCreateFolder_(invoicesFolder, 'Partner').getId();
  folders.INVOICES_INSURER = getOrCreateFolder_(invoicesFolder, 'Insurer').getId();

  Logger.log('Folders created: ' + Object.keys(folders).length);
  return folders;
}

/**
 * Gets an existing folder by name under parent, or creates it if not found.
 * Prevents duplicate folder creation on re-runs.
 */
function getOrCreateFolder_(parentFolder, folderName) {
  var existing = parentFolder.getFoldersByName(folderName);
  if (existing.hasNext()) {
    Logger.log('Folder exists: ' + folderName);
    return existing.next();
  }
  Logger.log('Creating folder: ' + folderName);
  return parentFolder.createFolder(folderName);
}

// ── SHEET CREATION HELPERS ────────────────────────────────────────────────────

/**
 * Creates a new Google Sheet in the specified folder.
 * If a sheet with the same name already exists in that folder, returns its ID.
 */
function getOrCreateSheet_(folderId, sheetName) {
  var folder = DriveApp.getFolderById(folderId);
  var existing = folder.getFilesByName(sheetName);
  if (existing.hasNext()) {
    var existingFile = existing.next();
    Logger.log('Sheet exists: ' + sheetName + ' (' + existingFile.getId() + ')');
    return SpreadsheetApp.openById(existingFile.getId());
  }
  Logger.log('Creating sheet: ' + sheetName);
  var ss = SpreadsheetApp.create(sheetName);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  return ss;
}

/**
 * Sets up a tab: renames it, sets headers with styling, returns the sheet.
 */
function setupTab_(ss, tabName, headers, headerColor, fontColor) {
  var sheet = ss.getSheets()[0];
  sheet.setName(tabName);

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground(headerColor || '#1F3864');
  headerRange.setFontColor(fontColor || '#FFFFFF');
  sheet.setFrozenRows(1);

  return sheet;
}

/**
 * Adds a new tab to an existing spreadsheet with headers.
 */
function addTab_(ss, tabName, headers, headerColor) {
  var existing = ss.getSheetByName(tabName);
  if (existing) {
    Logger.log('Tab exists: ' + tabName);
    return existing;
  }
  var sheet = ss.insertSheet(tabName);
  if (headers && headers.length > 0) {
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground(headerColor || '#1F3864');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── INDIVIDUAL SHEET CREATORS ─────────────────────────────────────────────────

function createProductMaster_(folderId) {
  var ss = getOrCreateSheet_(folderId, 'Product Master');
  var headers = ['product_vertical','product_type','product_sub_type','product_sub_sub_type','policy_type','active'];
  var sheet = setupTab_(ss, 'Motor', headers, '#1F3864', '#FFFFFF');

  // Clear existing data below header
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  }
  sheet.getRange(2, 1, PRODUCT_MASTER_DATA.length, headers.length).setValues(PRODUCT_MASTER_DATA);
  Logger.log('Product Master seeded: ' + PRODUCT_MASTER_DATA.length + ' rows');
  return ss.getId();
}

function createRTOMaster_(folderId) {
  var ss = getOrCreateSheet_(folderId, 'RTO Master');
  var headers = ['rto_id','rto_city','state_name','rto_code','state_code'];
  setupTab_(ss, 'RTO', headers, '#1F3864', '#FFFFFF');
  Logger.log('RTO Master created (headers only). Run importRTOMaster() to seed data.');
  return ss.getId();
}

function createInsurerMaster_(folderId) {
  var ss = getOrCreateSheet_(folderId, 'Insurer Master');
  var headers = ['insurer_id','insurer_name','insurer_gstin','insurer_state','insurer_state_code','insurer_address','sac_code','spoc_email','active'];
  var sheet = setupTab_(ss, 'Insurers', headers, '#1F3864', '#FFFFFF');

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  }
  sheet.getRange(2, 1, INSURER_MASTER_DATA.length, headers.length).setValues(INSURER_MASTER_DATA);
  Logger.log('Insurer Master seeded: ' + INSURER_MASTER_DATA.length + ' rows');
  return ss.getId();
}

function createBrokerConfig_(folderId) {
  var ss = getOrCreateSheet_(folderId, 'CaliberPO Config');

  // Tab 1: Field_Mapping
  var fmSheet = setupTab_(ss, 'Field_Mapping',
    ['broker_field','standard_field','transform','notes'], '#0066cc', '#FFFFFF');
  if (fmSheet.getLastRow() > 1) {
    fmSheet.getRange(2, 1, fmSheet.getLastRow() - 1, 4).clearContent();
  }
  fmSheet.getRange(2, 1, FIELD_MAPPING_DATA.length, 4).setValues(FIELD_MAPPING_DATA);

  // Tab 2: Insurer_Code_Map
  var icmSheet = addTab_(ss, 'Insurer_Code_Map',
    ['broker_value','caliber_insurer_id','notes'], '#0066cc');
  if (icmSheet.getLastRow() > 1) {
    icmSheet.getRange(2, 1, icmSheet.getLastRow() - 1, 3).clearContent();
  }
  icmSheet.getRange(2, 1, INSURER_CODE_MAP_DATA.length, 3).setValues(INSURER_CODE_MAP_DATA);

  // Tab 3: Product_Map
  var pmSheet = addTab_(ss, 'Product_Map',
    ['broker_field','broker_value','caliber_field','caliber_value','notes'], '#0066cc');
  if (pmSheet.getLastRow() > 1) {
    pmSheet.getRange(2, 1, pmSheet.getLastRow() - 1, 5).clearContent();
  }
  pmSheet.getRange(2, 1, PRODUCT_MAP_DATA.length, 5).setValues(PRODUCT_MAP_DATA);

  // Tab 4: Derivation_Rules
  var drSheet = addTab_(ss, 'Derivation_Rules',
    ['rule_type','keyword','derived_value','notes'], '#0066cc');
  if (drSheet.getLastRow() > 1) {
    drSheet.getRange(2, 1, drSheet.getLastRow() - 1, 4).clearContent();
  }
  drSheet.getRange(2, 1, DERIVATION_RULES_DATA.length, 4).setValues(DERIVATION_RULES_DATA);

  // Tab 5: Counters
  var ctrSheet = addTab_(ss, 'Counters',
    ['counter_name','current_value'], '#375623');
  if (ctrSheet.getLastRow() > 1) {
    ctrSheet.getRange(2, 1, ctrSheet.getLastRow() - 1, 2).clearContent();
  }
  ctrSheet.getRange(2, 1, 2, 2).setValues([
    ['PARTNER_INVOICE_COUNTER', 0],
    ['INSURER_INVOICE_COUNTER', 0]
  ]);

  // Tab 6: Insurer_Status — master tracking view
  var isSheet = addTab_(ss, 'Insurer_Status', [
    'insurer_id','insurer_name','data_configured','grid_configured',
    'statement_configured','notes','last_updated'
  ], '#1a4971');
  if (isSheet.getLastRow() > 1) {
    isSheet.getRange(2, 1, isSheet.getLastRow() - 1, 7).clearContent();
  }
  isSheet.getRange(2, 1, INSURER_STATUS_DATA.length, 7).setValues(INSURER_STATUS_DATA);
  isSheet.setColumnWidth(1, 90);
  isSheet.setColumnWidth(2, 280);
  isSheet.setColumnWidth(3, 120);
  isSheet.setColumnWidth(4, 110);
  isSheet.setColumnWidth(5, 150);
  isSheet.setColumnWidth(6, 420);
  isSheet.setColumnWidth(7, 90);

  // Traffic-light conditional formatting on status columns C, D, E
  var statusRows = INSURER_STATUS_DATA.length;
  var statusRangesCDE = [
    isSheet.getRange(2, 3, statusRows, 3)
  ];
  var cfRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Y')
      .setBackground('#c6efce').setFontColor('#276221')
      .setRanges(statusRangesCDE).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Pending')
      .setBackground('#ffeb9c').setFontColor('#7a4f00')
      .setRanges([isSheet.getRange(2, 5, statusRows, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('N')
      .setBackground('#ffc7ce').setFontColor('#9c0006')
      .setRanges(statusRangesCDE).build()
  ];
  isSheet.setConditionalFormatRules(cfRules);

  // Tab 7: Statement_Headers
  var shSheet = addTab_(ss, 'Statement_Headers', [
    'insurer_id','file_format','sheet_name','header_row',
    'policy_no_col','brokerage_col','premium_col',
    'insured_name_col','date_col','notes'
  ], '#1a4971');
  if (shSheet.getLastRow() > 1) {
    shSheet.getRange(2, 1, shSheet.getLastRow() - 1, 10).clearContent();
  }
  shSheet.getRange(2, 1, STATEMENT_HEADERS_DATA.length, 10).setValues(STATEMENT_HEADERS_DATA);

  // Tab 7: Prompts
  addTab_(ss, 'Prompts',
    ['insurer_id','prompt_template','notes'], '#444444');

  Logger.log('Broker Config Sheet created with 8 tabs');
  return ss.getId();
}

function createPartnerMaster_(folderId) {
  var ss = getOrCreateSheet_(folderId, 'Partner Master');
  var headers = [
    'posp_id','posp_name','dealer_name','manager','rm',
    'partner_email','partner_mobile','pan_number','gstin',
    'partner_legal_name','partner_address','partner_state','partner_state_code','partner_pan',
    'bank_account_name','bank_name','bank_branch','account_number','ifsc_code','account_type',
    'tds_rate_override','active','statement_sent','utr_number','payment_date'
  ];
  setupTab_(ss, 'Partners', headers, '#1F3864', '#FFFFFF');
  Logger.log('Partner Master created: ' + headers.length + ' columns');
  return ss.getId();
}

function createLogSheet_(folderId) {
  var ss = getOrCreateSheet_(folderId, 'CaliberPO Log');

  // Tab 1: Log_Active
  setupTab_(ss, 'Log_Active', [
    'timestamp','function_name','caller_type','insurer_id',
    'product_type','rto','match_type','match_status','response_ms','notes',
    'fuel_type','yom'
  ], '#1a1a2e', '#FFFFFF');

  // Tab 2: Log_Summary
  addTab_(ss, 'Log_Summary', [
    'period','total_calls','matched','no_match','errors','avg_response_ms'
  ], '#1a1a2e');

  // Tab 3: Log_Dashboard (empty — formulas added manually)
  addTab_(ss, 'Log_Dashboard', [], '#1a1a2e');

  // Tab 4: processed_policies
  addTab_(ss, 'processed_policies', [
    'policy_no','period','processed_at','source_file'
  ], '#375623');

  // Tab 5: Run_Log — system operational log; protected from manual edits
  setupTab_(ss, 'Run_Log', [
    'timestamp','function_name','trigger_type','run_status',
    'error_message','error_function','duration_seconds'
  ], '#4a1942', '#FFFFFF');
  var runLogSheet = ss.getSheetByName('Run_Log');
  if (runLogSheet) {
    var protection = runLogSheet.protect().setDescription('Run_Log — written by system only');
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
  }

  Logger.log('Log Sheet created with 5 tabs');
  return ss.getId();
}

function createReconciliationSheet_(folderId) {
  var ss = getOrCreateSheet_(folderId, 'Reconciliation');
  // First tab is a summary/index — individual insurer tabs added by Reconciliation.gs
  setupTab_(ss, 'Index', [
    'insurer_id','insurer_name','last_run','total_outstanding','total_variance','notes'
  ], '#1a1a2e', '#FFFFFF');
  Logger.log('Reconciliation Sheet created');
  return ss.getId();
}

// ── CONFIG UPDATER ────────────────────────────────────────────────────────────

/**
 * Call this after runSetup() with the JSON output.
 * Updates Config.gs with real folder and sheet IDs.
 *
 * Usage: writeConfigIds('{"folders":{...},"sheets":{...}}')
 */
function writeConfigIds(jsonString) {
  try {
    var ids = JSON.parse(jsonString);
    var f = ids.folders;
    var s = ids.sheets;

    Logger.log('writeConfigIds called. Folder IDs: ' + JSON.stringify(f));
    Logger.log('Sheet IDs: ' + JSON.stringify(s));
    Logger.log('');
    Logger.log('=== COPY THESE VALUES INTO Config.gs ===');
    Logger.log('FOLDER_ROOT:             "' + (f.ROOT || '') + '",');
    Logger.log('FOLDER_GRIDS:            "' + (f.GRIDS || '') + '",');
    Logger.log('FOLDER_GRID_IMPORT:      "' + (f.GRID_IMPORT || '') + '",');
    Logger.log('FOLDER_GRID_ARCHIVE:     "' + (f.GRID_ARCHIVE || '') + '",');
    Logger.log('FOLDER_INPUT:            "' + (f.INPUT || '') + '",');
    Logger.log('FOLDER_OUTPUT:           "' + (f.OUTPUT || '') + '",');
    Logger.log('FOLDER_STATEMENTS:       "' + (f.STATEMENTS || '') + '",');
    Logger.log('FOLDER_INVOICES:         "' + (f.INVOICES || '') + '",');
    Logger.log('FOLDER_INVOICES_PARTNER: "' + (f.INVOICES_PARTNER || '') + '",');
    Logger.log('FOLDER_INVOICES_INSURER: "' + (f.INVOICES_INSURER || '') + '",');
    Logger.log('FOLDER_RECONCILIATION:   "' + (f.RECONCILIATION || '') + '",');
    Logger.log('FOLDER_MASTERS:          "' + (f.MASTERS || '') + '",');
    Logger.log('FOLDER_BACKUP:           "' + (f.BACKUP || '') + '",');
    Logger.log('FOLDER_LOG:              "' + (f.LOG || '') + '",');
    Logger.log('SHEET_PRODUCT_MASTER:    "' + (s.PRODUCT_MASTER || '') + '",');
    Logger.log('SHEET_RTO_MASTER:        "' + (s.RTO_MASTER || '') + '",');
    Logger.log('SHEET_INSURER_MASTER:    "' + (s.INSURER_MASTER || '') + '",');
    Logger.log('SHEET_BROKER_CONFIG:     "' + (s.BROKER_CONFIG || '') + '",');
    Logger.log('SHEET_PARTNER_MASTER:    "' + (s.PARTNER_MASTER || '') + '",');
    Logger.log('SHEET_RECONCILIATION:    "' + (s.RECONCILIATION || '') + '",');
    Logger.log('SHEET_LOG:               "' + (s.LOG || '') + '",');
    Logger.log('=== END — paste these into Config.gs ===');

  } catch (e) {
    Logger.log('writeConfigIds failed: ' + e.message);
    throw e;
  }
}

// ── INSURER STATUS REFRESH ────────────────────────────────────────────────────

/**
 * Auto-refreshes the Insurer_Status tab by checking live data.
 * Run from Apps Script editor any time — safe to re-run repeatedly.
 *
 * data_configured  — checks Insurer Master: Y if GSTIN + address + SPOC email
 *                    all filled (no [placeholder] values); Partial if some filled
 * grid_configured  — checks Grids Drive folder: Y if file exists and has data
 *                    rows; Partial if file exists but empty
 * statement_configured — checks Statement_Headers tab: Y if policy_no_col is
 *                    non-blank; Pending if blank
 */
function refreshInsurerStatus() {
  return wrapWithErrorHandling('refreshInsurerStatus', function() {

    var configSS    = SpreadsheetApp.openById(CONFIG.SHEET_BROKER_CONFIG);
    var statusSheet = configSS.getSheetByName('Insurer_Status');
    if (!statusSheet) throw new Error('Insurer_Status tab not found. Run runSetup() first.');

    // ── Load reference data ───────────────────────────────────────────────────

    // Insurer Master rows (for data_configured check)
    var insurerMasterRows = getSheetDataAsObjects(CONFIG.SHEET_INSURER_MASTER, 'Insurers');
    var insurerMasterMap  = {};
    insurerMasterRows.forEach(function(ins) {
      if (ins.insurer_id) insurerMasterMap[ins.insurer_id] = ins;
    });

    // Statement_Headers rows (for statement_configured check)
    var stmtData = configSS.getSheetByName('Statement_Headers');
    var stmtMap  = {};
    if (stmtData) {
      var stmtRows = stmtData.getDataRange().getValues();
      for (var s = 1; s < stmtRows.length; s++) {
        var sid = (stmtRows[s][0] || '').toString().trim();
        if (sid) stmtMap[sid] = stmtRows[s]; // [policy_no_col] is index 4
      }
    }

    // ── Iterate status rows ───────────────────────────────────────────────────

    var statusData = statusSheet.getDataRange().getValues();
    var today      = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MM-yyyy');
    var updated    = 0;

    for (var i = 1; i < statusData.length; i++) {
      var insurerId = (statusData[i][0] || '').toString().trim();
      if (!insurerId) continue;

      // ── 1. data_configured ─────────────────────────────────────────────────
      var dataStatus = 'N';
      var ins        = insurerMasterMap[insurerId];
      if (ins) {
        var vals    = [ins.insurer_gstin, ins.insurer_address, ins.spoc_email];
        var filled  = vals.filter(function(v) {
          var s = (v || '').toString().trim();
          return s !== '' && s.indexOf('[') === -1;
        }).length;
        if      (filled === 3) dataStatus = 'Y';
        else if (filled > 0)   dataStatus = 'Partial';
      }

      // ── 2. grid_configured ─────────────────────────────────────────────────
      var gridStatus = checkGridConfigured_(insurerId);

      // ── 3. statement_configured ────────────────────────────────────────────
      var stmtStatus = 'N';
      var stmtRow    = stmtMap[insurerId];
      if (stmtRow) {
        var policyNoCol = (stmtRow[4] || '').toString().trim();
        stmtStatus = (policyNoCol && policyNoCol.indexOf('[') === -1)
          ? 'Y'
          : 'Pending';
      }

      // ── Write back ─────────────────────────────────────────────────────────
      statusSheet.getRange(i + 1, 3).setValue(dataStatus);
      statusSheet.getRange(i + 1, 4).setValue(gridStatus);
      statusSheet.getRange(i + 1, 5).setValue(stmtStatus);
      statusSheet.getRange(i + 1, 7).setValue(today);
      updated++;
    }

    SpreadsheetApp.flush();
    Logger.log('refreshInsurerStatus: updated ' + updated + ' rows');
    return { updated: updated };

  }, 'MANUAL');
}

/**
 * Checks whether a grid file exists in FOLDER_GRIDS and has data rows.
 * Returns 'Y', 'Partial' (file exists but no data rows), or 'N' (no file).
 *
 * @param {string} insurerId
 * @returns {string} 'Y' | 'Partial' | 'N'
 */
function checkGridConfigured_(insurerId) {
  try {
    if (!CONFIG.FOLDER_GRIDS) return 'N';

    // Find insurer name from INSURER_MASTER_DATA
    var insurerName = '';
    for (var i = 0; i < INSURER_MASTER_DATA.length; i++) {
      if (INSURER_MASTER_DATA[i][0] === insurerId) {
        insurerName = INSURER_MASTER_DATA[i][1];
        break;
      }
    }
    if (!insurerName) return 'N';

    var gridsFolder = DriveApp.getFolderById(CONFIG.FOLDER_GRIDS);

    // Try exact name first, then partial scan
    var gridFile = null;
    var exact = gridsFolder.getFilesByName(insurerName + ' Grid');
    if (exact.hasNext()) {
      gridFile = exact.next();
    } else {
      var all = gridsFolder.getFiles();
      var idLower = insurerId.toLowerCase();
      while (all.hasNext()) {
        var f = all.next();
        if (f.getName().toLowerCase().indexOf(idLower) !== -1) {
          gridFile = f;
          break;
        }
      }
    }

    if (!gridFile) return 'N';

    // File found — check any tab for data rows
    var ss     = SpreadsheetApp.open(gridFile);
    var sheets = ss.getSheets();
    for (var j = 0; j < sheets.length; j++) {
      if (sheets[j].getLastRow() > 1) return 'Y';
    }
    return 'Partial'; // file exists but all tabs are header-only

  } catch (e) {
    Logger.log('checkGridConfigured_ [' + insurerId + ']: ' + e.message);
    return 'N';
  }
}

// ── RTO MASTER IMPORTER ───────────────────────────────────────────────────────

/**
 * Convenience wrapper: reads CSV from a Drive file, then calls importRTOMaster().
 * Upload your rto_master.csv to the Input folder in Drive, then paste its file ID here.
 *
 * Usage: importRTOMasterFromDrive('PASTE_FILE_ID_HERE')
 */
function importRTOMasterFromDrive(fileId) {
  try {
    if (!fileId || fileId.trim() === '') {
      throw new Error('fileId is required. Open the CSV in Drive, copy the ID from the URL, and pass it here.');
    }
    var file = DriveApp.getFileById(fileId);
    var csvData = file.getBlob().getDataAsString();
    Logger.log('Read file: ' + file.getName() + ' (' + csvData.length + ' chars)');
    importRTOMaster(csvData);
  } catch (e) {
    Logger.log('importRTOMasterFromDrive failed: ' + e.message);
    throw new Error('[importRTOMasterFromDrive] failed: ' + e.message);
  }
}

/**
 * Imports RTO data into the RTO Master sheet.
 * Call with CSV string content of the rto_master data.
 * Normalises rto_code from XX00 to XX-00 format on import.
 *
 * Usage: importRTOMaster(csvString)
 */
function importRTOMaster(csvData) {
  try {
    if (!csvData || typeof csvData !== 'string' || csvData.trim() === '') {
      throw new Error(
        'csvData argument is required. Paste your RTO CSV content as a string argument.\n' +
        'Usage: importRTOMaster("rto_id,rto_city,...\\n1,Mumbai,...")'
      );
    }

    var ss = SpreadsheetApp.openById(CONFIG.SHEET_RTO_MASTER);
    var sheet = ss.getSheetByName('RTO');

    var rows = Utilities.parseCsv(csvData);
    if (!rows || rows.length < 2) {
      throw new Error('CSV appears empty or has no data rows. Check the content passed in.');
    }
    var headers = rows[0];
    if (!headers || headers.length === 0) {
      throw new Error('Could not parse CSV headers. Ensure the first row contains column names.');
    }
    var dataRows = rows.slice(1);

    var rtoIdx = headers.indexOf('VehicleCity_RTOCode');
    var stateIdx = headers.indexOf('State_Name');
    var cityIdx = headers.indexOf('RTO_City');
    var idIdx = headers.indexOf('VehicleCity_Id');

    var normalised = dataRows.map(function(row) {
      var rawCode = row[rtoIdx] || '';
      var normCode = normaliseRTOCode_(rawCode);
      var state = (row[stateIdx] || '')
        .replace('PUBJAB', 'PUNJAB')
        .replace('ORISSA', 'ODISHA');
      var stateCode = normCode.substring(0, 2);
      return [row[idIdx], row[cityIdx], state, normCode, stateCode];
    });

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).clearContent();
    }
    sheet.getRange(2, 1, normalised.length, 5).setValues(normalised);
    Logger.log('RTO Master imported: ' + normalised.length + ' rows');

  } catch (e) {
    Logger.log('importRTOMaster failed: ' + e.message);
    throw e;
  }
}

/**
 * Internal helper: normalise XX00 → XX-00
 */
function normaliseRTOCode_(code) {
  if (!code) return '';
  code = code.toString().trim().toUpperCase();
  if (/^[A-Z]{2}-\d{2,}$/.test(code)) return code; // already correct
  var match = code.match(/^([A-Z]{2})(\d+)$/);
  if (match) {
    var alpha = match[1];
    var num = match[2].padStart(2, '0');
    return alpha + '-' + num;
  }
  return code; // return as-is if pattern not recognised
}

// ── RTO STATE CODE BACKFILL ───────────────────────────────────────────────────

/**
 * Derives state_code from rto_code for every row in RTO Master that has a
 * blank state_code. Extracts the 2-letter prefix before the hyphen.
 * e.g. "MH-01" → "MH", "KA-05" → "KA"
 *
 * Run once after manually inserting RTO data without state_code.
 */
function backfillRTOStateCodes() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_RTO_MASTER);
    var sheet = ss.getSheetByName('RTO');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var rtoCodeIdx   = headers.indexOf('rto_code');
    var stateCodeIdx = headers.indexOf('state_code');

    if (rtoCodeIdx === -1 || stateCodeIdx === -1) {
      throw new Error('Could not find rto_code or state_code columns. Check RTO sheet headers.');
    }

    var updated = 0;
    for (var i = 1; i < data.length; i++) {
      var rtoCode   = (data[i][rtoCodeIdx] || '').toString().trim();
      var stateCode = (data[i][stateCodeIdx] || '').toString().trim();

      if (rtoCode && !stateCode) {
        var derived = rtoCode.substring(0, 2).toUpperCase();
        sheet.getRange(i + 1, stateCodeIdx + 1).setValue(derived);
        updated++;
      }
    }

    Logger.log('backfillRTOStateCodes: updated ' + updated + ' rows out of ' + (data.length - 1) + ' total.');
  } catch (e) {
    Logger.log('backfillRTOStateCodes failed: ' + e.message);
    throw new Error('[backfillRTOStateCodes] failed: ' + e.message);
  }
}

// ── PROMPT SEEDER ─────────────────────────────────────────────────────────────

/**
 * Default extraction prompt — works for any insurer statement before the
 * insurer-specific column names are known. Refine once you have a real
 * statement by replacing the prompt_template cell for that insurer.
 *
 * Run once after setup to pre-populate the Prompts tab:
 *   seedDefaultPrompts()
 *
 * Re-running is safe — existing rows for an insurer_id are updated in-place;
 * rows for other insurers are not touched.
 */
function seedDefaultPrompts() {
  try {
    var DEFAULT_PROMPT = [
      'This is a brokerage statement from an insurance company to a broker.',
      'Extract every policy row where a brokerage or commission amount is listed.',
      'Return a JSON array. Each element must have:',
      '  policy_no        — policy number or certificate number (string)',
      '  brokerage_amount — brokerage / commission payable (number, no ₹ symbol, no commas)',
      '  insured_name     — name of the insured/policyholder (string, or "" if absent)',
      '  premium_amount   — net premium or gross premium (number, or 0 if absent)',
      '  policy_date      — policy issue or inception date as DD-MM-YYYY (string, or "" if absent)',
      'Rules:',
      '  - Include only rows that have a numeric brokerage_amount > 0.',
      '  - Do NOT include sub-total, grand-total, or header rows.',
      '  - Do NOT include markdown, code fences, or any explanation.',
      '  - If no data rows are found return an empty array: []',
      'Example output: [{"policy_no":"1234/2026/123","brokerage_amount":850,"insured_name":"Ramesh Kumar","premium_amount":4200,"policy_date":"01-08-2026"}]'
    ].join('\n');

    // Insurer-specific notes appended to the default prompt.
    // Column names are exact — sourced from create_insurer_templates.py.
    var INSURER_NOTES = {

      'BAJAJ':
        'Excel file, sheet name "irdaPayoutReport", first 4 rows are blank — data starts at row 5. ' +
        'policy_no = "POLICY_REFERENCE". brokerage_amount = "TOTAL COMMISSION" (numeric, skip rows where this is 0 or blank). ' +
        'insured_name = "CUSTOMER NAME". premium_amount = "NET PREMIUM". policy_date = "POLICY DATE".',

      'GO':
        'Excel file (.xlsb format), sheet name "AAZCA5637P". ' +
        'Columns confirmed from actual statement: policy_number, version_no, endorsement_ind, policy_issue_date, ' +
        'risk_inc_date, risk_exp_date, office_code, office_name, state, user_id, imd_code, imd_name, ' +
        'imd_channel, imd_channel_irda, product_code, product_name, product_lob, vehicle_make, vehicle_model, ' +
        'fuel_type, veh_reg_no, rto_location, veh_age, veh_type, vehicle_subtype, veh_usage, veh_wheels, ' +
        'veh_seating, veh_gvw, veh_cc, policy_holder, ph_pincode, od_premium, tp_premium, add_on_premium, ' +
        'sum_insured, net_premium, issue_source, account_manager, prev_policy_expiry, curr_ncb, ' +
        'comm_disc_rate, comm_disc_amt, zero_dep_cover, tarrif_premium, veh_reg_date, technical_premium, ' +
        'cng_flag, SUR_PERS, partner_preferred_discount, incremental_variation, office_gst_number, ' +
        'ph_gst_number, vehicle_code, od_premium_before_commerical_discount, od_premium_at_commerical_discount, ' +
        'carrier_type, net_premium_coll, product_package, insured_person, policy_type, policy_status, ' +
        'prev_insurer, prev_policy_no, prev_ncb, endorse_reasons, AM_Location, Month, transaction_seq_number, ' +
        'Terrorism, Pan Number, mail_id, File_Split_Tag, IRDA_AMT, REWARD_AMT, TOTAL_AMT, Master_Policy_No, Gst_Flag. ' +
        'Mappings: policy_no = "policy_number". brokerage_amount = "TOTAL_AMT" (this is IRDA_AMT + REWARD_AMT combined — use TOTAL_AMT directly). ' +
        'insured_name = "policy_holder". premium_amount = "net_premium". policy_date = "policy_issue_date". ' +
        'Skip rows where TOTAL_AMT is 0 or blank.',

      'NIC':
        'PDF statement. Tables span multiple pages. ' +
        'The PDF has a header block at the top (Sales Channel Code, Sales Channel Name, Office Code, ' +
        'Office Name, Biz. Code, License #, License Exp Date) — ignore this entirely. ' +
        'The data table has these exact column headers: Dept Name, Prdt Code, Bill Number, Policy #-Endo#, ' +
        'Effective Date, Expiry Date, Insured Name, OD / Other Premium, Comm. %, OD / Other Commission, ' +
        'TP / Terrorism Prm, Terr. %, TP / Terr. Comm, Premium Amount, Commission Amount. ' +
        'There is a Grand Total footer row — skip it. ' +
        'Mappings: policy_no = "Policy #-Endo#" (use the full value including endorsement suffix if present). ' +
        'brokerage_amount = "Commission Amount" (this is the combined total of OD/Other Commission + TP/Terr. Comm). ' +
        'insured_name = "Insured Name". premium_amount = "Premium Amount". policy_date = "Effective Date". ' +
        'Skip rows where Commission Amount is 0 or blank.',

      'NIA':
        'PDF statement. The PDF contains: a header block (Broker Code, Broker Name, Broker License Number, ' +
        'Broker License Expiry Date, Broker GSTIN) — ignore entirely. ' +
        'Data table 1 — Policy-level detail — has these exact column headers: Invoice Number, Invoice Date, ' +
        'Office Code, Policy Number, Endorsement Number, LOB Code, Insured Name, Insured Type, Policy Month, ' +
        'Policy Inception Date, Policy Expiry Date, Brokerage Percentage, Premium, Brokerage. ' +
        'Data table 2 — Tax summary — has columns: Invoice Number, Invoice Date, Taxable Amount, CGST Input, ' +
        'SGST Input, IGST Input, CGST RCM, SGST RCM, IGST RCM, Invoice Amount. ' +
        'CRITICAL: extract ONLY from Data table 1 (Policy-level detail). Ignore Data table 2 entirely. ' +
        'Mappings: policy_no = "Policy Number". brokerage_amount = "Brokerage". ' +
        'insured_name = "Insured Name". premium_amount = "Premium". policy_date = "Policy Inception Date". ' +
        'Skip rows where Brokerage is 0 or blank.',

      'OR':
        'PDF statement (Oriental Insurance), up to 27 pages. ' +
        'IGNORE the following — they are not policy data rows: ' +
        '(1) Header block repeated on every page: Report Generating Office, User ID, Run Date, Report, Page No., Bill No., Office, For Period. ' +
        '(2) Broker details block repeated on every page: Name, Address, Broker Code, Licence No., PAN Number, Lic. Expiry Date, Process Date, I Tax Rate. ' +
        '(3) Footer/summary block at the end: Department Total, Grand Total, Cumulative Gross Commission, Cumulative Income Tax, Gross Commission, Less: Income Tax for the Current Period (Including Surcharge), Gross Payable, Add: GST for the current period, Net Payable. ' +
        'The data table has these exact column headers: Dept, Policy No., Insured Name, Colln. No., Prod. Code, Pol.Type, Cvr., Instl No., Policy Expiry Date, Bank Fin. Type Description, Premium (Rs.) (Ref.), Comm. (Rs.) (Ref.), Premium / Comm. Rate (%), Description, GST Exempt/Non-Exempt. ' +
        'STRUCTURAL NOTE — Oriental\'s layout is different from other insurers: ' +
        'each policy does NOT appear as two clean table rows. Instead, each policy spans TWO STACKED PHYSICAL LINES ' +
        'in the PDF: the first physical line carries Policy No., Insured Name, Colln. No., Prod. Code, Pol.Type, ' +
        'Cvr., Instl No., Policy Expiry Date, Bank Fin. Type Description, GST Exempt/Non-Exempt; ' +
        'the second physical line carries the Premium (Rs.) (Ref.) and Comm. (Rs.) (Ref.) figures, ' +
        'split between OD and TP components. ' +
        'When the PDF is flattened to text these two physical lines may appear interleaved or merged. ' +
        'Group all content belonging to the same Policy No. and sum the OD and TP figures. ' +
        'Return ONE element per Policy No. ' +
        'policy_no = "Policy No.". ' +
        'brokerage_amount = total of all "Comm. (Rs.) (Ref.)" values (OD + TP) for the same Policy No. ' +
        'premium_amount = total of all "Premium (Rs.) (Ref.)" values for the same Policy No. ' +
        'insured_name = "Insured Name". policy_date = "Policy Expiry Date". ' +
        'Negative entries (endorsement reversals) are valid — include as-is with the negative sign.',

      'TATA':
        'Excel file, sheet name "Report". ' +
        'Columns confirmed from actual statement: Policy_No, Proposal_No, Business_Place, Policy_start_date, ' +
        'Policy_end_date, Policy_issue_date, Customer_name, Product_name, Package_name, Business_type, ' +
        'Record_type_desc, Record_type_cd, endorsement_no, OD_Premium, TP_Terrorism_premium, Total_Premium, ' +
        'OD_Commission, TP_Terrorism_commission, Total_commission, TDS, OD_Rate, TP_Rate, ' +
        'Approved_Grid_Per_Policy, sap_doc_posting_no, Partner_Application_No, Certificate_No, Sol_ID, ' +
        'Producer_Code, Subproducer_Code, Producer_Name, Commission_Cycle, UTR_Number, UTR_Date, Reason, ' +
        'Coinsurance_Flag, PANNO, b_code, report_accounting_period, CCOMMISSION_MONTH, table_name, ' +
        'GST_impact, Commission_Cycle_name, remarks, email, txt_commisiion_cycle, txt_status, ' +
        'statement_sent, Payment_Flag, num_category_id, txt_category, File_type, product_code, product_cd, ' +
        'Winflag, accounting_ts, sap_posting_ts, sap_doc_fiscal_year, statement_trig_ts. ' +
        'Apply ALL THREE filters before extracting: ' +
        'FILTER 1 — Exclude TDS rows: skip any row where "table_name" equals "TDS". ' +
        'FILTER 2 — Primary producer only: skip any row where "Subproducer_Code" is non-empty. ' +
        'FILTER 3 — Co-insurance: skip any row where "Coinsurance_Flag" indicates follower status (e.g. "F", "Follower"); include only direct or leader rows. ' +
        'After all three filters, if the same Policy_No still appears more than once (different table_name values), ' +
        'include each distinct table_name as a separate element — do not collapse them. ' +
        'policy_no = "Policy_No". ' +
        'brokerage_amount = "Total_commission" (= OD_Commission + TP_Terrorism_commission pre-summed; do not subtract TDS — TDS rows are already excluded by Filter 1). ' +
        'insured_name = "Customer_name". premium_amount = "Total_Premium". policy_date = "Policy_issue_date". ' +
        'Skip rows where Total_commission is 0 or blank.',

      'UIIC':
        'Excel file, sheet name "Sheet1". ' +
        'Columns confirmed from actual statement: Name, Agt/Brk/Cor_Ag_Code, Dep No, Policy No, ' +
        'Endorsement No, Insured Name, Policy Exp Dt, Premium Amt, Rate, Terrsm Loading, Comm Amt. ' +
        'Each motor policy appears as TWO rows — one for Motor OD (Dep No = "31 - Motor") and one for ' +
        'Motor TP (Dep No = "32 - Motor TP"). ' +
        'CRITICAL: Sum both rows and return ONE element per Policy No. ' +
        'Note on Terrsm Loading: this is the terrorism premium amount (informational only) — there is no ' +
        'separate terrorism commission column; Comm Amt is the all-in total commission including any terrorism component. ' +
        'policy_no = "Policy No". ' +
        'brokerage_amount = SUM of "Comm Amt" across the OD and TP rows for the same Policy No. ' +
        'insured_name = "Insured Name". premium_amount = SUM of "Premium Amt" across both rows. ' +
        'policy_date = "Policy Exp Dt". ' +
        'Skip rows where Comm Amt is 0 or blank.',

      'USGI':
        'Excel file (Universal Sompo General Insurance). Two sheets: "MOTOR" and "NON-MOTOR". ' +
        'Both sheets have one blank row above the header — header is row 2, data starts row 3. ' +
        'Extract from both sheets and combine. ' +
        'Columns confirmed from actual statement (130+ cols, key ones): line_Of_Business, channel_Details, ' +
        'policy_Issue_Month_Year, intermediary_Code, policyNo, endorsementNo, final_Policy_No, ' +
        'customer_Name, policy_Issue_Date, policy_start_date, policy_end_date, policy_issuance_state, ' +
        'vehicle_make, vehicle_model, yr_Of_Manufacturing, policyType, productName, product_Name, ' +
        'gvw, policy_Status, rtoLocation, rtoState, businessType, usgiNetPremium, netOdPremium, ' +
        'num_Net_Tp_Premium, terrorism_Premium, net_Premium, fuel_Type, motor_Registration_No, ' +
        'co_Insurance_Type, gwp, final_gwp, grid_percentage, irda_od_perc, irda_tp_perc, ' +
        'irdai_amount_on_OD, irdai_amount_on_TP, total_irdai_amount, ' +
        'Instant Commission on OD, Instant Commission on TP, Total Instant Commission, ' +
        'final_grid_payable_on_OD, final_grid_payable_on_TP, final_grid_payable, total_amount, ' +
        'Remark for Finance. ' +
        'NOTE: customer_Name appears twice in the header row (duplicate column in their export) — use the first occurrence. ' +
        'FILTER — co-insurance: check co_Insurance_Type; skip rows where this indicates follower status. ' +
        'Mappings: policy_no = "policyNo". ' +
        'brokerage_amount = "total_amount" (this is the final aggregate commission — final_grid_payable + Total Instant Commission combined). ' +
        'insured_name = "customer_Name" (first occurrence). premium_amount = "net_Premium". ' +
        'policy_date = "policy_Issue_Date". ' +
        'Skip rows where total_amount is 0 or blank.',

      'INDUSIND':
        'IndusInd General Insurance statement (formerly Reliance General Insurance — same insurer, rebranded). ' +
        'Excel file. ' +
        'Columns confirmed from actual statement: Month, TransactionId, RegionName, BranchCode, BranchName, ' +
        'ProductCode, PolicyNumber, Endorsement, InsuredName, AgentCode, AgentName, AgentType, Discount, ' +
        'PremiumAmount, FinalIRDA, FinalIRDAComm, Reward, RewardCommission, TPPremiumAmount, FinalTP, ' +
        'FinalTPComm, TerrorismPremiumAmount, FinalTerrorism, FinalTerrorismComm, ChannelName, IRDAReqRefNo, ' +
        'RewardReqRefNo, TerrorismReqRefNo, TPReqRefNo, SkippedcovernoteY_N, POSPortalOSY_N, POLICY_COUNT, ' +
        'NoofLivesCovered, SUM_INSURED, NET_PREMIUM, CoverNoteNumber, CoinType, StateCode, StateName, Statement Month. ' +
        'CRITICAL — there is no pre-summed total commission column. ' +
        'brokerage_amount = FinalIRDAComm + RewardCommission + FinalTPComm + FinalTerrorismComm (sum all four). ' +
        'Skip rows where all four commission columns are 0 or blank. ' +
        'Mappings: policy_no = "PolicyNumber". ' +
        'insured_name = "InsuredName". premium_amount = "NET_PREMIUM". policy_date = "Month".',

      'SBIG':
        'Excel file. Insurer is SBI General Insurance Company Limited (SBIG). ' +
        'Columns confirmed from actual statement: UW_UNIQUE_REF_CODE, Statement MONTH, POLICY_ISSUE_DATE, ' +
        'SBIG_BRANCH_NAME, OF_LOB_NAME, LOB_1, PRODUCT_CODE, PRODUCT_NAME, SEGMENT, DISTRIBUTION_CHANNEL, ' +
        'DISTRIBUTION_CHANNEL_1, INSURED_NAME, POLICY_1, POLICY_NO, POLICY_START_DATE, POLICY_EXP_DATE, ' +
        'ENDORSEMENT_NO, ENDORSEMENT_REASON, GROSS_PREMIUM, COMMISSION_PREMIUM, INTERMEDIARY_CODE, ' +
        'INTERMEDIARY_NAME, FIXED_COMMISSION_PERCENT, FIXED_COMMISSION_AMOUNT, TERRORISM_PREMIUM, ' +
        'TERRORISM_COMMISSION_PERCENT, TERRORISM_COMMISSION_AMT, TOTAL_COMMISSION_AMOUNT, AGREEMENT_CODE, ' +
        'MDM_CODE, COINSURANCE_STATUS_1, PAY_COMMISSION_TO_LEADER, POLICY_TYPE, License expiry date, ' +
        'Registered/UnRegistered, From Location_ State( Intermediary Location), ' +
        'To Location_ State(Servicing Branch ), Intermediary GSTN NO, SBIG GSTN NO, BookingBranch, ' +
        'HSN Code, ALTERNATE_POLICY_NO, Remark, IRDA Product Code, IRDA Product Name, Channel Strucutre, ' +
        'Statement Ref No, CHANNEL_TYPE, PROVISION_BATCH_ID, PROVISION_BATCH_DATE, NEW_RENEWAL_DWBI, ' +
        'IMD_PAN_NO, IMD Full Name. ' +
        'CRITICAL — co-insurance filter: check the PAY_COMMISSION_TO_LEADER column. ' +
        'Include ONLY rows where PAY_COMMISSION_TO_LEADER indicates the broker is the leader (e.g. "Y", "YES", "Leader"). ' +
        'Skip follower/co-insurance rows. ' +
        'Mappings: policy_no = "POLICY_NO". ' +
        'brokerage_amount = "TOTAL_COMMISSION_AMOUNT" (this is FIXED_COMMISSION_AMOUNT + TERRORISM_COMMISSION_AMT combined — use directly). ' +
        'insured_name = "INSURED_NAME". premium_amount = "GROSS_PREMIUM". policy_date = "POLICY_ISSUE_DATE". ' +
        'Skip rows where TOTAL_COMMISSION_AMOUNT is 0 or blank.',

      'KOTAK':
        'CSV file (comma-separated). Insurer is Zurich Kotak General Insurance (formerly Kotak General / Kotak Mahindra General). ' +
        'Columns confirmed from actual statement: BRANCH CODE, BRANCH NAME, ZKGI GST NO, POLICY NO, Endorsement No, ' +
        'ENDORSEMENT TYPE, Endorsement Reason, BUSINESS TYPE, Policy/Endorsement Issue Date, POLICY INCEPTION DATE, ' +
        'Endorsement Effective Date, POLICY EXPIRY DATE, LOB NAME, PRODUCT NAME, CUSTOMER NAME, IMD CODE, IMD NAME, ' +
        'IMD GSTIN No, PA TO OWNER DRIVER PREMIUM, ALL OTHER TP COVER PREMIUM, Terrorism Premium, ' +
        'BASIC PREMIUM/OD PREMIUM, OUR SHARE OF PREMIUM GWP, GST Exempted Yes/No, TDS RATE ON COMM, ' +
        'PRODUCT TYPE, OD %, TP %, Terr %, OD / Basic commission, Motor TP commission, Terrisom commission, ' +
        'Total Commission, TDS Amt, CGST, SGST, IGST, Net Commission. ' +
        'Mappings: policy_no = "POLICY NO". ' +
        'brokerage_amount = "Total Commission" — this is the gross pre-TDS total (OD/Basic + TP + Terrorism combined). ' +
        'Do NOT use "Net Commission" — that is post-TDS. ' +
        'insured_name = "CUSTOMER NAME". premium_amount = "OUR SHARE OF PREMIUM GWP". ' +
        'policy_date = "Policy/Endorsement Issue Date". ' +
        'Skip rows where Total Commission is 0 or blank.',

      'ICICI':
        'CSV file (comma-separated). ' +
        'Columns confirmed from actual statement: AGENT_CATEGORY_NAME, AGENT_LICENSE_CODE, INTERMEDIARY_CODE, ' +
        'INTERMEDIARY_NAME, LOCATION_NAME, CUSTOMER_ID, INSURED_CUSTOMER_NAME, PRODUCT_CODE, PRODUCT_NAME, ' +
        'POLICY_NUMBER, POL_NUM_TXT, POL_PRI_VVERTICAL_DESC, POL_PRI_SSUB_VERTICAL_DESC, DEAL_CODE, ' +
        'POL_RM_CODE, POL_RM_NAME, APPLICABLE_PREMIUM_AMOUNT, PREMIUM_FOR_PAYOUTS, POL_COMMISSION_PERCENTAGE, ' +
        'COMMISSION_RATE_USED, ACTUAL_COMPR_OD_COMM, ACTUAL_COMPR_TP_COMM, ACTUAL_COMMISSION, ' +
        'POLICY_START_DATE, POLICY_END_DATE, ENDORSEMENT_NUMBER, ENDORSEMENT_TYPE, LEADER_FOLLOWER, ' +
        'CHILD_INTERMEDIARY_ID, CHILD_INTEREDIARY_NAME, COMMISSIONABLE_SOURCE, PAYMENT_LOCATION, ' +
        'BRANCH_NAME, BASIC_PREMIUM_AMOUNT, EARTHQUAKE_PREMIUM_AMOUNT, MOTOR_OD_PREMIUM_AMOUNT, ' +
        'MOTOR_TP_PREMIUM_AMOUNT, TERRORISM_PREMIUM_AMOUNT, WAR_SRCC_PREMIUM_AMT, PREMIUM_AMOUNT_USED, ' +
        'BUSINESS_TYPE, IRDA_REPORTING_DATE, GWP, FROM_LOCATION, TO_LOCATION, POL_VEHICLE_AGE, ' +
        'CUST_TYPE, TRANSACTION_STATUS, YEAR_FLAG, PAYOUT_CYCLE, PAY_ON, MATCH_TYPE, CALCULATION_TYPE, ' +
        'STD_REMARKS, TRANSACTION_ID, TOTAL_OD_PREMIUM_RECEIVED, TOTAL_TP_PREMIUM_RECEIVED, ' +
        'TOTAL_PREMIUM_RECEIVED, DMA_CODE, BRANCH_STATE, OFFLINE_POL_NUM_TXT, BANCS_POL_NUM, GST_EXCEMPTION_FLAG. ' +
        'CRITICAL — filter by TRANSACTION_STATUS: include ONLY rows where TRANSACTION_STATUS is not blank ' +
        'and does not indicate a reversal or cancellation (exclude values like "REVERSED", "CANCELLED", "VOID"). ' +
        'Mappings: policy_no = "POLICY_NUMBER". brokerage_amount = "ACTUAL_COMMISSION" (this is the total ' +
        'commission; includes OD component ACTUAL_COMPR_OD_COMM + TP component ACTUAL_COMPR_TP_COMM). ' +
        'insured_name = "INSURED_CUSTOMER_NAME". premium_amount = "GWP". policy_date = "POLICY_START_DATE". ' +
        'Skip rows where ACTUAL_COMMISSION is 0 or blank.'
    };

    var ss    = SpreadsheetApp.openById(CONFIG.SHEET_BROKER_CONFIG);
    var sheet = ss.getSheetByName('Prompts');
    if (!sheet) throw new Error('Prompts tab not found in Broker Config Sheet');

    var data = sheet.getDataRange().getValues();

    // Build index of existing insurer rows
    var existingRows = {};
    for (var i = 1; i < data.length; i++) {
      var id = (data[i][0] || '').toString().trim();
      if (id) existingRows[id] = i + 1; // 1-indexed row number
    }

    var insurerIds = Object.keys(INSURER_NOTES);
    var added = 0, updated = 0;

    insurerIds.forEach(function(id) {
      var fullPrompt = DEFAULT_PROMPT + '\n\nInsurer-specific note: ' + INSURER_NOTES[id];
      var notes = 'Generic starter prompt — refine once you have the actual statement format';

      if (existingRows[id]) {
        // Update in-place
        var rowNum = existingRows[id];
        sheet.getRange(rowNum, 2).setValue(fullPrompt);
        sheet.getRange(rowNum, 3).setValue(notes);
        updated++;
      } else {
        // Append new row
        sheet.appendRow([id, fullPrompt, notes]);
        added++;
      }
    });

    SpreadsheetApp.flush();
    Logger.log('seedDefaultPrompts: ' + added + ' added, ' + updated + ' updated');
    Logger.log('Refine each prompt once you have a sample statement from that insurer.');

  } catch (e) {
    Logger.log('seedDefaultPrompts failed: ' + e.message);
    throw e;
  }
}

// validateGrid() lives in CommissionApplication.gs

// ── GRID TEMPLATE ─────────────────────────────────────────────────────────────

var GRID_HEADERS = [
  'insurance_company',            // 0
  'insurer_code',                 // 1
  'scheme_name',                  // 2
  'product_type',                 // 3
  'product_sub_type',             // 4
  'product_sub_sub_type',         // 5
  'product_category',             // 6
  'effective_from_date',          // 7
  'effective_to_date',            // 8
  'vehicle_age_band',             // 9
  'vehicle_age_notes',            // 10
  'fuel_type',                    // 11
  'vehicle_type_desc',            // 12
  'vehicle_segment',              // 13
  'vehicle_cc_lower_limit',       // 14
  'vehicle_cc_upper_limit',       // 15
  'cc_range_notes',               // 16
  'cc_segment_label',             // 17
  'seating_capacity_lower_limit', // 18
  'seating_capacity_upper_limit', // 19
  'gvw_lower_limit',              // 20
  'gvw_upper_limit',              // 21
  'gvw_unit',                     // 22
  'tonnage_notes',                // 23
  'region_zone',                  // 24
  'rto_list',                     // 25
  'rto_zone',                     // 26
  'rto_notes',                    // 27
  'ncb_adj',                       // 28 — differential applied to PI when NCB absent on policy
  'ncb_rate_notes',               // 29 — free text notes on NCB differential logic
  'ncb_notes',                    // 30
  'age_lower_limit',              // 31
  'age_upper_limit',              // 32
  'nil_dep_adj',                  // 33 — differential applied to PI when nil dep absent on policy
  'nil_dep_notes',                // 34
  'cpa_adj',                      // 35 — differential applied to PI when CPA absent on policy
  'pi_rate',                      // 36
  'pi_rate_on',                   // 37
  'pi_rate1',                     // 38
  'pi_rate1_on',                  // 39
  'retention',                    // 40
  'retention1',                   // 41
  'po_rate',                      // 42
  'po_rate_on',                   // 43
  'po_rate_1',                    // 44
  'po_rate1_on',                  // 45
  'slab_1_from',                  // 46
  'slab_1_to',                    // 47
  'slab_1__pi_rate',              // 48
  'slab_1_rate_on',               // 49
  'slab_1_retention',             // 50
  'slab_1__po_rate',              // 51
  'slab_2_from',                  // 52
  'slab_2_to',                    // 53
  'slab_2__pi_rate',              // 54
  'slab_2_rate_on',               // 55
  'slab_2_retention',             // 56
  'slab_2__po_rate',              // 57
  'slab_3_from',                  // 58
  'slab_3_to',                    // 59
  'slab_3__pi_rate',              // 60
  'slab_3_rate_on',               // 61
  'slab_3_retention',             // 62
  'slab_3__po_rate'               // 63
];

/**
 * Creates a blank commission grid sheet for an insurer in FOLDER_GRIDS.
 * Run from the Apps Script editor for each insurer you want to set up.
 *
 * Usage:  createGridTemplate('OR', 'TW')
 *         createGridTemplate('NIC', 'Pvt Car')
 *
 * Creates: "[insurer_name] Grid" sheet in Grids folder
 *          Tab named e.g. "TW_2026-08" for the current period
 *
 * After running, open the sheet and add rate rows. Then run validateGrid().
 */
function createGridTemplate(insurerId, productType) {
  var id_  = insurerId   || 'OR';
  var pt_  = productType || 'TW';

  var insurerRow = null;
  for (var i = 0; i < INSURER_MASTER_DATA.length; i++) {
    if (INSURER_MASTER_DATA[i][0] === id_) { insurerRow = INSURER_MASTER_DATA[i]; break; }
  }
  if (!insurerRow) throw new Error('Insurer not found in INSURER_MASTER_DATA: ' + id_);

  var insurerName = insurerRow[1];
  var sheetName   = insurerName + ' Grid';

  var now     = new Date();
  var year    = now.getFullYear();
  var month   = now.getMonth() + 1;
  var fyStart = month >= 4 ? year : year - 1;
  var fyEnd   = fyStart + 1;
  var fy      = String(fyStart).slice(2) + '-' + String(fyEnd).slice(2);

  var prefixMap = {
    'TW': 'TW', 'Pvt Car': 'PC', 'GCV': 'GCV',
    'PCV': 'PCV', 'Tractor': 'MiscD', 'Construction Eqpt': 'MiscD'
  };
  var tabName = (prefixMap[pt_] || pt_) + '_' + fy;

  var ss = getOrCreateSheet_(CONFIG.FOLDER_GRIDS, sheetName);

  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    Logger.log('Created tab: ' + tabName);
  } else {
    Logger.log('Tab already exists: ' + tabName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(GRID_HEADERS);
    sheet.getRange(1, 1, 1, GRID_HEADERS.length)
      .setBackground('#1F3864')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('Headers written: ' + GRID_HEADERS.length + ' columns');
  } else {
    Logger.log('Headers already present — skipped');
  }

  Logger.log('Grid template ready: ' + sheetName + ' > ' + tabName);
  Logger.log('Sheet ID: ' + ss.getId());
  Logger.log('URL: ' + ss.getUrl());
  return ss.getId();
}

/**
 * Creates grid sheets for ALL insurers × ALL product types in one run.
 * One Google Sheet per insurer, one tab per product (TW, PC, GCV, PCV, MiscD).
 * Safe to re-run — skips existing tabs.
 *
 * Usage: createAllGridTemplates()
 */
function createAllGridTemplates() {
  var insurerIds   = ['OR','NIC','UIIC','USGI','TATA','BAJAJ','GO','INDUSIND','NIA','ICICI','KOTAK','SBIG'];
  var productTypes = ['TW','Pvt Car','GCV','PCV','Tractor']; // Tractor → MiscD_26-27

  var total = 0, created = 0, skipped = 0;

  insurerIds.forEach(function(id) {
    productTypes.forEach(function(pt) {
      total++;
      try {
        createGridTemplate(id, pt);
        created++;
      } catch (e) {
        Logger.log('SKIP ' + id + '/' + pt + ': ' + e.message);
        skipped++;
      }
    });
  });

  Logger.log('');
  Logger.log('=== createAllGridTemplates complete ===');
  Logger.log('Total: ' + total + ' | Created/Updated: ' + created + ' | Skipped: ' + skipped);
}

/**
 * Rewrites row 1 on all 40 grid tabs with the current GRID_HEADERS.
 * Run after any header rename. Safe — only touches row 1, never data rows.
 *
 * Usage: updateAllGridHeaders()
 */
function updateAllGridHeaders() {
  var insurerIds   = ['OR','NIC','UIIC','USGI','TATA','BAJAJ','GO','INDUSIND','NIA','ICICI','KOTAK','SBIG'];
  var productTypes = ['TW','Pvt Car','GCV','PCV','Tractor'];
  var prefixMap    = { 'TW':'TW','Pvt Car':'PC','GCV':'GCV','PCV':'PCV','Tractor':'MiscD','Construction Eqpt':'MiscD' };

  var now     = new Date();
  var year    = now.getFullYear();
  var month   = now.getMonth() + 1;
  var fyStart = month >= 4 ? year : year - 1;
  var fy      = String(fyStart).slice(2) + '-' + String(fyStart + 1).slice(2);

  var updated = 0, skipped = 0, missing = 0;

  insurerIds.forEach(function(id) {
    var insurerRow = null;
    for (var i = 0; i < INSURER_MASTER_DATA.length; i++) {
      if (INSURER_MASTER_DATA[i][0] === id) { insurerRow = INSURER_MASTER_DATA[i]; break; }
    }
    if (!insurerRow) { Logger.log('SKIP ' + id + ': not in INSURER_MASTER_DATA'); missing++; return; }

    var sheetName = insurerRow[1] + ' Grid';
    var folder    = DriveApp.getFolderById(CONFIG.FOLDER_GRIDS);
    var files     = folder.getFilesByName(sheetName);
    if (!files.hasNext()) { Logger.log('MISSING sheet: ' + sheetName); missing++; return; }

    var ss = SpreadsheetApp.open(files.next());

    productTypes.forEach(function(pt) {
      var tabName = (prefixMap[pt] || pt) + '_' + fy;
      var sheet   = ss.getSheetByName(tabName);
      if (!sheet) { Logger.log('MISSING tab: ' + id + ' > ' + tabName); missing++; return; }

      sheet.getRange(1, 1, 1, GRID_HEADERS.length).setValues([GRID_HEADERS]);
      Logger.log('UPDATED ' + id + ' > ' + tabName);
      updated++;
    });
  });

  Logger.log('');
  Logger.log('=== updateAllGridHeaders: ' + updated + ' updated | ' + skipped + ' skipped | ' + missing + ' missing ===');
}

/**
 * Validates all grid tabs for all insurers.
 * Logs PASS/FAIL per tab. Run after createAllGridTemplates().
 *
 * Usage: validateAllGrids()
 */
function validateAllGrids() {
  var insurerIds   = ['OR','NIC','UIIC','USGI','TATA','BAJAJ','GO','INDUSIND','NIA','ICICI','KOTAK','SBIG'];
  var productTypes = ['TW','Pvt Car','GCV','PCV','Tractor'];
  var prefixMap    = { 'TW':'TW','Pvt Car':'PC','GCV':'GCV','PCV':'PCV','Tractor':'MiscD','Construction Eqpt':'MiscD' };

  var now     = new Date();
  var year    = now.getFullYear();
  var month   = now.getMonth() + 1;
  var fyStart = month >= 4 ? year : year - 1;
  var fy      = String(fyStart).slice(2) + '-' + String(fyStart + 1).slice(2);

  var passed = 0, failed = 0, missing = 0;

  insurerIds.forEach(function(id) {
    var insurerRow = null;
    for (var i = 0; i < INSURER_MASTER_DATA.length; i++) {
      if (INSURER_MASTER_DATA[i][0] === id) { insurerRow = INSURER_MASTER_DATA[i]; break; }
    }
    if (!insurerRow) { Logger.log('SKIP ' + id + ': not in INSURER_MASTER_DATA'); missing++; return; }

    var sheetName = insurerRow[1] + ' Grid';
    var folder    = DriveApp.getFolderById(CONFIG.FOLDER_GRIDS);
    var files     = folder.getFilesByName(sheetName);
    if (!files.hasNext()) { Logger.log('MISSING sheet: ' + sheetName); missing++; return; }

    var ss = SpreadsheetApp.open(files.next());

    productTypes.forEach(function(pt) {
      var tabName = (prefixMap[pt] || pt) + '_' + fy;
      var result  = validateGrid(ss.getId(), tabName);
      if (result.valid) {
        Logger.log('PASS  ' + id + ' > ' + tabName + ' (' + result.rowsChecked + ' rows)');
        passed++;
      } else {
        Logger.log('FAIL  ' + id + ' > ' + tabName + ': ' + result.errors.length + ' errors');
        failed++;
      }
    });
  });

  Logger.log('');
  Logger.log('=== validateAllGrids: ' + passed + ' passed | ' + failed + ' failed | ' + missing + ' missing ===');
}

// ── GRID ARCHIVE FOLDER MANAGEMENT ───────────────────────────────────────────

/**
 * Creates one sub-folder per active insurer inside CONFIG.FOLDER_GRID_ARCHIVE.
 *
 * Driven entirely by the live Insurer Master sheet — no hardcoded list.
 * Safe to re-run: existing folders are left untouched, only missing ones created.
 *
 * Run once after initial setup, and again whenever a new insurer is added to
 * the Insurer Master.
 *
 * Usage:  setupGridArchiveFolders()
 */
function setupGridArchiveFolders() {
  var archiveFolder = DriveApp.getFolderById(CONFIG.FOLDER_GRID_ARCHIVE);
  var insurers      = getSheetDataAsObjects(CONFIG.SHEET_INSURER_MASTER, 'Insurers');

  var created = 0, existing = 0, skipped = 0;

  insurers.forEach(function(ins) {
    if (ins.active !== 'Y') { skipped++; return; }

    var id   = (ins.insurer_id   || '').trim();
    var name = (ins.insurer_name || '').trim();
    if (!id) { skipped++; return; }

    // Folder named "TATA — TATA AIG GENERAL INSURANCE CO LTD" for easy identification
    var folderName = id + (name ? ' — ' + name : '');
    var existing_  = archiveFolder.getFoldersByName(folderName);
    if (existing_.hasNext()) {
      Logger.log('EXISTS  ' + folderName);
      existing++;
    } else {
      archiveFolder.createFolder(folderName);
      Logger.log('CREATED ' + folderName);
      created++;
    }
  });

  Logger.log('');
  Logger.log('=== setupGridArchiveFolders: ' + created + ' created | ' + existing + ' existing | ' + skipped + ' skipped ===');
}

/**
 * Returns the archive sub-folder for a given insurer code, creating it if absent.
 * Scans FOLDER_GRID_ARCHIVE for a folder whose name starts with the insurer code.
 * Falls back to creating a plain folder named by the code if no match found.
 *
 * @param {string} insurerCode  e.g. 'TATA', 'RELIANCE'
 * @returns {Folder}
 */
function getOrCreateInsurerArchiveFolder_(insurerCode) {
  var archiveFolder = DriveApp.getFolderById(CONFIG.FOLDER_GRID_ARCHIVE);
  var codeLower     = insurerCode.toLowerCase();

  // Scan for a folder whose name starts with the insurer code (matches "TATA — TATA AIG...")
  var all = archiveFolder.getFolders();
  while (all.hasNext()) {
    var f = all.next();
    if (f.getName().toLowerCase().indexOf(codeLower) === 0) return f;
  }

  // Not found — create a plain folder named by the code
  var newFolder = archiveFolder.createFolder(insurerCode);
  Logger.log('  Archive folder created: ' + insurerCode);
  return newFolder;
}

// ── GRID IMPORT FROM EXCEL ────────────────────────────────────────────────────

/**
 * Imports commission grid data from all .xlsx files in a Drive folder.
 *
 * PREREQUISITE: Enable the Advanced Drive Service in Apps Script editor:
 *   Services (+ icon) → Drive API → Add
 *
 * For each .xlsx file:
 *   1. Converts it to a temporary Google Sheet
 *   2. Detects insurer from insurer_code column (col B, row 2)
 *   3. Finds the target grid Sheet in CONFIG.FOLDER_GRIDS (creates if missing)
 *   4. Imports all product tabs (e.g. TW_26-27) using DATE-PERIOD MERGE:
 *      - Detects effective_from_date / effective_to_date pairs in incoming data
 *      - Removes only rows in the target with matching date periods
 *      - Appends new rows — rows from other periods are untouched
 *   5. Deletes the temporary Google Sheet
 *
 * Usage:  importGridsFromFolder()
 *   Reads from CONFIG.FOLDER_GRID_IMPORT. Pass a folderId to override.
 */
function importGridsFromFolder(folderId) {
  var srcFolder = DriveApp.getFolderById(folderId || CONFIG.FOLDER_GRID_IMPORT);
  var files     = srcFolder.getFilesByType(MimeType.MICROSOFT_EXCEL);
  var summary   = [];

  while (files.hasNext()) {
    var file  = files.next();
    var tempId = null;
    Logger.log('▶ Processing: ' + file.getName());

    try {
      // Convert .xlsx → temporary Google Sheet
      tempId = convertExcelToSheet_(file);
      var srcSS  = SpreadsheetApp.openById(tempId);
      var srcTabs = srcSS.getSheets();

      // Detect insurer from col A (insurance_company) and col B (insurer_code) of first data row
      var insurerCode = null, insurerName = null;
      for (var t = 0; t < srcTabs.length; t++) {
        if (srcTabs[t].getLastRow() >= 2) {
          var row2 = srcTabs[t].getRange(2, 1, 1, 2).getValues()[0];
          insurerName = row2[0]; // col A = insurance_company
          insurerCode = row2[1]; // col B = insurer_code
          break;
        }
      }
      if (!insurerCode) throw new Error('No data rows found — cannot detect insurer');
      Logger.log('  Insurer: ' + insurerCode + ' (' + insurerName + ')');

      // Find or create the target grid sheet
      var targetId = findOrCreateGridSheet_(insurerCode, insurerName);
      var targetSS = SpreadsheetApp.openById(targetId);

      var tabsOk = 0, tabsSkipped = 0, totalRows = 0;

      srcTabs.forEach(function(srcTab) {
        var tabName = srcTab.getName();
        // Only import product tabs matching our naming pattern e.g. TW_26-27
        if (!/^[A-Za-z]+_\d{2}-\d{2}$/.test(tabName)) return;

        var lastRow = srcTab.getLastRow();
        if (lastRow < 2) { tabsSkipped++; return; }

        var destTab = targetSS.getSheetByName(tabName);
        if (!destTab) {
          Logger.log('  TAB NOT IN TARGET: ' + tabName + ' — skipping');
          tabsSkipped++;
          return;
        }

        // ── Date-period merge ─────────────────────────────────────────────
        // effective_from_date = col H (index 7), effective_to_date = col I (index 8)
        // Only rows whose date-period key exists in the incoming data are replaced.
        // Rows from other periods (e.g. Aug rates when importing Sep) are kept.

        var srcData = srcTab.getRange(2, 1, lastRow - 1, 64).getValues();

        // Collect all date-period keys present in the incoming data
        var srcPeriods = {};
        srcData.forEach(function(row) {
          var key = normalizeDate_(row[7]) + '|' + normalizeDate_(row[8]);
          srcPeriods[key] = true;
        });

        // Read existing target rows and keep those NOT in the incoming date periods
        var destLast   = destTab.getLastRow();
        var keepRows   = [];
        var removedCount = 0;
        if (destLast > 1) {
          var existing = destTab.getRange(2, 1, destLast - 1, 64).getValues();
          existing.forEach(function(row) {
            var key = normalizeDate_(row[7]) + '|' + normalizeDate_(row[8]);
            if (srcPeriods[key]) { removedCount++; } else { keepRows.push(row); }
          });
        }

        // Rewrite: kept rows + new source rows
        if (destLast > 1) destTab.getRange(2, 1, destLast - 1, 64).clearContent();
        var allRows = keepRows.concat(srcData);
        if (allRows.length > 0) destTab.getRange(2, 1, allRows.length, 64).setValues(allRows);

        Logger.log('  ✓ ' + tabName + ': removed ' + removedCount + ' old-period rows, added ' +
                   srcData.length + ' new rows, kept ' + keepRows.length + ' other-period rows');
        tabsOk++;
        totalRows += srcData.length;
      });

      // ── Auto-archive ─────────────────────────────────────────────────────
      // Move processed file from Grid Import to Grid Archive / [Insurer] /
      try {
        var archiveFolder = getOrCreateInsurerArchiveFolder_(insurerCode);
        file.moveTo(archiveFolder);
        Logger.log('  Archived to: ' + archiveFolder.getName());
      } catch (archErr) {
        Logger.log('  WARNING: archive move failed — ' + archErr.message);
      }

      summary.push({ file: file.getName(), insurer: insurerCode, status: 'OK',
                     tabs: tabsOk, skipped: tabsSkipped, rows: totalRows });

    } catch (e) {
      Logger.log('  ERROR: ' + e.message);
      summary.push({ file: file.getName(), status: 'ERROR', reason: e.message });

    } finally {
      // Always delete the temporary converted Google Sheet
      if (tempId) {
        try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e2) {}
      }
    }
  }

  Logger.log('');
  Logger.log('=== importGridsFromFolder complete ===');
  summary.forEach(function(r) { Logger.log(JSON.stringify(r)); });
  return summary;
}

/**
 * Converts an Excel (.xlsx) file to a Google Sheets file.
 * Returns the new spreadsheet ID. Caller must trash after use.
 *
 * Requires: Advanced Drive Service (Services → Drive API → Add).
 */
function convertExcelToSheet_(file) {
  var resource = {
    title:    'TEMP_IMPORT__' + file.getName(),
    mimeType: MimeType.GOOGLE_SHEETS
  };
  var result = Drive.Files.create(resource, file.getBlob(), {fields: 'id'});
  return result.id;
}

/**
 * Finds the grid Sheet for insurerCode in CONFIG.FOLDER_GRIDS.
 * If not found, creates a new Sheet with all 5 product tabs.
 *
 * Search order:
 *   1. Exact filename: insurerCode + ' Grid'
 *   2. Scan folder for any file whose name contains insurerCode (case-insensitive)
 *   3. Create: insurerCode + ' Grid' with TW/PC/GCV/PCV/MiscD tabs
 */
function findOrCreateGridSheet_(insurerCode, insurerName) {
  var gridsFolder = DriveApp.getFolderById(CONFIG.FOLDER_GRIDS);

  // 1. Exact match on code
  var f = gridsFolder.getFilesByName(insurerCode + ' Grid');
  if (f.hasNext()) return f.next().getId();

  // 2. Scan for partial match — handles e.g. 'TATA AIG GENERAL INSURANCE CO LTD Grid'
  var all = gridsFolder.getFiles();
  var codeLower = insurerCode.toLowerCase();
  while (all.hasNext()) {
    var candidate = all.next();
    if (candidate.getName().toLowerCase().indexOf(codeLower) !== -1) {
      Logger.log('  Grid found by scan: ' + candidate.getName());
      return candidate.getId();
    }
  }

  // 3. Create new grid sheet for this insurer
  Logger.log('  No grid found for ' + insurerCode + ' — creating new sheet');
  var now     = new Date();
  var fyStart = (now.getMonth() + 1) >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  var fy      = String(fyStart).slice(2) + '-' + String(fyStart + 1).slice(2);

  var ss = SpreadsheetApp.create(insurerCode + ' Grid');
  DriveApp.getFileById(ss.getId()).moveTo(gridsFolder);

  var prefixes = ['TW', 'PC', 'GCV', 'PCV', 'MiscD'];
  prefixes.forEach(function(prefix, i) {
    var tab = (i === 0) ? ss.getSheets()[0] : ss.insertSheet();
    tab.setName(prefix + '_' + fy);
    tab.getRange(1, 1, 1, GRID_HEADERS.length).setValues([GRID_HEADERS]);
    tab.getRange(1, 1, 1, GRID_HEADERS.length).setFontWeight('bold');
    tab.setFrozenRows(1);
  });

  Logger.log('  Created grid sheet: ' + insurerCode + ' Grid (ID: ' + ss.getId() + ')');
  return ss.getId();
}

/**
 * Normalises a date value to a YYYY-MM-DD string for period-key comparison.
 * Handles Date objects (from Sheets) and string values.
 */
function normalizeDate_(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(val).trim();
}
