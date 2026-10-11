/**
 * CaliberPO Rate API — Setup
 * Run authorizeDeployment() once after first deployment (editor or clasp run).
 */
function setupScriptProperties() {
  var props   = PropertiesService.getScriptProperties();
  var missing = [];
  if (!props.getProperty('RATE_API_KEY')) missing.push('RATE_API_KEY');

  if (missing.length === 0) {
    Logger.log('All Script Properties are set. Rate API is ready.');
  } else {
    Logger.log('=== Action required — set these in Project Settings → Script Properties ===');
    missing.forEach(function(k) { Logger.log('  ' + k + '  — strong random string, share with API consumers'); });
  }

  var cfg = getRateRuntimeConfig_();
  Logger.log('FOLDER_GRIDS:         ' + cfg.FOLDER_GRIDS);
  Logger.log('SHEET_INSURER_MASTER: ' + cfg.SHEET_INSURER_MASTER);
}

/**
 * Touches required services so OAuth scopes are granted for the web app.
 * Safe to re-run.
 */
function authorizeDeployment() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RATE_API_KEY')) {
    props.setProperty('RATE_API_KEY', Utilities.getUuid().replace(/-/g, ''));
  }
  var cfg = getRateRuntimeConfig_();
  if (!cfg.FOLDER_GRIDS) {
    props.setProperty('FOLDER_GRIDS', '125lwRE7R-NSNnHolBGIBA_z3kLm4-vT2');
    cfg.FOLDER_GRIDS = '125lwRE7R-NSNnHolBGIBA_z3kLm4-vT2';
  }
  if (!cfg.SHEET_INSURER_MASTER) {
    props.setProperty('SHEET_INSURER_MASTER', '1NKyVjVDPVb4jmVqbG7IbklLiBqYp1_hV0GRzYMDfBrc');
    cfg.SHEET_INSURER_MASTER = '1NKyVjVDPVb4jmVqbG7IbklLiBqYp1_hV0GRzYMDfBrc';
  }
  // Force scope use
  SpreadsheetApp.openById(cfg.SHEET_INSURER_MASTER).getName();
  DriveApp.getFolderById(cfg.FOLDER_GRIDS).getName();
  // Touch library
  try { GridEngine.validateConditionalFields({ productType: 'TW' }); } catch (e) { /* ok */ }
  return {
    ok: true,
    FOLDER_GRIDS: cfg.FOLDER_GRIDS,
    SHEET_INSURER_MASTER: cfg.SHEET_INSURER_MASTER,
    hasRateKey: !!props.getProperty('RATE_API_KEY')
  };
}
