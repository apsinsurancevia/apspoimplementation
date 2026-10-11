/**
 * CaliberPO Grid Run API
 *
 * Single-insurer, single-policy commission calculation.
 * Send a complete policy record, receive calculated commission amounts.
 * Equivalent to one row of the monthly commission batch, on demand.
 *
 * ── REQUEST ──────────────────────────────────────────────────────────────────
 * GET <url>?api=true&apiKey=KEY&...params
 *
 * ── AUTHENTICATION ───────────────────────────────────────────────────────────
 * apiKey            : string   Set GRID_RUN_API_KEY in Script Properties
 *
 * ── ALWAYS REQUIRED ──────────────────────────────────────────────────────────
 * insurerId         : string   e.g. TATA_AIG
 * productType       : string   TW | Pvt Car | GCV | PCV | Tractor | Construction Eqpt
 * productSubType    : string   Comprehensive | TP Only
 * policyIssueDate   : string   YYYY-MM-DD
 * rto               : string   e.g. MH-12
 * netPremium        : number   Total premium (or send odPremium + tpPremium)
 *
 * ── RECOMMENDED ──────────────────────────────────────────────────────────────
 * odPremium         : number   OD premium incl. all OD add-ons
 * tpPremium         : number   TP premium incl. all TP add-ons
 *
 * ── CONDITIONAL BY PRODUCT TYPE ──────────────────────────────────────────────
 * vehicleCc         : number   Required for: TW, Pvt Car
 * vehicleGvw        : number   Required for: GCV, Tractor  (tonnes)
 * vehicleSeating    : number   Required for: PCV
 * yom               : number   Required for: Pvt Car, GCV, PCV, Tractor
 * fuelType          : string   Required for: TW, Pvt Car, GCV, PCV
 *                              Values: Petrol | Diesel | Electric | Bio Fuel
 *
 * ── OPTIONAL ─────────────────────────────────────────────────────────────────
 * productSubSubType : string   e.g. School Bus (PCV variants)
 * ncb               : number   0 | 20 | 25 | 35 | 45 | 50  (0 = no NCB)
 * nilDep            : string   Y = present, blank = absent
 * cpa               : string   Y = present, blank = absent
 *
 * ── RESPONSE ─────────────────────────────────────────────────────────────────
 * {
 *   success           : boolean,
 *   matchStatus       : MATCHED | NO_MATCH | DUPLICATE_RATE | ERROR,
 *   matchType         : EXACT_RTO | PAN_INDIA,
 *   gridTier          : Base | Slab_1 | Slab_2 | Slab_3,
 *   vehicleAge        : New | Old,
 *   piRate            : number,   PI rate %
 *   piOn              : string,   OD | TP | NET | FLAT
 *   piAmount          : number,   PI amount before adjustments
 *   piRate2           : number,   second PI rate % (OD+TP split grids)
 *   piOn2             : string,
 *   piAmount2         : number,
 *   poRate            : number,   PO rate %
 *   poAmount          : number,   PO amount before adjustments
 *   poRate2           : number,
 *   poAmount2         : number,
 *   ncbAdj            : number,   NCB adjustment % from grid (null if none)
 *   nilDepAdj         : number,   NilDep adjustment % from grid (null if none)
 *   cpaAdj            : number,   CPA adjustment % from grid (null if none)
 *   adjustmentsApplied: string[], e.g. ["ncb_adj: -5%"]
 *   finalPoAmount     : number,   net PO amount after all adjustments — USE THIS
 *   finalPiAmount     : number,   net PI amount after all adjustments
 *   notes             : string,   explanation on NO_MATCH or ERROR
 *   missingFields     : string[]  populated on validation failure
 * }
 */

function doGet(e) {
  try {
    if (e && e.parameter && String(e.parameter.action || '').toLowerCase() === 'bootstrap') {
      return handleGridRunBootstrap_(e);
    }
    if (e && e.parameter && e.parameter.api === 'true') return handleGridRunRequest_(e);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Missing api=true parameter' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return apiResp_({ success: false, error: err.message });
  }
}

