/**
 * CaliberPO Grid Run API — Setup
 * Run authorizeDeployment() once after first deployment (editor or clasp run).
 */
function setupScriptProperties() {
  var props   = PropertiesService.getScriptProperties();
  var missing = [];
  if (!props.getProperty('GRID_RUN_API_KEY')) missing.push('GRID_RUN_API_KEY');

  if (missing.length === 0) {
    Logger.log('All Script Properties are set. GridRun API is ready.');
  } else {
    Logger.log('=== Action required — set these in Project Settings → Script Properties ===');
    missing.forEach(function(k) { Logger.log('  ' + k + '  — strong random string, share with API consumers'); });
  }

  var cfg = getGridRunRuntimeConfig_();
  Logger.log('FOLDER_GRIDS:         ' + cfg.FOLDER_GRIDS);
  Logger.log('SHEET_INSURER_MASTER: ' + cfg.SHEET_INSURER_MASTER);
}

/**
 * Touches required services so OAuth scopes are granted for the web app.
 * Safe to re-run.
 */
function authorizeDeployment() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('GRID_RUN_API_KEY')) {
    props.setProperty('GRID_RUN_API_KEY', Utilities.getUuid().replace(/-/g, ''));
  }
  var cfg = getGridRunRuntimeConfig_();
  if (!cfg.FOLDER_GRIDS) {
    props.setProperty('FOLDER_GRIDS', '125lwRE7R-NSNnHolBGIBA_z3kLm4-vT2');
    cfg.FOLDER_GRIDS = '125lwRE7R-NSNnHolBGIBA_z3kLm4-vT2';
  }
  if (!cfg.SHEET_INSURER_MASTER) {
    props.setProperty('SHEET_INSURER_MASTER', '1NKyVjVDPVb4jmVqbG7IbklLiBqYp1_hV0GRzYMDfBrc');
    cfg.SHEET_INSURER_MASTER = '1NKyVjVDPVb4jmVqbG7IbklLiBqYp1_hV0GRzYMDfBrc';
  }
  SpreadsheetApp.openById(cfg.SHEET_INSURER_MASTER).getName();
  DriveApp.getFolderById(cfg.FOLDER_GRIDS).getName();
  try { GridEngine.validateConditionalFields({ productType: 'TW' }); } catch (e) { /* ok */ }
  return {
    ok: true,
    FOLDER_GRIDS: cfg.FOLDER_GRIDS,
    SHEET_INSURER_MASTER: cfg.SHEET_INSURER_MASTER,
    hasGridKey: !!props.getProperty('GRID_RUN_API_KEY')
  };
}
