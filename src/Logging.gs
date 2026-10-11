/**
 * CaliberPO — Logging, Alerting & Monitoring
 *
 * Handles all logging for Rate Lookup calls, error alerting,
 * weekly no-match reports, and monthly log archiving.
 *
 * Log Sheet structure (CONFIG.SHEET_LOG):
 *   Tab: Log_Active       — live call log
 *   Tab: Log_Summary      — monthly aggregates
 *   Tab: Log_Dashboard    — formula-driven (not written by code)
 *   Tab: processed_policies — dedup check for commission runs
 */

// ── CALL LOGGING ──────────────────────────────────────────────────────────────

/**
 * Logs a Rate Lookup call to Log_Active tab.
 * Called after every lookupRate() invocation.
 *
 * @param {Object} params      - Lookup params (insurerId, productType, rto etc.)
 * @param {Object} result      - Lookup result object
 * @param {string} callerType  - "FORM" or "API" or "BATCH"
 * @param {number} responseMs  - Response time in milliseconds
 */
function logCall(params, result, callerType, responseMs) {
  try {
    var row = [
      new Date().toISOString(),                          // timestamp
      'lookupRate',                                      // function_name
      callerType || 'FORM',                              // caller_type
      params.insurerId      || '',                       // insurer_id
      params.productType    || '',                       // product_type
      params.rto            || '',                       // rto
      result.matchType      || '',                       // match_type
      result.matchStatus    || '',                       // match_status
      responseMs            || 0,                        // response_ms
      result.notes          || '',                       // notes
      params.fuelType       || '',                       // fuel_type
      params.yom            || ''                        // yom
    ];
    appendRow(CONFIG.SHEET_LOG, 'Log_Active', row);
  } catch (e) {
    // Log failures must never crash the calling function
    Logger.log('logCall failed (non-fatal): ' + e.message);
  }
}

// ── RUN-LEVEL EVENT LOGGING ───────────────────────────────────────────────────

/**
 * Logs a run-level operational event to the Run_Log tab.
 * Called automatically by wrapWithErrorHandling for every instrumented function.
 * Never throws — a logging failure must never crash the calling function.
 *
 * @param {string}  functionName   - Name of the function being logged
 * @param {string}  triggerType    - MANUAL | TIME_TRIGGER | API
 * @param {string}  runStatus      - STARTED | COMPLETE | FAILED
 * @param {string|null} errorMessage  - Error message; null unless FAILED
 * @param {string|null} errorFunction - Sub-function where error occurred; null unless FAILED
 * @param {Date|null}   startTimestamp - Start time for duration calc; null on STARTED rows
 */
function logRunEvent(functionName, triggerType, runStatus, errorMessage, errorFunction, startTimestamp) {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SHEET_LOG);
    var sheet = ss.getSheetByName('Run_Log');
    if (!sheet) return; // tab not yet created (e.g. pre-setup) — fail silently

    var durationSeconds = (startTimestamp instanceof Date)
      ? Math.round((new Date() - startTimestamp) / 1000)
      : null;

    // Call sheet.appendRow() directly — NOT via SheetUtils.appendRow()
    // because SheetUtils holds LockService and we may already be inside a lock.
    sheet.appendRow([
      new Date().toISOString(),   // timestamp
      functionName  || '',        // function_name
      triggerType   || 'MANUAL',  // trigger_type
      runStatus     || '',        // run_status
      errorMessage  || null,      // error_message
      errorFunction || null,      // error_function
      durationSeconds             // duration_seconds (null on STARTED rows)
    ]);
  } catch (e) {
    Logger.log('logRunEvent failed (non-fatal): ' + e.message);
  }
}

// ── ERROR LOGGING & ALERTING ──────────────────────────────────────────────────

/**
 * Logs an error to Log_Active and immediately emails EMAIL_COORDINATOR.
 * Called from catch blocks throughout the system.
 *
 * @param {string} functionName  - Name of the function that errored
 * @param {string} errorMessage  - Error message
 * @param {string} stackTrace    - Stack trace string (e.params.stack)
 */
function logError(functionName, errorMessage, stackTrace) {
  try {
    // Write to log sheet
    var row = [
      new Date().toISOString(),
      functionName,
      'SYSTEM',
      '', '', '', '', 'ERROR',
      0,
      errorMessage
    ];
    appendRow(CONFIG.SHEET_LOG, 'Log_Active', row);
  } catch (logWriteErr) {
    Logger.log('logError sheet write failed: ' + logWriteErr.message);
  }

  // Always attempt email regardless of sheet write result
  try {
    if (!CONFIG.EMAIL_COORDINATOR) return;
    var subject = 'CaliberPO Error — ' + functionName;
    var body = [
      'CaliberPO encountered an error.',
      '',
      'Time:      ' + new Date().toISOString(),
      'Function:  ' + functionName,
      'Error:     ' + errorMessage,
      '',
      'Stack Trace:',
      stackTrace || '(not available)',
      '',
      '— CaliberPO System'
    ].join('\n');
    MailApp.sendEmail(CONFIG.EMAIL_COORDINATOR, subject, body);
  } catch (mailErr) {
    Logger.log('logError email failed: ' + mailErr.message);
  }
}

