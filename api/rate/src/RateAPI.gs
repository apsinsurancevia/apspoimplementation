/**
 * CaliberPO Rate API
 *
 * Returns commission rates across all (or specified) insurers for a given
 * policy/vehicle combination. No premiums required — returns rate % only.
 *
 * Three-layer CacheService optimisation:
 *   L1 — insurer list          (15 min TTL)
 *   L2 — grid sheet ID         (60 min TTL per insurer)
 *   L3 — rate result per query (60 min TTL per insurer+params)
 *
 * ── REQUEST ──────────────────────────────────────────────────────────────────
 * GET <url>?api=true&apiKey=KEY&...params
 *
 * ── AUTHENTICATION ───────────────────────────────────────────────────────────
 * apiKey          : string   Set RATE_API_KEY in Script Properties
 *
 * ── ALWAYS REQUIRED ──────────────────────────────────────────────────────────
 * productType     : string   TW | Pvt Car | GCV | PCV | Tractor | Construction Eqpt
 * productSubType  : string   Comprehensive | TP Only  (exact values per insurer grid)
 * policyIssueDate : string   YYYY-MM-DD
 * rto             : string   e.g. MH-12  (required — drives EXACT_RTO vs PAN_INDIA logic)
 *
 * ── OPTIONAL INSURER FILTER ──────────────────────────────────────────────────
 * insurers        : string   Comma-separated insurer IDs e.g. TATA_AIG,HDFC_ERGO
 *                            Omit to query all active insurers (uses more quota)
 *
 * ── CONDITIONAL BY PRODUCT TYPE ──────────────────────────────────────────────
 * vehicleCc       : number   Required for: TW, Pvt Car
 * vehicleGvw      : number   Required for: GCV, Tractor  (in tonnes)
 * vehicleSeating  : number   Required for: PCV
 * yom             : number   Required for: Pvt Car, GCV, PCV, Tractor
 * fuelType        : string   Required for: TW, Pvt Car, GCV, PCV
 *                            Values: Petrol | Diesel | Electric | Bio Fuel
 *
 * ── OPTIONAL ─────────────────────────────────────────────────────────────────
 * productSubSubType : string  e.g. School Bus (PCV variants)
 *
 * ── RESPONSE ─────────────────────────────────────────────────────────────────
 * {
 *   success  : boolean,
 *   matched  : [{ insurerId, insurerName, matchType, gridTier, vehicleAge,
 *                 piRate, piOn, piRate2, piOn2, poRate, poRate2,
 *                 ncbAdj, nilDepAdj, cpaAdj }],
 *   declined : [{ insurerId, insurerName }],
 *   queried  : number,   total insurers checked
 *   cached   : number    results served from cache (0 = all fresh)
 * }
 */

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.api === 'true') return handleRateRequest_(e);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Missing api=true parameter' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return apiResp_({ success: false, error: err.message });
  }
}

