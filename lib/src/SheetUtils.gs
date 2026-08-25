/**
 * CaliberPO Grid Engine Library — Sheet Utilities
 * Read-only. No write operations in the library.
 */

function getSheetData(sheetId, tabName) {
  try {
    var ss    = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);
    return sheet.getDataRange().getValues();
  } catch (e) { throw new Error('getSheetData failed [' + tabName + ']: ' + e.message); }
}

function getSheetDataAsObjects(sheetId, tabName) {
  try {
    var data    = getSheetData(sheetId, tabName);
    if (!data || data.length < 2) return [];
    var headers = data[0].map(function(h) { return h ? h.toString().trim() : ''; });
    var results = [];
    for (var i = 1; i < data.length; i++) {
      var row     = data[i];
      var isEmpty = row.every(function(c) { return c === null || c === undefined || c === ''; });
      if (isEmpty) continue;
      var obj = {};
      headers.forEach(function(h, idx) { if (h) obj[h] = row[idx] !== null && row[idx] !== undefined ? row[idx] : ''; });
      results.push(obj);
    }
    return results;
  } catch (e) { throw new Error('getSheetDataAsObjects failed [' + tabName + ']: ' + e.message); }
}
