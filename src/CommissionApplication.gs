/**
 * CaliberPO — Commission Application Engine
 *
 * Processes broker sales data against commission grids.
 * Input:  Sales file in CaliberPO/Input/ (130-col or raw broker export)
 * Output: Enriched Sales_Data_Master in CaliberPO/Output/
 *         Cols A-DH: original data preserved unchanged
 *         Cols DI-DZ: 18 commission working columns appended
 *
 * DY (col 129, 0-indexed) = Match Status — control field for everything
 * DZ (col 130, 0-indexed) = Flag/Notes
 *
 * Status values:
 *   MATCHED / NO_MATCH / MISSING_PARTNER / MISSING_FIELD /
 *   NORMALISATION_FAILED / DUPLICATE / INACTIVE_PARTNER /
 *   GRID_ERROR / DUPLICATE_RATE
 */

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

var ORIGINAL_COLS = 112;
var COMMISSION_COLS = 18;
var TOTAL_COLS = 130;
var STATUS_COL_IDX = 128;  // DY — 0-indexed
var NOTES_COL_IDX  = 129;  // DZ — 0-indexed

var COMMISSION_HEADERS = [
  'Grid Product',    // DI
  'Grid Sub-Type',   // DJ
  'New/Old',         // DK
  'PA Present',      // DL
  'Insurer Code',    // DM
  'Grid Tier',       // DN
  'PI Rate %',       // DO
  'PI ON',           // DP
  'PI Amount',       // DQ
  'PI Rate % (2)',   // DR
  'PI ON (2)',       // DS
  'PI Amount (2)',   // DT
  'PO Rate %',       // DU
  'PO Amount',       // DV
  'PO Rate % (2)',   // DW
  'PO Amount (2)',   // DX
  'Match Status',    // DY
  'Flag / Notes'     // DZ
];

// Standard field names after normalisation
// Maps to source columns in the broker sales file
var STANDARD_FIELDS = {
  PARTNER_ID:       'partner_id',
  PARTNER_NAME:     'partner_name',
  SYS_REF_NO:       'sys_ref_no',
  POLICY_NO:        'policy_no',
  INSURANCE_CO:     'insurance_company',
  PRODUCT:          'product',
  PRODUCT_TYPE:     'product_type',
  PRODUCT_SUB_TYPE: 'product_sub_type',
  ISSUE_DATE:       'policy_issue_date',
  BUSINESS_TYPE:    'business_type',
  RTO:              'rto',
  VEHICLE_MODEL:    'vehicle_model',
  MAKE_YEAR:        'make_year',
  FUEL_TYPE:        'vehicle_fuel_type',
  VEHICLE_CC:       'vehicle_cc',
  VEHICLE_GVW:      'vehicle_gvw',
  VEHICLE_SEATING:  'vehicle_seating',
  GROSS_PREMIUM:    'gross_premium',
  NET_PREMIUM:      'net_premium',
  OD_PREMIUM:       'od_premium',
  TP_PREMIUM:       'tp_premium',
  PA_COVER:         'pa_cover_owner'
};

// ── MAIN ENTRY POINT ──────────────────────────────────────────────────────────

/**
 * Main commission batch processing function.
 * Run from Apps Script editor or triggered via time-based trigger.
 */
