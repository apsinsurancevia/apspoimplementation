/**
 * CaliberPO — Field Mapping Wizard
 *
 * One-time per-broker setup that maps source file column headers
 * to CaliberPO standard field names.
 *
 * Workflow:
 *   1. Drop sales data file into CaliberPO/Input/ folder
 *   2. Run runMappingWizard()  → reads headers, alias + AI match → Mapping_Review tab
 *   3. Human reviews yellow/red rows in Mapping_Review tab
 *   4. Run confirmMapping()    → writes Field_Mapping tab, batch is ready
 *
 * After first run, Field_Mapping is stable. Only re-run if broker changes export format.
 */

// ── REQUIRED FIELDS ───────────────────────────────────────────────────────────
// Every standard field the commission engine needs, with description and default transform.

var REQUIRED_FIELDS = [
  { standard: 'partner_id',        description: 'POSP/Agent unique ID — join key to Partner Master',               transform: 'none'           },
  { standard: 'partner_name',      description: 'POSP/Agent name — carried through to output',                     transform: 'none'           },
  { standard: 'sys_ref_no',        description: 'System reference/UID — carried through to output',                transform: 'none'           },
  { standard: 'policy_no',         description: 'Policy number — used for duplicate check',                        transform: 'none'           },
  { standard: 'insurance_company', description: 'Insurer full name — mapped to code via Insurer_Code_Map tab',     transform: 'insurer_code_map' },
  { standard: 'product',           description: 'Product full name — informational, carried through',              transform: 'none'           },
  { standard: 'product_type',      description: 'Product type (TW/Pvt Car/GCV/PCV) — via Product_Map tab',        transform: 'product_map'    },
  { standard: 'product_sub_type',  description: 'Product sub-type (Comprehensive/TP-Only) — via Product_Map tab', transform: 'product_map'    },
  { standard: 'policy_issue_date', description: 'Policy issue date — determines which grid rate period applies',   transform: 'date_format'    },
  { standard: 'business_type',     description: 'New or Renewal — carried through to output',                     transform: 'none'           },
  { standard: 'rto',               description: 'RTO/registration code — normalised to XX-00 format',             transform: 'rto_normalise'  },
  { standard: 'vehicle_model',     description: 'Vehicle model name — derives TW sub-sub-type (Sports/Scooter)',  transform: 'none'           },
  { standard: 'make_year',         description: 'Year of manufacture — derives New/Old vehicle age flag',         transform: 'none'           },
  { standard: 'vehicle_fuel_type', description: 'Fuel type (Petrol/Diesel/Electric) — optional grid filter',      transform: 'none'           },
  { standard: 'vehicle_cc',        description: 'Engine CC — range filter for TW and Pvt Car grids',              transform: 'none'           },
  { standard: 'vehicle_gvw',       description: 'Gross Vehicle Weight — range filter for GCV/Tractor grids',      transform: 'gvw_normalise'  },
  { standard: 'vehicle_seating',   description: 'Seating capacity — range filter for PCV grids',                  transform: 'none'           },
  { standard: 'gross_premium',     description: 'Total/net premium — fallback base when OD/TP not matched',       transform: 'none'           },
  { standard: 'net_premium',       description: 'Net premium (OD+TP total) — base for NET-rated commission',      transform: 'none'           },
  { standard: 'od_premium',        description: 'OD premium including all OD addons — base for OD-rated commission', transform: 'none'        },
  { standard: 'tp_premium',        description: 'TP premium including all TP addons — base for TP-rated commission', transform: 'none'        },
  { standard: 'pa_cover_owner',    description: 'PA cover for owner-driver — Y/N sets PA Present output flag',    transform: 'none'           },
  { standard: 'has_ncb',           description: 'NCB value — 20/25/35/45/50 or blank. Blank or 0 = no NCB, adjustment fires', transform: 'ncb_normalise' },
  { standard: 'has_nil_dep',       description: 'Nil Depreciation add-on — blank = absent (adj fires), any value = present', transform: 'none' },
  { standard: 'has_cpa',           description: 'CPA cover — blank = absent (adj fires), any value = present',   transform: 'none'           }
];

