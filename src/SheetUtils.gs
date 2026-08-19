/**
 * CaliberPO — Sheet Utilities
 *
 * All Google Sheets read/write operations go through these functions.
 * No other file accesses SpreadsheetApp directly.
 *
 * All functions wrapped in try/catch.
 * On error: throw new Error('[FunctionName] failed: ' + e.message)
 */

// ── READ OPERATIONS ───────────────────────────────────────────────────────────

/**
 * Returns all data from a sheet tab as a 2D array.
 * Row 0 = headers. Row 1+ = data.
 * Empty rows (all blank) are excluded from data rows.
 *
 * @param {string} sheetId - Spreadsheet ID
 * @param {string} tabName - Tab name
 * @returns {Array[]} 2D array including header row
 */
function getSheetData(sheetId, tabName) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName + ' in sheet ' + sheetId);
    var data = sheet.getDataRange().getValues();
    return data;
  } catch (e) {
    throw new Error('getSheetData failed [' + tabName + ']: ' + e.message);
  }
}

/**
 * Returns the header row of a sheet tab as an array of strings.
 *
 * @param {string} sheetId - Spreadsheet ID
 * @param {string} tabName - Tab name
 * @returns {string[]} Header values
 */
function getSheetHeaders(sheetId, tabName) {
  try {
    var data = getSheetData(sheetId, tabName);
    if (!data || data.length === 0) return [];
    return data[0].map(function(h) { return h ? h.toString() : ''; });
  } catch (e) {
    throw new Error('getSheetHeaders failed [' + tabName + ']: ' + e.message);
  }
}

/**
 * Returns all data rows as an array of objects.
 * Keys are header names. Empty rows excluded.
 *
 * @param {string} sheetId - Spreadsheet ID
 * @param {string} tabName - Tab name
 * @returns {Object[]} Array of row objects
 */
function getSheetDataAsObjects(sheetId, tabName) {
  try {
    var data = getSheetData(sheetId, tabName);
    if (!data || data.length < 2) return [];

    var headers = data[0].map(function(h) {
      return h ? h.toString().trim() : '';
    });

    var results = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var isEmpty = row.every(function(cell) {
        return cell === null || cell === undefined || cell === '';
      });
      if (isEmpty) continue;

      var obj = {};
      headers.forEach(function(header, idx) {
        if (header) {
          var val = row[idx];
          obj[header] = (val !== null && val !== undefined) ? val : '';
        }
      });
      results.push(obj);
    }
    return results;
  } catch (e) {
    throw new Error('getSheetDataAsObjects failed [' + tabName + ']: ' + e.message);
  }
}

/**
 * Finds the first row where a column matches a search value.
 * Returns 1-indexed row number, or -1 if not found.
 * Case-insensitive string comparison.
 *
 * @param {string} sheetId - Spreadsheet ID
 * @param {string} tabName - Tab name
 * @param {number} colIndex - 0-indexed column number to search
 * @param {string} searchValue - Value to find
 * @returns {number} 1-indexed row number, or -1 if not found
 */
function findRowByColumnValue(sheetId, tabName, colIndex, searchValue) {
  try {
    var data = getSheetData(sheetId, tabName);
    var search = searchValue ? searchValue.toString().toLowerCase().trim() : '';
    for (var i = 1; i < data.length; i++) {
      var cell = data[i][colIndex];
      if (cell !== null && cell !== undefined &&
          cell.toString().toLowerCase().trim() === search) {
        return i + 1; // 1-indexed
      }
    }
    return -1;
  } catch (e) {
    throw new Error('findRowByColumnValue failed [' + tabName + ']: ' + e.message);
  }
}

/**
 * Looks up a value in a two-column map sheet.
 * Searches column 0 (broker_value), returns column 1 (caliber_value).
 * Case-insensitive. Returns null if not found.
 *
 * @param {Array[]} mapData - 2D array from getSheetData() (includes header row)
 * @param {string} lookupValue - Value to look up in column 0
 * @returns {string|null} Mapped value from column 1, or null
 */