function runCommissionBatch() {
  return wrapWithErrorHandling('runCommissionBatch', function() {

    Logger.log('=== CommissionApplication: Starting batch run ===');
    Logger.log('Period: ' + CONFIG.CURRENT_PERIOD);

    // Step 1: Period lock check
    if (!CONFIG.CURRENT_PERIOD) {
      throw new Error('CONFIG.CURRENT_PERIOD is not set. Set it to YYYY-MM before running.');
    }
    if (periodFileExists(CONFIG.FOLDER_OUTPUT, CONFIG.BROKER_SHORT_CODE, CONFIG.CURRENT_PERIOD)) {
      var msg = 'Period ' + CONFIG.CURRENT_PERIOD + ' already processed. ' +
                'Delete the output file from CaliberPO/Output/ to re-run.';
      MailApp.sendEmail(CONFIG.EMAIL_COORDINATOR,
        'CaliberPO — Period Lock: ' + CONFIG.CURRENT_PERIOD, msg);
      Logger.log('PERIOD LOCK: ' + msg);
      return;
    }

    // Step 2: Find and load input file
    var inputFiles = listFilesInFolder(CONFIG.FOLDER_INPUT);
    if (!inputFiles || inputFiles.length === 0) {
      throw new Error('No files found in CaliberPO/Input/. Upload sales file and retry.');
    }
    // Use most recently created file
    inputFiles.sort(function(a, b) { return b.createdDate - a.createdDate; });
    var inputFile = inputFiles[0];
    Logger.log('Input file: ' + inputFile.name + ' (' + inputFile.id + ')');

    var inputSS   = SpreadsheetApp.openById(inputFile.id);
    var inputSheet = inputSS.getSheets()[0];
    var inputData  = inputSheet.getDataRange().getValues();

    if (!inputData || inputData.length < 2) {
      throw new Error('Input file is empty or has no data rows.');
    }

    var sourceHeaders = inputData[0].map(function(h) {
      return h ? h.toString().trim() : '';
    });
    var sourceRows = inputData.slice(1);
    Logger.log('Source rows: ' + sourceRows.length);

    // Step 3: Load broker config into memory
    Logger.log('Loading broker config...');
    var fieldMap    = getSheetDataAsObjects(CONFIG.SHEET_BROKER_CONFIG, 'Field_Mapping');

    // Pre-check: Field_Mapping must have been confirmed by runMappingWizard() + confirmMapping()
    if (!fieldMap || fieldMap.length < 5) {
      throw new Error(
        'Field_Mapping has fewer than 5 rows. ' +
        'Run runMappingWizard() and confirmMapping() before processing sales data.'
      );
    }
    var insurerMap  = getSheetData(CONFIG.SHEET_BROKER_CONFIG, 'Insurer_Code_Map');
    var productMap  = getSheetData(CONFIG.SHEET_BROKER_CONFIG, 'Product_Map');
    var derivRules  = getSheetDataAsObjects(CONFIG.SHEET_BROKER_CONFIG, 'Derivation_Rules');

    // Step 4: Pre-scan to determine unique insurer+product combos
    // Build field index from source headers for fast column lookup
    var sourceIndex = buildSourceIndex(sourceHeaders, fieldMap);

    // Step 5: Process each row
    Logger.log('Processing rows...');
    var outputRows   = [];
    var exceptions   = [];
    var statusCounts = {};
    var policiesToLog = [];

    sourceRows.forEach(function(row, idx) {
      // Skip completely empty rows
      var isEmpty = row.every(function(c) {
        return c === null || c === undefined || c === '';
      });
      if (isEmpty) return;

      var result = processRow(
        row, sourceHeaders, sourceIndex,
        fieldMap, insurerMap, productMap, derivRules,
        inputFile.name
      );

      outputRows.push(result.outputRow);

      var status = result.outputRow[STATUS_COL_IDX];
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (status !== 'MATCHED') {
        exceptions.push({
          policyNo: result.outputRow[2] || ('Row ' + (idx + 2)),
          status:   status,
          notes:    result.outputRow[NOTES_COL_IDX] || ''
        });
      } else {
        // Queue for processed_policies log
        policiesToLog.push([
          result.outputRow[2],        // policy_no (col C)
          CONFIG.CURRENT_PERIOD,
          inputFile.name
        ]);
      }
    });

    Logger.log('Processing complete. Status counts: ' + JSON.stringify(statusCounts));

    // Step 6: Write output file
    Logger.log('Writing output file...');
    var outputFileName = CONFIG.BROKER_SHORT_CODE + '_Sales_Data_' +
      CONFIG.CURRENT_PERIOD + '_' +
      Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyyMMdd') + '.xlsx';

    var outputSS = createSheetInFolder(CONFIG.FOLDER_OUTPUT, outputFileName);
    var outputSheet = outputSS.getSheets()[0];
    outputSheet.setName('Policy_Data');

    // Write section header row (row 1)
    var sectionHeaders = new Array(TOTAL_COLS).fill('');
    sectionHeaders[0]   = 'ORIGINAL SALES DATA';
    sectionHeaders[112] = 'COMMISSION WORKING';
    outputSheet.getRange(1, 1, 1, TOTAL_COLS).setValues([sectionHeaders]);

    // Style section headers
    var origRange = outputSheet.getRange(1, 1, 1, ORIGINAL_COLS);
    origRange.setBackground('#1F3864');
    origRange.setFontColor('#FFFFFF');
    origRange.setFontWeight('bold');

    var commRange = outputSheet.getRange(1, ORIGINAL_COLS + 1, 1, COMMISSION_COLS);
    commRange.setBackground('#375623');
    commRange.setFontColor('#FFFFFF');
    commRange.setFontWeight('bold');

    // Write column headers row (row 2)
    var allHeaders = sourceHeaders.concat(COMMISSION_HEADERS);
    // Pad to 130 cols if source has fewer
    while (allHeaders.length < TOTAL_COLS) allHeaders.push('');
    outputSheet.getRange(2, 1, 1, TOTAL_COLS).setValues([allHeaders]);
    styleHeaderRow(outputSheet, 2, ORIGINAL_COLS, '#1F3864', '#FFFFFF');
    // Style commission headers at correct offset
    outputSheet.getRange(2, ORIGINAL_COLS + 1, 1, COMMISSION_COLS)
      .setBackground('#375623').setFontColor('#FFFFFF').setFontWeight('bold');

    // Write data rows (starting row 3)
    if (outputRows.length > 0) {
      outputSheet.getRange(3, 1, outputRows.length, TOTAL_COLS).setValues(outputRows);
    }

    // Freeze header rows
    outputSheet.setFrozenRows(2);
    SpreadsheetApp.flush();

    Logger.log('Output file written: ' + outputFileName);

    // Step 7: Log processed policies
    if (policiesToLog.length > 0) {
      logProcessedPoliciesBatch(policiesToLog);
    }

    // Step 8: Send exception summary email
    sendExceptionSummary({
      period:       CONFIG.CURRENT_PERIOD,
      totalRows:    outputRows.length,
      matched:      statusCounts['MATCHED'] || 0,
      statusCounts: statusCounts,
      exceptions:   exceptions
    });

    Logger.log('=== CommissionApplication: Batch run complete ===');
    Logger.log('Total: ' + outputRows.length + ', Matched: ' + (statusCounts['MATCHED'] || 0));

    return {
      totalRows:    outputRows.length,
      matched:      statusCounts['MATCHED'] || 0,
      statusCounts: statusCounts,
      outputFile:   outputFileName
    };
  }, 'MANUAL');
}

