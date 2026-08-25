/**
 * CaliberPO Grid Engine Library — Core Rate Lookup
 *
 * Exported functions (callable by consumer projects as GridEngine.fnName()):
 *   findInsurerGrid(insurerId, folderGridsId, insurerMasterSheetId)
 *   lookupRate(params, gridSheetId)
 *   validateConditionalFields(params)
 *   applyConditionAdjustments(result, params)
 *
 * All other functions are internal helpers.
 * No dependency on Config.gs — all IDs passed as parameters.
 */

// ── PUBLIC: INSURER GRID LOCATOR ──────────────────────────────────────────────

/**
 * Returns the grid spreadsheet ID for an insurer.
 * Searches by insurer name then insurer_id as fallback.
 *
 * @param {string} insurerId            - Insurer ID from Insurer Master
 * @param {string} folderGridsId        - Drive folder ID where grids live
 * @param {string} insurerMasterSheetId - Insurer Master spreadsheet ID
 * @returns {string|null} Grid spreadsheet ID, or null if not found
 */
function findInsurerGrid(insurerId, folderGridsId, insurerMasterSheetId) {
  try {
    var insurers = getSheetDataAsObjects(insurerMasterSheetId, 'Insurers');
    var insurer  = null;
    for (var i = 0; i < insurers.length; i++) {
      if (insurers[i].insurer_id === insurerId) { insurer = insurers[i]; break; }
    }
    if (!insurer) return null;
    var fileId = findFileInFolder(folderGridsId, insurer.insurer_name + ' Grid');
    if (!fileId) fileId = findFileInFolder(folderGridsId, insurerId + ' Grid');
    return fileId;
  } catch (e) { Logger.log('findInsurerGrid failed [' + insurerId + ']: ' + e.message); return null; }
}

// ── PUBLIC: CORE RATE LOOKUP ──────────────────────────────────────────────────

/**
 * Main rate lookup. Accepts gridSheetId directly — no Config dependency.
 *
 * @param {Object} params       - Rate lookup parameters (see RateAPI.gs for full schema)
 * @param {string} gridSheetId  - Grid spreadsheet ID for the insurer
 * @returns {Object} Rate result with matchStatus, rates, adjustments
 */