function handleRateRequest_(e) {
  var props       = PropertiesService.getScriptProperties();
  var expectedKey = props.getProperty('RATE_API_KEY');
  if (expectedKey) {
    var callerKey = (e.parameter && e.parameter.apiKey) ? e.parameter.apiKey : '';
    if (callerKey !== expectedKey) return apiResp_({ success: false, error: 'Invalid or missing apiKey' });
  }

  var p = e.parameter || {};

  // ── Parse params ────────────────────────────────────────────────────────────
  var params = {
    productType:       p.productType       || '',
    productSubType:    p.productSubType    || '',
    productSubSubType: p.productSubSubType || '',
    policyIssueDate:   p.policyIssueDate   || '',
    rto:               p.rto               || '',
    fuelType:          p.fuelType          || '',
    vehicleCc:         p.vehicleCc         ? parseFloat(p.vehicleCc)      : null,
    vehicleGvw:        p.vehicleGvw        ? parseFloat(p.vehicleGvw)     : null,
    vehicleSeating:    p.vehicleSeating    ? parseFloat(p.vehicleSeating) : null,
    yom:               p.yom               ? parseInt(p.yom)              : null,
    // Premiums not required for rate-only — set to 0 so library amounts are 0
    netPremium: 0, odPremium: 0, tpPremium: 0
  };

  // ── Validate ────────────────────────────────────────────────────────────────
  var missing = [];
  if (!params.productType)     missing.push('productType');
  if (!params.productSubType)  missing.push('productSubType');
  if (!params.policyIssueDate) missing.push('policyIssueDate');
  if (!params.rto)             missing.push('rto');
  missing = missing.concat(GridEngine.validateConditionalFields(params));
  if (missing.length) return apiResp_({ success: false, error: 'Missing required fields', missingFields: missing });

  // ── Resolve insurer list ────────────────────────────────────────────────────
  var insurerList = resolveInsurerList_(p.insurers || '');
  if (!insurerList || !insurerList.length) return apiResp_({ success: false, error: 'No active insurers found' });

  // ── Query each insurer ──────────────────────────────────────────────────────
  var cache    = CacheService.getScriptCache();
  var matched  = [];
  var declined = [];
  var cacheHits = 0;
  var rateParamKey = [
    params.productType, params.productSubType, params.productSubSubType,
    params.rto, params.vehicleCc, params.vehicleGvw, params.vehicleSeating,
    params.yom, params.fuelType, params.policyIssueDate
  ].join('|');

  insurerList.forEach(function(ins) {

    // L2: grid sheet ID per insurer
    var gridIdKey    = 'gid_' + ins.id;
    var gridSheetId  = cache.get(gridIdKey);
    if (!gridSheetId) {
      gridSheetId = GridEngine.findInsurerGrid(ins.id, RATE_CONFIG.FOLDER_GRIDS, RATE_CONFIG.SHEET_INSURER_MASTER);
      if (gridSheetId) cache.put(gridIdKey, gridSheetId, RATE_CONFIG.CACHE_TTL_GRID_SHEET_ID);
    }
    if (!gridSheetId) { declined.push({ insurerId: ins.id, insurerName: ins.name }); return; }

    // L3: rate result per insurer+params
    var rateKey     = ('r_' + ins.id + '_' + rateParamKey).substring(0, 250);
    var cachedRate  = cache.get(rateKey);
    var result;

    if (cachedRate) {
      result = JSON.parse(cachedRate);
      cacheHits++;
    } else {
      result = GridEngine.lookupRate(params, gridSheetId);
      if (result.matchStatus === 'MATCHED') {
        try { cache.put(rateKey, JSON.stringify(result), RATE_CONFIG.CACHE_TTL_RATE_RESULT); } catch(ce) {}
      }
    }

    if (result.matchStatus === 'MATCHED') {
      matched.push({
        insurerId:    ins.id,
        insurerName:  ins.name,
        matchType:    result.matchType,
        gridTier:     result.gridTier,
        vehicleAge:   result.vehicleAge,
        piRate:       result.piRate,
        piOn:         result.piOn,
        piRate2:      result.piRate2,
        piOn2:        result.piOn2,
        poRate:       result.poRate,
        poRate2:      result.poRate2,
        ncbAdj:       result.ncbAdj,
        nilDepAdj:    result.nilDepAdj,
        cpaAdj:       result.cpaAdj
      });
    } else {
      declined.push({ insurerId: ins.id, insurerName: ins.name });
    }
  });

  return apiResp_({
    success:  true,
    matched:  matched,
    declined: declined,
    queried:  insurerList.length,
    cached:   cacheHits
  });
}

/**
 * Returns active insurer list.
 * L1 cache: insurer list (15 min TTL).
 * If insurerFilter is provided (comma-separated IDs), filters to only those.
 */
function resolveInsurerList_(insurerFilter) {
  var cache     = CacheService.getScriptCache();
  var cacheKey  = 'insurer_list';
  var cached    = cache.get(cacheKey);
  var all;

  if (cached) {
    all = JSON.parse(cached);
  } else {
    try {
      var rows = GridEngine.getSheetDataAsObjects(RATE_CONFIG.SHEET_INSURER_MASTER, 'Insurers');
      all = rows
        .filter(function(r) { return r.active === 'Y'; })
        .map(function(r)    { return { id: r.insurer_id, name: r.insurer_name }; });
      cache.put(cacheKey, JSON.stringify(all), RATE_CONFIG.CACHE_TTL_INSURER_LIST);
    } catch (e) { return []; }
  }

  if (!insurerFilter || insurerFilter.trim() === '') return all;

  var filter = insurerFilter.split(',').map(function(s) { return s.trim().toUpperCase(); });
  return all.filter(function(ins) { return filter.indexOf(ins.id.toUpperCase()) !== -1; });
}

function apiResp_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