// ── TARGETED RE-RUN ───────────────────────────────────────────────────────────

/**
 * Re-processes only rows with a specific Match Status.
 * Used after fixing data issues (e.g. adding a missing partner).
 * Updates the existing output file in-place.
 *
 * @param {string} status - DY status value to reprocess e.g. "MISSING_PARTNER"
 */
function runByStatus(status) {
  return wrapWithErrorHandling('runByStatus', function() {

    if (!status) throw new Error('Status parameter required e.g. runByStatus("MISSING_PARTNER")');
    Logger.log('runByStatus: reprocessing rows with status = ' + status);

    // Find existing output file
    var prefix   = CONFIG.BROKER_SHORT_CODE + '_Sales_Data_' + CONFIG.CURRENT_PERIOD;
    var fileId   = findMostRecentFileByPrefix(CONFIG.FOLDER_OUTPUT, prefix);
    if (!fileId) {
      throw new Error('No output file found for period ' + CONFIG.CURRENT_PERIOD +
        '. Run runCommissionBatch() first.');
    }

    var outputSS    = SpreadsheetApp.openById(fileId);
    var outputSheet = outputSS.getSheetByName('Policy_Data');
    if (!outputSheet) throw new Error('Policy_Data tab not found in output file');

    var data = outputSheet.getDataRange().getValues();
    // Row 0 = section headers, Row 1 = col headers, Row 2+ = data

    // Load broker config
    var fieldMap   = getSheetDataAsObjects(CONFIG.SHEET_BROKER_CONFIG, 'Field_Mapping');
    var insurerMap = getSheetData(CONFIG.SHEET_BROKER_CONFIG, 'Insurer_Code_Map');
    var productMap = getSheetData(CONFIG.SHEET_BROKER_CONFIG, 'Product_Map');
    var derivRules = getSheetDataAsObjects(CONFIG.SHEET_BROKER_CONFIG, 'Derivation_Rules');

    var sourceHeaders = data[1].map(function(h) {
      return h ? h.toString().trim() : '';
    }).slice(0, ORIGINAL_COLS);

    var sourceIndex = buildSourceIndex(sourceHeaders, fieldMap);

    var reprocessed = 0;
    var nowMatched  = 0;
    var policiesToLog = [];

    for (var i = 2; i < data.length; i++) {
      var row = data[i];
      if (!row || row.every(function(c) { return c === '' || c === null; })) continue;

      var rowStatus = row[STATUS_COL_IDX] ? row[STATUS_COL_IDX].toString() : '';
      if (rowStatus !== status) continue;

      // Re-process this row
      var sourceRow = row.slice(0, ORIGINAL_COLS);
      var result = processRow(
        sourceRow, sourceHeaders, sourceIndex,
        fieldMap, insurerMap, productMap, derivRules,
        'rerun-' + status
      );

      // Update commission columns only (cols DI-DZ)
      var newCommCols = result.outputRow.slice(ORIGINAL_COLS);
      outputSheet.getRange(i + 1, ORIGINAL_COLS + 1, 1, COMMISSION_COLS)
        .setValues([newCommCols]);

      reprocessed++;
      if (result.outputRow[STATUS_COL_IDX] === 'MATCHED') {
        nowMatched++;
        policiesToLog.push([result.outputRow[2], CONFIG.CURRENT_PERIOD, 'rerun']);
      }
    }

    SpreadsheetApp.flush();

    if (policiesToLog.length > 0) {
      logProcessedPoliciesBatch(policiesToLog);
    }

    var msg = 'runByStatus("' + status + '"): ' + reprocessed + ' rows reprocessed, ' +
      nowMatched + ' now MATCHED, ' + (reprocessed - nowMatched) + ' still ' + status;
    Logger.log(msg);

    if (CONFIG.EMAIL_COORDINATOR) {
      MailApp.sendEmail(CONFIG.EMAIL_COORDINATOR,
        'CaliberPO — Re-run Complete: ' + status, msg);
    }

    return { reprocessed: reprocessed, nowMatched: nowMatched };
  }, 'MANUAL');
}

