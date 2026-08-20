/**
 * CaliberPO CommandCentre — One-Time Setup
 *
 * Run setupCommandCentre() once from the Apps Script editor in the
 * NovoUp central project. Creates the Drive folder structure and
 * CLMS_Master sheet, then stores their IDs in Script Properties.
 *
 * Pre-requisite: Set PARENT_FOLDER_ID in Script Properties before running.
 *   PARENT_FOLDER_ID — ID of the Drive folder that will contain
 *                      "CaliberPO/CommandCentre/". If not set, folders
 *                      are created in My Drive root.
 *
 * After running:
 *   CLMS_SHEET_ID and COMMAND_CENTRE_FOLDER_ID are written to Script
 *   Properties automatically. No manual copy-paste needed.
 */

function setupCommandCentre() {
  try {
    var props        = PropertiesService.getScriptProperties();
    var parentFolderId = props.getProperty('PARENT_FOLDER_ID');

    // ── Create CaliberPO/CommandCentre folder structure ─────────────────────
    var parentFolder = parentFolderId
      ? DriveApp.getFolderById(parentFolderId)
      : DriveApp.getRootFolder();

    var caliberFolder   = _getOrCreateSubfolder(parentFolder, 'CaliberPO');
    var commandCentre   = _getOrCreateSubfolder(caliberFolder, 'CommandCentre');

    Logger.log('CommandCentre folder: ' + commandCentre.getUrl());

    // ── Create CLMS_Master sheet inside CommandCentre ───────────────────────
    var clmsName = 'CLMS_Master';
    var existingFiles = commandCentre.getFilesByName(clmsName);
    var clmsSS;
    if (existingFiles.hasNext()) {
      clmsSS = SpreadsheetApp.open(existingFiles.next());
      Logger.log('CLMS_Master already exists — using existing sheet');
    } else {
      clmsSS = SpreadsheetApp.create(clmsName);
      DriveApp.getFileById(clmsSS.getId()).moveTo(commandCentre);
      Logger.log('CLMS_Master created in CommandCentre');
    }

    // ── Tab 1: Broker_Status ────────────────────────────────────────────────
    _setupClmsTab(clmsSS, 'Broker_Status', [
      'broker_id', 'broker_name', 'last_sync', 'sync_age_mins',
      'trigger_health', 'api_failures_24h',
      'commission_last_run', 'commission_last_status', 'commission_last_error',
      'payout_last_run', 'payout_last_status', 'payout_last_error',
      'statement_last_run', 'statement_last_status', 'statement_last_error',
      'reconciliation_last_run', 'reconciliation_last_status', 'reconciliation_last_error',
      'health_status', 'alert_sent_at', 'notes'
    ], '#1a1a2e', '#FFFFFF');

    // ── Tab 2: Alert_Log ────────────────────────────────────────────────────
    _setupClmsTab(clmsSS, 'Alert_Log', [
      'alert_timestamp', 'broker_id', 'broker_name', 'alert_type',
      'condition', 'error_detail', 'resolved', 'resolved_at', 'notes'
    ], '#7b0000', '#FFFFFF');

    // ── Tab 3: Signal_History ───────────────────────────────────────────────
    _setupClmsTab(clmsSS, 'Signal_History', [
      'received_at', 'broker_id', 'broker_name', 'trigger_health',
      'api_failures_24h', 'commission_status', 'payout_status',
      'statement_status', 'reconciliation_status', 'raw_payload'
    ], '#1a3a2e', '#FFFFFF');

    // ── Tab 4: Broker_Registry ──────────────────────────────────────────────
    _setupClmsTab(clmsSS, 'Broker_Registry', [
      'broker_id', 'broker_name', 'go_live_date', 'contact_email', 'active'
    ], '#2e2e1a', '#FFFFFF');

    // Remove the default empty sheet created with the spreadsheet
    var defaultSheet = clmsSS.getSheetByName('Sheet1');
    if (defaultSheet && clmsSS.getSheets().length > 1) {
      clmsSS.deleteSheet(defaultSheet);
    }

    SpreadsheetApp.flush();

    // ── Store IDs in Script Properties ─────────────────────────────────────
    props.setProperty('CLMS_SHEET_ID',            clmsSS.getId());
    props.setProperty('COMMAND_CENTRE_FOLDER_ID', commandCentre.getId());

    Logger.log('=== setupCommandCentre complete ===');
    Logger.log('CLMS_SHEET_ID:            ' + clmsSS.getId());
    Logger.log('COMMAND_CENTRE_FOLDER_ID: ' + commandCentre.getId());
    Logger.log('Next steps:');
    Logger.log('  1. Set MONITORING_KEY in Script Properties (shared with all brokers)');
    Logger.log('  2. Set ALERT_EMAIL_PRIMARY in Script Properties');
    Logger.log('  3. Deploy this project as a Web App (Execute as Me, Anyone with link)');
    Logger.log('  4. Copy the Web App URL → set as MONITORING_ENDPOINT in each broker Script Properties');
    Logger.log('  5. Run setupAlertTriggers() to create the daily Amber digest trigger');

  } catch (e) {
    Logger.log('setupCommandCentre FAILED: ' + e.message + '\n' + (e.stack || ''));
    throw e;
  }
}

// ── PRIVATE HELPERS ───────────────────────────────────────────────────────────

function _getOrCreateSubfolder(parent, name) {
  var existing = parent.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(name);
}

function _setupClmsTab(ss, tabName, headers, bgColor, fontColor) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(bgColor);
  headerRange.setFontColor(fontColor);
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
}
