/**
 * CaliberPO Rate API — Setup
 * Run setupScriptProperties() once after first deployment.
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

  Logger.log('FOLDER_GRIDS:         ' + RATE_CONFIG.FOLDER_GRIDS);
  Logger.log('SHEET_INSURER_MASTER: ' + RATE_CONFIG.SHEET_INSURER_MASTER);
}