// ── ROW PROCESSING ────────────────────────────────────────────────────────────

/**
 * Processes a single source row.
 * Returns a 130-element array: original 112 cols + 18 commission cols.
 *
 * @param {Array}    row          - Source data row (112 elements)
 * @param {string[]} sourceHeaders - Source column headers
 * @param {Object}   sourceIndex  - Pre-built header→colIdx map
 * @param {Array}    fieldMap     - Field mapping config rows
 * @param {Array}    insurerMap   - Insurer code map data
 * @param {Array}    productMap   - Product map data
 * @param {Array}    derivRules   - Derivation rules
 * @param {string}   sourceFile   - Source file name for logging
 * @returns {Object} { outputRow: Array[130] }
 */
function processRow(row, sourceHeaders, sourceIndex,
                    fieldMap, insurerMap, productMap, derivRules, sourceFile) {

  // Initialise 130-col output row
  var outputRow = [];
  for (var i = 0; i < ORIGINAL_COLS; i++) {
    outputRow.push(row[i] !== undefined ? row[i] : '');
  }
  // Append 18 blank commission cols
  for (var j = 0; j < COMMISSION_COLS; j++) {
    outputRow.push('');
  }

  function setCommission(colOffset, value) {
    outputRow[ORIGINAL_COLS + colOffset] = value !== null && value !== undefined ? value : '';
  }

  function setStatus(status, notes) {
    outputRow[STATUS_COL_IDX] = status;
    outputRow[NOTES_COL_IDX]  = notes || '';
  }

  try {
    // ── Step 1: Map source fields ─────────────────────────────────────────
    var mapped = mapSourceFields(row, sourceIndex, fieldMap, insurerMap, productMap);

    // ── Step 2: Validate required fields ──────────────────────────────────
    if (!mapped.partner_id) {
      setStatus('MISSING_FIELD', 'Posp Id is blank');
      return { outputRow: outputRow };
    }
    if (!mapped.policy_issue_date) {
      setStatus('MISSING_FIELD', 'Issue Date missing or could not be parsed');
      return { outputRow: outputRow };
    }
    if (!mapped.insurance_company) {
      setStatus('NORMALISATION_FAILED',
        'Insurer not mapped: "' + (mapped._raw_insurer || '') + '" — add to Insurer_Code_Map tab');
      return { outputRow: outputRow };
    }
    if (!mapped.product_type) {
      setStatus('NORMALISATION_FAILED',
        'Product Type not mapped: "' + (mapped._raw_product_type || '') + '" — add to Product_Map tab');
      return { outputRow: outputRow };
    }

    // ── Step 3: Derive calculated fields ──────────────────────────────────
    var vehicleAge   = deriveVehicleAge(mapped.make_year);
    var paPresent    = mapped.pa_cover_owner ? 'Y' : 'N';
    var subSubType   = '';
    if (mapped.product_type === 'TW' && !mapped.product_sub_sub_type) {
      subSubType = deriveSubSubType(mapped.vehicle_model, derivRules) || '';
    }

    // ── Step 4: Partner Master check ──────────────────────────────────────
    var partnerStatus = checkPartnerMaster(mapped.partner_id);
    if (partnerStatus === 'NOT_FOUND') {
      setStatus('MISSING_PARTNER',
        'Posp Id "' + mapped.partner_id + '" not found in Partner Master');
      return { outputRow: outputRow };
    }
    if (partnerStatus === 'INACTIVE') {
      setStatus('INACTIVE_PARTNER',
        'Partner "' + mapped.partner_id + '" is inactive (active=N)');
      return { outputRow: outputRow };
    }

    // ── Step 5: Duplicate policy check ────────────────────────────────────
    if (mapped.policy_no &&
        isPolicyAlreadyProcessed(mapped.policy_no, CONFIG.CURRENT_PERIOD)) {
      setStatus('DUPLICATE',
        'Policy "' + mapped.policy_no + '" already processed in ' + CONFIG.CURRENT_PERIOD);
      return { outputRow: outputRow };
    }

    // ── Step 6: Set commission working cols DI-DN (grid context) ──────────
    setCommission(0, mapped.product_type);           // DI: Grid Product
    setCommission(1, mapped.product_sub_type || ''); // DJ: Grid Sub-Type
    setCommission(2, vehicleAge || '');              // DK: New/Old
    setCommission(3, paPresent);                     // DL: PA Present
    setCommission(4, mapped.insurance_company);      // DM: Insurer Code

    // ── Step 7: Rate lookup ───────────────────────────────────────────────
    var lookupParams = {
      insurerId:       mapped.insurance_company,
      productType:     mapped.product_type,
      productSubType:  mapped.product_sub_type || '',
      rto:             mapped.rto || '',
      vehicleCc:       mapped.vehicle_cc      ? parseFloat(mapped.vehicle_cc)      : null,
      vehicleGvw:      mapped.vehicle_gvw     ? parseFloat(mapped.vehicle_gvw)     : null,
      vehicleSeating:  mapped.vehicle_seating  ? parseFloat(mapped.vehicle_seating) : null,
      policyIssueDate: mapped.policy_issue_date,
      netPremium:      normalisePremium(mapped.net_premium),
      odPremium:       normalisePremium(mapped.od_premium),
      tpPremium:       normalisePremium(mapped.tp_premium)
    };

    var rateResult = lookupRate(lookupParams);

    // ── Condition-absent PI adjustments ───────────────────────────────────
    // Each adj column holds a differential applied when that condition is NOT
    // present on the policy. Both + and - values are treated identically:
    // applied only when absent. Blank adj = insurer doesn't differentiate.
    // mapped.has_ncb / has_nil_dep / has_cpa come from source field mapping —
    // truthy means the condition IS present (no deduction needed).
    if (rateResult.success) {
      var piAdj = 0;
      if (rateResult.ncbAdj    !== null && !mapped.has_ncb)     piAdj += rateResult.ncbAdj;
      if (rateResult.nilDepAdj !== null && !mapped.has_nil_dep) piAdj += rateResult.nilDepAdj;
      if (rateResult.cpaAdj    !== null && !mapped.has_cpa)     piAdj += rateResult.cpaAdj;
      if (piAdj !== 0) {
        rateResult.piRate  = Math.round(((rateResult.piRate  || 0) + piAdj) * 100) / 100;
        rateResult.poRate  = Math.round(((rateResult.poRate  || 0) + piAdj) * 100) / 100;
        if (rateResult.piRate2 !== null) {
          rateResult.piRate2 = Math.round(((rateResult.piRate2 || 0) + piAdj) * 100) / 100;
          rateResult.poRate2 = Math.round(((rateResult.poRate2 || 0) + piAdj) * 100) / 100;
        }
      }
    }

    // ── Step 8: Write rate results to commission cols ─────────────────────
    setCommission(5,  rateResult.gridTier  || '');  // DN: Grid Tier
    setCommission(6,  rateResult.piRate    || '');  // DO: PI Rate %
    setCommission(7,  rateResult.piOn      || '');  // DP: PI ON
    setCommission(8,  rateResult.piAmount  || '');  // DQ: PI Amount
    setCommission(9,  rateResult.piRate2   || '');  // DR: PI Rate % (2)
    setCommission(10, rateResult.piOn2     || '');  // DS: PI ON (2)
    setCommission(11, rateResult.piAmount2 || '');  // DT: PI Amount (2)
    setCommission(12, rateResult.poRate    || '');  // DU: PO Rate %
    setCommission(13, rateResult.poAmount  || '');  // DV: PO Amount
    setCommission(14, rateResult.poRate2   || '');  // DW: PO Rate % (2)
    setCommission(15, rateResult.poAmount2 || '');  // DX: PO Amount (2)

    // ── Step 9: Set final match status ────────────────────────────────────
    setStatus(rateResult.matchStatus, rateResult.notes || '');

  } catch (rowErr) {
    setStatus('GRID_ERROR', 'Processing error: ' + rowErr.message);
    Logger.log('processRow error: ' + rowErr.message);
  }

  return { outputRow: outputRow };
}