// ── ALIAS DICTIONARY ──────────────────────────────────────────────────────────
// Known alternate names for each standard field across common CRM/system exports.
// All comparisons are case-insensitive. First match wins.

var FIELD_ALIASES = {
  'partner_id':        ['posp id', 'agent id', 'posp_id', 'agent code', 'partner id', 'posp code', 'emp posp id', 'agent_id'],
  'partner_name':      ['posp', 'agent name', 'posp name', 'partner name', 'agent', 'advisor name'],
  'sys_ref_no':        ['system policy uid', 'system policy id', 'sys ref no', 'uid', 'reference number', 'system uid', 'sr. no.', 'sr no'],
  'policy_no':         ['policy number', 'policy no', 'policy_no', 'pol no', 'policy num', 'policy_number'],
  'insurance_company': ['insurer', 'insurance company', 'insurance co', 'insurer name', 'company', 'carrier'],
  'product':           ['product', 'product name', 'insurance product'],
  'product_type':      ['product type', 'product_type', 'line of business', 'lob', 'product category'],
  'product_sub_type':  ['product sub type', 'product sub-type', 'sub type', 'cover type', 'policy sub type'],
  'policy_issue_date': ['issue date', 'policy issue date', 'policy date', 'date of issue', 'issuance date', 'created date'],
  'business_type':     ['business type', 'new renewal', 'renewal type', 'policy business type'],
  'rto':               ['vehicle rta', 'rto', 'rto code', 'registration district', 'vehicle rto', 'reg district'],
  'vehicle_model':     ['model', 'vehicle model', 'model name', 'vehicle name'],
  'make_year':         ['make year', 'year of manufacture', 'yom', 'manufacturing year', 'mfg year'],
  'vehicle_fuel_type': ['vehicle fuel type', 'fuel type', 'fuel', 'propulsion type', 'energy type'],
  'vehicle_cc':        ['vehicle cc', 'cc', 'engine cc', 'cubic capacity', 'vehicle cubic capacity', 'displacement'],
  'vehicle_gvw':       ['vehicle gvw', 'gvw', 'gross vehicle weight', 'vehicle gvw as per rc', 'laden weight'],
  'vehicle_seating':   ['vehicle seating capacity', 'seating capacity', 'seating', 'seats', 'no of seats', 'passenger capacity'],
  'gross_premium':     ['net premium', 'total premium', 'gross premium', 'premium amount', 'total net premium'],
  'net_premium':       ['net premium', 'total net premium', 'net amount', 'total premium'],
  'od_premium':        ['total od premium', 'od premium', 'own damage premium', 'od amount', 'basic od premium', 'od total'],
  'tp_premium':        ['total tp premium', 'tp premium', 'third party premium', 'tp amount', 'basic tp premium', 'tp total'],
  'pa_cover_owner':    ['pa cover owner', 'pa owner', 'pa cover', 'personal accident owner', 'pa', 'owner pa'],
  'has_ncb':           ['ncb', 'transfer vehicle ncb', 'no claim bonus', 'ncb percent', 'ncb %', 'ncb value'],
  'has_nil_dep':       ['nil dep', 'addon nil depreciation cover', 'nil depreciation', 'nil dep cover', 'depreciation waiver clause', 'zero dep'],
  'has_cpa':           ['cpa', 'cpa optout', 'compulsory pa', 'cpa cover', 'compulsory personal accident', 'cpa policy number']
};

// ── STATUS COLOURS ─────────────────────────────────────────────────────────────

var MAPPING_COLOURS = {
  'AUTO_MATCHED':        '#d9ead3',  // green
  'AI_SUGGESTED_HIGH':   '#e2efda',  // light green
  'AI_SUGGESTED_MEDIUM': '#fff2cc',  // yellow
  'AI_SUGGESTED_LOW':    '#fce5cd',  // orange
  'NEEDS_REVIEW':        '#f4cccc'   // red
};

// ── MAIN ENTRY POINTS ──────────────────────────────────────────────────────────

/**
 * Step 1 of 2: Run this after dropping a sales file into CaliberPO/Input/.
 * Reads source headers, runs alias + AI matching, writes Mapping_Review tab.
 * Human reviews yellow/red rows, then runs confirmMapping().
 */
