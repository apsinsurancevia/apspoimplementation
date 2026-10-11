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
    var action = (e && e.parameter && String(e.parameter.action || '').toLowerCase()) || '';
    if (action === 'health') {
      return handleHealthRequest_();
    }
    if (action === 'setprop') {
      return handleSetPropRequest_(e);
    }
    if (action === 'updateinsurers') {
      return handleUpdateInsurersRequest_(e);
    }
    if (action === 'appendinsurers') {
      return handleAppendInsurersRequest_(e);
    }
    if (action === 'refreshinsurerstatus') {
      return handleRefreshInsurerStatusRequest_(e);
    }
    if (action === 'backfillporate') {
      return handleBackfillPoRateRequest_(e);
    }
    if (action === 'wipegriddata') {
      return handleWipeGridDataRequest_(e);
    }
    if (action === 'ensureconfigtabs') {
      return handleEnsureConfigTabsRequest_(e);
    }
    if (action === 'createoperationsguide') {
      return handleCreateOperationsGuideRequest_(e);
    }
    if (action === 'completeopsguide') {
      return handleCompleteOpsGuideRequest_(e);
    }
    if (action === 'opsstatementrecon') {
      return handleOpsStatementReconRequest_(e);
    }
    if (action === 'diagnoseclaude') {
      return handleDiagnoseClaudeRequest_(e);
    }
    if (action === 'validateallgrids') {
      return handleValidateAllGridsRequest_(e);
    }
    if (action === 'fillinsurers') {
      return handleFillInsurersRequest_(e);
    }
    if (action === 'importrto') {
      return handleImportRtoRequest_(e);
    }
    if (action === 'createtestgrid') {
      return handleCreateTestGridRequest_(e);
    }
    if (action === 'seedpartners') {
      return handleSeedPartnersRequest_(e);
    }
    if (action === 'seedmasters') {
      return handleSeedMastersRequest_(e);
    }
    if (action === 'setuparchives') {
      return handleSetupArchivesRequest_(e);
    }
    if (action === 'setuptriggers') {
      return handleSetupTriggersRequest_(e);
    }
    if (action === 'createallgrids') {
      return handleCreateAllGridsRequest_(e);
    }
    if (action === 'importgrids') {
      return handleImportGridsRequest_(e);
    }
    if (action === 'bootstrap') {
      return handleBootstrapRequest_(e);
    }
    var mode = (e && e.parameter && String(e.parameter.mode || '').toLowerCase()) || '';
    if (mode === 'rateapi' || action === 'rateapi') {
      return handleGatewayRateApi_(e);
    }
    if (mode === 'gridrun' || action === 'gridrun') {
      return handleGatewayGridRun_(e);
    }
    if (e && e.parameter && (e.parameter.api === 'true' || mode === 'api')) {
      return handleAPIRequest(e);
    }
    return HtmlService
      .createHtmlOutputFromFile('index')
      .setTitle('CaliberPO — Rate Lookup')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Set Script Properties remotely (bootstrap key required).
 * ?action=setprop&key=...&CLAUDE_API_KEY=...&RATE_API_KEY=...&GRID_RUN_API_KEY=...
 */
function handleSetPropRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) {
    return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  }
  var props = PropertiesService.getScriptProperties();
  var p = (e && e.parameter) || {};
  var set = [];
  ['CLAUDE_API_KEY', 'RATE_API_KEY', 'GRID_RUN_API_KEY', 'MONITORING_ENDPOINT', 'MONITORING_KEY'].forEach(function (k) {
    if (p[k] !== undefined && p[k] !== null && String(p[k]).trim() !== '') {
      props.setProperty(k, String(p[k]).trim());
      set.push(k);
    }
  });
  return jsonOut_({
    success: true,
    set: set,
    hasClaude: !!props.getProperty('CLAUDE_API_KEY'),
    hasRateKey: !!props.getProperty('RATE_API_KEY'),
    hasGridKey: !!props.getProperty('GRID_RUN_API_KEY')
  });
}

/** ?action=importRto&key=...&fileId=DRIVE_FILE_ID */
function handleImportRtoRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    var fileId = (e.parameter && e.parameter.fileId) || '';
    importRTOMasterFromDrive(fileId);
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_RTO_MASTER);
    var sheet = ss.getSheetByName('RTO');
    var rows = Math.max(0, sheet.getLastRow() - 1);
    return jsonOut_({ success: true, rtoRows: rows, sheetId: CONFIG.SHEET_RTO_MASTER });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/**
 * ?action=createTestGrid&key=...&insurerId=OR&productType=TW
 * Creates grid sheet + one Pan-India sample rate row for Rate Lookup smoke test.
 */
function handleCreateTestGridRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    var insurerId = (e.parameter && e.parameter.insurerId) || 'OR';
    var productType = (e.parameter && e.parameter.productType) || 'TW';
    var sheetId = createGridTemplate(insurerId, productType);
    var sample = seedSampleGridRow_(sheetId, insurerId, productType);
    return jsonOut_({
      success: true,
      gridSheetId: sheetId,
      gridUrl: 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit',
      sample: sample
    });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** Appends one Pan-India TW sample row if the active/data tab has only headers. */