// ── FIELD MAPPING ─────────────────────────────────────────────────────────────

/**
 * Builds a source column index from headers and field mapping.
 * Maps standard_field names to 0-based column indices in the source file.
 *
 * @param {string[]} sourceHeaders - Source file column headers
 * @param {Object[]} fieldMap      - Field mapping config rows
 * @returns {Object} Map of standard_field → column index
 */
function buildSourceIndex(sourceHeaders, fieldMap) {
  var headerIdx = {};
  sourceHeaders.forEach(function(h, i) {
    if (h) headerIdx[h.trim().toLowerCase()] = i;
  });

  var sourceIndex = {};
  fieldMap.forEach(function(mapping) {
    var brokerField   = (mapping.broker_field   || '').trim();
    var standardField = (mapping.standard_field || '').trim();
    if (!brokerField || !standardField) return;
    var colIdx = headerIdx[brokerField.toLowerCase()];
    if (colIdx !== undefined) {
      sourceIndex[standardField] = colIdx;
    }
  });

  return sourceIndex;
}

/**
 * Maps source row values to standard field names using config.
 * Applies transforms: date_format, rto_normalise, gvw_normalise,
 * insurer_code_map, product_map.
 *
 * @param {Array}    row         - Source data row
 * @param {Object}   sourceIndex - standard_field → col index map
 * @param {Object[]} fieldMap    - Field mapping config
 * @param {Array}    insurerMap  - Insurer code map data (2D)
 * @param {Array}    productMap  - Product map data (2D)
 * @returns {Object} Mapped and transformed field values
 */