function lookupInMap(mapData, lookupValue) {
  try {
    if (!mapData || !lookupValue) return null;
    var search = lookupValue.toString().toLowerCase().trim();
    for (var i = 1; i < mapData.length; i++) {
      var row = mapData[i];
      if (row[0] && row[0].toString().toLowerCase().trim() === search) {
        return row[1] ? row[1].toString().trim() : null;
      }
    }
    return null;
  } catch (e) {
    throw new Error('lookupInMap failed for "' + lookupValue + '": ' + e.message);
  }
}

// ── WRITE OPERATIONS ──────────────────────────────────────────────────────────

/**
 * Appends a single row to a sheet tab.
 * Uses LockService to prevent concurrent write conflicts.
 *
 * @param {string} sheetId - Spreadsheet ID
 * @param {string} tabName - Tab name
 * @param {Array} rowData - Array of values to append
 */
function appendRow(sheetId, tabName, rowData) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var ss = SpreadsheetApp.openById(sheetId);
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) throw new Error('Tab not found: ' + tabName);
      sheet.appendRow(rowData);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    throw new Error('appendRow failed [' + tabName + ']: ' + e.message);
  }
}

/**
 * Appends multiple rows to a sheet tab in a single operation.
 * More efficient than calling appendRow() in a loop.
 * Uses LockService.
 *
 * @param {string} sheetId - Spreadsheet ID
 * @param {string} tabName - Tab name
 * @param {Array[]} rowsData - 2D array of rows to append
 */
function appendRows(sheetId, tabName, rowsData) {
  try {
    if (!rowsData || rowsData.length === 0) return;
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var ss = SpreadsheetApp.openById(sheetId);
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) throw new Error('Tab not found: ' + tabName);
      var lastRow = sheet.getLastRow();
      var numCols = rowsData[0].length;
      sheet.getRange(lastRow + 1, 1, rowsData.length, numCols).setValues(rowsData);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    throw new Error('appendRows failed [' + tabName + ']: ' + e.message);
  }
}

/**
 * Updates a specific cell by 1-indexed row and column.
 *
 * @param {string} sheetId - Spreadsheet ID
 * @param {string} tabName - Tab name
 * @param {number} row - 1-indexed row number
 * @param {number} col - 1-indexed column number
 * @param {*} value - Value to set
 */
function updateCell(sheetId, tabName, row, col, value) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);
    sheet.getRange(row, col).setValue(value);
    SpreadsheetApp.flush();
  } catch (e) {
    throw new Error('updateCell failed [' + tabName + ' R' + row + 'C' + col + ']: ' + e.message);
  }
}

/**
 * Updates an entire row by 1-indexed row number.
 *
 * @param {string} sheetId - Spreadsheet ID
 * @param {string} tabName - Tab name
 * @param {number} row - 1-indexed row number
 * @param {Array} rowData - Array of values
 */
function updateRow(sheetId, tabName, row, rowData) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);
    sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
    SpreadsheetApp.flush();
  } catch (e) {
    throw new Error('updateRow failed [' + tabName + ' row ' + row + ']: ' + e.message);
  }
}

/**
 * Writes a complete dataset to a sheet tab.
 * Clears existing data below headers first, then writes all rows.
 *
 * @param {string} sheetId - Spreadsheet ID
 * @param {string} tabName - Tab name
 * @param {Array[]} rowsData - 2D array of data rows (no header row)
 * @param {number} [startRow=2] - Row to start writing (default 2, after header)
 */
function writeSheetData(sheetId, tabName, rowsData, startRow) {
  try {
    if (!rowsData || rowsData.length === 0) return;
    var start = startRow || 2;
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);

    var lastRow = sheet.getLastRow();
    if (lastRow >= start) {
      sheet.getRange(start, 1, lastRow - start + 1, sheet.getLastColumn()).clearContent();
    }

    var numCols = rowsData[0].length;
    sheet.getRange(start, 1, rowsData.length, numCols).setValues(rowsData);
    SpreadsheetApp.flush();
  } catch (e) {
    throw new Error('writeSheetData failed [' + tabName + ']: ' + e.message);
  }
}

/**
 * Clears all content below the header rows.
 *
 * @param {string} sheetId - Spreadsheet ID
 * @param {string} tabName - Tab name
 * @param {number} [keepHeaderRows=1] - Number of header rows to preserve
 */
