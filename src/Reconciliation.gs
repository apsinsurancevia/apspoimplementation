/**
 * CaliberPO — Reconciliation Engine
 *
 * Step V of the CaliberPO pipeline.
 *
 * Flow:
 *   1. Load broker commission working for period (MATCHED rows, filtered by insurer)
 *   2. Load insurer statement summary (extracted by Step IV)
 *   3. Open/create reconciliation tab for this insurer
 *   4. Append new broker rows with status "Outstanding"
 *   5. Two-pass match against statement data:
 *        Pass 1 — Exact policy_no match
 *        Pass 2 — Fuzzy: policy_no prefix (16 chars) + amount within 5%
 *   6. Update match status, variance, match type
 *   7. Generate 5-sheet reconciliation report Excel
 *   8. Email report to EMAIL_RECON
 *
 * Reconciliation sheet structure (CONFIG.SHEET_RECONCILIATION):
 *   Tab "Index"       — summary of all insurer tabs
 *   Tab "[insurerId]" — one rolling tab per insurer (e.g. "OR", "NIC")
 *   Tab "[insurerId]_Archive" — rows older than 12 months (manual trigger)
 *
 * Resolution status values:
 *   Open / In Discussion / Resolved / Written Off
 */

// ── RECONCILIATION SHEET COLUMNS ──────────────────────────────────────────────

var RECON_HEADERS = [
  'policy_no',         // A
  'period',            // B
  'insurer_id',        // C
  'our_amount',        // D — broker calculated PO amount
  'insurer_amount',    // E — from insurer statement
  'variance',          // F — insurer_amount - our_amount
  'match_type',        // G — EXACT / FUZZY_MATCH / Unknown / Outstanding
  'match_status',      // H — Outstanding / Matched / Variance / Unknown
  'resolution_status', // I — Open / In Discussion / Resolved / Written Off
  'resolution_date',   // J
  'resolution_notes',  // K
  'updated_at'         // L
];

var RECON_COL = {
  policy_no:         0,
  period:            1,
  insurer_id:        2,
  our_amount:        3,
  insurer_amount:    4,
  variance:          5,
  match_type:        6,
  match_status:      7,
  resolution_status: 8,
  resolution_date:   9,
  resolution_notes:  10,
  updated_at:        11
};

// ── MAIN ENTRY POINT ──────────────────────────────────────────────────────────

/**
 * Main reconciliation function.
 * Run from Apps Script editor after statement processing (Step IV).
 *
 * @param {string} insurerId - CaliberPO insurer ID e.g. "OR", "NIC"
 * @param {string} [period]  - Period "YYYY-MM" — defaults to CONFIG.CURRENT_PERIOD
 */