function lookupRate(params, gridSheetId) {
  var result = {
    success: false, matchType: '', gridTier: '', matchStatus: 'NO_MATCH',
    vehicleAge: '', notes: '',
    piRate: null, piOn: null, piAmount: null, piRate2: null, piOn2: null, piAmount2: null,
    poRate: null, poAmount: null, poRate2: null, poAmount2: null,
    ncbAdj: null, nilDepAdj: null, cpaAdj: null
  };

  try {
    if (!gridSheetId) return Object.assign(result, { notes: 'gridSheetId is required' });

    var normRTO   = params.rto ? normaliseRTO(params.rto) : '';
    var issueDate = normaliseDate(params.policyIssueDate);
    if (!issueDate) return Object.assign(result, { notes: 'Invalid policyIssueDate' });

    var period  = derivePeriod(issueDate);
    var tabName = getGridTabName(params.productType, period);
    if (!tabName) return Object.assign(result, { notes: 'Could not derive grid tab for productType: ' + params.productType });

    var gridData;
    try { gridData = getSheetData(gridSheetId, tabName); }
    catch (tabErr) { return Object.assign(result, { notes: 'Grid tab not found: ' + tabName }); }

    if (!gridData || gridData.length < 2) return Object.assign(result, { notes: 'Grid tab is empty: ' + tabName });

    var colIdx    = buildColumnIndex_(gridData[0]);
    var dataRows  = gridData.slice(1);

    // Step 1: Date filter
    var dateRows = filterByEffectiveDate_(dataRows, colIdx, issueDate);
    if (!dateRows.length) return Object.assign(result, { notes: 'No grid rows valid for date ' + issueDate });

    // Step 2: Product sub-type filter
    var productRows = filterByProductSubType_(dateRows, colIdx, params.productSubType);
    if (!productRows.length) productRows = dateRows;

    // Step 2b: Sub-sub-type filter
    var sssRows = filterByProductSubSubType_(productRows, colIdx, params.productSubSubType);
    if (sssRows.length) productRows = sssRows;

    // Step 3: RTO — exact match first, PAN India second
    var matchedRows = [];
    var matchType   = '';

    if (normRTO) {
      matchedRows = filterByRTO_(productRows, colIdx, normRTO);
      if (matchedRows.length) matchType = 'EXACT_RTO';
    }

    // Only fall back to PAN India if no exact RTO match
    if (!matchedRows.length) {
      matchedRows = filterByPanIndia_(productRows, colIdx);
      if (matchedRows.length) matchType = 'PAN_INDIA';
    }

    if (!matchedRows.length) return Object.assign(result, { notes: 'No rate for RTO ' + normRTO });

    // Step 4: Vehicle params
    matchedRows = filterByVehicleParams_(matchedRows, colIdx, params);
    if (!matchedRows.length) return Object.assign(result, { notes: 'No rate matched vehicle parameters' });

    // Step 5: Duplicate check
    if (matchedRows.length > 1) {
      return Object.assign(result, {
        matchStatus: 'DUPLICATE_RATE',
        notes: 'Multiple rates matched (' + matchedRows.length + ') — resolve duplicate in grid'
      });
    }

    // Step 6: Tier selection + amount calculation
    var gridRow    = matchedRows[0];
    var tierResult = selectBestTier_(gridRow, colIdx, params);
    var amounts    = calculateAmounts_(tierResult, params);

    var rawNcb    = gridRow[colIdx.ncb_adj];
    var rawNilDep = gridRow[colIdx.nil_dep_adj];
    var rawCpa    = gridRow[colIdx.cpa_adj];

    return {
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
      ncbAdj:      (rawNcb    !== '' && rawNcb    !== null && rawNcb    !== undefined) ? parseFloat(rawNcb)    : null,
      nilDepAdj:   (rawNilDep !== '' && rawNilDep !== null && rawNilDep !== undefined) ? parseFloat(rawNilDep) : null,
      cpaAdj:      (rawCpa    !== '' && rawCpa    !== null && rawCpa    !== undefined) ? parseFloat(rawCpa)    : null
    };

  } catch (e) {
    Logger.log('lookupRate failed: ' + e.message);
    return Object.assign(result, { matchStatus: 'ERROR', notes: e.message });
  }
}

// ── PUBLIC: VALIDATION ────────────────────────────────────────────────────────

/**
 * Returns array of missing field names for the given productType.
 * Empty array = all required fields present.
 */
function validateConditionalFields(params) {
  var rules = {
    'TW':               { cc: true,  fuel: true,  gvw: false, seating: false, yom: false },
    'Pvt Car':          { cc: true,  fuel: true,  gvw: false, seating: false, yom: true  },
    'GCV':              { cc: false, fuel: true,  gvw: true,  seating: false, yom: true  },
    'PCV':              { cc: false, fuel: true,  gvw: false, seating: true,  yom: true  },
    'Tractor':          { cc: false, fuel: false, gvw: false, seating: false, yom: true  },
    'Construction Eqpt':{ cc: false, fuel: false, gvw: false, seating: false, yom: false }
  };
  var r       = rules[params.productType];
  if (!r) return [];
  var missing = [];
  if (r.cc      && params.vehicleCc      === null) missing.push('vehicleCc');
  if (r.gvw     && params.vehicleGvw     === null) missing.push('vehicleGvw');
  if (r.seating && params.vehicleSeating === null) missing.push('vehicleSeating');
  if (r.yom     && params.yom            === null) missing.push('yom');
  if (r.fuel    && !params.fuelType)               missing.push('fuelType');
  return missing;
}

// ── PUBLIC: CONDITION ADJUSTMENTS ────────────────────────────────────────────