function runMappingWizard() {
  return wrapWithErrorHandling('runMappingWizard', function() {

    Logger.log('=== MappingWizard: Starting ===');

    // ── 1. Read source file headers ──────────────────────────────────────────
    var sourceHeaders = readSourceHeaders_();
    Logger.log('Source headers found: ' + sourceHeaders.length);

    // ── 2. Layer 1 — Alias matching ──────────────────────────────────────────
    var results       = [];
    var unmatched     = [];
    var sourceLower   = sourceHeaders.map(function(h) { return h.toLowerCase(); });

    REQUIRED_FIELDS.forEach(function(field) {
      var aliases = FIELD_ALIASES[field.standard] || [];
      var matchedHeader = null;

      for (var i = 0; i < aliases.length; i++) {
        var idx = sourceLower.indexOf(aliases[i].toLowerCase());
        if (idx !== -1) { matchedHeader = sourceHeaders[idx]; break; }
      }

      if (matchedHeader) {
        results.push({
          standard:    field.standard,
          description: field.description,
          suggested:   matchedHeader,
          confidence:  'HIGH',
          status:      'AUTO_MATCHED',
          transform:   field.transform,
          notes:       'Alias match'
        });
      } else {
        results.push(null);  // placeholder — filled by AI pass below
        unmatched.push(field);
      }
    });

    // ── 3. Layer 2 — AI matching for unmatched fields ────────────────────────
    var aiMap = {};
    if (unmatched.length > 0) {
      Logger.log('Calling Claude AI for ' + unmatched.length + ' unmatched fields...');
      var aiResults = getAIMappingSuggestions_(sourceHeaders, unmatched);
      aiResults.forEach(function(s) { aiMap[s.standard_field] = s; });
    }

    // Merge AI results into results array
    for (var i = 0; i < REQUIRED_FIELDS.length; i++) {
      if (results[i] !== null) continue;
      var field    = REQUIRED_FIELDS[i];
      var aiResult = aiMap[field.standard];

      if (aiResult && aiResult.suggested_column &&
          aiResult.suggested_column.toUpperCase() !== 'NONE') {
        results[i] = {
          standard:    field.standard,
          description: field.description,
          suggested:   aiResult.suggested_column,
          confidence:  aiResult.confidence,
          status:      'AI_SUGGESTED_' + aiResult.confidence,
          transform:   field.transform,
          notes:       aiResult.reason || ''
        };
      } else {
        results[i] = {
          standard:    field.standard,
          description: field.description,
          suggested:   '',
          confidence:  'NONE',
          status:      'NEEDS_REVIEW',
          transform:   field.transform,
          notes:       'No match found — select from dropdown'
        };
      }
    }

    // ── 4. Write Mapping_Review tab ──────────────────────────────────────────
    writeMappingReview_(results, sourceHeaders);

    var autoCount   = results.filter(function(r) { return r.status === 'AUTO_MATCHED'; }).length;
    var aiCount     = results.filter(function(r) { return r.status.indexOf('AI_SUGGESTED') === 0; }).length;
    var reviewCount = results.filter(function(r) { return r.status === 'NEEDS_REVIEW'; }).length;

    Logger.log('=== MappingWizard: Complete ===');
    Logger.log('Auto-matched: ' + autoCount + '  AI-suggested: ' + aiCount + '  Needs review: ' + reviewCount);
    Logger.log('Open the Mapping_Review tab in CaliberPO Config sheet. Fix any red/yellow rows, then run confirmMapping().');

    return { total: results.length, autoMatched: autoCount, aiSuggested: aiCount, needsReview: reviewCount };

  }, 'MANUAL');
}

/**
 * Step 2 of 2: Run after reviewing Mapping_Review tab.
 * Reads confirmed selections and writes them to Field_Mapping tab.
 * After this, runCommissionBatch() is ready to run.
 */