function seedSampleGridRow_(sheetId, insurerId, productType) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheets().filter(function (s) {
    return s.getName() !== 'Sheet1' && s.getLastRow() >= 0;
  })[0] || ss.getSheets()[0];
  if (sheet.getLastRow() > 1) {
    return { skipped: true, reason: 'data rows already present', tab: sheet.getName(), rows: sheet.getLastRow() - 1 };
  }
  var insurerName = '';
  for (var i = 0; i < INSURER_MASTER_DATA.length; i++) {
    if (INSURER_MASTER_DATA[i][0] === insurerId) { insurerName = INSURER_MASTER_DATA[i][1]; break; }
  }
  var row = [];
  for (var c = 0; c < GRID_HEADERS.length; c++) row.push('');
  var idx = {};
  GRID_HEADERS.forEach(function (h, i) { idx[h] = i; });
  row[idx.insurance_company] = insurerName;
  row[idx.insurer_code] = insurerId;
  row[idx.scheme_name] = 'APS_TEST';
  row[idx.product_type] = productType;
  row[idx.product_sub_type] = '1+1';
  row[idx.product_category] = 'Motor';
  row[idx.effective_from_date] = '01-04-2025';
  row[idx.effective_to_date] = '31-03-2027';
  row[idx.vehicle_age_band] = 'New';
  row[idx.fuel_type] = 'Petrol';
  row[idx.vehicle_cc_lower_limit] = 0;
  row[idx.vehicle_cc_upper_limit] = 9999;
  row[idx.rto_list] = 'PAN INDIA';
  row[idx.pi_rate] = 10;
  row[idx.pi_rate_on] = 'NET';
  row[idx.po_rate] = 8;
  row[idx.po_rate_on] = 'NET';
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return { skipped: false, tab: sheet.getName(), piRate: 10, poRate: 8, rto: 'PAN INDIA' };
}

/** ?action=setupArchives&key=... — create Grid Archive subfolders per active insurer */
function handleSetupArchivesRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    return jsonOut_({ success: true, archives: setupGridArchiveFolders() });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=setupTriggers&key=... — wire archiveLog + sendNoMatchReport triggers */
function handleSetupTriggersRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    return jsonOut_({ success: true, triggers: setupTriggers() });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=createAllGrids&key=... — one grid sheet per active insurer × product tabs */
function handleCreateAllGridsRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    return jsonOut_({ success: true, grids: createAllGridTemplates() });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=importGrids&key=... — process all .xlsx in Grid Import folder */
function handleImportGridsRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    var summary = importGridsFromFolder();
    return jsonOut_({ success: true, summary: summary });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=seedMasters&key=... — reseed Product/Insurer/Partner/Broker Config from code refs */
function handleSeedMastersRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    var result = seedAllMastersFromRefs();
    var prompts = null;
    try { prompts = seedDefaultPrompts(); } catch (pe) { prompts = { error: pe.message }; }
    return jsonOut_({ success: true, masters: result, prompts: prompts });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=seedPartners&key=... — 3 test partners for payout tests */
function handleSeedPartnersRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    var result = applyPartnerMasterSeed();
    return jsonOut_({ success: true, partners: result.partners });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** Fill GST details for grid insurers already on Insurer Master. ?action=fillInsurers&key=... */
function handleFillInsurersRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) {
    return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  }
  try {
    var result = fillGridInsurerGstDetails();
    return jsonOut_({ success: true, insurers: result });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** Append grid insurers missing from Insurer Master. ?action=appendInsurers&key=... */
function handleAppendInsurersRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) {
    return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  }
  try {
    var result = appendMissingGridInsurers();
    return jsonOut_({ success: true, insurers: result });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=refreshInsurerStatus&key=... */
function handleRefreshInsurerStatusRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    return jsonOut_({ success: true, status: refreshInsurerStatus() });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/**
 * ?action=backfillPoRate&key=...&insurerId=BAJAJ
 * Copies pi_rate → po_rate on live grid tabs where PO is blank.
 */
function handleBackfillPoRateRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    var insurerId = (e.parameter && e.parameter.insurerId) || '';
    return jsonOut_({ success: true, result: backfillPoRateFromPi_(insurerId) });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=wipeGridData&key=... — clear data rows on all FY product tabs in Grids folder */
function handleWipeGridDataRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    return jsonOut_({ success: true, result: wipeAllProductGridData_() });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=ensureConfigTabs&key=... — create Insurer_Status / Statement_Headers if missing */
function handleEnsureConfigTabsRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    var ensured = ensureBrokerConfigExtraTabs_();
    var status = null;
    try { status = refreshInsurerStatus(); } catch (re) { status = { error: re.message }; }
    return jsonOut_({ success: true, ensured: ensured, status: status });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=createOperationsGuide&key=... — build Ops Guide sheet in FOLDER_ROOT */
function handleCreateOperationsGuideRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    var url = createOperationsGuide();
    return jsonOut_({ success: true, url: url });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=completeOpsGuide&key=... — audit + finish Ops Guide checklist */
function handleCompleteOpsGuideRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    return jsonOut_({ success: true, report: completeOpsGuideProcess() });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message, stack: err.stack });
  }
}