function runReconciliation(insurerId, period) {
  return wrapWithErrorHandling('runReconciliation', function() {

    var reconPeriod = period || CONFIG.CURRENT_PERIOD;
    Logger.log('=== runReconciliation: ' + insurerId + ' / ' + reconPeriod + ' ===');

    if (!insurerId)    throw new Error('insurerId is required');
    if (!reconPeriod)  throw new Error('period is required (or set CONFIG.CURRENT_PERIOD)');

    // Step 1: Load broker commission working for this insurer + period
    Logger.log('Loading broker commission working...');
    var brokerRows = loadBrokerRows(insurerId, reconPeriod);
    Logger.log('Broker rows for ' + insurerId + ': ' + brokerRows.length);

    // Step 2: Load insurer statement summary
    Logger.log('Loading insurer statement summary...');
    var statementRows = loadStatementRows(insurerId, reconPeriod);
    Logger.log('Statement rows: ' + statementRows.length);

    if (brokerRows.length === 0 && statementRows.length === 0) {
      Logger.log('No data for either side — nothing to reconcile');
      return;
    }

    // Step 3: Open/create insurer tab in Reconciliation Sheet
    Logger.log('Opening reconciliation sheet...');
    var reconSS    = SpreadsheetApp.openById(CONFIG.SHEET_RECONCILIATION);
    var reconSheet = getOrCreateReconTab(reconSS, insurerId);

    // Step 4: Load existing recon data
    var existingData = reconSheet.getDataRange().getValues();
    // existingData[0] = headers, [1+] = data rows

    // Step 5: Determine which broker rows are new (not yet in recon sheet)
    Logger.log('Appending new broker rows...');
    var newBrokerRows = findNewBrokerRows(brokerRows, existingData, reconPeriod);
    Logger.log('New broker rows to append: ' + newBrokerRows.length);

    // Append new broker rows with "Outstanding" status
    if (newBrokerRows.length > 0) {
      var rowsToAppend = newBrokerRows.map(function(br) {
        return buildReconRow(
          br.policy_no, reconPeriod, insurerId,
          br.our_amount, '', '',
          'Outstanding', 'Outstanding', 'Open',
          '', '', new Date().toISOString()
        );
      });
      appendRows(CONFIG.SHEET_RECONCILIATION, insurerId, rowsToAppend);

      // Reload data after append
      existingData = reconSheet.getDataRange().getValues();
    }

    // Step 6: Two-pass matching
    Logger.log('Running two-pass matching...');
    var matchResults = runTwoPassMatch(
      statementRows, existingData, reconSheet, reconPeriod, insurerId);

    Logger.log('Match results: ' + JSON.stringify({
      exactMatched:  matchResults.exactMatched,
      fuzzyMatched:  matchResults.fuzzyMatched,
      variances:     matchResults.variances,
      unknowns:      matchResults.unknowns
    }));

    SpreadsheetApp.flush();

    // Step 7: Update Index tab
    updateIndexTab(reconSS, insurerId, reconPeriod, matchResults);

    // Step 8: Generate reconciliation report
    Logger.log('Generating reconciliation report...');
    var reportFileId = generateReconReport(insurerId, reconPeriod);

    // Step 9: Email report
    Logger.log('Emailing reconciliation report...');
    emailReconReport(insurerId, reconPeriod, reportFileId, matchResults);

    Logger.log('=== runReconciliation complete: ' + insurerId + ' ===');
    return matchResults;
  }, 'MANUAL');
}

// ── DATA LOADERS ──────────────────────────────────────────────────────────────

/**
 * Loads MATCHED rows for a specific insurer from the commission output file.
 * Returns array of { policy_no, our_amount } objects.
 *
 * Col DM (index 116) = Insurer Code
 * Col C  (index 2)   = Policy Number
 * Col DV (index 125) = PO Amount
 * Col DX (index 127) = PO Amount (2)
 * Col DY (index 128) = Match Status
 *
 * @param {string} insurerId - Insurer ID to filter by
 * @param {string} period    - Period "YYYY-MM"
 * @returns {Object[]} Array of { policy_no, our_amount }
 */
function loadBrokerRows(insurerId, period) {
  try {
    var prefix = CONFIG.BROKER_SHORT_CODE + '_Sales_Data_' + period;
    var fileId = findMostRecentFileByPrefix(CONFIG.FOLDER_OUTPUT, prefix);
    if (!fileId) {
      Logger.log('No commission output file found for period: ' + period);
      return [];
    }

    var ss    = SpreadsheetApp.openById(fileId);
    var sheet = ss.getSheetByName('Policy_Data');
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    // Row 0 = section headers, Row 1 = col headers, Row 2+ = data

    var rows = [];
    for (var i = 2; i < data.length; i++) {
      var row = data[i];
      if (!row || row.every(function(c) { return c === '' || c === null; })) continue;

      var rowInsurer = row[116] ? row[116].toString().trim() : '';
      var rowStatus  = row[128] ? row[128].toString().trim() : '';

      if (rowInsurer !== insurerId || rowStatus !== 'MATCHED') continue;

      var poAmt  = parseFloat(row[125]) || 0;
      var poAmt2 = parseFloat(row[127]) || 0;
      var ourAmount = Math.round((poAmt + poAmt2) * 100) / 100;

      var policyNo = row[2] ? row[2].toString().trim() : '';
      if (!policyNo) continue;

      rows.push({ policy_no: policyNo, our_amount: ourAmount });
    }

    return rows;
  } catch (e) {
    Logger.log('loadBrokerRows failed: ' + e.message);
    return [];
  }
}