function mapSourceFields(row, sourceIndex, fieldMap, insurerMap, productMap) {
  var mapped = {};

  fieldMap.forEach(function(mapping) {
    var standardField = (mapping.standard_field || '').trim();
    var transform     = (mapping.transform      || 'none').trim().toLowerCase();
    if (!standardField) return;

    var colIdx = sourceIndex[standardField];
    var rawVal = colIdx !== undefined ? row[colIdx] : '';
    if (rawVal === null || rawVal === undefined) rawVal = '';

    var val = rawVal;

    switch (transform) {
      case 'date_format':
        val = normaliseDate(rawVal) || '';
        break;

      case 'rto_normalise':
        val = rawVal ? (normaliseRTO(rawVal) || rawVal.toString()) : '';
        break;

      case 'gvw_normalise':
        var gvwVal = normaliseGVW(rawVal, CONFIG.GVW_UNIT);
        val = gvwVal !== null ? gvwVal : '';
        break;

      case 'insurer_code_map':
        var rawInsurer = rawVal ? rawVal.toString().trim() : '';
        mapped['_raw_insurer'] = rawInsurer;
        val = lookupInMap(insurerMap, rawInsurer) || '';
        break;

      case 'product_map':
        var brokerField = (mapping.broker_field || '').trim();
        var rawProduct  = rawVal ? rawVal.toString().trim() : '';
        val = lookupProductMap(productMap, brokerField, rawProduct) || '';
        if (standardField === 'product_type' && !val) {
          mapped['_raw_product_type'] = rawProduct;
        }
        break;

      case 'ncb_normalise':
        // NCB comes as 0/20/25/35/45/50 or "20%". 0 and blank both mean no NCB.
        var ncbStr = rawVal ? rawVal.toString().replace('%', '').trim() : '';
        var ncbNum = parseFloat(ncbStr);
        val = (isNaN(ncbNum) || ncbNum === 0) ? 0 : ncbNum;
        break;

      default:
        val = rawVal;
    }

    mapped[standardField] = val;
  });

  return mapped;
}

