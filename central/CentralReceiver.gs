/**
 * CaliberPO CommandCentre — Central Receiver
 *
 * Deployed as a Web App in the NovoUp Google Workspace.
 *   Execute as: Me (NovoUp account)
 *   Access:     Anyone with the link
 *   Auth:       MONITORING_KEY passed by broker as ?key= URL query param
 *
 * doGet(e)  — serves the CommandCentre dashboard HTML
 * doPost(e) — receives broker health signals; updates CLMS_Master
 *
 * Script Properties required (set in Project Settings → Script Properties):
 *   CLMS_SHEET_ID        — ID of the CLMS_Master Google Sheet
 *   MONITORING_KEY       — shared secret; must match broker Script Properties
 *   ALERT_EMAIL_PRIMARY  — email for Red alerts and Amber digest
 */

// ── WEB APP ENTRY POINTS ──────────────────────────────────────────────────────

/**
 * Serves the CommandCentre dashboard HTML.
 */
function doGet(e) {
  return HtmlService
    .createHtmlOutputFromFile('dashboard')
    .setTitle('CaliberPO CommandCentre')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Receives a broker health signal and updates CLMS_Master.
 */
function doPost(e) {
  try {

    // ── Step 1: Validate shared key ─────────────────────────────────────────
    var receivedKey = (e.parameter && e.parameter.key) ? e.parameter.key : '';
    var expectedKey = PropertiesService.getScriptProperties().getProperty('MONITORING_KEY');
    if (!expectedKey || receivedKey !== expectedKey) {
      Logger.log('doPost: rejected — key mismatch from IP ' +
        (e.parameter && e.parameter.key ? '(key present)' : '(no key)'));
      return ContentService
        .createTextOutput('Unauthorised')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // ── Step 2: Parse payload ───────────────────────────────────────────────
    var payload = JSON.parse(e.postData.contents);

    // ── Step 3: Acquire script lock ─────────────────────────────────────────
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      var sheetId = PropertiesService.getScriptProperties().getProperty('CLMS_SHEET_ID');
      var ss      = SpreadsheetApp.openById(sheetId);
      var now     = new Date();

      // ── Step 4+5: Find or create broker row in Broker_Status ───────────────
      var statusSheet = ss.getSheetByName('Broker_Status');
      var statusData  = statusSheet.getDataRange().getValues();
      var brokerSheetRow = -1; // 1-based sheet row index; -1 = not found
      for (var i = 1; i < statusData.length; i++) {
        if (statusData[i][0] && statusData[i][0].toString() === payload.broker_id) {
          brokerSheetRow = i + 1;
          break;
        }
      }

      // ── Step 6: Compute field values ────────────────────────────────────────
      var syncAgeMs   = now - new Date(payload.sync_timestamp);
      var syncAgeMins = Math.round(syncAgeMs / 60000);

      var cb = payload.runs.commission_batch       || {};
      var po = payload.runs.payout                || {};
      var st = payload.runs.statement_processing  || {};
      var re = payload.runs.reconciliation         || {};

      // ── Step 7: computeHealth ───────────────────────────────────────────────
      var brokerRow = {
        trigger_health:             payload.trigger_health,
        sync_age_mins:              syncAgeMins,
        api_failures_24h:           payload.api_failures_24h,
        commission_last_status:     cb.last_run_status || null,
        commission_last_error:      cb.last_error      || null,
        commission_last_run:        cb.last_run_at     || null,
        payout_last_status:         po.last_run_status || null,
        payout_last_error:          po.last_error      || null,
        payout_last_run:            po.last_run_at     || null,
        statement_last_status:      st.last_run_status || null,
        statement_last_error:       st.last_error      || null,
        statement_last_run:         st.last_run_at     || null,
        reconciliation_last_status: re.last_run_status || null
      };
      var healthResult = computeHealth(brokerRow);

      // Carry forward alert_sent_at and notes from the existing row
      var prevAlertSentAt = null;
      var prevNotes       = '';
      if (brokerSheetRow > 0) {
        var existingRow  = statusData[brokerSheetRow - 1];
        prevAlertSentAt  = existingRow[19] || null; // col T (0-indexed 19)
        prevNotes        = existingRow[20] || '';   // col U (0-indexed 20)
      }

      // ── Step 8: Fire Red alert if needed ───────────────────────────────────
      var newAlertSentAt = prevAlertSentAt;
      if (healthResult.status === 'Red') {
        var shouldAlert = !prevAlertSentAt ||
          (now - new Date(prevAlertSentAt)) > 4 * 60 * 60 * 1000;
        if (shouldAlert) {
          fireRedAlert(payload, healthResult, ss);
          newAlertSentAt = now.toISOString();
        }
      }

      // 20-column row matching Broker_Status headers
      var newRow = [
        payload.broker_id,              // broker_id
        payload.broker_name,            // broker_name
        payload.sync_timestamp,         // last_sync
        syncAgeMins,                    // sync_age_mins
        payload.trigger_health,         // trigger_health
        payload.api_failures_24h,       // api_failures_24h
        cb.last_run_at     || null,     // commission_last_run
        cb.last_run_status || null,     // commission_last_status
        cb.last_error      || null,     // commission_last_error
        po.last_run_at     || null,     // payout_last_run
        po.last_run_status || null,     // payout_last_status
        po.last_error      || null,     // payout_last_error
        st.last_run_at     || null,     // statement_last_run
        st.last_run_status || null,     // statement_last_status
        st.last_error      || null,     // statement_last_error
        re.last_run_at     || null,     // reconciliation_last_run
        re.last_run_status || null,     // reconciliation_last_status
        re.last_error      || null,     // reconciliation_last_error
        healthResult.status,            // health_status
        newAlertSentAt,                 // alert_sent_at
        prevNotes                       // notes
      ];

      if (brokerSheetRow > 0) {
        statusSheet.getRange(brokerSheetRow, 1, 1, newRow.length).setValues([newRow]);
      } else {
        statusSheet.appendRow(newRow);
      }

      // ── Step 9: Append to Signal_History ───────────────────────────────────
      var historySheet = ss.getSheetByName('Signal_History');
      if (historySheet) {
        historySheet.appendRow([
          now.toISOString(),              // received_at
          payload.broker_id,             // broker_id
          payload.broker_name,           // broker_name
          payload.trigger_health,        // trigger_health
          payload.api_failures_24h,      // api_failures_24h
          cb.last_run_status || null,    // commission_status
          po.last_run_status || null,    // payout_status
          st.last_run_status || null,    // statement_status
          re.last_run_status || null,    // reconciliation_status
          JSON.stringify(payload)        // raw_payload
        ]);
      }

      SpreadsheetApp.flush();

    } finally {
      lock.releaseLock();
    }

    return ContentService
      .createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    Logger.log('doPost error: ' + err.message + '\n' + (err.stack || ''));
    return ContentService
      .createTextOutput('Error: ' + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