/**
 * Applies NCB / NilDep / CPA absent-condition deductions.
 * Adds finalPoAmount and finalPiAmount to result.
 * ncb: 0 or blank = absent. nilDep/cpa: blank = absent, Y = present.
 */
function applyConditionAdjustments(result, params) {
  if (!result.success || result.matchStatus !== 'MATCHED') return result;

  var poAmount  = (result.poAmount  || 0) + (result.poAmount2  || 0);
  var piAmount  = (result.piAmount  || 0) + (result.piAmount2  || 0);
  var applied   = [];

  function deduct(adj, label) {
    poAmount = Math.round(poAmount * (1 - adj / 100) * 100) / 100;
    piAmount = Math.round(piAmount * (1 - adj / 100) * 100) / 100;
    applied.push(label + ': -' + adj + '%');
  }

  if (result.ncbAdj    !== null && (!params.ncb    || params.ncb    === 0)) deduct(result.ncbAdj,    'ncb_adj');
  if (result.nilDepAdj !== null && !params.nilDep)                          deduct(result.nilDepAdj, 'nil_dep_adj');
  if (result.cpaAdj    !== null && !params.cpa)                             deduct(result.cpaAdj,    'cpa_adj');

  result.finalPoAmount       = poAmount;
  result.finalPiAmount       = piAmount;
  result.adjustmentsApplied  = applied;
  return result;
}

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

function buildColumnIndex_(headers) {
  var idx = {};
  headers.forEach(function(h, i) { if (h) idx[h.toString().trim().toLowerCase().replace(/\s+/g, '_')] = i; });
  function col(name, def) { return idx[name] !== undefined ? idx[name] : def; }
  return {
    product_sub_type:             col('product_sub_type', 4),
    product_sub_sub_type:         col('product_sub_sub_type', 5),
    effective_from_date:          col('effective_from_date', 7),
    effective_to_date:            col('effective_to_date', 8),
    fuel_type:                    col('fuel_type', 11),
    vehicle_cc_lower_limit:       col('vehicle_cc_lower_limit', 14),
    vehicle_cc_upper_limit:       col('vehicle_cc_upper_limit', 15),
    seating_capacity_lower_limit: col('seating_capacity_lower_limit', 18),
    seating_capacity_upper_limit: col('seating_capacity_upper_limit', 19),
    gvw_lower_limit:              col('gvw_lower_limit', 20),
    gvw_upper_limit:              col('gvw_upper_limit', 21),
    rto_list:                     col('rto_list', 25),
    ncb_adj:                      col('ncb_adj', 28),
    nil_dep_adj:                  col('nil_dep_adj', 33),
    cpa_adj:                      col('cpa_adj', 35),
    pi_rate:                      col('pi_rate', 36),
    pi_rate_on:                   col('pi_rate_on', 37),
    pi_rate1:                     col('pi_rate1', 38),
    pi_rate1_on:                  col('pi_rate1_on', 39),
    retention:                    col('retention', 40),
    po_rate:                      col('po_rate', 42),
    po_rate_on:                   col('po_rate_on', 43),
    po_rate_1:                    col('po_rate_1', 44),
    slab_1_from:                  col('slab_1_from', 46),  slab_1_to:     col('slab_1_to', 47),
    slab_1_pi_rate:               col('slab_1__pi_rate', 48), slab_1_rate_on: col('slab_1_rate_on', 49),
    slab_1_retention:             col('slab_1_retention', 50), slab_1_po_rate: col('slab_1__po_rate', 51),
    slab_2_from:                  col('slab_2_from', 52),  slab_2_to:     col('slab_2_to', 53),
    slab_2_pi_rate:               col('slab_2__pi_rate', 54), slab_2_rate_on: col('slab_2_rate_on', 55),
    slab_2_retention:             col('slab_2_retention', 56), slab_2_po_rate: col('slab_2__po_rate', 57),
    slab_3_from:                  col('slab_3_from', 58),  slab_3_to:     col('slab_3_to', 59),
    slab_3_pi_rate:               col('slab_3__pi_rate', 60), slab_3_rate_on: col('slab_3_rate_on', 61),
    slab_3_retention:             col('slab_3_retention', 62), slab_3_po_rate: col('slab_3__po_rate', 63)
  };
}

