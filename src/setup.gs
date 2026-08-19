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
  ['Motor','TW','New (1+5)','Scooter/Bike','New Business','Y'],
  ['Motor','TW','New (5+5)','Scooter/Bike','New Business','Y'],
  ['Motor','TW','1+1','Scooter/Bike','New Business / Renewal','Y'],
  ['Motor','TW','SAOD','Scooter/Bike','New Business / Renewal','Y'],
  ['Motor','TW','SATP','Scooter/Bike','New Business / Renewal','Y'],
  ['Motor','Pvt Car','New (1+3)','','New Business','Y'],
  ['Motor','Pvt Car','New (3+3)','','New Business','Y'],
  ['Motor','Pvt Car','1+1','','New Business / Renewal','Y'],
  ['Motor','Pvt Car','SAOD','','New Business / Renewal','Y'],
  ['Motor','Pvt Car','SATP','','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','3W / Tanker / Water Tanker / Car Carrier / Flatbed / Oil Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','3W / Tanker / Water Tanker / Car Carrier / Flatbed / Oil Tanker','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','3W / Taxi 4+1 / Taxi 5+1 / Taxi>7 / Bus<12 / Bus>12<36 / Bus>36 / School Bus / Staff Bus','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','3W / Taxi 4+1 / Bus<12 / Bus>36 / School Bus / Staff Bus','New Business / Renewal','Y'],
  ['Misc D','Tractor','1+1','Excavator / Harvester / Agri Tractor','New Business / Renewal','Y'],
  ['Misc D','Tractor','SATP','Excavator / Harvester / Agri Tractor','New Business / Renewal','Y'],
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
  ['INDUSIND','INDUSIND BANK GENERAL INSURANCE CO LTD','[GSTIN]','[STATE]','[CODE]','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['NIA','THE NEW INDIA ASSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y']
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
  ['NIA','NIA','Direct match'],
  ['NEW INDIA','NIA','Alternate label'],
  ['New India','NIA','Short name variant']
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

  // Tab 6: Prompts
  addTab_(ss, 'Prompts',
    ['insurer_id','prompt_template','notes'], '#444444');

  Logger.log('Broker Config Sheet created with 6 tabs');
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
    'product_type','rto','match_type','match_status','response_ms','notes'
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

  Logger.log('Log Sheet created with 4 tabs');
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

// validateGrid() lives in CommissionApplication.gs
