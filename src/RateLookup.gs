/**
 * CaliberPO — Rate Lookup Engine
 *
 * Serves the Rate Lookup web form and API endpoint.
 * Two-pass RTO matching against commission grids.
 * Grid rows filtered by effective date before any other matching.
 *
 * Web form: doGet(e) → index.html
 * API: doGet(e) with ?api=true → JSON response
 */

// ── WEB APP ENTRY POINT ───────────────────────────────────────────────────────

/**
 * Web App entry point.
 * Routes to API handler or serves HTML form.
 */
function doGet(e) {
  try {
    if (e && e.parameter && (e.parameter.api === 'true' || e.parameter.mode === 'api')) {
      return handleAPIRequest(e);
    }
    return HtmlService
      .createHtmlOutputFromFile('index')
      .setTitle('CaliberPO — Rate Lookup')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles API requests from system integrations.
 * All parameters passed as URL query params.
 */
function handleAPIRequest(e) {
  try {
    // API key validation — key stored in Script Properties, never in code
    var expectedKey = PropertiesService.getScriptProperties().getProperty('RATE_API_KEY');
    if (expectedKey) {
      var callerKey = e.parameter.apiKey || '';
      if (callerKey !== expectedKey) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, error: 'Invalid or missing apiKey' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    var params = {
      insurerId:       e.parameter.insurerId       || '',
      productType:     e.parameter.productType     || '',
      productSubType:    e.parameter.productSubType    || '',
      productSubSubType: e.parameter.productSubSubType || '',
      rto:             e.parameter.rto             || '',
      vehicleCc:       e.parameter.vehicleCc       ? parseFloat(e.parameter.vehicleCc)       : null,
      vehicleGvw:      e.parameter.vehicleGvw      ? parseFloat(e.parameter.vehicleGvw)      : null,
      vehicleSeating:  e.parameter.vehicleSeating  ? parseFloat(e.parameter.vehicleSeating)  : null,
      policyIssueDate: e.parameter.policyIssueDate || '',
      netPremium:      e.parameter.netPremium      ? parseFloat(e.parameter.netPremium)      : 0,
      odPremium:       e.parameter.odPremium       ? parseFloat(e.parameter.odPremium)       : 0,
      tpPremium:       e.parameter.tpPremium       ? parseFloat(e.parameter.tpPremium)       : 0,
      fuelType:        e.parameter.fuelType        || '',
      nilDep:          e.parameter.nilDep          || '',
      ncb:             e.parameter.ncb             || '',
      yom:             e.parameter.yom             ? parseInt(e.parameter.yom)               : null
    };
    var result = lookupRate(params);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── FORM DATA PROVIDERS (called by index.html via google.script.run) ──────────

/**
 * Returns list of active insurers for the form dropdown.
 * Called by index.html on page load.
 *
 * @returns {Object[]} Array of {id, name} objects
 */
function getInsurers() {
  try {
    var insurers = getSheetDataAsObjects(CONFIG.SHEET_INSURER_MASTER, 'Insurers');
    return insurers
      .filter(function(row) { return row.active === 'Y'; })
      .map(function(row) {
        return { id: row.insurer_id, name: row.insurer_name };
      });
  } catch (e) {
    throw new Error('getInsurers failed: ' + e.message);
  }
}

/**
 * Returns unique product types for the form dropdown.
 * Called by index.html on page load.
 *
 * @returns {string[]} Array of unique product_type values
 */
function getProductTypes() {
  try {
    var products = getSheetDataAsObjects(CONFIG.SHEET_PRODUCT_MASTER, 'Motor');
    var seen = {};
    var types = [];
    products.forEach(function(row) {
      if (row.product_type && !seen[row.product_type] && row.active === 'Y') {
        seen[row.product_type] = true;
        types.push(row.product_type);
      }
    });
    return types;
  } catch (e) {
    throw new Error('getProductTypes failed: ' + e.message);
  }
}

/**
 * Returns product sub-types for a given product type.
 * Called by index.html when product type changes.
 *
 * @param {string} productType - Selected product type
 * @returns {string[]} Array of product_sub_type values
 */
function getProductSubTypes(productType) {
  try {
    var products = getSheetDataAsObjects(CONFIG.SHEET_PRODUCT_MASTER, 'Motor');
    var seen = {};
    var subTypes = [];
    products.forEach(function(row) {
      if (row.product_type === productType &&
          row.product_sub_type &&
          !seen[row.product_sub_type] &&
          row.active === 'Y') {
        seen[row.product_sub_type] = true;
        subTypes.push(row.product_sub_type);
      }
    });
    return subTypes;
  } catch (e) {
    throw new Error('getProductSubTypes failed: ' + e.message);
  }
}

/**
 * Returns unique product sub-sub-types for a given product type + sub type.
 * Returns [] when this combination has no sub-sub-type (e.g. Pvt Car, Construction Eqpt).
 *
 * @param {string} productType    - Col B value
 * @param {string} productSubType - Col C value
 * @returns {string[]} Unique sub-sub-type strings, or []
 */
function getProductSubSubTypes(productType, productSubType) {
  try {
    var products = getSheetDataAsObjects(CONFIG.SHEET_PRODUCT_MASTER, 'Motor');
    var seen = {};
    var subSubTypes = [];
    products.forEach(function(row) {
      if (row.active === 'Y' &&
          row.product_type === productType &&
          row.product_sub_type === productSubType) {
        var val = row.product_sub_sub_type;
        if (val && val.toString().trim() !== '' && !seen[val]) {
          seen[val] = true;
          subSubTypes.push(val.toString().trim());
        }
      }
    });
    return subSubTypes;
  } catch (e) {
    throw new Error('getProductSubSubTypes failed: ' + e.message);
  }
}

/**
 * Returns complete form configuration in one server call.
 * Called once on form load — replaces separate getInsurers(),
 * getProductTypes(), getProductSubTypes() calls.
 *
 * @returns {Object} Full form config including insurers, productTypes,
 *   subTypesByProductType, subSubTypesByProductType, fieldConfig, fuelTypes
 */
function getFormConfig() {
  try {
    var insurers = getSheetDataAsObjects(CONFIG.SHEET_INSURER_MASTER, 'Insurers');
    var insurerList = insurers
      .filter(function(r) { return r.active === 'Y'; })
      .map(function(r) { return { id: r.insurer_id, name: r.insurer_name }; });

    var products = getSheetDataAsObjects(CONFIG.SHEET_PRODUCT_MASTER, 'Motor');
    var activeProducts = products.filter(function(r) { return r.active === 'Y'; });

    var seenTypes = {};
    var productTypes = [];
    activeProducts.forEach(function(r) {
      if (r.product_type && !seenTypes[r.product_type]) {
        seenTypes[r.product_type] = true;
        productTypes.push(r.product_type);
      }
    });

    var subTypesByProductType    = {};
    var subSubTypesByProductType = {};
    activeProducts.forEach(function(r) {
      if (!r.product_type) return;

      if (r.product_sub_type) {
        if (!subTypesByProductType[r.product_type]) {
          subTypesByProductType[r.product_type] = [];
        }
        var existing = subTypesByProductType[r.product_type];
        if (existing.indexOf(r.product_sub_type) === -1) {
          existing.push(r.product_sub_type);
        }
      }

      if (r.product_sub_sub_type) {
        var sssVal = r.product_sub_sub_type.toString().trim();
        if (sssVal) {
          if (!subSubTypesByProductType[r.product_type]) {
            subSubTypesByProductType[r.product_type] = [];
          }
          var existingSub = subSubTypesByProductType[r.product_type];
          if (existingSub.indexOf(sssVal) === -1) existingSub.push(sssVal);
        }
      }
    });

    var fieldConfig = {
      'TW':               { cc: true,  fuel: true,  gvw: false, seating: false, yom: false, nilDep: false, ncb: false },
      'Pvt Car':          { cc: true,  fuel: true,  gvw: false, seating: false, yom: true,  nilDep: true,  ncb: true  },
      'GCV':              { cc: false, fuel: true,  gvw: true,  seating: false, yom: true,  nilDep: false, ncb: false },
      'PCV':              { cc: false, fuel: true,  gvw: false, seating: true,  yom: true,  nilDep: false, ncb: false },
      'Tractor':          { cc: false, fuel: false, gvw: false, seating: false, yom: true,  nilDep: false, ncb: false },
      'Construction Eqpt':{ cc: false, fuel: false, gvw: false, seating: false, yom: false, nilDep: false, ncb: false }
    };

    return {
      insurers:                 insurerList,
      productTypes:             productTypes,
      subTypesByProductType:    subTypesByProductType,
      subSubTypesByProductType: subSubTypesByProductType,
      fieldConfig:              fieldConfig,
      fuelTypes:                ['Petrol', 'Diesel', 'Bio Fuel', 'Electric']
    };

  } catch (e) {
    throw new Error('getFormConfig failed: ' + e.message);
  }
}

/**
 * Derives vehicle age category from year of manufacture.
 * New = yom >= current calendar year; Old = yom < current year.
 *
 * @param {number} yom - Year of manufacture
 * @returns {string} 'New' or 'Old'
 */
function deriveVehicleAge(yom) {
  if (!yom) return '';
  return parseInt(yom) >= new Date().getFullYear() ? 'New' : 'Old';
}

// ── CORE RATE LOOKUP ENGINE ───────────────────────────────────────────────────

/**
 * Main rate lookup function.
 * Used by both the web form and CommissionApplication.gs.
 *
 * @param {Object} params - Lookup parameters:
 *   insurerId, productType, productSubType, rto,
 *   vehicleCc, vehicleGvw, vehicleSeating, policyIssueDate,
 *   netPremium, odPremium, tpPremium
 *
 * @returns {Object} Result object:
 *   success, matchType, gridTier, matchStatus, notes,
 *   piRate, piOn, piAmount, piRate2, piOn2, piAmount2,
 *   poRate, poAmount, poRate2, poAmount2
 */
function lookupRate(params) {
  var startTime = new Date().getTime();
  var result = {
    success:     false,
    matchType:   '',
    gridTier:    '',
    matchStatus: 'NO_MATCH',
    vehicleAge:  '',
    notes:       '',
    piRate:      null,
    piOn:        null,
    piAmount:    null,
    piRate2:     null,
    piOn2:       null,
    piAmount2:   null,
    poRate:      null,
    poAmount:    null,
    poRate2:     null,
    poAmount2:   null
  };

  try {
    // Validate required params
    if (!params.insurerId)       return Object.assign(result, { notes: 'insurerId is required' });
    if (!params.productType)     return Object.assign(result, { notes: 'productType is required' });
    if (!params.policyIssueDate) return Object.assign(result, { notes: 'policyIssueDate is required' });

    // Normalise inputs
    var normRTO   = params.rto ? normaliseRTO(params.rto) : '';
    var issueDate = normaliseDate(params.policyIssueDate);
    if (!issueDate) return Object.assign(result, { notes: 'Invalid policyIssueDate: ' + params.policyIssueDate });

    var period  = derivePeriod(issueDate);
    var tabName = getGridTabName(params.productType, period);

    // Load grid sheet
    var gridSheetId = findInsurerGridSheet(params.insurerId);
    if (!gridSheetId) {
      return Object.assign(result, { notes: 'Grid not found for insurer: ' + params.insurerId });
    }

    // Load grid tab
    var gridData;
    try {
      gridData = getSheetData(gridSheetId, tabName);
    } catch (tabErr) {
      return Object.assign(result, {
        notes: 'Grid tab not found: ' + tabName + ' for insurer ' + params.insurerId
      });
    }

    if (!gridData || gridData.length < 2) {
      return Object.assign(result, { notes: 'Grid tab is empty: ' + tabName });
    }

    var headers  = gridData[0];
    var dataRows = gridData.slice(1);

    // Map column indices from headers
    var colIdx = buildColumnIndex(headers);

    // Step 1: Filter by effective date
    var dateValidRows = filterByEffectiveDate(dataRows, colIdx, issueDate);
    if (dateValidRows.length === 0) {
      return Object.assign(result, {
        notes: 'No grid rows valid for date ' + issueDate + ' in tab ' + tabName
      });
    }

    // Step 2: Filter by product sub-type
    var productRows = filterByProductSubType(dateValidRows, colIdx, params.productSubType);
    if (productRows.length === 0) {
      productRows = dateValidRows; // fall back to all date-valid rows
    }

    // Step 2b: Filter by product sub-sub-type (PCV variants, Construction Eqpt)
    var subSubRows = filterByProductSubSubType(productRows, colIdx, params.productSubSubType);
    if (subSubRows.length > 0) productRows = subSubRows;
    // no fallback — if no sub-sub-type provided or no column in grid, productRows unchanged

    // Step 3: Pass 1 — Exact RTO match
    var matchedRows = [];
    var matchType   = '';

    if (normRTO) {
      matchedRows = filterByRTO(productRows, colIdx, normRTO);
      if (matchedRows.length > 0) matchType = 'EXACT_RTO';
    }

    // Step 4: Pass 2 — PAN India fallback
    if (matchedRows.length === 0) {
      matchedRows = filterByPanIndia(productRows, colIdx);
      if (matchedRows.length > 0) matchType = 'PAN_INDIA';
    }

    if (matchedRows.length === 0) {
      return Object.assign(result, {
        notes: 'No matching rate found for RTO: ' + normRTO + ' or PAN India in ' + tabName
      });
    }

    // Step 5: Apply vehicle parameter filters
    matchedRows = filterByVehicleParams(matchedRows, colIdx, params);

    if (matchedRows.length === 0) {
      return Object.assign(result, {
        notes: 'No rate matched vehicle parameters (CC/GVW/Seating) in ' + tabName
      });
    }

    // Step 6: Check for duplicate rates
    if (matchedRows.length > 1) {
      var dupDesc = 'Multiple rates matched (' + matchedRows.length + ') for ' +
        params.insurerId + '/' + params.productType + '/' + params.productSubType +
        '/RTO:' + normRTO + ' in ' + tabName;
      markGridDuplicate(gridSheetId, tabName, matchedRows, colIdx, dupDesc);
      if (CONFIG.EMAIL_COORDINATOR) {
        try {
          MailApp.sendEmail(
            CONFIG.EMAIL_COORDINATOR,
            'CaliberPO — Duplicate Rate Detected: ' + tabName,
            'Duplicate rate rows detected:\n\n' + dupDesc +
            '\n\nPlease review and resolve in the grid tab: ' + tabName
          );
        } catch (mailErr) {
          Logger.log('Could not send duplicate rate email: ' + mailErr.message);
        }
      }
      return Object.assign(result, {
        matchStatus: 'DUPLICATE_RATE',
        notes:       dupDesc
      });
    }

    // Step 7: Single matched row — select best tier
    var gridRow    = matchedRows[0];
    var tierResult = selectBestTier(gridRow, colIdx, params);

    // Step 8: Calculate amounts
    var amounts = calculateAmounts(tierResult, params);

    // Build final result
    var responseMs = new Date().getTime() - startTime;
    var rawNcbAdj    = gridRow[colIdx.ncb_adj];
    var rawNilDepAdj = gridRow[colIdx.nil_dep_adj];
    var rawCpaAdj    = gridRow[colIdx.cpa_adj];
    result = {
      success:     true,
      matchType:   matchType,
      gridTier:    tierResult.tier,
      matchStatus: 'MATCHED',
      vehicleAge:  params.yom ? deriveVehicleAge(params.yom) : '',
      notes:       '',
      piRate:      tierResult.piRate,
      piOn:        tierResult.piOn,
      piAmount:    amounts.piAmount,
      piRate2:     tierResult.piRate2,
      piOn2:       tierResult.piOn2,
      piAmount2:   amounts.piAmount2,
      poRate:      tierResult.poRate,
      poAmount:    amounts.poAmount,
      poRate2:     tierResult.poRate2,
      poAmount2:   amounts.poAmount2,
      ncbAdj:      (rawNcbAdj    !== '' && rawNcbAdj    !== null && rawNcbAdj    !== undefined) ? parseFloat(rawNcbAdj)    : null,
      nilDepAdj:   (rawNilDepAdj !== '' && rawNilDepAdj !== null && rawNilDepAdj !== undefined) ? parseFloat(rawNilDepAdj) : null,
      cpaAdj:      (rawCpaAdj    !== '' && rawCpaAdj    !== null && rawCpaAdj    !== undefined) ? parseFloat(rawCpaAdj)    : null,
      responseMs:  responseMs
    };

    // Log the call (Logging.gs — Prompt 05)
    try {
      logCall(params, result, 'FORM', responseMs);
    } catch (logErr) {
      Logger.log('logCall failed (non-fatal): ' + logErr.message);
    }

    return result;

  } catch (e) {
    Logger.log('lookupRate failed: ' + e.message + '\n' + e.stack);
    return Object.assign(result, {
      matchStatus: 'ERROR',
      notes:       'Lookup error: ' + e.message
    });
  }
}

// ── GRID HELPER FUNCTIONS ─────────────────────────────────────────────────────

/**
 * Finds the grid spreadsheet ID for an insurer.
 * Looks in FOLDER_GRIDS for a file named "[insurer_name] Grid" or "[insurer_id] Grid".
 */
function findInsurerGridSheet(insurerId) {
  try {
    var insurers = getSheetDataAsObjects(CONFIG.SHEET_INSURER_MASTER, 'Insurers');
    var insurer  = null;
    for (var i = 0; i < insurers.length; i++) {
      if (insurers[i].insurer_id === insurerId) { insurer = insurers[i]; break; }
    }
    if (!insurer) throw new Error('Insurer not found in master: ' + insurerId);

    var fileName = insurer.insurer_name + ' Grid';
    var fileId   = findFileInFolder(CONFIG.FOLDER_GRIDS, fileName);
    if (!fileId) {
      fileId = findFileInFolder(CONFIG.FOLDER_GRIDS, insurerId + ' Grid');
    }
    return fileId; // null if not found
  } catch (e) {
    throw new Error('findInsurerGridSheet failed [' + insurerId + ']: ' + e.message);
  }
}

/**
 * Builds a column index map from the grid header row.
 * Maps normalised header names to 0-based column indices.
 */
function buildColumnIndex(headers) {
  var idx = {};
  headers.forEach(function(h, i) {
    if (h) idx[h.toString().trim().toLowerCase().replace(/\s+/g, '_')] = i;
  });
  return {
    insurance_company:            idx['insurance_company']            !== undefined ? idx['insurance_company']            : 0,
    product_type:                 idx['product_type']                 !== undefined ? idx['product_type']                 : 3,
    product_sub_type:             idx['product_sub_type']             !== undefined ? idx['product_sub_type']             : 4,
    product_sub_sub_type:         idx['product_sub_sub_type']         !== undefined ? idx['product_sub_sub_type']         : 5,
    effective_from_date:          idx['effective_from_date']          !== undefined ? idx['effective_from_date']          : 7,
    effective_to_date:            idx['effective_to_date']            !== undefined ? idx['effective_to_date']            : 8,
    vehicle_cc_lower_limit:       idx['vehicle_cc_lower_limit']       !== undefined ? idx['vehicle_cc_lower_limit']       : 14,
    vehicle_cc_upper_limit:       idx['vehicle_cc_upper_limit']       !== undefined ? idx['vehicle_cc_upper_limit']       : 15,
    seating_capacity_lower_limit: idx['seating_capacity_lower_limit'] !== undefined ? idx['seating_capacity_lower_limit'] : 18,
    seating_capacity_upper_limit: idx['seating_capacity_upper_limit'] !== undefined ? idx['seating_capacity_upper_limit'] : 19,
    gvw_lower_limit:              idx['gvw_lower_limit']              !== undefined ? idx['gvw_lower_limit']              : 20,
    gvw_upper_limit:              idx['gvw_upper_limit']              !== undefined ? idx['gvw_upper_limit']              : 21,
    rto_list:                     idx['rto_list']                     !== undefined ? idx['rto_list']                     : 25,
    cpa_adj:                      idx['cpa_adj']                      !== undefined ? idx['cpa_adj']                      : 35,
    pi_rate:                      idx['pi_rate']                      !== undefined ? idx['pi_rate']                      : 36,
    pi_rate_on:                   idx['pi_rate_on']                   !== undefined ? idx['pi_rate_on']                   : 37,
    pi_rate1:                     idx['pi_rate1']                     !== undefined ? idx['pi_rate1']                     : 38,
    pi_rate1_on:                  idx['pi_rate1_on']                  !== undefined ? idx['pi_rate1_on']                  : 39,
    retention:                    idx['retention']                    !== undefined ? idx['retention']                    : 40,
    retention1:                   idx['retention1']                   !== undefined ? idx['retention1']                   : 41,
    po_rate:                      idx['po_rate']                      !== undefined ? idx['po_rate']                      : 42,
    po_rate_on:                   idx['po_rate_on']                   !== undefined ? idx['po_rate_on']                   : 43,
    po_rate_1:                    idx['po_rate_1']                    !== undefined ? idx['po_rate_1']                    : 44,
    po_rate1_on:                  idx['po_rate1_on']                  !== undefined ? idx['po_rate1_on']                  : 45,
    slab_1_from:                  idx['slab_1_from']                  !== undefined ? idx['slab_1_from']                  : 46,
    slab_1_to:                    idx['slab_1_to']                    !== undefined ? idx['slab_1_to']                    : 47,
    slab_1_pi_rate:               idx['slab_1__pi_rate']              !== undefined ? idx['slab_1__pi_rate']              : 48,
    slab_1_rate_on:               idx['slab_1_rate_on']               !== undefined ? idx['slab_1_rate_on']               : 49,
    slab_1_retention:             idx['slab_1_retention']             !== undefined ? idx['slab_1_retention']             : 50,
    slab_1_po_rate:               idx['slab_1__po_rate']              !== undefined ? idx['slab_1__po_rate']              : 51,
    slab_2_from:                  idx['slab_2_from']                  !== undefined ? idx['slab_2_from']                  : 52,
    slab_2_to:                    idx['slab_2_to']                    !== undefined ? idx['slab_2_to']                    : 53,
    slab_2_pi_rate:               idx['slab_2__pi_rate']              !== undefined ? idx['slab_2__pi_rate']              : 54,
    slab_2_rate_on:               idx['slab_2_rate_on']               !== undefined ? idx['slab_2_rate_on']               : 55,
    slab_2_retention:             idx['slab_2_retention']             !== undefined ? idx['slab_2_retention']             : 56,
    slab_2_po_rate:               idx['slab_2__po_rate']              !== undefined ? idx['slab_2__po_rate']              : 57,
    slab_3_from:                  idx['slab_3_from']                  !== undefined ? idx['slab_3_from']                  : 58,
    slab_3_to:                    idx['slab_3_to']                    !== undefined ? idx['slab_3_to']                    : 59,
    slab_3_pi_rate:               idx['slab_3__pi_rate']              !== undefined ? idx['slab_3__pi_rate']              : 60,
    slab_3_rate_on:               idx['slab_3_rate_on']               !== undefined ? idx['slab_3_rate_on']               : 61,
    slab_3_retention:             idx['slab_3_retention']             !== undefined ? idx['slab_3_retention']             : 62,
    slab_3_po_rate:               idx['slab_3__po_rate']              !== undefined ? idx['slab_3__po_rate']              : 63,
    fuel_type:                    idx['fuel_type']                    || 11,
    ncb_adj:                      idx['ncb_adj']                      !== undefined ? idx['ncb_adj']                      : 28,
    nil_dep_adj:                  idx['nil_dep_adj']                  !== undefined ? idx['nil_dep_adj']                  : 33
  };
}

/**
 * Filters grid rows by effective date range.
 * effective_from_date <= issueDate <= effective_to_date
 */
function filterByEffectiveDate(rows, colIdx, issueDate) {
  return rows.filter(function(row) {
    var fromRaw = row[colIdx.effective_from_date];
    var toRaw   = row[colIdx.effective_to_date];
    if (!fromRaw && !toRaw) return true;
    var fromDate = fromRaw ? normaliseDate(fromRaw) : '1900-01-01';
    var toDate   = toRaw   ? normaliseDate(toRaw)   : '2099-12-31';
    if (!fromDate) fromDate = '1900-01-01';
    if (!toDate)   toDate   = '2099-12-31';
    return issueDate >= fromDate && issueDate <= toDate;
  });
}

/**
 * Filters grid rows by product sub-type.
 */
function filterByProductSubType(rows, colIdx, productSubType) {
  if (!productSubType) return rows;
  return rows.filter(function(row) {
    var cellVal = row[colIdx.product_sub_type];
    if (!cellVal) return true;
    return cellVal.toString().trim().toLowerCase() ===
           productSubType.toString().trim().toLowerCase();
  });
}

/**
 * Filters grid rows by product sub-sub-type.
 * Blank grid cells pass through (apply to all sub-sub-types).
 * Returns unchanged rows if productSubSubType is empty.
 */
function filterByProductSubSubType(rows, colIdx, productSubSubType) {
  if (!productSubSubType) return rows;
  return rows.filter(function(row) {
    var cellVal = row[colIdx.product_sub_sub_type];
    if (!cellVal) return true;
    return cellVal.toString().trim().toLowerCase() ===
           productSubSubType.toString().trim().toLowerCase();
  });
}

/**
 * Pass 1: Filters rows by exact RTO code match in rto_list column.
 * rto_list may be comma or pipe separated.
 */
function filterByRTO(rows, colIdx, normRTO) {
  return rows.filter(function(row) {
    var rtoList = row[colIdx.rto_list];
    if (!rtoList) return false;
    var rtoListStr = rtoList.toString().trim();
    if (rtoListStr === '' || rtoListStr.toLowerCase() === 'all') return false;
    var codes = rtoListStr.split(/[,|]/).map(function(c) {
      return normaliseRTO(c.trim());
    });
    return codes.indexOf(normRTO) !== -1;
  });
}

/**
 * Pass 2: Filters rows where rto_list is blank, "All", or "PAN India".
 */
function filterByPanIndia(rows, colIdx) {
  return rows.filter(function(row) {
    var rtoList = row[colIdx.rto_list];
    if (!rtoList) return true;
    var val = rtoList.toString().trim().toLowerCase();
    return val === '' || val === 'all' || val === 'pan india' || val === 'panindia';
  });
}

/**
 * Filters grid rows by vehicle parameters.
 * Applies filters relevant to each product type:
 *   CC      — TW and Pvt Car
 *   GVW     — GCV and Tractor
 *   Seating — PCV
 *   Fuel    — TW, Pvt Car, GCV, PCV (when provided)
 *   Nil Dep — Pvt Car (when provided)
 *   NCB     — Pvt Car (when provided)
 * Grid rows with blank filter columns apply to all values — not filtered out.
 */
function filterByVehicleParams(rows, colIdx, params) {
  return rows.filter(function(row) {

    // ── CC ─────────────────────────────────────────────────────────────────
    if (params.vehicleCc !== null && params.vehicleCc !== undefined) {
      var ccLo = row[colIdx.vehicle_cc_lower_limit];
      var ccHi = row[colIdx.vehicle_cc_upper_limit];
      if ((ccLo !== '' && ccLo !== null) || (ccHi !== '' && ccHi !== null)) {
        if (!matchVehicleParam(params.vehicleCc, ccLo, ccHi)) return false;
      }
    }

    // ── GVW ────────────────────────────────────────────────────────────────
    if (params.vehicleGvw !== null && params.vehicleGvw !== undefined) {
      var gvwLo = row[colIdx.gvw_lower_limit];
      var gvwHi = row[colIdx.gvw_upper_limit];
      if ((gvwLo !== '' && gvwLo !== null) || (gvwHi !== '' && gvwHi !== null)) {
        if (!matchVehicleParam(params.vehicleGvw, gvwLo, gvwHi)) return false;
      }
    }

    // ── Seating ────────────────────────────────────────────────────────────
    if (params.vehicleSeating !== null && params.vehicleSeating !== undefined) {
      var seatLo = row[colIdx.seating_capacity_lower_limit];
      var seatHi = row[colIdx.seating_capacity_upper_limit];
      if ((seatLo !== '' && seatLo !== null) || (seatHi !== '' && seatHi !== null)) {
        if (!matchVehicleParam(params.vehicleSeating, seatLo, seatHi)) return false;
      }
    }

    // ── Fuel Type ──────────────────────────────────────────────────────────
    // Only filter when provided AND the grid row specifies a fuel type.
    // Rows with blank fuel_type apply to all fuels — do not filter out.
    if (params.fuelType && params.fuelType !== '') {
      var gridFuel = row[colIdx.fuel_type];
      if (gridFuel && gridFuel.toString().trim() !== '') {
        if (gridFuel.toString().trim().toLowerCase() !==
            params.fuelType.toString().trim().toLowerCase()) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Selects the best rate tier (Base, Slab_1, Slab_2, Slab_3).
 * Checks slabs highest-first; falls back to Base tier.
 */
function selectBestTier(row, colIdx, params) {
  var basePremium = Math.max(
    normalisePremium(params.netPremium),
    normalisePremium(params.odPremium),
    normalisePremium(params.tpPremium)
  );

  var slabs = [
    { name: 'Slab_3', from: colIdx.slab_3_from, to: colIdx.slab_3_to,
      piRate: colIdx.slab_3_pi_rate, rateOn: colIdx.slab_3_rate_on,
      retention: colIdx.slab_3_retention, poRate: colIdx.slab_3_po_rate },
    { name: 'Slab_2', from: colIdx.slab_2_from, to: colIdx.slab_2_to,
      piRate: colIdx.slab_2_pi_rate, rateOn: colIdx.slab_2_rate_on,
      retention: colIdx.slab_2_retention, poRate: colIdx.slab_2_po_rate },
    { name: 'Slab_1', from: colIdx.slab_1_from, to: colIdx.slab_1_to,
      piRate: colIdx.slab_1_pi_rate, rateOn: colIdx.slab_1_rate_on,
      retention: colIdx.slab_1_retention, poRate: colIdx.slab_1_po_rate }
  ];

  for (var i = 0; i < slabs.length; i++) {
    var slab       = slabs[i];
    var fromVal    = row[slab.from];
    var toVal      = row[slab.to];
    var slabPiRate = row[slab.piRate];
    if (!slabPiRate && slabPiRate !== 0) continue;
    if (fromVal !== '' && fromVal !== null && toVal !== '' && toVal !== null) {
      if (matchVehicleParam(basePremium, fromVal, toVal)) {
        return {
          tier:      slab.name,
          piRate:    normalisePremium(slabPiRate),
          piOn:      (row[slab.rateOn] || '').toString().trim().toUpperCase(),
          piRate2:   null,
          piOn2:     null,
          retention: normalisePremium(row[slab.retention]),
          poRate:    normalisePremium(row[slab.poRate]),
          poRate2:   null
        };
      }
    }
  }

  // Base tier
  return {
    tier:      'Base',
    piRate:    normalisePremium(row[colIdx.pi_rate]),
    piOn:      (row[colIdx.pi_rate_on] || '').toString().trim().toUpperCase(),
    piRate2:   row[colIdx.pi_rate1]    ? normalisePremium(row[colIdx.pi_rate1])    : null,
    piOn2:     row[colIdx.pi_rate1_on] ? (row[colIdx.pi_rate1_on] || '').toString().trim().toUpperCase() : null,
    retention: normalisePremium(row[colIdx.retention]),
    poRate:    normalisePremium(row[colIdx.po_rate]),
    poRate2:   row[colIdx.po_rate_1]   ? normalisePremium(row[colIdx.po_rate_1])   : null
  };
}

/**
 * Calculates commission amounts from rate and premium fields.
 * Rate On values: OD, TP, NET, FLAT, TP1Y
 */
function calculateAmounts(tierResult, params) {
  var amounts = { piAmount: 0, piAmount2: 0, poAmount: 0, poAmount2: 0 };

  function getPremiumBase(rateOn) {
    var ro = (rateOn || '').toString().toUpperCase().trim();
    if (ro === 'OD')   return normalisePremium(params.odPremium);
    if (ro === 'TP')   return normalisePremium(params.tpPremium);
    if (ro === 'TP1Y') return normalisePremium(params.tpPremium);
    if (ro === 'NET')  return normalisePremium(params.netPremium);
    if (ro === 'FLAT') return 1;
    return normalisePremium(params.netPremium);
  }

  if (tierResult.piRate) {
    var base1 = getPremiumBase(tierResult.piOn);
    amounts.piAmount = tierResult.piOn === 'FLAT'
      ? Math.round(tierResult.piRate * 100) / 100
      : Math.round(base1 * (tierResult.piRate / 100) * 100) / 100;
    var poRate1 = tierResult.poRate || 0;
    amounts.poAmount = tierResult.piOn === 'FLAT'
      ? Math.round(poRate1 * 100) / 100
      : Math.round(base1 * (poRate1 / 100) * 100) / 100;
  }

  if (tierResult.piRate2) {
    var base2 = getPremiumBase(tierResult.piOn2);
    amounts.piAmount2 = tierResult.piOn2 === 'FLAT'
      ? Math.round(tierResult.piRate2 * 100) / 100
      : Math.round(base2 * (tierResult.piRate2 / 100) * 100) / 100;
    var poRate2 = tierResult.poRate2 || 0;
    amounts.poAmount2 = tierResult.piOn2 === 'FLAT'
      ? Math.round(poRate2 * 100) / 100
      : Math.round(base2 * (poRate2 / 100) * 100) / 100;
  }

  return amounts;
}

/**
 * Marks duplicate rate rows in the grid with a status flag.
 */
function markGridDuplicate(gridSheetId, tabName, matchedRows, colIdx, description) {
  try {
    var ss    = SpreadsheetApp.openById(gridSheetId);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    var lastCol = sheet.getLastColumn() + 1;
    var data    = sheet.getDataRange().getValues();
    matchedRows.forEach(function(matchedRow) {
      for (var i = 1; i < data.length; i++) {
        if (JSON.stringify(data[i]) === JSON.stringify(matchedRow)) {
          sheet.getRange(i + 1, lastCol).setValue('DUPLICATE');
          break;
        }
      }
    });
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log('markGridDuplicate failed (non-fatal): ' + e.message);
  }
}