function filterByEffectiveDate_(rows, colIdx, issueDate) {
  return rows.filter(function(row) {
    var from = row[colIdx.effective_from_date];
    var to   = row[colIdx.effective_to_date];
    if (!from && !to) return true;
    var f = from ? (normaliseDate(from) || '1900-01-01') : '1900-01-01';
    var t = to   ? (normaliseDate(to)   || '2099-12-31') : '2099-12-31';
    return issueDate >= f && issueDate <= t;
  });
}

function filterByProductSubType_(rows, colIdx, productSubType) {
  if (!productSubType) return rows;
  return rows.filter(function(row) {
    var v = row[colIdx.product_sub_type];
    if (!v) return true;
    return v.toString().trim().toLowerCase() === productSubType.toString().trim().toLowerCase();
  });
}

function filterByProductSubSubType_(rows, colIdx, productSubSubType) {
  if (!productSubSubType) return rows;
  return rows.filter(function(row) {
    var v = row[colIdx.product_sub_sub_type];
    if (!v) return true;
    return v.toString().trim().toLowerCase() === productSubSubType.toString().trim().toLowerCase();
  });
}

function filterByRTO_(rows, colIdx, normRTO) {
  return rows.filter(function(row) {
    var rtoList = row[colIdx.rto_list];
    if (!rtoList) return false;
    var s = rtoList.toString().trim();
    if (!s || s.toLowerCase() === 'all' || s.toLowerCase() === 'pan india') return false;
    return s.split(/[,|]/).map(function(c) { return normaliseRTO(c.trim()); }).indexOf(normRTO) !== -1;
  });
}

function filterByPanIndia_(rows, colIdx) {
  return rows.filter(function(row) {
    var rtoList = row[colIdx.rto_list];
    if (!rtoList) return true;
    var v = rtoList.toString().trim().toLowerCase();
    return v === '' || v === 'all' || v === 'pan india' || v === 'panindia';
  });
}

function filterByVehicleParams_(rows, colIdx, params) {
  return rows.filter(function(row) {
    if (params.vehicleCc !== null && params.vehicleCc !== undefined) {
      var lo = row[colIdx.vehicle_cc_lower_limit], hi = row[colIdx.vehicle_cc_upper_limit];
      if ((lo !== '' && lo !== null) || (hi !== '' && hi !== null)) {
        if (!matchVehicleParam(params.vehicleCc, lo, hi)) return false;
      }
    }
    if (params.vehicleGvw !== null && params.vehicleGvw !== undefined) {
      var glo = row[colIdx.gvw_lower_limit], ghi = row[colIdx.gvw_upper_limit];
      if ((glo !== '' && glo !== null) || (ghi !== '' && ghi !== null)) {
        if (!matchVehicleParam(params.vehicleGvw, glo, ghi)) return false;
      }
    }
    if (params.vehicleSeating !== null && params.vehicleSeating !== undefined) {
      var slo = row[colIdx.seating_capacity_lower_limit], shi = row[colIdx.seating_capacity_upper_limit];
      if ((slo !== '' && slo !== null) || (shi !== '' && shi !== null)) {
        if (!matchVehicleParam(params.vehicleSeating, slo, shi)) return false;
      }
    }
    if (params.fuelType && params.fuelType !== '') {
      var gf = row[colIdx.fuel_type];
      if (gf && gf.toString().trim() !== '') {
        if (gf.toString().trim().toLowerCase() !== params.fuelType.toString().trim().toLowerCase()) return false;
      }
    }
    return true;
  });
}