/**
 * Looks up a value in the Product_Map config tab.
 * Matches on broker_field (col 0) + broker_value (col 1).
 * Returns caliber_value (col 3).
 *
 * @param {Array}  productMap  - Product map data (2D array with header)
 * @param {string} brokerField - Field name e.g. "Product Type"
 * @param {string} brokerValue - Value to look up e.g. "Two Wheeler"
 * @returns {string|null} CaliberPO canonical value or null
 */
function lookupProductMap(productMap, brokerField, brokerValue) {
  if (!productMap || !brokerField || !brokerValue) return null;
  var bField = brokerField.toLowerCase().trim();
  var bValue = brokerValue.toLowerCase().trim();
  for (var i = 1; i < productMap.length; i++) {
    var row = productMap[i];
    if (!row[0] || !row[1]) continue;
    if (row[0].toString().toLowerCase().trim() === bField &&
        row[1].toString().toLowerCase().trim() === bValue) {
      return row[3] ? row[3].toString().trim() : null;
    }
  }
  return null;
}

// ── PARTNER MASTER CHECK ──────────────────────────────────────────────────────

/**
 * Checks if a partner exists in the Partner Master and is active.
 *
 * @param {string} partnerId - POSP ID to check
 * @returns {string} "FOUND" | "NOT_FOUND" | "INACTIVE"
 */