/**
 * Loads insurer statement data from the summary Excel created in Step IV.
 * Returns array of { policy_no, brokerage_amount } objects.
 *
 * @param {string} insurerId - Insurer ID
 * @param {string} period    - Period "YYYY-MM"
 * @returns {Object[]} Array of { policy_no, brokerage_amount }
 */
function loadStatementRows(insurerId, period) {
  try {
    var folderId = createPeriodSubfolder(CONFIG.FOLDER_INVOICES_INSURER, period);
    var fileName = insurerId + '_statement_summary_' + period;
    var fileId   = findFileInFolder(folderId, fileName);

    if (!fileId) {
      Logger.log('No statement summary found: ' + fileName);
      return [];
    }

    var rows = getSheetDataAsObjects(fileId, 'Summary');

    return rows
      .filter(function(r) { return r.policy_no && r.policy_no !== 'TOTAL'; })
      .map(function(r) {
        return {
          policy_no:        (r.policy_no || '').toString().trim(),
          brokerage_amount: parseFloat(r.brokerage_amount) || 0
        };
      });
  } catch (e) {
    Logger.log('loadStatementRows failed: ' + e.message);
    return [];
  }
}

// ── RECONCILIATION TAB MANAGEMENT ────────────────────────────────────────────

/**
 * Gets or creates an insurer tab in the Reconciliation Sheet.
 *
 * @param {Spreadsheet} reconSS   - Reconciliation spreadsheet
 * @param {string}      insurerId - Tab name = insurerId
 * @returns {Sheet} The insurer reconciliation tab
 */
function getOrCreateReconTab(reconSS, insurerId) {
  var existing = reconSS.getSheetByName(insurerId);
  if (existing) return existing;

  Logger.log('Creating new recon tab: ' + insurerId);
  var sheet = reconSS.insertSheet(insurerId);

  sheet.getRange(1, 1, 1, RECON_HEADERS.length).setValues([RECON_HEADERS]);
  styleHeaderRow(sheet, 1, RECON_HEADERS.length, '#1a1a2e', '#FFFFFF');
  sheet.setFrozenRows(1);

  setColumnWidths(sheet, [150, 80, 80, 100, 110, 100, 120, 120, 130, 110, 200, 180]);

  SpreadsheetApp.flush();
  return sheet;
}

/**
 * Builds a single reconciliation row array.
 */
function buildReconRow(policyNo, period, insurerId, ourAmount,
                        insurerAmount, variance, matchType,
                        matchStatus, resolutionStatus,
                        resolutionDate, resolutionNotes, updatedAt) {
  return [
    policyNo, period, insurerId,
    ourAmount        !== undefined ? ourAmount        : '',
    insurerAmount    !== undefined ? insurerAmount    : '',
    variance         !== undefined ? variance         : '',
    matchType        || '',
    matchStatus      || '',
    resolutionStatus || 'Open',
    resolutionDate   || '',
    resolutionNotes  || '',
    updatedAt        || new Date().toISOString()
  ];
}

/**
 * Finds broker rows not yet present in the recon sheet for this period.
 *
 * @param {Object[]} brokerRows   - Broker data rows
 * @param {Array[]}  existingData - Current recon sheet data (2D array)
 * @param {string}   period       - Period to check
 * @returns {Object[]} New broker rows to append
 */
function findNewBrokerRows(brokerRows, existingData, period) {
  var existing = {};
  for (var i = 1; i < existingData.length; i++) {
    var row = existingData[i];
    if (!row[RECON_COL.policy_no]) continue;
    var key = row[RECON_COL.policy_no].toString() + '|' +
              (row[RECON_COL.period] || '').toString();
    existing[key] = true;
  }

  return brokerRows.filter(function(br) {
    return !existing[br.policy_no + '|' + period];
  });
}

