/**
 * CaliberPO Grid Run API — Setup
 * Run setupScriptProperties() once after first deployment.
 */
function setupScriptProperties() {
  var props   = PropertiesService.getScriptProperties();
  var missing = [];
  if (!props.getProperty('GRID_RUN_API_KEY')) missing.push('GRID_RUN_API_KEY');

  if (missing.length === 0) {
    Logger.log('All Script Properties are set. Grid Run API is ready.');
  } else {
    Logger.log('=== Action required — set these in Project Settings → Script Properties ===');
    missing.forEach(function(k) { Logger.log('  ' + k + '  — strong random string, share with API consumers'); });
  }

  Logger.log('FOLDER_GRIDS:         ' + GRIDRUN_CONFIG.FOLDER_GRIDS);
  Logger.log('SHEET_INSURER_MASTER: ' + GRIDRUN_CONFIG.SHEET_INSURER_MASTER);
}