function checkPartnerMaster(partnerId) {
  try {
    var partners = getSheetDataAsObjects(CONFIG.SHEET_PARTNER_MASTER, 'Partners');
    for (var i = 0; i < partners.length; i++) {
      if (partners[i].posp_id &&
          partners[i].posp_id.toString().trim() === partnerId.toString().trim()) {
        return partners[i].active === 'N' ? 'INACTIVE' : 'FOUND';
      }
    }
    return 'NOT_FOUND';
  } catch (e) {
    Logger.log('checkPartnerMaster failed (non-fatal): ' + e.message);
    return 'FOUND'; // fail open — do not block on partner check failure
  }
}

// ── GRID VALIDATION ───────────────────────────────────────────────────────────

/**
 * Validates a commission grid tab before use.
 * Run from Apps Script editor after uploading each insurer grid.
 *
 * @param {string} spreadsheetId - Grid spreadsheet ID
 * @param {string} tabName       - Tab name e.g. "TW_2026-08"
 * @returns {Object} { valid, errors, tabName, rowsChecked }
 */
function validateGrid(spreadsheetId, tabName) {
  try {
    var ss    = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);

    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var errors  = [];

    // Check 1: Minimum 64 columns
    if (headers.length < 64) {
      errors.push({
        row: 1, col: headers.length,
        message: 'Expected 64 columns, found ' + headers.length
      });
    }

    var PI_RATE_COL    = 36; // col AK (0-indexed)
    var PI_RATE_ON_COL = 37; // col AL
    var RTO_LIST_COL   = 25; // col Z
    var VALID_RATE_ON  = ['OD', 'TP', 'NET', 'FLAT', 'TP1Y'];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row.every(function(c) {
        return c === '' || c === null || c === undefined;
      })) continue;

      // Check 2: PI Rate must be numeric if not blank
      var piRate = row[PI_RATE_COL];
      if (piRate !== '' && piRate !== null && piRate !== undefined) {
        if (isNaN(parseFloat(piRate.toString()))) {
          errors.push({
            row: i + 1, col: PI_RATE_COL + 1,
            message: 'PI Rate not numeric: "' + piRate + '"'
          });
        }
      }

      // Check 3: PI Rate On must be valid
      var piRateOn = (row[PI_RATE_ON_COL] || '').toString().toUpperCase().trim();
      if (piRateOn !== '' && VALID_RATE_ON.indexOf(piRateOn) === -1) {
        errors.push({
          row: i + 1, col: PI_RATE_ON_COL + 1,
          message: 'Invalid PI Rate On: "' + piRateOn + '" (valid: ' + VALID_RATE_ON.join(', ') + ')'
        });
      }

      // Check 4: rto_list must not be blank
      var rtoList = (row[RTO_LIST_COL] || '').toString().trim();
      if (rtoList === '') {
        errors.push({
          row: i + 1, col: RTO_LIST_COL + 1,
          message: 'rto_list is blank — must contain RTO codes or "All"'
        });
      }
    }

    var result = {
      valid:       errors.length === 0,
      errors:      errors,
      tabName:     tabName,
      rowsChecked: data.length - 1
    };

    if (errors.length > 0) {
      Logger.log('validateGrid FAILED: ' + errors.length + ' errors in ' + tabName);
      errors.forEach(function(e) {
        Logger.log('  Row ' + e.row + ', Col ' + e.col + ': ' + e.message);
      });
      if (CONFIG.EMAIL_COORDINATOR) {
        var emailBody = 'Grid validation failed for tab: ' + tabName + '\n\n' +
          errors.length + ' errors found:\n\n' +
          errors.map(function(e) {
            return 'Row ' + e.row + ', Col ' + e.col + ': ' + e.message;
          }).join('\n') +
          '\n\n— CaliberPO System';
        MailApp.sendEmail(CONFIG.EMAIL_COORDINATOR,
          'CaliberPO — Grid Validation Failed: ' + tabName, emailBody);
      }
    } else {
      Logger.log('validateGrid PASSED: ' + tabName +
        ' (' + result.rowsChecked + ' rows checked)');
    }

    return result;

  } catch (e) {
    Logger.log('validateGrid failed: ' + e.message);
    throw e;
  }
}