/**
 * ?action=diagnoseClaude&key=...
 * Reports masked CLAUDE_API_KEY shape, trims whitespace if needed, re-probes Anthropic.
 */
function handleDiagnoseClaudeRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });

  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('CLAUDE_API_KEY') || '';
  var trimmed = raw.replace(/^\s+|\s+$/g, '').replace(/^["']|["']$/g, '');
  var info = {
    present: !!raw,
    length: raw.length,
    trimmedLength: trimmed.length,
    startsWithSkAnt: trimmed.indexOf('sk-ant-') === 0,
    hadLeadingTrailingWhitespace: raw !== raw.replace(/^\s+|\s+$/g, ''),
    hadWrappingQuotes: raw.length > 0 && (raw.charAt(0) === '"' || raw.charAt(0) === "'"),
    prefix: trimmed ? trimmed.substring(0, 10) + '…' : '',
    suffix: trimmed.length > 6 ? ('…' + trimmed.substring(trimmed.length - 4)) : ''
  };

  if (trimmed && trimmed !== raw) {
    props.setProperty('CLAUDE_API_KEY', trimmed);
    info.rewroteTrimmed = true;
  } else {
    info.rewroteTrimmed = false;
  }

  var probe = { ok: false, code: 0, body: '' };
  if (trimmed) {
    try {
      var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': trimmed,
          'anthropic-version': '2023-06-01'
        },
        payload: JSON.stringify({
          model: CONFIG.CLAUDE_MODEL || 'claude-sonnet-4-6',
          max_tokens: 16,
          messages: [{ role: 'user', content: 'Reply with OK only' }]
        }),
        muteHttpExceptions: true
      });
      probe.code = resp.getResponseCode();
      probe.ok = probe.code === 200;
      probe.body = String(resp.getContentText() || '').substring(0, 280);
    } catch (err) {
      probe.error = err.message;
    }
  }

  return jsonOut_({ success: true, key: info, probe: probe });
}

/** ?action=opsStatementRecon&key=... — retry Ops Guide steps 18–19 only */
function handleOpsStatementReconRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    var s18 = _opsGuideRunStatementSample_();
    var s19;
    try {
      var recon = runReconciliation('BAJAJ', CONFIG.CURRENT_PERIOD);
      s19 = recon
        ? _opsOk_('Recon rows=' + (recon.totalStatement || 0), (recon.totalStatement || 0) > 0, recon)
        : _opsFail_('recon', 'null');
    } catch (re) {
      s19 = _opsFail_('recon', re.message);
    }
    // Tick guide boxes for 18/19 if ok
    try {
      var folder = DriveApp.getFolderById(CONFIG.FOLDER_ROOT);
      var files = folder.getFilesByName('CaliberPO Operations Guide');
      if (files.hasNext()) {
        var gss = SpreadsheetApp.open(files.next());
        var ot = gss.getSheetByName('One-Time Setup');
        var mo = gss.getSheetByName('Monthly Cycle');
        if (ot && s18.ok) ot.getRange(19, 1).setValue(true); // step 18 → row 19
        if (ot && s19.ok) ot.getRange(20, 1).setValue(true);
        if (mo && s18.ok) {
          mo.getRange(5, 1).setValue(true);
          mo.getRange(6, 1).setValue(true);
        }
        if (mo && s19.ok) mo.getRange(14, 1).setValue(true);
      }
    } catch (markErr) { /* non-fatal */ }
    return jsonOut_({ success: true, step18: s18, step19: s19 });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** ?action=validateAllGrids&key=... */
function handleValidateAllGridsRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  try {
    return jsonOut_({ success: true, result: validateAllGrids() });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/**
 * Ensures Insurer_Status + Statement_Headers exist on CaliberPO Config
 * (older APS setups were created before those tabs existed).
 */
function ensureBrokerConfigExtraTabs_() {
  if (!CONFIG.SHEET_BROKER_CONFIG) throw new Error('CONFIG.SHEET_BROKER_CONFIG is blank');
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_BROKER_CONFIG);
  var created = [];

  if (!ss.getSheetByName('Insurer_Status')) {
    var isSheet = ss.insertSheet('Insurer_Status');
    var headers = ['insurer_id','insurer_name','data_configured','grid_configured','statement_configured','notes','last_updated'];
    isSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (typeof INSURER_STATUS_DATA !== 'undefined' && INSURER_STATUS_DATA.length) {
      isSheet.getRange(2, 1, INSURER_STATUS_DATA.length, 7).setValues(INSURER_STATUS_DATA);
    }
    created.push('Insurer_Status');
  }

  if (!ss.getSheetByName('Statement_Headers')) {
    var sh = ss.insertSheet('Statement_Headers');
    var shHeaders = ['insurer_id','file_format','sheet_name','header_row','policy_no_col','brokerage_col','premium_col','insured_name_col','date_col','notes'];
    sh.getRange(1, 1, 1, shHeaders.length).setValues([shHeaders]);
    if (typeof STATEMENT_HEADERS_DATA !== 'undefined' && STATEMENT_HEADERS_DATA.length) {
      sh.getRange(2, 1, STATEMENT_HEADERS_DATA.length, 10).setValues(STATEMENT_HEADERS_DATA);
    }
    created.push('Statement_Headers');
  }

  SpreadsheetApp.flush();
  return { created: created, existing: created.length === 0 };
}

