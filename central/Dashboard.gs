/**
 * CaliberPO CommandCentre — Dashboard Data Provider
 *
 * Server-side functions called by dashboard.html via google.script.run.
 * All reads are from CLMS_Master (ID in Script Properties: CLMS_SHEET_ID).
 */

/**
 * Returns all data needed by the dashboard in one call.
 * Called on page load and every 15 minutes by the auto-refresh timer.
 *
 * @returns {{
 *   brokers:    Object[],   — rows from Broker_Status as key-value objects
 *   alerts:     Object[],   — unresolved Alert_Log rows (newest first, max 20)
 *   serverTime: string      — ISO timestamp of when this data was read
 *   error:      string|null — set only if the sheet read failed
 * }}
 */
function getDashboardData() {
  try {
    var sheetId = PropertiesService.getScriptProperties().getProperty('CLMS_SHEET_ID');
    if (!sheetId) return { brokers: [], alerts: [], serverTime: new Date().toISOString(),
      error: 'CLMS_SHEET_ID not set in Script Properties' };

    var ss = SpreadsheetApp.openById(sheetId);

    // ── Broker_Status ───────────────────────────────────────────────────────
    var statusSheet  = ss.getSheetByName('Broker_Status');
    var statusData   = statusSheet.getDataRange().getValues();
    var brokers      = [];
    if (statusData.length > 1) {
      var statusHeaders = statusData[0].map(function(h) { return h.toString().trim(); });
      brokers = statusData.slice(1).map(function(row) {
        var obj = {};
        statusHeaders.forEach(function(h, i) {
          obj[h] = (row[i] !== null && row[i] !== undefined) ? row[i] : null;
        });
        return obj;
      });
    }

    // ── Alert_Log (unresolved, newest first, max 20) ────────────────────────
    var alertSheet  = ss.getSheetByName('Alert_Log');
    var alertData   = alertSheet.getDataRange().getValues();
    var alerts      = [];
    if (alertData.length > 1) {
      var alertHeaders  = alertData[0].map(function(h) { return h.toString().trim(); });
      var resolvedIdx   = alertHeaders.indexOf('resolved');
      alerts = alertData.slice(1)
        .filter(function(row) { return row[resolvedIdx] === 'N'; })
        .map(function(row) {
          var obj = {};
          alertHeaders.forEach(function(h, i) {
            obj[h] = (row[i] !== null && row[i] !== undefined) ? row[i] : null;
          });
          return obj;
        })
        .reverse()   // newest first
        .slice(0, 20);
    }

    return {
      brokers:    brokers,
      alerts:     alerts,
      serverTime: new Date().toISOString(),
      error:      null
    };

  } catch (e) {
    Logger.log('getDashboardData failed: ' + e.message);
    return {
      brokers:    [],
      alerts:     [],
      serverTime: new Date().toISOString(),
      error:      e.message
    };
  }
}