function selectBestTier_(row, colIdx, params) {
  var base = Math.max(normalisePremium(params.netPremium), normalisePremium(params.odPremium), normalisePremium(params.tpPremium));
  var slabs = [
    { name: 'Slab_3', from: colIdx.slab_3_from, to: colIdx.slab_3_to, piRate: colIdx.slab_3_pi_rate, rateOn: colIdx.slab_3_rate_on, retention: colIdx.slab_3_retention, poRate: colIdx.slab_3_po_rate },
    { name: 'Slab_2', from: colIdx.slab_2_from, to: colIdx.slab_2_to, piRate: colIdx.slab_2_pi_rate, rateOn: colIdx.slab_2_rate_on, retention: colIdx.slab_2_retention, poRate: colIdx.slab_2_po_rate },
    { name: 'Slab_1', from: colIdx.slab_1_from, to: colIdx.slab_1_to, piRate: colIdx.slab_1_pi_rate, rateOn: colIdx.slab_1_rate_on, retention: colIdx.slab_1_retention, poRate: colIdx.slab_1_po_rate }
  ];
  for (var i = 0; i < slabs.length; i++) {
    var s = slabs[i];
    var pr = row[s.piRate];
    if (!pr && pr !== 0) continue;
    var fv = row[s.from], tv = row[s.to];
    if (fv !== '' && fv !== null && tv !== '' && tv !== null && matchVehicleParam(base, fv, tv)) {
      return { tier: s.name, piRate: normalisePremium(pr), piOn: (row[s.rateOn] || '').toString().trim().toUpperCase(),
               piRate2: null, piOn2: null, retention: normalisePremium(row[s.retention]), poRate: normalisePremium(row[s.poRate]), poRate2: null };
    }
  }
  return {
    tier: 'Base',
    piRate:  normalisePremium(row[colIdx.pi_rate]),
    piOn:    (row[colIdx.pi_rate_on] || '').toString().trim().toUpperCase(),
    piRate2: row[colIdx.pi_rate1]    ? normalisePremium(row[colIdx.pi_rate1])  : null,
    piOn2:   row[colIdx.pi_rate1_on] ? (row[colIdx.pi_rate1_on] || '').toString().trim().toUpperCase() : null,
    retention: normalisePremium(row[colIdx.retention]),
    poRate:  normalisePremium(row[colIdx.po_rate]),
    poRate2: row[colIdx.po_rate_1]   ? normalisePremium(row[colIdx.po_rate_1]) : null
  };
}

function calculateAmounts_(tierResult, params) {
  var amounts = { piAmount: 0, piAmount2: 0, poAmount: 0, poAmount2: 0 };
  function base(rateOn) {
    var ro = (rateOn || '').toString().toUpperCase().trim();
    if (ro === 'OD' || ro === 'TP1Y') return normalisePremium(params.odPremium);
    if (ro === 'TP')   return normalisePremium(params.tpPremium);
    if (ro === 'FLAT') return 1;
    return normalisePremium(params.netPremium);
  }
  if (tierResult.piRate) {
    var b1 = base(tierResult.piOn);
    amounts.piAmount = tierResult.piOn === 'FLAT' ? Math.round(tierResult.piRate * 100) / 100 : Math.round(b1 * (tierResult.piRate / 100) * 100) / 100;
    amounts.poAmount = tierResult.piOn === 'FLAT' ? Math.round((tierResult.poRate || 0) * 100) / 100 : Math.round(b1 * ((tierResult.poRate || 0) / 100) * 100) / 100;
  }
  if (tierResult.piRate2) {
    var b2 = base(tierResult.piOn2);
    amounts.piAmount2 = tierResult.piOn2 === 'FLAT' ? Math.round(tierResult.piRate2 * 100) / 100 : Math.round(b2 * (tierResult.piRate2 / 100) * 100) / 100;
    amounts.poAmount2 = tierResult.piOn2 === 'FLAT' ? Math.round((tierResult.poRate2 || 0) * 100) / 100 : Math.round(b2 * ((tierResult.poRate2 || 0) / 100) * 100) / 100;
  }
  return amounts;
}