/**
 * Logs an informational message to Log_Active. No email.
 *
 * @param {string} functionName - Calling function name
 * @param {string} message      - Info message
 */
function logInfo(functionName, message) {
  try {
    var row = [
      new Date().toISOString(),
      functionName,
      'SYSTEM',
      '', '', '', '', 'INFO',
      0,
      message
    ];
    appendRow(CONFIG.SHEET_LOG, 'Log_Active', row);
  } catch (e) {
    Logger.log('logInfo failed (non-fatal): ' + e.message);
  }
}

// ── ERROR HANDLING WRAPPER ────────────────────────────────────────────────────

/**
 * Wraps a function in try/catch with automatic error logging and alerting.
 * Use this for all script entry points.
 *
 * Usage:
 *   function runMyProcess() {
 *     return wrapWithErrorHandling('runMyProcess', function() {
 *       // ... your code here
 *     });
 *   }
 *
 * @param {string}   functionName - Name for logging
 * @param {Function} fn           - Function to execute
 * @returns {*} Return value of fn(), or null on error
 */
function wrapWithErrorHandling(functionName, fn, triggerType) {
  var runStart = new Date();
  var tType = triggerType || 'MANUAL';
  logRunEvent(functionName, tType, 'STARTED', null, null, null);
  try {
    logInfo(functionName, 'Started');
    var result = fn();
    logInfo(functionName, 'Completed successfully');
    logRunEvent(functionName, tType, 'COMPLETE', null, null, runStart);
    return result;
  } catch (e) {
    logError(functionName, e.message, e.stack);
    var errFn = '';
    if (e.stack) {
      var stackLines = e.stack.split('\n');
      errFn = (stackLines.length > 1 ? stackLines[1] : stackLines[0] || '').trim();
    }
    logRunEvent(functionName, tType, 'FAILED', e.message, errFn, runStart);
    return null;
  }
}

// ── PROCESSED POLICIES LOG ────────────────────────────────────────────────────

/**
 * Records a processed policy to the processed_policies tab.
 * Used by CommissionApplication.gs for dedup checking.
 *
 * @param {string} policyNo   - Policy number
 * @param {string} period     - Period "YYYY-MM"
 * @param {string} sourceFile - Name of the source file processed
 */
function logProcessedPolicy(policyNo, period, sourceFile) {
  try {
    var row = [
      policyNo,
      period,
      new Date().toISOString(),
      sourceFile || ''
    ];
    appendRow(CONFIG.SHEET_LOG, 'processed_policies', row);
  } catch (e) {
    Logger.log('logProcessedPolicy failed (non-fatal): ' + e.message);
  }
}

/**
 * Batch logs multiple processed policies in one write operation.
 * More efficient than calling logProcessedPolicy() in a loop.
 *
 * @param {Array[]} policies  - Array of [policyNo, period, sourceFile] arrays
 */
function logProcessedPoliciesBatch(policies) {
  try {
    if (!policies || policies.length === 0) return;
    var timestamp = new Date().toISOString();
    var rows = policies.map(function(p) {
      return [p[0], p[1], timestamp, p[2] || ''];
    });
    appendRows(CONFIG.SHEET_LOG, 'processed_policies', rows);
  } catch (e) {
    Logger.log('logProcessedPoliciesBatch failed (non-fatal): ' + e.message);
  }
}

/**
 * Checks if a policy has already been processed for a given period.
 * Used by CommissionApplication.gs before processing each row.
 *
 * @param {string} policyNo - Policy number to check
 * @param {string} period   - Period "YYYY-MM"
 * @returns {boolean} true if already processed
 */
function isPolicyAlreadyProcessed(policyNo, period) {
  try {
    var data = getSheetData(CONFIG.SHEET_LOG, 'processed_policies');
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === policyNo.toString() &&
          data[i][1] && data[i][1].toString() === period.toString()) {
        return true;
      }
    }
    return false;
  } catch (e) {
    Logger.log('isPolicyAlreadyProcessed failed (non-fatal): ' + e.message);
    return false; // fail open — do not block processing on log read failure
  }
}

// ── LOG ARCHIVING ─────────────────────────────────────────────────────────────

/**
 * Archives Log_Active to a monthly tab and clears it.
 * Time-triggered: 1st of each month at 01:00.
 * Can also be run manually at any time.
 */