function confirmMapping() {
  return wrapWithErrorHandling('confirmMapping', function() {

    Logger.log('=== confirmMapping: Starting ===');

    var ss = SpreadsheetApp.openById(CONFIG.SHEET_BROKER_CONFIG);
    var reviewSheet = ss.getSheetByName('Mapping_Review');
    if (!reviewSheet) {
      throw new Error('Mapping_Review tab not found. Run runMappingWizard() first.');
    }

    var data = reviewSheet.getDataRange().getValues();
    // Row 0 = column headers, Row 1 = instruction banner, Rows 2+ = data

    var mappingRows  = [];
    var needsReview  = [];

    for (var i = 2; i < data.length; i++) {
      var row = data[i];
      if (!row || !row[0] || row[0].toString().trim() === '') continue;

      var standardField  = row[0].toString().trim();
      var status         = row[4].toString().trim();
      var yourSelection  = row[5].toString().trim();
      var transform      = row[6].toString().trim();
      var description    = row[1].toString().trim();

      if (!yourSelection) {
        needsReview.push(standardField);
        continue;
      }

      mappingRows.push([yourSelection, standardField, transform, description]);
    }

    if (needsReview.length > 0) {
      throw new Error(
        'These fields have no selection in "your_selection" column:\n' +
        needsReview.join(', ') +
        '\n\nFill in the Mapping_Review tab before running confirmMapping().'
      );
    }

    // Write to Field_Mapping tab
    var fieldMappingSheet = ss.getSheetByName('Field_Mapping');
    if (!fieldMappingSheet) {
      throw new Error('Field_Mapping tab not found in CaliberPO Config sheet.');
    }

    var lastRow = fieldMappingSheet.getLastRow();
    if (lastRow > 1) {
      fieldMappingSheet.getRange(2, 1, lastRow - 1, 4).clearContent();
    }

    if (mappingRows.length > 0) {
      fieldMappingSheet.getRange(2, 1, mappingRows.length, 4).setValues(mappingRows);
    }

    SpreadsheetApp.flush();

    Logger.log('confirmMapping: ' + mappingRows.length + ' fields written to Field_Mapping tab.');
    Logger.log('Field_Mapping is confirmed. Run runCommissionBatch() to process sales data.');

    return { confirmed: mappingRows.length };

  }, 'MANUAL');
}

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

/**
 * Reads the header row from the most recent file in FOLDER_INPUT.
 * Handles both raw broker exports (row 1 = headers) and
 * CaliberPO-formatted files (row 1 = blue banner, row 2 = headers).
 */
function readSourceHeaders_() {
  var inputFiles = listFilesInFolder(CONFIG.FOLDER_INPUT);
  if (!inputFiles || inputFiles.length === 0) {
    throw new Error('No files found in CaliberPO/Input/. Drop a sales data file there first.');
  }
  inputFiles.sort(function(a, b) { return b.createdDate - a.createdDate; });
  var inputFile = inputFiles[0];
  Logger.log('Reading headers from: ' + inputFile.name);

  var inputSS    = SpreadsheetApp.openById(inputFile.id);
  var inputSheet = inputSS.getSheets()[0];
  var lastCol    = inputSheet.getLastColumn();
  if (lastCol === 0) throw new Error('File appears to be empty: ' + inputFile.name);

  // Detect banner row: if row 1 has fewer than 10 non-empty cells, use row 2
  var row1 = inputSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var nonEmpty1 = row1.filter(function(v) { return v && v.toString().trim() !== ''; }).length;

  var headerRow;
  if (nonEmpty1 < 10) {
    Logger.log('Row 1 looks like a banner (' + nonEmpty1 + ' non-empty cells) — using row 2 for headers');
    headerRow = inputSheet.getRange(2, 1, 1, lastCol).getValues()[0];
  } else {
    headerRow = row1;
  }

  return headerRow
    .map(function(h) { return h ? h.toString().trim() : ''; })
    .filter(function(h) { return h !== ''; });
}

/**
 * Creates / overwrites the Mapping_Review tab with colour-coded results.
 * Adds dropdowns for non-auto-matched rows.
 */