/** Clears data rows (keeps headers) on all *_YY-YY product tabs under Grids. */
function wipeAllProductGridData_() {
  var folder = DriveApp.getFolderById(CONFIG.FOLDER_GRIDS);
  var files = folder.getFiles();
  var summary = [];
  while (files.hasNext()) {
    var file = files.next();
    if (file.getName().toLowerCase().indexOf('grid') === -1) continue;
    var ss = SpreadsheetApp.openById(file.getId());
    var cleared = 0;
    ss.getSheets().forEach(function(sheet) {
      if (!/^[A-Za-z]+_\d{2}-\d{2}$/.test(sheet.getName())) return;
      var last = sheet.getLastRow();
      if (last > 1) {
        sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent();
        cleared++;
      }
    });
    if (cleared) summary.push({ file: file.getName(), tabsCleared: cleared });
  }
  SpreadsheetApp.flush();
  return { files: summary.length, details: summary };
}

/** Backfill blank po_rate from pi_rate for one insurer or all grid sheets. */
function backfillPoRateFromPi_(insurerId) {
  var summary = [];
  var folder = DriveApp.getFolderById(CONFIG.FOLDER_GRIDS);
  var files = folder.getFiles();
  var filter = (insurerId || '').toString().trim().toUpperCase();

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    if (name.toLowerCase().indexOf('grid') === -1) continue;
    if (filter && name.toUpperCase().indexOf(filter) === -1) continue;

    var ss = SpreadsheetApp.openById(file.getId());
    var tabsTouched = 0, cells = 0;
    ss.getSheets().forEach(function(sheet) {
      if (!/^[A-Za-z]+_\d{2}-\d{2}$/.test(sheet.getName())) return;
      var last = sheet.getLastRow();
      if (last < 2) return;
      var width = Math.min(64, sheet.getLastColumn());
      var data = sheet.getRange(2, 1, last - 1, width).getValues();
      var changed = false;
      for (var r = 0; r < data.length; r++) {
        while (data[r].length < 64) data[r].push('');
        var pi = parseFloat(data[r][36]);
        var po = parseFloat(data[r][42]);
        if (!isNaN(pi) && pi > 0 && (data[r][42] === '' || data[r][42] === null || isNaN(po) || po === 0)) {
          data[r][42] = pi;
          if (!data[r][43]) data[r][43] = data[r][37] || 'NET';
          cells++;
          changed = true;
        }
      }
      if (changed) {
        sheet.getRange(2, 1, data.length, 64).setValues(data.map(function(row) { return row.slice(0, 64); }));
        tabsTouched++;
      }
    });
    if (tabsTouched) summary.push({ file: name, tabs: tabsTouched, cells: cells });
  }
  SpreadsheetApp.flush();
  return { filesUpdated: summary.length, details: summary };
}