function clearTabData(sheetId, tabName, keepHeaderRows) {
  try {
    var keep = keepHeaderRows || 1;
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);
    var lastRow = sheet.getLastRow();
    if (lastRow > keep) {
      sheet.getRange(keep + 1, 1, lastRow - keep, sheet.getLastColumn()).clearContent();
    }
    SpreadsheetApp.flush();
  } catch (e) {
    throw new Error('clearTabData failed [' + tabName + ']: ' + e.message);
  }
}

// ── COUNTER OPERATIONS ────────────────────────────────────────────────────────

/**
 * Reads a counter value from the Counters tab of the Broker Config Sheet.
 *
 * @param {string} sheetId - Broker Config Sheet ID
 * @param {string} counterName - Counter name (e.g. "PARTNER_INVOICE_COUNTER")
 * @returns {number} Current counter value
 */
function getCounterValue(sheetId, counterName) {
  try {
    var data = getSheetData(sheetId, 'Counters');
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === counterName) {
        return parseInt(data[i][1]) || 0;
      }
    }
    throw new Error('Counter not found: ' + counterName);
  } catch (e) {
    throw new Error('getCounterValue failed [' + counterName + ']: ' + e.message);
  }
}

/**
 * Increments a counter and returns the NEW value.
 * Uses LockService to prevent collision on concurrent runs.
 *
 * @param {string} sheetId - Broker Config Sheet ID
 * @param {string} counterName - Counter name
 * @returns {number} New counter value after increment
 */
function incrementCounter(sheetId, counterName) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var ss = SpreadsheetApp.openById(sheetId);
      var sheet = ss.getSheetByName('Counters');
      if (!sheet) throw new Error('Counters tab not found');

      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString().trim() === counterName) {
          var newVal = (parseInt(data[i][1]) || 0) + 1;
          sheet.getRange(i + 1, 2).setValue(newVal);
          SpreadsheetApp.flush();
          return newVal;
        }
      }
      throw new Error('Counter not found: ' + counterName);
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    throw new Error('incrementCounter failed [' + counterName + ']: ' + e.message);
  }
}

// ── SPREADSHEET CREATION ──────────────────────────────────────────────────────

/**
 * Creates a new Google Sheet in a Drive folder.
 * Returns the new spreadsheet object.
 *
 * @param {string} folderId - Destination folder ID
 * @param {string} fileName - Name for the new spreadsheet
 * @returns {Spreadsheet} New Google Spreadsheet object
 */
function createSheetInFolder(folderId, fileName) {
  try {
    var ss = SpreadsheetApp.create(fileName);
    var file = DriveApp.getFileById(ss.getId());
    file.moveTo(DriveApp.getFolderById(folderId));
    return ss;
  } catch (e) {
    throw new Error('createSheetInFolder failed [' + fileName + ']: ' + e.message);
  }
}

/**
 * Applies standard header styling to a range.
 * Navy background (#1F3864) with white bold text by default.
 *
 * @param {Sheet} sheet - Google Sheet object
 * @param {number} row - 1-indexed row number
 * @param {number} numCols - Number of columns to style
 * @param {string} [bgColor='#1F3864'] - Background colour hex
 * @param {string} [fontColor='#FFFFFF'] - Font colour hex
 */
function styleHeaderRow(sheet, row, numCols, bgColor, fontColor) {
  try {
    var range = sheet.getRange(row, 1, 1, numCols);
    range.setFontWeight('bold');
    range.setBackground(bgColor || '#1F3864');
    range.setFontColor(fontColor || '#FFFFFF');
  } catch (e) {
    throw new Error('styleHeaderRow failed: ' + e.message);
  }
}

/**
 * Sets column widths for a sheet.
 *
 * @param {Sheet} sheet - Google Sheet object
 * @param {number[]} widths - Array of column widths in pixels
 */
function setColumnWidths(sheet, widths) {
  try {
    widths.forEach(function(width, idx) {
      if (width) sheet.setColumnWidth(idx + 1, width);
    });
  } catch (e) {
    throw new Error('setColumnWidths failed: ' + e.message);
  }
}