function writeMappingReview_(results, sourceHeaders) {
  var ss       = SpreadsheetApp.openById(CONFIG.SHEET_BROKER_CONFIG);
  var existing = ss.getSheetByName('Mapping_Review');
  if (existing) ss.deleteSheet(existing);
  var sheet = ss.insertSheet('Mapping_Review');

  var colHeaders = ['standard_field', 'description', 'suggested_column',
                    'confidence', 'status', 'your_selection', 'transform', 'notes'];

  // Row 1 — column headers
  sheet.getRange(1, 1, 1, colHeaders.length).setValues([colHeaders]);
  sheet.getRange(1, 1, 1, colHeaders.length)
    .setBackground('#1F3864').setFontColor('#FFFFFF').setFontWeight('bold');

  // Row 2 — instruction banner
  sheet.getRange(2, 1, 1, colHeaders.length).merge();
  sheet.getRange(2, 1).setValue(
    'GREEN = Auto-matched (no action needed).  ' +
    'YELLOW/ORANGE = AI suggested — verify "your_selection" column.  ' +
    'RED = Needs review — pick from the dropdown in "your_selection".  ' +
    'Run confirmMapping() when all rows have a value in "your_selection".'
  )
  .setBackground('#f3f3f3')
  .setFontStyle('italic')
  .setWrap(true);
  sheet.setRowHeight(2, 48);

  // Rows 3+ — data
  results.forEach(function(r, idx) {
    var rowNum  = idx + 3;
    var rowData = [
      r.standard,
      r.description,
      r.suggested || '',
      r.confidence,
      r.status,
      r.suggested || '',   // pre-fill your_selection with best guess
      r.transform,
      r.notes || ''
    ];
    sheet.getRange(rowNum, 1, 1, colHeaders.length).setValues([rowData]);
    sheet.getRange(rowNum, 1, 1, colHeaders.length)
      .setBackground(MAPPING_COLOURS[r.status] || '#ffffff');

    // Dropdown on your_selection (col 6) for non-auto rows
    if (r.status !== 'AUTO_MATCHED') {
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(sourceHeaders, true)
        .setAllowInvalid(true)
        .setHelpText('Select the source column that corresponds to this standard field')
        .build();
      sheet.getRange(rowNum, 6).setDataValidation(rule);
    } else {
      sheet.getRange(rowNum, 6).setFontColor('#888888');
    }
  });

  sheet.setFrozenRows(2);
  sheet.autoResizeColumns(1, colHeaders.length);
  sheet.setColumnWidth(2, 320);  // description column needs more space
  sheet.setColumnWidth(6, 200);  // your_selection dropdown

  Logger.log('Mapping_Review tab written to CaliberPO Config sheet.');
}

/**
 * Calls Claude API to suggest source columns for unmatched standard fields.
 * Returns array of { standard_field, suggested_column, confidence, reason }.
 * Non-fatal — returns [] on any error so wizard continues without AI.
 */
function getAIMappingSuggestions_(sourceHeaders, unmatchedFields) {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
    if (!apiKey) {
      Logger.log('CLAUDE_API_KEY not set — skipping AI matching. Fields will be NEEDS_REVIEW.');
      return [];
    }

    var prompt =
      'You are mapping motor insurance sales data column headers to standard internal field names.\n\n' +
      'Available source column headers from the sales file:\n' +
      sourceHeaders.map(function(h, i) { return (i + 1) + '. ' + h; }).join('\n') +
      '\n\nFor each required field below, identify the BEST matching source column. ' +
      'If no reasonable match exists, use "NONE" as suggested_column.\n\n' +
      'Required fields:\n' +
      unmatchedFields.map(function(f) {
        return '- ' + f.standard + ': ' + f.description;
      }).join('\n') +
      '\n\nRespond with ONLY a valid JSON array — no explanation, no markdown:\n' +
      '[{"standard_field":"...","suggested_column":"...","confidence":"HIGH|MEDIUM|LOW","reason":"one line"}]';

    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method:           'POST',
      headers:          {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json'
      },
      payload:          JSON.stringify({
        model:      CONFIG.CLAUDE_MODEL,
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    });

    var data = JSON.parse(response.getContentText());
    if (!data.content || !data.content[0]) {
      Logger.log('AI response empty — skipping AI matching');
      return [];
    }

    var text      = data.content[0].text;
    var jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      Logger.log('AI response did not contain JSON — skipping AI matching');
      return [];
    }

    var suggestions = JSON.parse(jsonMatch[0]);
    Logger.log('AI returned ' + suggestions.length + ' suggestions');
    return suggestions;

  } catch (e) {
    Logger.log('getAIMappingSuggestions_ failed (non-fatal): ' + e.message);
    return [];
  }
}
