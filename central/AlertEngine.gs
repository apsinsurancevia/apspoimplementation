/**
 * CaliberPO CommandCentre — Alert Engine
 *
 * fireRedAlert()     — immediate email on Red status; called inline from doPost()
 * sendAmberDigest()  — daily 09:00 IST digest of all Amber brokers
 * setupAlertTriggers() — one-time setup; run from Apps Script editor
 *
 * IMPORTANT: Set project timezone to Asia/Kolkata in Apps Script Project Settings
 * so that the 09:00 trigger fires at IST, not UTC.
 */

// ── RED ALERT ─────────────────────────────────────────────────────────────────

/**
 * Sends an immediate email alert for a broker in Red status.
 * Also appends a row to Alert_Log in CLMS_Master.
 *
 * @param {Object} payload     - Full signal payload from broker
 * @param {Object} healthResult - { status, reason } from computeHealth()
 * @param {Object} ss           - SpreadsheetApp spreadsheet (CLMS_Master), already open
 */
function fireRedAlert(payload, healthResult, ss) {
  try {
    var alertEmail = PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL_PRIMARY');
    if (!alertEmail) {
      Logger.log('fireRedAlert: ALERT_EMAIL_PRIMARY not set in Script Properties');
      return;
    }

    var cb = payload.runs.commission_batch       || {};
    var po = payload.runs.payout                || {};
    var st = payload.runs.statement_processing  || {};
    var re = payload.runs.reconciliation         || {};

    var subject = '[CALIBER ALERT] ' + payload.broker_name + ' — ' + healthResult.reason;

    var body = [
      'CaliberPO — Red Status Alert',
      '─────────────────────────────────────────────',
      '',
      'Broker:         ' + payload.broker_name + ' (' + payload.broker_id + ')',
      'Alert condition: ' + healthResult.reason,
      'Alert time:      ' + new Date().toISOString(),
      '',
      'Pipeline status at time of alert:',
      '  Commission:  ' + _fmtStatus(cb),
      '  Payout:      ' + _fmtStatus(po),
      '  Statement:   ' + _fmtStatus(st),
      '  Recon:       ' + _fmtStatus(re),
      '',
      'Trigger health:   ' + payload.trigger_health,
      'API failures 24h: ' + payload.api_failures_24h,
      '',
      'Review the CommandCentre dashboard for full details.',
      '— CaliberPO CommandCentre'
    ].join('\n');

    MailApp.sendEmail(alertEmail, subject, body);

    // Append to Alert_Log
    var errorDetail = cb.last_error || st.last_error || po.last_error || re.last_error || null;
    var alertSheet = ss.getSheetByName('Alert_Log');
    if (alertSheet) {
      alertSheet.appendRow([
        new Date().toISOString(),  // alert_timestamp
        payload.broker_id,         // broker_id
        payload.broker_name,       // broker_name
        'RED',                     // alert_type
        healthResult.reason,       // condition
        errorDetail,               // error_detail
        'N',                       // resolved
        null,                      // resolved_at
        null                       // notes
      ]);
    }

  } catch (e) {
    Logger.log('fireRedAlert failed (non-fatal): ' + e.message);
  }
}

// ── AMBER DIGEST ──────────────────────────────────────────────────────────────

/**
 * Sends a daily digest email listing all Amber brokers.
 * Time-triggered at 09:00 IST (set project timezone in Project Settings).
 * Does nothing if no brokers are Amber.
 */
function sendAmberDigest() {
  try {
    var alertEmail = PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL_PRIMARY');
    if (!alertEmail) {
      Logger.log('sendAmberDigest: ALERT_EMAIL_PRIMARY not set');
      return;
    }

    var sheetId = PropertiesService.getScriptProperties().getProperty('CLMS_SHEET_ID');
    if (!sheetId) {
      Logger.log('sendAmberDigest: CLMS_SHEET_ID not set');
      return;
    }

    var ss          = SpreadsheetApp.openById(sheetId);
    var statusSheet = ss.getSheetByName('Broker_Status');
    var data        = statusSheet.getDataRange().getValues();

    if (data.length <= 1) return;

    var headers        = data[0];
    var healthIdx      = headers.indexOf('health_status');
    var nameIdx        = headers.indexOf('broker_name');
    var idIdx          = headers.indexOf('broker_id');
    var lastSyncIdx    = headers.indexOf('last_sync');
    var syncAgeIdx     = headers.indexOf('sync_age_mins');
    var commStatusIdx  = headers.indexOf('commission_last_status');
    var payStatusIdx   = headers.indexOf('payout_last_status');
    var stmtStatusIdx  = headers.indexOf('statement_last_status');

    var amberRows = data.slice(1).filter(function(row) {
      return row[healthIdx] === 'Amber';
    });

    if (amberRows.length === 0) return;

    var lines = [
      'CaliberPO — Daily Amber Status Digest',
      new Date().toISOString(),
      '─────────────────────────────────────────────',
      '',
      amberRows.length + ' broker(s) in Amber status:',
      ''
    ];

    amberRows.forEach(function(row) {
      lines.push('  Broker:     ' + row[nameIdx] + ' (' + row[idIdx] + ')');
      lines.push('  Last sync:  ' + (row[lastSyncIdx] || 'unknown') +
        ' (' + (row[syncAgeIdx] || '?') + ' mins ago)');
      lines.push('  Commission: ' + (row[commStatusIdx] || 'no data') +
        '  Payout: ' + (row[payStatusIdx] || 'no data') +
        '  Statement: ' + (row[stmtStatusIdx] || 'no data'));
      lines.push('');
    });

    lines.push('Review at: [CommandCentre Dashboard URL]');
    lines.push('— CaliberPO CommandCentre');

    MailApp.sendEmail(
      alertEmail,
      'CaliberPO — ' + amberRows.length + ' broker(s) Amber — Daily Digest',
      lines.join('\n')
    );

  } catch (e) {
    Logger.log('sendAmberDigest failed (non-fatal): ' + e.message);
  }
}

// ── TRIGGER SETUP ─────────────────────────────────────────────────────────────

/**
 * Creates time-based trigger for sendAmberDigest at 09:00 daily.
 * Run once from Apps Script editor after deploying the central project.
 *
 * IMPORTANT: Set project timezone to Asia/Kolkata in:
 *   Apps Script editor → Project Settings → Time zone → Asia/Kolkata
 * This ensures 09:00 fires at IST, not UTC.
 */
function setupAlertTriggers() {
  try {
    var existing = ScriptApp.getProjectTriggers();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].getHandlerFunction() === 'sendAmberDigest') {
        ScriptApp.deleteTrigger(existing[i]);
        Logger.log('Deleted existing sendAmberDigest trigger');
      }
    }

    ScriptApp.newTrigger('sendAmberDigest')
      .timeBased()
      .atHour(9)
      .everyDays(1)
      .create();

    Logger.log('Alert trigger created: sendAmberDigest daily at 09:00');
    Logger.log('REMINDER: Confirm project timezone is set to Asia/Kolkata in Project Settings');

  } catch (e) {
    Logger.log('setupAlertTriggers failed: ' + e.message);
    throw e;
  }
}

// ── PRIVATE HELPERS ───────────────────────────────────────────────────────────

function _fmtStatus(runObj) {
  if (!runObj || !runObj.last_run_status) return 'no data';
  var s = runObj.last_run_status;
  if (runObj.last_error) s += ' — ' + runObj.last_error;
  return s;
}