/** Replace Insurer Master rows with APS buyer GST details. ?action=updateInsurers&key=... */
function handleUpdateInsurersRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) {
    return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  }
  try {
    var result = applyApsInsurerBuyers();
    var prompts = null;
    try { prompts = seedDefaultPrompts(); } catch (pe) { prompts = { error: pe.message }; }
    return jsonOut_({ success: true, insurers: result, prompts: prompts });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

/** Smoke test: ?action=health — verifies Config sheet IDs are readable. */
function handleHealthRequest_() {
  try {
    var cfg = getFormConfig();
    return jsonOut_({
      success: true,
      insurerCount: (cfg.insurers || []).length,
      productTypes: cfg.productTypes || [],
      folderRoot: CONFIG.FOLDER_ROOT || '',
      sheetInsurerMaster: CONFIG.SHEET_INSURER_MASTER || ''
    });
  } catch (err) {
    return jsonOut_({
      success: false,
      error: err.message,
      folderRoot: CONFIG.FOLDER_ROOT || '',
      sheetInsurerMaster: CONFIG.SHEET_INSURER_MASTER || ''
    });
  }
}

/**
 * One-shot remote setup for fresh deploys.
 * GET ?action=bootstrap&key=...
 * Uses existing CONFIG IDs when present; otherwise runs runSetup().
 */
function handleBootstrapRequest_(e) {
  var expected = 'caliberpo-aps-bootstrap-2026';
  var key = (e && e.parameter && e.parameter.key) || '';
  if (key !== expected) {
    return jsonOut_({ success: false, error: 'invalid bootstrap key' });
  }

  var ids;
  var setupSource = 'runSetup';
  if (CONFIG.FOLDER_ROOT && CONFIG.SHEET_INSURER_MASTER && CONFIG.SHEET_PRODUCT_MASTER) {
    setupSource = 'config';
    ids = {
      folders: {
        ROOT: CONFIG.FOLDER_ROOT,
        MASTERS: CONFIG.FOLDER_MASTERS,
        CONFIG: '',
        GRIDS: CONFIG.FOLDER_GRIDS,
        GRID_IMPORT: CONFIG.FOLDER_GRID_IMPORT,
        GRID_ARCHIVE: CONFIG.FOLDER_GRID_ARCHIVE,
        INPUT: CONFIG.FOLDER_INPUT,
        OUTPUT: CONFIG.FOLDER_OUTPUT,
        STATEMENTS: CONFIG.FOLDER_STATEMENTS,
        INVOICES: CONFIG.FOLDER_INVOICES,
        INVOICES_PARTNER: CONFIG.FOLDER_INVOICES_PARTNER,
        INVOICES_INSURER: CONFIG.FOLDER_INVOICES_INSURER,
        RECONCILIATION: CONFIG.FOLDER_RECONCILIATION,
        BACKUP: CONFIG.FOLDER_BACKUP,
        LOG: CONFIG.FOLDER_LOG
      },
      sheets: {
        PRODUCT_MASTER: CONFIG.SHEET_PRODUCT_MASTER,
        RTO_MASTER: CONFIG.SHEET_RTO_MASTER,
        INSURER_MASTER: CONFIG.SHEET_INSURER_MASTER,
        BROKER_CONFIG: CONFIG.SHEET_BROKER_CONFIG,
        PARTNER_MASTER: CONFIG.SHEET_PARTNER_MASTER,
        LOG: CONFIG.SHEET_LOG,
        RECONCILIATION: CONFIG.SHEET_RECONCILIATION
      }
    };
  } else {
    ids = JSON.parse(runSetup());
  }

  var prompts = null;
  try { prompts = seedDefaultPrompts(); } catch (pe) { prompts = { error: pe.message }; }

  var props = PropertiesService.getScriptProperties();
  var rateKey = props.getProperty('RATE_API_KEY');
  var gridKey = props.getProperty('GRID_RUN_API_KEY');
  if (!rateKey) {
    rateKey = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('RATE_API_KEY', rateKey);
  }
  if (!gridKey) {
    gridKey = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('GRID_RUN_API_KEY', gridKey);
  }

  var flat = {};
  Object.keys(ids.folders || {}).forEach(function (k) { flat['FOLDER_' + k] = ids.folders[k]; });
  Object.keys(ids.sheets || {}).forEach(function (k) { flat['SHEET_' + k] = ids.sheets[k]; });

  var formCheck = null;
  try {
    var cfg = getFormConfig();
    formCheck = { insurerCount: (cfg.insurers || []).length, productTypes: cfg.productTypes || [] };
  } catch (fe) {
    formCheck = { error: fe.message };
  }

  return jsonOut_({
    success: true,
    setupSource: setupSource,
    ids: flat,
    folders: ids.folders,
    sheets: ids.sheets,
    rootFolderUrl: 'https://drive.google.com/drive/folders/' + (ids.folders.ROOT || ''),
    rateApiKey: rateKey,
    gridRunApiKey: gridKey,
    prompts: prompts,
    formCheck: formCheck
  });
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run once from editor/clasp to ensure Main OAuth + optional property scaffolding. */
function authorizeMainProperties() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RATE_API_KEY')) {
    props.setProperty('RATE_API_KEY', Utilities.getUuid().replace(/-/g, ''));
  }
  if (!props.getProperty('GRID_RUN_API_KEY')) {
    props.setProperty('GRID_RUN_API_KEY', Utilities.getUuid().replace(/-/g, ''));
  }
  SpreadsheetApp.openById(CONFIG.SHEET_INSURER_MASTER).getName();
  return {
    ok: true,
    hasClaude: !!props.getProperty('CLAUDE_API_KEY'),
    hasRateKey: !!props.getProperty('RATE_API_KEY'),
    hasGridKey: !!props.getProperty('GRID_RUN_API_KEY')
  };
}