// ── TWO-PASS MATCHING ─────────────────────────────────────────────────────────

/**
 * Runs two-pass matching of statement rows against recon sheet data.
 * Updates the recon sheet in-place for each match found.
 *
 * Pass 1: Exact policy_no match
 * Pass 2: policy_no prefix (16 chars) + amount within 5%
 *
 * Unmatched statement rows appended as "Unknown".
 *
 * @param {Object[]} statementRows - Insurer statement rows
 * @param {Array[]}  existingData  - Current recon sheet data
 * @param {Sheet}    reconSheet    - Recon sheet to update
 * @param {string}   period        - Period being reconciled
 * @param {string}   insurerId     - Insurer ID
 * @returns {Object} Match result counts
 */
function runTwoPassMatch(statementRows, existingData,
                          reconSheet, period, insurerId) {
  var results = {
    exactMatched:   0,
    fuzzyMatched:   0,
    variances:      0,
    unknowns:       0,
    totalStatement: statementRows.length
  };

  var threshold = CONFIG.VARIANCE_THRESHOLD || 10;
  var now       = new Date().toISOString();

  statementRows.forEach(function(stRow) {
    var statPolicyNo = stRow.policy_no.toString().trim();
    var statAmount   = parseFloat(stRow.brokerage_amount) || 0;

    // ── Pass 1: Exact policy_no match ──────────────────────────────────────
    var matchRowIdx = -1;
    var matchType   = '';

    for (var i = 1; i < existingData.length; i++) {
      var reconRow = existingData[i];
      if (!reconRow[RECON_COL.policy_no]) continue;
      var reconPeriod   = (reconRow[RECON_COL.period] || '').toString();
      var reconPolicyNo = reconRow[RECON_COL.policy_no].toString().trim();

      if (reconPolicyNo === statPolicyNo && reconPeriod === period) {
        matchRowIdx = i;
        matchType   = 'EXACT';
        break;
      }
    }

    // ── Pass 2: Fuzzy match ────────────────────────────────────────────────
    if (matchRowIdx === -1) {
      var statPrefix = statPolicyNo.substring(0, 16);

      for (var j = 1; j < existingData.length; j++) {
        var reconRow2    = existingData[j];
        if (!reconRow2[RECON_COL.policy_no]) continue;
        var reconPeriod2   = (reconRow2[RECON_COL.period] || '').toString();
        var reconPolicyNo2 = reconRow2[RECON_COL.policy_no].toString().trim();
        var ourAmt2        = parseFloat(reconRow2[RECON_COL.our_amount]) || 0;

        if (reconPeriod2 !== period) continue;
        if (reconPolicyNo2.substring(0, 16) !== statPrefix) continue;

        if (ourAmt2 > 0) {
          var pctDiff = Math.abs(ourAmt2 - statAmount) / ourAmt2;
          if (pctDiff <= 0.05) {
            matchRowIdx = j;
            matchType   = 'FUZZY_MATCH';
            break;
          }
        }
      }
    }

    // ── Process match result ───────────────────────────────────────────────
    if (matchRowIdx !== -1) {
      var matchedReconRow = existingData[matchRowIdx];
      var ourAmount       = parseFloat(matchedReconRow[RECON_COL.our_amount]) || 0;
      var variance        = Math.round((statAmount - ourAmount) * 100) / 100;
      var absVariance     = Math.abs(variance);

      var matchStatus;
      var resolutionStatus;

      if (absVariance <= threshold) {
        matchStatus      = 'Matched';
        resolutionStatus = 'Resolved';
        if (matchType === 'EXACT') {
          results.exactMatched++;
        } else {
          results.fuzzyMatched++;
        }
      } else {
        matchStatus      = 'Variance';
        resolutionStatus = 'Open';
        results.variances++;
      }

      var sheetRow = matchRowIdx + 1; // 1-indexed
      reconSheet.getRange(sheetRow, RECON_COL.insurer_amount + 1).setValue(statAmount);
      reconSheet.getRange(sheetRow, RECON_COL.variance + 1).setValue(variance);
      reconSheet.getRange(sheetRow, RECON_COL.match_type + 1).setValue(matchType);
      reconSheet.getRange(sheetRow, RECON_COL.match_status + 1).setValue(matchStatus);
      reconSheet.getRange(sheetRow, RECON_COL.resolution_status + 1).setValue(resolutionStatus);
      reconSheet.getRange(sheetRow, RECON_COL.updated_at + 1).setValue(now);

      if (matchType === 'FUZZY_MATCH') {
        var existingNotes = matchedReconRow[RECON_COL.resolution_notes] || '';
        reconSheet.getRange(sheetRow, RECON_COL.resolution_notes + 1)
          .setValue('FUZZY MATCH — verify policy_no. ' + existingNotes);
      }

    } else {
      // ── No match found — append as Unknown ────────────────────────────────
      var unknownRow = buildReconRow(
        statPolicyNo, period, insurerId,
        '',          // our_amount blank — not in our data
        statAmount,  // insurer_amount
        '',          // variance cannot be calculated without our_amount
        'Unknown', 'Unknown', 'Open',
        '', '', now
      );
      reconSheet.appendRow(unknownRow);
      results.unknowns++;
    }
  });

  return results;
}

