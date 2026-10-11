/**
 * CaliberPO — API gateway on Main web app
 *
 * Serves Rate API + GridRun API through the already-authorized Main /exec URL
 * so separate Rate/GridRun projects do not need a first-time browser authorize.
 *
 * Rate API:   ?mode=rateapi&api=true&apiKey=...&productType=...
 * GridRun:    ?mode=gridrun&api=true&apiKey=...&insurerId=...
 */

function handleGatewayRateApi_(e) {
  var props = PropertiesService.getScriptProperties();
  var expectedKey = props.getProperty('RATE_API_KEY');
  if (expectedKey) {
    var callerKey = (e.parameter && e.parameter.apiKey) ? e.parameter.apiKey : '';
    if (callerKey !== expectedKey) {
      return jsonOut_({ success: false, error: 'Invalid or missing apiKey' });
    }
  }

  var p = e.parameter || {};
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
    netPremium: 0, odPremium: 0, tpPremium: 0
  };

  var missing = [];
  if (!params.productType) missing.push('productType');
  if (!params.productSubType) missing.push('productSubType');
  if (!params.policyIssueDate) missing.push('policyIssueDate');
  if (!params.rto) missing.push('rto');
  if (missing.length) {
    return jsonOut_({ success: false, error: 'Missing required fields', missingFields: missing });
  }

  var insurerList = gatewayResolveInsurers_(p.insurers || '');
  if (!insurerList.length) {
    return jsonOut_({ success: false, error: 'No active insurers found' });
  }

  var matched = [];
  var declined = [];
  insurerList.forEach(function (ins) {
    try {
      var callParams = {
        insurerId: ins.id,
        productType: params.productType,
        productSubType: params.productSubType,
        productSubSubType: params.productSubSubType,
        policyIssueDate: params.policyIssueDate,
        rto: params.rto,
        fuelType: params.fuelType,
        vehicleCc: params.vehicleCc,
        vehicleGvw: params.vehicleGvw,
        vehicleSeating: params.vehicleSeating,
        yom: params.yom,
        netPremium: 0,
        odPremium: 0,
        tpPremium: 0
      };
      var result = lookupRate(callParams);
      if (result && result.matchStatus === 'MATCHED') {
        matched.push({
          insurerId:   ins.id,
          insurerName: ins.name,
          matchType:   result.matchType || result.matchStatus || '',
          gridTier:    result.gridTier || '',
          vehicleAge:  result.vehicleAge || '',
          piRate:      result.piRate,
          piOn:        result.piOn,
          piRate2:     result.piRate2,
          piOn2:       result.piOn2,
          poRate:      result.poRate,
          poRate2:     result.poRate2,
          ncbAdj:      result.ncbAdj,
          nilDepAdj:   result.nilDepAdj,
          cpaAdj:      result.cpaAdj
        });
      } else {
        declined.push({ insurerId: ins.id, insurerName: ins.name });
      }
    } catch (err) {
      declined.push({ insurerId: ins.id, insurerName: ins.name, error: err.message });
    }
  });

  return jsonOut_({
    success: true,
    matched: matched,
    declined: declined,
    queried: insurerList.length,
    via: 'main-gateway'
  });
}

function handleGatewayGridRun_(e) {
  var props = PropertiesService.getScriptProperties();
  var expectedKey = props.getProperty('GRID_RUN_API_KEY');
  if (expectedKey) {
    var callerKey = (e.parameter && e.parameter.apiKey) ? e.parameter.apiKey : '';
    if (callerKey !== expectedKey) {
      return jsonOut_({ success: false, error: 'Invalid or missing apiKey' });
    }
  }

  var p = e.parameter || {};
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

  var missing = [];
  if (!params.insurerId) missing.push('insurerId');
  if (!params.productType) missing.push('productType');
  if (!params.productSubType) missing.push('productSubType');
  if (!params.policyIssueDate) missing.push('policyIssueDate');
  if (!params.rto) missing.push('rto');
  if (!params.netPremium && !params.odPremium && !params.tpPremium) {
    missing.push('netPremium (or odPremium + tpPremium)');
  }
  if (missing.length) {
    return jsonOut_({ success: false, error: 'Missing required fields', missingFields: missing });
  }

  var result = lookupRate(params);
  result = applyConditionAdjustments_(result, params);
  result.via = 'main-gateway';
  result.success = result.success !== false;
  return jsonOut_(result);
}

function gatewayResolveInsurers_(insurerFilter) {
  var insurers = getSheetDataAsObjects(CONFIG.SHEET_INSURER_MASTER, 'Insurers')
    .filter(function (r) { return String(r.active || '').trim().toUpperCase() === 'Y'; })
    .map(function (r) { return { id: r.insurer_id, name: r.insurer_name }; });
  if (!insurerFilter || String(insurerFilter).trim() === '') return insurers;
  var filter = String(insurerFilter).split(',').map(function (s) { return s.trim().toUpperCase(); });
  return insurers.filter(function (ins) { return filter.indexOf(String(ins.id).toUpperCase()) !== -1; });
}