/**
 * CaliberPO Rate API
 * Single-call endpoint. Send all fields, get rate back.
 *
 * ── REQUEST ──────────────────────────────────────────────────────────────────
 * Method : GET
 * URL    : <deployed web app URL>
 * Params : api=true  (required — routes to this handler)
 *
 * ── AUTHENTICATION ───────────────────────────────────────────────────────────
 * apiKey : string  Your API key (set RATE_API_KEY in Apps Script Script Properties)
 *
 * ── ALWAYS REQUIRED ──────────────────────────────────────────────────────────
 * insurerId       : string  Insurer code from CaliberPO master.
 *                           Examples: TATA_AIG, HDFC_ERGO, BAJAJ, NEW_INDIA,
 *                                     ICICI_LOMBARD, RELIANCE, ROYAL_SUNDARAM,
 *                                     CHOLA, SBI_GENERAL
 *
 * productType     : string  One of:
 *                           TW | Pvt Car | GCV | PCV | Tractor | Construction Eqpt
 *
 * productSubType  : string  Coverage type. Common values:
 *                           Comprehensive | TP Only
 *                           (exact values vary by insurer grid)
 *
 * policyIssueDate : string  YYYY-MM-DD  e.g. 2026-08-01
 *
 * netPremium      : number  Total premium (OD + TP). Used when odPremium/tpPremium
 *                           are not split. Send at least one of netPremium,
 *                           odPremium, or tpPremium.
 *
 * ── RECOMMENDED (split premium — more accurate rate calculation) ──────────────
 * odPremium       : number  OD component including all OD add-ons
 * tpPremium       : number  TP component including all TP add-ons
 *
 * ── CONDITIONAL BY PRODUCT TYPE ──────────────────────────────────────────────
 * vehicleCc       : number  Engine CC          — required for: TW, Pvt Car
 *                           Examples: 100, 125, 150, 350, 1197, 1500
 *
 * vehicleGvw      : number  Gross Vehicle Wt   — required for: GCV, Tractor
 *                           In tonnes. Examples: 3.5, 7.5, 12, 25
 *
 * vehicleSeating  : number  Seating capacity   — required for: PCV
 *                           Examples: 7, 13, 32, 54
 *
 * yom             : number  Year of manufacture — required for: Pvt Car, GCV, PCV, Tractor
 *                           Examples: 2019, 2022, 2026
 *
 * fuelType        : string  Fuel type           — required for: TW, Pvt Car, GCV, PCV
 *                           One of: Petrol | Diesel | Electric | Bio Fuel
 *
 * ── OPTIONAL ─────────────────────────────────────────────────────────────────
 * rto             : string  RTO/registration code. Normalised to XX-00 format internally.
 *                           Examples: MH-12, DL-01, KA-05
 *                           If blank or no exact match → PAN India rate applies.
 *
 * productSubSubType : string  Required only for product types that have a third level
 *                             (e.g. PCV sub-sub-types: School Bus, Staff Bus).
 *                             Leave blank if not applicable.
 *
 * ncb             : number  No Claim Bonus value on the policy.
 *                           Values: 0 | 20 | 25 | 35 | 45 | 50
 *                           0 = no NCB (NCB-absent adjustment fires if grid has one).
 *                           Omit or send 0 for new/no-NCB policies.
 *
 * nilDep          : string  Nil Depreciation add-on present on this policy.
 *                           Send: Y (present) or blank (absent).
 *                           Absent → NilDep-absent adjustment fires if grid has one.
 *
 * cpa             : string  Compulsory PA cover present on this policy.
 *                           Send: Y (present) or blank (absent).
 *                           Absent → CPA-absent adjustment fires if grid has one.
 *
 * ── RESPONSE ─────────────────────────────────────────────────────────────────
 * success          : boolean
 * matchStatus      : MATCHED | NO_MATCH | DUPLICATE_RATE | ERROR
 * matchType        : EXACT_RTO | PAN_INDIA
 * gridTier         : Base | Slab_1 | Slab_2 | Slab_3
 * vehicleAge       : New | Old  (derived from yom)
 * piRate           : number  PI rate % (insurer → broker)
 * piOn             : string  Rate basis: OD | TP | NET | FLAT
 * piAmount         : number  PI amount before adjustments
 * piRate2          : number  Second PI rate % (when grid has OD + TP split rates)
 * piOn2            : string  Second rate basis
 * piAmount2        : number  Second PI amount
 * poRate           : number  PO rate % (broker → partner)
 * poAmount         : number  PO amount before adjustments
 * poRate2          : number  Second PO rate %
 * poAmount2        : number  Second PO amount
 * ncbAdj           : number  NCB adjustment % from grid (null if grid has none)
 * nilDepAdj        : number  NilDep adjustment % from grid (null if grid has none)
 * cpaAdj           : number  CPA adjustment % from grid (null if grid has none)
 * adjustmentsApplied: array  List of adjustments that fired, e.g. ["ncb_adj: -5%"]
 * finalPoAmount    : number  Net PO amount after all adjustments — USE THIS for payout
 * finalPiAmount    : number  Net PI amount after all adjustments
 * notes            : string  Explanation on NO_MATCH or ERROR
 * missingFields    : array   Populated on validation failure
 * error            : string  Error message on failure
 */
