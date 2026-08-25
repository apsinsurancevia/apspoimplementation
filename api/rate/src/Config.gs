/**
 * CaliberPO Rate API — Configuration
 * Points to the same CaliberPO Drive resources as the main project.
 * API key is NEVER stored here — set RATE_API_KEY in Script Properties.
 */
var RATE_CONFIG = {
  FOLDER_GRIDS:         '15CJn8xIZBSRBw-e-O8kxZyW0RP7yx2mh',
  SHEET_INSURER_MASTER: '1GvECCDrVFsp_SXvlEZpL7hhO26sdADBVFQYdoTnRMZw',

  // Cache TTLs (seconds)
  CACHE_TTL_INSURER_LIST: 900,    // 15 min — insurer master rarely changes
  CACHE_TTL_GRID_SHEET_ID: 3600, // 1 hour — grid files don't move
  CACHE_TTL_RATE_RESULT: 3600    // 1 hour — grid data doesn't change intraday
};