// ── RECONCILIATION REPORT ─────────────────────────────────────────────────────

/**
 * Generates a 5-sheet reconciliation report Excel.
 * Saved to Reconciliation/[insurerId]/ folder.
 *
 * Sheets:
 *   1. Summary          — aggregate metrics
 *   2. Matched          — all matched rows (green)
 *   3. Variance Detail  — variances above threshold, sorted by abs(variance) desc
 *   4. Unknown          — statement rows not in our data
 *   5. Outstanding by Age — open/in-discussion items across all periods, oldest first
 *
 * @param {string} insurerId - Insurer ID
 * @param {string} period    - Period "YYYY-MM"
 * @returns {string} Created spreadsheet ID
 */
function generateReconReport(insurerId, period) {
  try {
    var insurerFolderId = createSubFolder(CONFIG.FOLDER_RECONCILIATION, insurerId);
    var fileName = CONFIG.BROKER_SHORT_CODE + '_recon_' + insurerId + '_' + period;
    var ss       = createSheetInFolder(insurerFolderId, fileName);

    var reconSS    = SpreadsheetApp.openById(CONFIG.SHEET_RECONCILIATION);
    var reconSheet = reconSS.getSheetByName(insurerId);
    if (!reconSheet) throw new Error('Recon tab not found for: ' + insurerId);

    var allData  = reconSheet.getDataRange().getValues();
    var headers  = allData[0];
    var threshold = CONFIG.VARIANCE_THRESHOLD || 10;

    var dataRows = allData.slice(1).filter(function(r) {
      return r[RECON_COL.period] && r[RECON_COL.period].toString() === period;
    });

    // ── Sheet 1: Summary ──────────────────────────────────────────────────
    var summarySheet = ss.getSheets()[0];
    summarySheet.setName('Summary');
    buildReconSummary(summarySheet, insurerId, period, dataRows, threshold);

    // ── Sheet 2: Matched ──────────────────────────────────────────────────
    var matchedSheet = ss.insertSheet('Matched');
    var matchedRows  = dataRows.filter(function(r) {
      return r[RECON_COL.match_status] === 'Matched';
    });
    buildReconTab(matchedSheet, headers, matchedRows, '#e6f4ea');

    // ── Sheet 3: Variance Detail ──────────────────────────────────────────
    var varianceSheet = ss.insertSheet('Variance Detail');
    var varianceRows  = dataRows
      .filter(function(r) {
        return r[RECON_COL.match_status] === 'Variance' &&
               Math.abs(parseFloat(r[RECON_COL.variance]) || 0) > threshold;
      })
      .sort(function(a, b) {
        return Math.abs(parseFloat(b[RECON_COL.variance]) || 0) -
               Math.abs(parseFloat(a[RECON_COL.variance]) || 0);
      });
    buildReconTab(varianceSheet, headers, varianceRows, '#fdecea');

    // ── Sheet 4: Unknown ──────────────────────────────────────────────────
    var unknownSheet = ss.insertSheet('Unknown');
    var unknownRows  = dataRows.filter(function(r) {
      return r[RECON_COL.match_status] === 'Unknown';
    });
    buildReconTab(unknownSheet, headers, unknownRows, '#fff3e0');

    // ── Sheet 5: Outstanding by Age ───────────────────────────────────────
    var outstandingSheet = ss.insertSheet('Outstanding by Age');
    var allPeriodRows = allData.slice(1).filter(function(r) {
      var status  = r[RECON_COL.resolution_status] || '';
      var absVar  = Math.abs(parseFloat(r[RECON_COL.variance]) || 0);
      return (status === 'Open' || status === 'In Discussion') && absVar > threshold;
    }).sort(function(a, b) {
      var pa = (a[RECON_COL.period] || '').toString();
      var pb = (b[RECON_COL.period] || '').toString();
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
    buildReconTab(outstandingSheet, headers, allPeriodRows, '#e3f0ff');

    SpreadsheetApp.flush();
    Logger.log('Recon report created: ' + fileName);
    return ss.getId();

  } catch (e) {
    throw new Error('generateReconReport failed: ' + e.message);
  }
}

/**
 * Builds the Summary sheet of the reconciliation report.
 */
function buildReconSummary(sheet, insurerId, period, dataRows, threshold) {
  var matched = dataRows.filter(function(r) {
    return r[RECON_COL.match_status] === 'Matched';
  });
  var variance = dataRows.filter(function(r) {
    return r[RECON_COL.match_status] === 'Variance' &&
           Math.abs(parseFloat(r[RECON_COL.variance]) || 0) > threshold;
  });
  var unknown = dataRows.filter(function(r) {
    return r[RECON_COL.match_status] === 'Unknown';
  });
  var outstanding = dataRows.filter(function(r) {
    return r[RECON_COL.match_status] === 'Outstanding';
  });

  var totalOurAmt = dataRows.reduce(function(s, r) {
    return s + (parseFloat(r[RECON_COL.our_amount]) || 0);
  }, 0);
  var totalInsurerAmt = dataRows.reduce(function(s, r) {
    return s + (parseFloat(r[RECON_COL.insurer_amount]) || 0);
  }, 0);
  var totalVarianceAmt = variance.reduce(function(s, r) {
    return s + Math.abs(parseFloat(r[RECON_COL.variance]) || 0);
  }, 0);
  var matchRate = dataRows.length > 0
    ? Math.round((matched.length / dataRows.length) * 10000) / 100
    : 0;

  var summaryData = [
    ['CaliberPO Reconciliation Summary', ''],
    ['Insurer',   insurerId],
    ['Period',    period],
    ['Run Date',  Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy')],
    ['', ''],
    ['Metric', 'Value'],
    ['Total our policies',          dataRows.length],
    ['Total their policies',        dataRows.filter(function(r) {
      return r[RECON_COL.insurer_amount] !== '';
    }).length],
    ['Matched',                     matched.length],
    ['Variance (above threshold)',  variance.length],
    ['Unknown',                     unknown.length],
    ['Outstanding (unmatched yet)', outstanding.length],
    ['Match rate',                  matchRate + '%'],
    ['', ''],
    ['Our total brokerage (₹)',    Math.round(totalOurAmt * 100) / 100],
    ['Insurer total (₹)',          Math.round(totalInsurerAmt * 100) / 100],
    ['Total variance amount (₹)', Math.round(totalVarianceAmt * 100) / 100]
  ];

  sheet.getRange(1, 1, summaryData.length, 2).setValues(summaryData);
  styleHeaderRow(sheet, 1, 2, '#1a1a2e', '#FFFFFF');
  styleHeaderRow(sheet, 6, 2, '#1F3864', '#FFFFFF');
  sheet.getRange(1, 1).setFontSize(13).setFontWeight('bold');
  sheet.setColumnWidth(1, 240);
  sheet.setColumnWidth(2, 160);
}

/**
 * Builds a data tab in the reconciliation report.
 */
function buildReconTab(sheet, headers, rows, rowColor) {
  if (!headers || headers.length === 0) return;

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeaderRow(sheet, 1, headers.length, '#1a1a2e', '#FFFFFF');
  sheet.setFrozenRows(1);

  if (rows && rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    if (rowColor) {
      sheet.getRange(2, 1, rows.length, headers.length).setBackground(rowColor);
    }
  }

  setColumnWidths(sheet, [150, 80, 80, 100, 110, 100, 120, 120, 130, 110, 200, 180]);
}

// ── INDEX TAB ─────────────────────────────────────────────────────────────────

/**
 * Updates the Index tab of the Reconciliation Sheet with latest run info.
 */
function updateIndexTab(reconSS, insurerId, period, matchResults) {
  try {
    var indexSheet = reconSS.getSheetByName('Index');
    if (!indexSheet) return;

    var data  = indexSheet.getDataRange().getValues();
    var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy');

    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === insurerId) {
        indexSheet.getRange(i + 1, 3).setValue(today);
        indexSheet.getRange(i + 1, 5).setValue(matchResults.variances);
        found = true;
        break;
      }
    }

    if (!found) {
      indexSheet.appendRow([insurerId, '', today, '', matchResults.variances, '']);
    }

    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log('updateIndexTab failed (non-fatal): ' + e.message);
  }
}

// ── REPORT EMAIL ──────────────────────────────────────────────────────────────

/**
 * Emails reconciliation report to EMAIL_RECON.
 *
 * @param {string} insurerId    - Insurer ID
 * @param {string} period       - Period
 * @param {string} reportFileId - Report spreadsheet ID
 * @param {Object} matchResults - Match result counts
 */
function emailReconReport(insurerId, period, reportFileId, matchResults) {
  try {
    if (!CONFIG.EMAIL_RECON) {
      Logger.log('EMAIL_RECON not set — skipping recon report email');
      return;
    }

    var attachment = SpreadsheetApp.openById(reportFileId)
      .getBlob()
      .setName(CONFIG.BROKER_SHORT_CODE + '_recon_' + insurerId + '_' + period + '.xlsx');

    var subject = 'Reconciliation Report — ' + insurerId + ' — ' + period;
    var body = [
      'Reconciliation complete for ' + insurerId + ' / ' + period + '.',
      '',
      'Summary:',
      '  Matched (exact):  ' + matchResults.exactMatched,
      '  Matched (fuzzy):  ' + matchResults.fuzzyMatched,
      '  Variances:        ' + matchResults.variances,
      '  Unknown:          ' + matchResults.unknowns,
      '  Total statement:  ' + matchResults.totalStatement,
      '',
      'Full report attached.',
      '',
      'Fuzzy matches require manual verification — check the Matched tab.',
      'Variances require resolution — update resolution_status in the',
      'Reconciliation Sheet once agreed with insurer.',
      '',
      '— CaliberPO System'
    ].join('\n');

    GmailApp.sendEmail(CONFIG.EMAIL_RECON, subject, body, {
      from:        CONFIG.EMAIL_SENDER || '',
      attachments: [attachment]
    });

    Logger.log('Recon report emailed to ' + CONFIG.EMAIL_RECON);

  } catch (e) {
    Logger.log('emailReconReport failed (non-fatal): ' + e.message);
    logError('emailReconReport', e.message, e.stack || '');
  }
}

// ── ARCHIVE ───────────────────────────────────────────────────────────────────

/**
 * Archives matched rows older than 12 months to an archive tab.
 * Manual trigger — run when sheet performance degrades.
 *
 * @param {string} insurerId - Insurer tab to archive
 */
function archiveMatchedRows(insurerId) {
  return wrapWithErrorHandling('archiveMatchedRows', function() {

    var reconSS    = SpreadsheetApp.openById(CONFIG.SHEET_RECONCILIATION);
    var reconSheet = reconSS.getSheetByName(insurerId);
    if (!reconSheet) throw new Error('Recon tab not found: ' + insurerId);

    var cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    var cutoffPeriod = Utilities.formatDate(cutoff, 'UTC', 'yyyy-MM');

    var data    = reconSheet.getDataRange().getValues();
    var headers = data[0];
    var toArchive = [];
    var toKeep    = [headers];

    for (var i = 1; i < data.length; i++) {
      var row    = data[i];
      var rowPeriod = (row[RECON_COL.period] || '').toString();
      var status = (row[RECON_COL.match_status] || '').toString();

      if (status === 'Matched' && rowPeriod < cutoffPeriod) {
        toArchive.push(row);
      } else {
        toKeep.push(row);
      }
    }

    if (toArchive.length === 0) {
      Logger.log('archiveMatchedRows: nothing to archive for ' + insurerId);
      return;
    }

    var archiveTabName = insurerId + '_Archive';
    var archiveSheet   = reconSS.getSheetByName(archiveTabName);
    if (!archiveSheet) {
      archiveSheet = reconSS.insertSheet(archiveTabName);
      archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      styleHeaderRow(archiveSheet, 1, headers.length, '#444444', '#FFFFFF');
    }

    var lastArchiveRow = archiveSheet.getLastRow();
    archiveSheet.getRange(
      lastArchiveRow + 1, 1, toArchive.length, headers.length
    ).setValues(toArchive);

    reconSheet.clearContents();
    reconSheet.getRange(1, 1, toKeep.length, headers.length).setValues(toKeep);
    styleHeaderRow(reconSheet, 1, headers.length, '#1a1a2e', '#FFFFFF');

    SpreadsheetApp.flush();

    Logger.log('archiveMatchedRows: archived ' + toArchive.length +
      ' rows from ' + insurerId);
    return { archived: toArchive.length };
  });
}

// ── RESOLUTION HELPERS ────────────────────────────────────────────────────────

/**
 * Updates the resolution status for a specific policy in the recon sheet.
 * Called manually when coordinator resolves a variance.
 *
 * @param {string} insurerId        - Insurer tab name
 * @param {string} policyNo         - Policy number to update
 * @param {string} resolutionStatus - New status: Resolved / Written Off / In Discussion
 * @param {string} notes            - Resolution notes
 */
function updateResolutionStatus(insurerId, policyNo, resolutionStatus, notes) {
  return wrapWithErrorHandling('updateResolutionStatus', function() {

    var reconSS    = SpreadsheetApp.openById(CONFIG.SHEET_RECONCILIATION);
    var reconSheet = reconSS.getSheetByName(insurerId);
    if (!reconSheet) throw new Error('Recon tab not found: ' + insurerId);

    var data  = reconSheet.getDataRange().getValues();
    var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy');
    var found = false;

    for (var i = 1; i < data.length; i++) {
      if (data[i][RECON_COL.policy_no] &&
          data[i][RECON_COL.policy_no].toString() === policyNo.toString()) {
        reconSheet.getRange(i + 1, RECON_COL.resolution_status + 1)
          .setValue(resolutionStatus);
        reconSheet.getRange(i + 1, RECON_COL.resolution_date + 1)
          .setValue(today);
        if (notes) {
          reconSheet.getRange(i + 1, RECON_COL.resolution_notes + 1)
            .setValue(notes);
        }
        reconSheet.getRange(i + 1, RECON_COL.updated_at + 1)
          .setValue(new Date().toISOString());
        found = true;
        break;
      }
    }

    SpreadsheetApp.flush();

    if (!found) {
      Logger.log('updateResolutionStatus: policy not found: ' + policyNo);
    } else {
      Logger.log('Resolution updated: ' + policyNo + ' → ' + resolutionStatus);
    }

    return { found: found };
  });
}