function archiveLog() {
  return wrapWithErrorHandling('archiveLog', function() {
    var ss    = SpreadsheetApp.openById(CONFIG.SHEET_LOG);
    var active = ss.getSheetByName('Log_Active');
    if (!active) throw new Error('Log_Active tab not found');

    var data = active.getDataRange().getValues();
    if (data.length <= 1) {
      logInfo('archiveLog', 'Nothing to archive — Log_Active is empty');
      return;
    }

    // Determine archive tab name from prior month
    var now       = new Date();
    var archiveYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    var archiveMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    var tabName   = 'Log_' + archiveYear + '_' + String(archiveMonth).padStart(2, '0');

    // Create archive tab
    var archiveTab = ss.getSheetByName(tabName);
    if (!archiveTab) {
      archiveTab = ss.insertSheet(tabName);
    } else {
      archiveTab.clearContents();
    }

    // Copy all data to archive tab
    archiveTab.getRange(1, 1, data.length, data[0].length).setValues(data);

    // Calculate summary stats (data rows = data.length - 1)
    var dataRows    = data.slice(1);
    var totalCalls  = dataRows.length;
    var matched     = dataRows.filter(function(r) { return r[7] === 'MATCHED'; }).length;
    var noMatch     = dataRows.filter(function(r) { return r[7] === 'NO_MATCH'; }).length;
    var errors      = dataRows.filter(function(r) { return r[7] === 'ERROR'; }).length;
    var totalMs     = dataRows.reduce(function(sum, r) { return sum + (parseInt(r[8]) || 0); }, 0);
    var avgMs       = totalCalls > 0 ? Math.round(totalMs / totalCalls) : 0;

    var period = archiveYear + '-' + String(archiveMonth).padStart(2, '0');

    // Update Log_Summary
    var summaryTab = ss.getSheetByName('Log_Summary');
    if (summaryTab) {
      summaryTab.appendRow([period, totalCalls, matched, noMatch, errors, avgMs]);
    }

    // Clear Log_Active (keep header row)
    var lastRow = active.getLastRow();
    if (lastRow > 1) {
      active.getRange(2, 1, lastRow - 1, active.getLastColumn()).clearContent();
    }

    logInfo('archiveLog', 'Archived ' + totalCalls + ' rows to ' + tabName);
    Logger.log('archiveLog complete: ' + totalCalls + ' rows → ' + tabName);
  }, 'TIME_TRIGGER');
}

// ── NO-MATCH WEEKLY REPORT ────────────────────────────────────────────────────

/**
 * Sends a weekly no-match report to EMAIL_COORDINATOR.
 * Time-triggered: every Monday at 08:00.
 * Skipped if zero no-matches in past 7 days.
 */
function sendNoMatchReport() {
  return wrapWithErrorHandling('sendNoMatchReport', function() {
    var data = getSheetData(CONFIG.SHEET_LOG, 'Log_Active');
    if (!data || data.length <= 1) return;

    var sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Filter to NO_MATCH rows in past 7 days
    var noMatchRows = data.slice(1).filter(function(row) {
      if (row[7] !== 'NO_MATCH') return false;
      var ts = new Date(row[0]);
      return ts >= sevenDaysAgo;
    });

    if (noMatchRows.length === 0) {
      Logger.log('sendNoMatchReport: no NO_MATCH rows in past 7 days — skipping');
      return;
    }

    // Group by insurer + product_type + rto
    var groups = {};
    noMatchRows.forEach(function(row) {
      var key = (row[3] || '') + ' / ' + (row[4] || '') + ' / ' + (row[5] || 'No RTO');
      groups[key] = (groups[key] || 0) + 1;
    });

    // Sort by count descending
    var sorted = Object.keys(groups).map(function(k) {
      return { key: k, count: groups[k] };
    }).sort(function(a, b) { return b.count - a.count; });

    // Build email body
    var lines = [
      'CaliberPO — Weekly No-Match Report',
      'Period: past 7 days',
      'Total no-match lookups: ' + noMatchRows.length,
      '',
      'Top combinations with no rate found:',
      '─────────────────────────────────────────',
    ];
    sorted.slice(0, 20).forEach(function(item) {
      lines.push(item.count + 'x  ' + item.key);
    });
    if (sorted.length > 20) {
      lines.push('... and ' + (sorted.length - 20) + ' more combinations');
    }
    lines.push('');
    lines.push('Action: Review grid coverage for these combinations.');
    lines.push('— CaliberPO System');

    MailApp.sendEmail(
      CONFIG.EMAIL_COORDINATOR,
      'CaliberPO — Weekly No-Match Report (' + noMatchRows.length + ' lookups)',
      lines.join('\n')
    );

    Logger.log('sendNoMatchReport: sent report — ' + noMatchRows.length + ' no-matches');
  }, 'TIME_TRIGGER');
}

// ── TRIGGER SETUP ─────────────────────────────────────────────────────────────

