/**
 * CaliberPO — Monitoring Sync
 *
 * Pushes a broker health signal to the NovoUp CommandCentre every 15 minutes.
 * Reads Run_Log from the broker's Log Sheet, compiles a status payload, and
 * POSTs it to the central receiver.
 *
 * Auth: MONITORING_KEY is appended as a URL query param (?key=).
 * Never stored in Config.gs — always in Apps Script Script Properties.
 *
 * Setup: run setupMonitoringTrigger() once after deployment.
 */

// ── SYNC FUNCTION ─────────────────────────────────────────────────────────────

/**
 * Compiles and posts a broker health signal to the CommandCentre.
 * Runs every 15 minutes via time-based trigger.
 * Never throws — all exceptions caught internally.
 */
function syncToMonitoring() {
  var syncStart = new Date();
  try {

    // ── Step 1: Read Run_Log ────────────────────────────────────────────────
    var logData  = getSheetData(CONFIG.SHEET_LOG, 'Run_Log');
    var dataRows = logData.length > 1 ? logData.slice(1) : [];
    // Run_Log columns (0-indexed):
    // 0:timestamp  1:function_name  2:trigger_type  3:run_status
    // 4:error_message  5:error_function  6:duration_seconds

    // ── Step 2: Most recent terminal row per tracked function ───────────────
    var TRACKED = {
      commission_batch:     'runCommissionBatch',
      payout:               'runPayoutGeneration',
      statement_processing: 'processInsurerStatement',
      reconciliation:       'runReconciliation',
      archive_log:          'archiveLog'
    };

    var runs = {};
    var trackedKeys = Object.keys(TRACKED);
    for (var k = 0; k < trackedKeys.length; k++) {
      var key    = trackedKeys[k];
      var fnName = TRACKED[key];
      var relevant = [];
      for (var i = 0; i < dataRows.length; i++) {
        var r = dataRows[i];
        if (r[1] === fnName && (r[3] === 'COMPLETE' || r[3] === 'FAILED')) {
          relevant.push(r);
        }
      }
      if (relevant.length === 0) {
        runs[key] = { last_run_at: null, last_run_status: null, last_error: null, last_error_fn: null };
        continue;
      }
      // Most recent by timestamp
      relevant.sort(function(a, b) { return new Date(b[0]) - new Date(a[0]); });
      var latest = relevant[0];
      runs[key] = {
        last_run_at:     latest[0] ? new Date(latest[0]).toISOString() : null,
        last_run_status: latest[3] || null,
        last_error:      latest[4] || null,
        last_error_fn:   latest[5] || null
      };
    }

    // ── Step 3: Trigger health ──────────────────────────────────────────────
    // Determined from: (a) does a trigger exist? (b) when did it last COMPLETE?
    var triggerHealth = 'MISSING';
    var projectTriggers = ScriptApp.getProjectTriggers();
    var hasTrigger = false;
    for (var t = 0; t < projectTriggers.length; t++) {
      if (projectTriggers[t].getHandlerFunction() === 'syncToMonitoring') {
        hasTrigger = true;
        break;
      }
    }
    if (hasTrigger) {
      var syncCompletes = [];
      for (var j = 0; j < dataRows.length; j++) {
        var row = dataRows[j];
        if (row[1] === 'syncToMonitoring' && row[3] === 'COMPLETE') {
          syncCompletes.push(row);
        }
      }
      if (syncCompletes.length === 0) {
        triggerHealth = 'STALE'; // trigger exists but has never completed yet
      } else {
        syncCompletes.sort(function(a, b) { return new Date(b[0]) - new Date(a[0]); });
        var lastCompletedAt = new Date(syncCompletes[0][0]);
        var minsAgo = (new Date() - lastCompletedAt) / 60000;
        triggerHealth = minsAgo > 20 ? 'STALE' : 'OK';
      }
    }

    // ── Step 4: API failures in last 24 hours ───────────────────────────────
    var cutoff24h = new Date(new Date() - 24 * 60 * 60 * 1000);
    var apiFailures24h = 0;
    for (var a = 0; a < dataRows.length; a++) {
      var dr = dataRows[a];
      if (dr[1] === 'processInsurerStatement' &&
          dr[3] === 'FAILED' &&
          dr[0] && new Date(dr[0]) >= cutoff24h) {
        apiFailures24h++;
      }
    }

    // ── Step 5: Build payload ───────────────────────────────────────────────
    var payload = {
      broker_id:        CONFIG.BROKER_SHORT_CODE,
      broker_name:      CONFIG.BROKER_NAME,
      sync_timestamp:   new Date().toISOString(),
      trigger_health:   triggerHealth,
      api_failures_24h: apiFailures24h,
      runs:             runs
    };

    // ── Step 6: Read Script Properties ─────────────────────────────────────
    var props    = PropertiesService.getScriptProperties();
    var endpoint = props.getProperty('MONITORING_ENDPOINT');
    var monKey   = props.getProperty('MONITORING_KEY');

    if (!endpoint || !monKey) {
      logRunEvent('syncToMonitoring', 'TIME_TRIGGER', 'FAILED',
        'MONITORING_ENDPOINT or MONITORING_KEY not set in Script Properties',
        null, syncStart);
      return;
    }

    // ── Step 7: POST to CommandCentre ───────────────────────────────────────
    var url      = endpoint + '?key=' + encodeURIComponent(monKey);
    var response = UrlFetchApp.fetch(url, {
      method:             'post',
      contentType:        'application/json',
      payload:            JSON.stringify(payload),
      muteHttpExceptions: true
    });

    // ── Step 8: Log result ──────────────────────────────────────────────────
    var responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      logRunEvent('syncToMonitoring', 'TIME_TRIGGER', 'FAILED',
        'CommandCentre returned HTTP ' + responseCode,
        null, syncStart);
    } else {
      logRunEvent('syncToMonitoring', 'TIME_TRIGGER', 'COMPLETE', null, null, syncStart);
    }

  } catch (e) {
    Logger.log('syncToMonitoring failed: ' + e.message);
    try {
      logRunEvent('syncToMonitoring', 'TIME_TRIGGER', 'FAILED', e.message, '', syncStart);
    } catch (logErr) {
      Logger.log('logRunEvent also failed in syncToMonitoring catch: ' + logErr.message);
    }
  }
}

// ── TRIGGER SETUP ─────────────────────────────────────────────────────────────

/**
 * Creates a 15-minute time-based trigger for syncToMonitoring.
 * Run once from the Apps Script editor after deployment.
 * Safe to re-run — deletes existing trigger first to avoid duplicates.
 */
function setupMonitoringTrigger() {
  try {
    var existing = ScriptApp.getProjectTriggers();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].getHandlerFunction() === 'syncToMonitoring') {
        ScriptApp.deleteTrigger(existing[i]);
        Logger.log('Deleted existing syncToMonitoring trigger: ' + existing[i].getUniqueId());
      }
    }

    var newTrigger = ScriptApp.newTrigger('syncToMonitoring')
      .timeBased()
      .everyMinutes(15)
      .create();

    Logger.log('Monitoring trigger created — ID: ' + newTrigger.getUniqueId() +
      ' — fires every 15 minutes');

  } catch (e) {
    Logger.log('setupMonitoringTrigger failed: ' + e.message);
    throw e;
  }
}