function handleGridRunBootstrap_(e) {
  var p = e.parameter || {};
  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty('GRID_RUN_API_KEY') || '';
  var bootKey = p.bootstrapKey || '';
  if (existing && bootKey !== existing) {
    return apiResp_({ success: false, error: 'bootstrapKey mismatch' });
  }
  if (p.GRID_RUN_API_KEY) props.setProperty('GRID_RUN_API_KEY', p.GRID_RUN_API_KEY);
  if (p.FOLDER_GRIDS) props.setProperty('FOLDER_GRIDS', p.FOLDER_GRIDS);
  if (p.SHEET_INSURER_MASTER) props.setProperty('SHEET_INSURER_MASTER', p.SHEET_INSURER_MASTER);
  var cfg = getGridRunRuntimeConfig_();
  return apiResp_({
    success: true,
    FOLDER_GRIDS: cfg.FOLDER_GRIDS,
    SHEET_INSURER_MASTER: cfg.SHEET_INSURER_MASTER
  });
}

function getGridRunRuntimeConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    FOLDER_GRIDS: props.getProperty('FOLDER_GRIDS') || GRIDRUN_CONFIG.FOLDER_GRIDS || '',
    SHEET_INSURER_MASTER: props.getProperty('SHEET_INSURER_MASTER') || GRIDRUN_CONFIG.SHEET_INSURER_MASTER || ''
  };
}

function handleGridRunRequest_(e) {
  var props       = PropertiesService.getScriptProperties();
  var expectedKey = props.getProperty('GRID_RUN_API_KEY');
  if (expectedKey) {
    var callerKey = (e.parameter && e.parameter.apiKey) ? e.parameter.apiKey : '';
    if (callerKey !== expectedKey) return apiResp_({ success: false, error: 'Invalid or missing apiKey' });
  }

  var p = e.parameter || {};

  // ── Parse params ────────────────────────────────────────────────────────────
  var params = {
    insurerId:         p.insurerId         || '',
    productType:       p.productType       || '',
    productSubType:    p.productSubType    || '',
    productSubSubType: p.productSubSubType || '',
    policyIssueDate:   p.policyIssueDate   || '',
    rto:               p.rto               || '',
    fuelType:          p.fuelType          || '',
    vehicleCc:         p.vehicleCc         ? parseFloat(p.vehicleCc)       : null,
    vehicleGvw:        p.vehicleGvw        ? parseFloat(p.vehicleGvw)      : null,
    vehicleSeating:    p.vehicleSeating    ? parseFloat(p.vehicleSeating)  : null,
    yom:               p.yom               ? parseInt(p.yom)               : null,
    netPremium:        p.netPremium        ? parseFloat(p.netPremium)      : 0,
    odPremium:         p.odPremium         ? parseFloat(p.odPremium)       : 0,
    tpPremium:         p.tpPremium         ? parseFloat(p.tpPremium)       : 0,
    ncb:               p.ncb               ? parseFloat(p.ncb)             : 0,
    nilDep:            p.nilDep            || '',
    cpa:               p.cpa               || ''
  };

  // ── Validate ────────────────────────────────────────────────────────────────
  var missing = [];
  if (!params.insurerId)       missing.push('insurerId');
  if (!params.productType)     missing.push('productType');
  if (!params.productSubType)  missing.push('productSubType');
  if (!params.policyIssueDate) missing.push('policyIssueDate');
  if (!params.rto)             missing.push('rto');
  if (!params.netPremium && !params.odPremium && !params.tpPremium) missing.push('netPremium (or odPremium + tpPremium)');
  missing = missing.concat(GridEngine.validateConditionalFields(params));
  if (missing.length) return apiResp_({ success: false, error: 'Missing required fields', missingFields: missing });

  // ── Find grid ───────────────────────────────────────────────────────────────
  var cfg = getGridRunRuntimeConfig_();
  var gridSheetId = GridEngine.findInsurerGrid(params.insurerId, cfg.FOLDER_GRIDS, cfg.SHEET_INSURER_MASTER);
  if (!gridSheetId) return apiResp_({ success: false, error: 'No grid found for insurer: ' + params.insurerId, matchStatus: 'NO_MATCH' });

  // ── Lookup + adjustments ────────────────────────────────────────────────────
  var result = GridEngine.lookupRate(params, gridSheetId);
  result     = GridEngine.applyConditionAdjustments(result, params);

  return apiResp_(result);
}

function apiResp_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