/**
 * Creates time-based triggers for log archiving and no-match reporting.
 * Run once after deployment from Apps Script editor.
 * Checks for existing triggers before creating — no duplicates.
 */
function setupTriggers() {
  try {
    var existingTriggers = ScriptApp.getProjectTriggers();
    var hasArchive  = false;
    var hasNoMatch  = false;
    var created = [];
    var existing = [];

    existingTriggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === 'archiveLog')       hasArchive  = true;
      if (trigger.getHandlerFunction() === 'sendNoMatchReport') hasNoMatch = true;
    });

    if (!hasArchive) {
      ScriptApp.newTrigger('archiveLog')
        .timeBased()
        .onMonthDay(1)
        .atHour(1)
        .create();
      Logger.log('Trigger created: archiveLog — 1st of month at 01:00');
      created.push('archiveLog');
    } else {
      Logger.log('Trigger already exists: archiveLog');
      existing.push('archiveLog');
    }

    if (!hasNoMatch) {
      ScriptApp.newTrigger('sendNoMatchReport')
        .timeBased()
        .everyWeeks(1)
        .onWeekDay(ScriptApp.WeekDay.MONDAY)
        .atHour(8)
        .create();
      Logger.log('Trigger created: sendNoMatchReport — every Monday at 08:00');
      created.push('sendNoMatchReport');
    } else {
      Logger.log('Trigger already exists: sendNoMatchReport');
      existing.push('sendNoMatchReport');
    }

    Logger.log('setupTriggers complete');
    return { created: created, existing: existing };

  } catch (e) {
    Logger.log('setupTriggers failed: ' + e.message);
    throw e;
  }
}

// ── EXCEPTION SUMMARY EMAIL ───────────────────────────────────────────────────

/**
 * Sends a commission run exception summary to EMAIL_COORDINATOR.
 * Called by CommissionApplication.gs after each batch run.
 *
 * @param {Object} summary - Run summary object:
 *   { period, totalRows, matched, exceptions: [{policyNo, status, notes}] }
 */
function sendExceptionSummary(summary) {
  try {
    if (!CONFIG.EMAIL_COORDINATOR) return;

    var subject = 'CaliberPO Commission Run — ' + summary.period +
      ' (' + summary.matched + '/' + summary.totalRows + ' matched)';

    var lines = [
      'Commission batch run complete.',
      '',
      'Period:        ' + summary.period,
      'Total rows:    ' + summary.totalRows,
      'Matched:       ' + summary.matched,
      'Exceptions:    ' + (summary.totalRows - summary.matched),
      ''
    ];

    // Status breakdown
    if (summary.statusCounts) {
      lines.push('Status breakdown:');
      Object.keys(summary.statusCounts).forEach(function(status) {
        if (status !== 'MATCHED') {
          lines.push('  ' + status + ': ' + summary.statusCounts[status]);
        }
      });
      lines.push('');
    }

    // Exception detail
    if (summary.exceptions && summary.exceptions.length > 0) {
      var exList = summary.exceptions.slice(0, 50);
      lines.push('Exception rows (first ' + exList.length + '):');
      lines.push('─────────────────────────────────────────');
      exList.forEach(function(ex) {
        lines.push(ex.policyNo + '  [' + ex.status + ']  ' + (ex.notes || ''));
      });
      if (summary.exceptions.length > 50) {
        lines.push('... and ' + (summary.exceptions.length - 50) + ' more — see output file for full list');
      }
    } else {
      lines.push('No exceptions — all rows matched successfully.');
    }

    lines.push('');
    lines.push('Output file saved to: CaliberPO/Output/');
    lines.push('— CaliberPO System');

    MailApp.sendEmail(CONFIG.EMAIL_COORDINATOR, subject, lines.join('\n'));

  } catch (e) {
    Logger.log('sendExceptionSummary failed (non-fatal): ' + e.message);
  }
}

/**
 * Sends a duplicate rate alert email to EMAIL_COORDINATOR.
 * Called when grid validation finds duplicate rates.
 *
 * @param {string} tabName    - Grid tab name where duplicate found
 * @param {string} description - Full description of the duplicate
 */
function sendDuplicateRateAlert(tabName, description) {
  try {
    if (!CONFIG.EMAIL_COORDINATOR) return;
    MailApp.sendEmail(
      CONFIG.EMAIL_COORDINATOR,
      'CaliberPO — Duplicate Rate Detected: ' + tabName,
      'A duplicate rate was detected in grid tab: ' + tabName + '\n\n' +
      description + '\n\n' +
      'Please review and resolve in the grid before running commission batch.\n\n' +
      '— CaliberPO System'
    );
  } catch (e) {
    Logger.log('sendDuplicateRateAlert failed (non-fatal): ' + e.message);
  }
}