function handleAPIRequest(e) {
  try {

    // ── API key validation ──────────────────────────────────────────────────────
    var expectedKey = PropertiesService.getScriptProperties().getProperty('RATE_API_KEY');
    if (expectedKey) {
      var callerKey = (e.parameter && e.parameter.apiKey) ? e.parameter.apiKey : '';
      if (callerKey !== expectedKey) {
        return apiResponse_({ success: false, error: 'Invalid or missing apiKey' });
      }
    }

    var p = e.parameter || {};

    // ── Parse all inputs ────────────────────────────────────────────────────────
    var params = {
      insurerId:         p.insurerId         || '',
      productType:       p.productType       || '',
      productSubType:    p.productSubType    || '',
      productSubSubType: p.productSubSubType || '',
      rto:               p.rto               || '',
      policyIssueDate:   p.policyIssueDate   || '',
      netPremium:        p.netPremium        ? parseFloat(p.netPremium)      : 0,
      odPremium:         p.odPremium         ? parseFloat(p.odPremium)       : 0,
      tpPremium:         p.tpPremium         ? parseFloat(p.tpPremium)       : 0,
      fuelType:          p.fuelType          || '',
      vehicleCc:         p.vehicleCc         ? parseFloat(p.vehicleCc)       : null,
      vehicleGvw:        p.vehicleGvw        ? parseFloat(p.vehicleGvw)      : null,
      vehicleSeating:    p.vehicleSeating    ? parseFloat(p.vehicleSeating)  : null,
      yom:               p.yom               ? parseInt(p.yom)               : null,
      ncb:               p.ncb               ? parseFloat(p.ncb)             : 0,
      nilDep:            p.nilDep            || '',
      cpa:               p.cpa               || ''
    };

    // ── Validate required fields ────────────────────────────────────────────────
    var missingFields = [];
    if (!params.insurerId)       missingFields.push('insurerId');
    if (!params.productType)     missingFields.push('productType');
    if (!params.productSubType)  missingFields.push('productSubType');
    if (!params.policyIssueDate) missingFields.push('policyIssueDate');
    if (!params.netPremium && !params.odPremium && !params.tpPremium) {
      missingFields.push('netPremium (or odPremium + tpPremium)');
    }
    missingFields = missingFields.concat(validateConditionalFields_(params));

    if (missingFields.length > 0) {
      return apiResponse_({
        success:       false,
        error:         'Missing required fields',
        missingFields: missingFields
      });
    }

    // ── Lookup and return ───────────────────────────────────────────────────────
    var result = lookupRate(params);
    return apiResponse_(applyConditionAdjustments_(result, params));

  } catch (err) {
    return apiResponse_({ success: false, error: err.message });
  }
}

/**
 * Validates that all conditional required fields are present for the given product type.
 * Returns array of missing field names (empty = all good).
 */
function validateConditionalFields_(params) {
  var missing = [];

  var fc = {
    'TW':               { cc: true,  fuel: true,  gvw: false, seating: false, yom: false },
    'Pvt Car':          { cc: true,  fuel: true,  gvw: false, seating: false, yom: true  },
    'GCV':              { cc: false, fuel: true,  gvw: true,  seating: false, yom: true  },
    'PCV':              { cc: false, fuel: true,  gvw: false, seating: true,  yom: true  },
    'Tractor':          { cc: false, fuel: false, gvw: false, seating: false, yom: true  },
    'Construction Eqpt':{ cc: false, fuel: false, gvw: false, seating: false, yom: false }
  };

  var rules = fc[params.productType];
  if (!rules) return missing; // unknown product type — let lookupRate handle it

  if (rules.cc      && (params.vehicleCc    === null || params.vehicleCc    === undefined)) missing.push('vehicleCc');
  if (rules.gvw     && (params.vehicleGvw   === null || params.vehicleGvw   === undefined)) missing.push('vehicleGvw');
  if (rules.seating && (params.vehicleSeating === null || params.vehicleSeating === undefined)) missing.push('vehicleSeating');
  if (rules.yom     && (params.yom          === null || params.yom          === undefined)) missing.push('yom');
  if (rules.fuel    && !params.fuelType)                                                    missing.push('fuelType');

  return missing;
}

/**
 * Applies NCB, NilDep, CPA condition adjustments to the rate result.
 * Adjustment logic mirrors CommissionApplication.gs:
 *   If condition is ABSENT → adjustment fires (deduction applies).
 *   ncb: 0 or blank = absent; nilDep/cpa: blank = absent, any value = present.
 * Returns the result object with finalPoAmount and finalPiAmount added.
 */
function applyConditionAdjustments_(result, params) {
  if (!result.success || result.matchStatus !== 'MATCHED') return result;

  var poAmount  = (result.poAmount  || 0) + (result.poAmount2  || 0);
  var piAmount  = (result.piAmount  || 0) + (result.piAmount2  || 0);

  var ncbAdj    = (result.ncbAdj    !== null && result.ncbAdj    !== undefined) ? parseFloat(result.ncbAdj)    : null;
  var nilDepAdj = (result.nilDepAdj !== null && result.nilDepAdj !== undefined) ? parseFloat(result.nilDepAdj) : null;
  var cpaAdj    = (result.cpaAdj    !== null && result.cpaAdj    !== undefined) ? parseFloat(result.cpaAdj)    : null;

  var adjustmentsApplied = [];

  // NCB absent (ncb = 0 or blank) → ncbAdj deduction fires
  if (ncbAdj !== null && (!params.ncb || params.ncb === 0)) {
    poAmount = Math.round(poAmount * (1 - ncbAdj / 100) * 100) / 100;
    piAmount = Math.round(piAmount * (1 - ncbAdj / 100) * 100) / 100;
    adjustmentsApplied.push('ncb_adj: -' + ncbAdj + '%');
  }

  // NilDep absent (blank) → nilDepAdj deduction fires
  if (nilDepAdj !== null && !params.nilDep) {
    poAmount = Math.round(poAmount * (1 - nilDepAdj / 100) * 100) / 100;
    piAmount = Math.round(piAmount * (1 - nilDepAdj / 100) * 100) / 100;
    adjustmentsApplied.push('nil_dep_adj: -' + nilDepAdj + '%');
  }

  // CPA absent (blank) → cpaAdj deduction fires
  if (cpaAdj !== null && !params.cpa) {
    poAmount = Math.round(poAmount * (1 - cpaAdj / 100) * 100) / 100;
    piAmount = Math.round(piAmount * (1 - cpaAdj / 100) * 100) / 100;
    adjustmentsApplied.push('cpa_adj: -' + cpaAdj + '%');
  }

  result.finalPoAmount        = poAmount;
  result.finalPiAmount        = piAmount;
  result.adjustmentsApplied   = adjustmentsApplied;

  return result;
}

/** Wraps any object as a JSON ContentService response. */
function apiResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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
      .filter(function(r) { return String(r.active || '').trim().toUpperCase() === 'Y'; })
      .map(function(r) { return { id: r.insurer_id, name: r.insurer_name }; });

    var products = getSheetDataAsObjects(CONFIG.SHEET_PRODUCT_MASTER, 'Motor');
    var activeProducts = products.filter(function(r) {
      return String(r.active || '').trim().toUpperCase() === 'Y';
    });

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
      'TW':               { cc: true,  fuel: ['Petrol', 'CNG', 'Electric'],                  gvw: false, seating: false, yom: false, nilDep: false, ncb: false },
      'Pvt Car':          { cc: true,  fuel: ['Petrol', 'Diesel', 'CNG', 'Electric'],         gvw: false, seating: false, yom: true,  nilDep: true,  ncb: true  },
      'GCV':              { cc: false, fuel: ['Diesel', 'CNG', 'Electric'],                   gvw: true,  seating: false, yom: true,  nilDep: false, ncb: false },
      'PCV':              { cc: false, fuel: ['Diesel', 'CNG', 'Electric', 'Petrol'],         gvw: false, seating: true,  yom: true,  nilDep: false, ncb: false },
      'Tractor':          { cc: false, fuel: false,                                           gvw: false, seating: false, yom: true,  nilDep: false, ncb: false },
      'Construction Eqpt':{ cc: false, fuel: false,                                           gvw: false, seating: false, yom: false, nilDep: false, ncb: false }
    };

    return {
      insurers:                 insurerList,
      productTypes:             productTypes,
      subTypesByProductType:    subTypesByProductType,
      subSubTypesByProductType: subSubTypesByProductType,
      fieldConfig:              fieldConfig,
      fuelTypes:                ['Petrol', 'Diesel', 'CNG', 'Bio Fuel', 'Electric']
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
    var id = (insurerId || '').toString().trim();
    if (!id) throw new Error('insurerId is blank');

    // Prefer sheets that already have rate rows (import often creates "[CODE] Grid")
    var candidates = [];

    // 1. Exact "[CODE] Grid"
    var byCode = findFileInFolder(CONFIG.FOLDER_GRIDS, id + ' Grid');
    if (byCode) candidates.push(byCode);

    // 2. Insurer Master name → "[name] Grid"
    try {
      var insurers = getSheetDataAsObjects(CONFIG.SHEET_INSURER_MASTER, 'Insurers');
      for (var i = 0; i < insurers.length; i++) {
        if (String(insurers[i].insurer_id || '').trim() === id) {
          var byName = findFileInFolder(CONFIG.FOLDER_GRIDS, insurers[i].insurer_name + ' Grid');
          if (byName && candidates.indexOf(byName) === -1) candidates.push(byName);
          break;
        }
      }
    } catch (masterErr) {
      Logger.log('findInsurerGridSheet: master lookup skipped — ' + masterErr.message);
    }

    // 3. Scan Grids folder for any file name containing the code
    var folder = DriveApp.getFolderById(CONFIG.FOLDER_GRIDS);
    var files = folder.getFiles();
    var codeLower = id.toLowerCase();
    while (files.hasNext()) {
      var f = files.next();
      var n = f.getName().toLowerCase();
      if (n.indexOf(codeLower) !== -1 && n.indexOf('grid') !== -1) {
        if (candidates.indexOf(f.getId()) === -1) candidates.push(f.getId());
      }
    }

    if (!candidates.length) return null;

    // Pick first candidate that has any product tab with data rows
    for (var c = 0; c < candidates.length; c++) {
      try {
        var ss = SpreadsheetApp.openById(candidates[c]);
        var tabs = ss.getSheets();
        for (var t = 0; t < tabs.length; t++) {
          var tn = tabs[t].getName();
          if (/^[A-Za-z]+_\d{2}-\d{2}$/.test(tn) && tabs[t].getLastRow() > 1) {
            return candidates[c];
          }
        }
      } catch (openErr) {
        Logger.log('findInsurerGridSheet: skip ' + candidates[c] + ' — ' + openErr.message);
      }
    }
    return candidates[0];
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
    var rtoListStr = rtoList.toString().replace(/\([^)]*\)/g, '').trim();
    if (rtoListStr === '' || rtoListStr.toLowerCase() === 'all') return false;
    var codes = rtoListStr.split(/[,|;]/).map(function(c) {
      return normaliseRTO(c.trim());
    }).filter(function(c) { return !!c; });
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
