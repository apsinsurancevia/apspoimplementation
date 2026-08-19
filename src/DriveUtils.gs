/**
 * CaliberPO — Drive Utilities
 *
 * All Google Drive operations go through these functions.
 * No other file accesses DriveApp directly.
 *
 * All functions wrapped in try/catch.
 * On error: throw new Error('[FunctionName] failed: ' + e.message)
 */

// ── FOLDER OPERATIONS ─────────────────────────────────────────────────────────

/**
 * Gets a folder by ID. Throws if not found.
 *
 * @param {string} folderId - Drive folder ID
 * @returns {Folder} Drive Folder object
 */
function getFolderById(folderId) {
  try {
    return DriveApp.getFolderById(folderId);
  } catch (e) {
    throw new Error('getFolderById failed [' + folderId + ']: ' + e.message);
  }
}

/**
 * Finds a file by name in a folder. Returns file ID or null.
 * Exact name match.
 *
 * @param {string} folderId - Folder to search in
 * @param {string} fileName - Exact file name to find
 * @returns {string|null} File ID or null if not found
 */
function findFileInFolder(folderId, fileName) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFilesByName(fileName);
    if (files.hasNext()) return files.next().getId();
    return null;
  } catch (e) {
    throw new Error('findFileInFolder failed [' + fileName + ']: ' + e.message);
  }
}

/**
 * Finds the most recent file in a folder matching a name prefix.
 * Returns file ID of the most recently created matching file, or null.
 *
 * @param {string} folderId - Folder to search in
 * @param {string} namePrefix - File name prefix to match
 * @returns {string|null} File ID of most recent match, or null
 */
function findMostRecentFileByPrefix(folderId, namePrefix) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var matches = [];
    while (files.hasNext()) {
      var file = files.next();
      if (file.getName().indexOf(namePrefix) === 0) {
        matches.push({ id: file.getId(), date: file.getDateCreated() });
      }
    }
    if (matches.length === 0) return null;
    matches.sort(function(a, b) { return b.date - a.date; });
    return matches[0].id;
  } catch (e) {
    throw new Error('findMostRecentFileByPrefix failed [' + namePrefix + ']: ' + e.message);
  }
}

/**
 * Finds a subfolder by name under a parent folder.
 * Returns folder ID or null if not found.
 *
 * @param {string} parentFolderId - Parent folder ID
 * @param {string} folderName - Subfolder name to find
 * @returns {string|null} Folder ID or null
 */
function findFolderInFolder(parentFolderId, folderName) {
  try {
    var parent = DriveApp.getFolderById(parentFolderId);
    var folders = parent.getFoldersByName(folderName);
    if (folders.hasNext()) return folders.next().getId();
    return null;
  } catch (e) {
    throw new Error('findFolderInFolder failed [' + folderName + ']: ' + e.message);
  }
}

/**
 * Creates a subfolder under a parent folder.
 * If the folder already exists, returns its existing ID (no duplicate).
 *
 * @param {string} parentFolderId - Parent folder ID
 * @param {string} folderName - Name for the new subfolder
 * @returns {string} Folder ID (new or existing)
 */
function createSubFolder(parentFolderId, folderName) {
  try {
    var existing = findFolderInFolder(parentFolderId, folderName);
    if (existing) return existing;
    var parent = DriveApp.getFolderById(parentFolderId);
    return parent.createFolder(folderName).getId();
  } catch (e) {
    throw new Error('createSubFolder failed [' + folderName + ']: ' + e.message);
  }
}

/**
 * Creates a YYYY-MM period subfolder under a parent folder.
 * Returns folder ID (existing or new).
 *
 * @param {string} parentFolderId - Parent folder ID
 * @param {string} period - Period string "YYYY-MM"
 * @returns {string} Folder ID
 */
function createPeriodSubfolder(parentFolderId, period) {
  try {
    return createSubFolder(parentFolderId, period);
  } catch (e) {
    throw new Error('createPeriodSubfolder failed [' + period + ']: ' + e.message);
  }
}

// ── FILE OPERATIONS ───────────────────────────────────────────────────────────

/**
 * Moves a file to a destination folder.
 *
 * @param {string} fileId - File ID to move
 * @param {string} destinationFolderId - Destination folder ID
 */
function moveFileToFolder(fileId, destinationFolderId) {
  try {
    var file = DriveApp.getFileById(fileId);
    file.moveTo(DriveApp.getFolderById(destinationFolderId));
  } catch (e) {
    throw new Error('moveFileToFolder failed [' + fileId + ']: ' + e.message);
  }
}

/**
 * Copies a file to a destination folder with a new name.
 * Returns the new file ID.
 *
 * @param {string} fileId - Source file ID
 * @param {string} destinationFolderId - Destination folder ID
 * @param {string} newName - New file name
 * @returns {string} New file ID
 */
function copyFileToFolder(fileId, destinationFolderId, newName) {
  try {
    var file = DriveApp.getFileById(fileId);
    var dest = DriveApp.getFolderById(destinationFolderId);
    var copy = file.makeCopy(newName, dest);
    return copy.getId();
  } catch (e) {
    throw new Error('copyFileToFolder failed [' + fileId + ']: ' + e.message);
  }
}

/**
 * Lists all files in a folder.
 * Returns array of {id, name, mimeType, createdDate} objects.
 *
 * @param {string} folderId - Folder ID to list
 * @param {string} [mimeType] - Optional MIME type filter
 * @returns {Object[]} Array of file info objects
 */
function listFilesInFolder(folderId, mimeType) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var results = [];
    while (files.hasNext()) {
      var file = files.next();
      if (!mimeType || file.getMimeType() === mimeType) {
        results.push({
          id:          file.getId(),
          name:        file.getName(),
          mimeType:    file.getMimeType(),
          createdDate: file.getDateCreated()
        });
      }
    }
    return results;
  } catch (e) {
    throw new Error('listFilesInFolder failed [' + folderId + ']: ' + e.message);
  }
}

/**
 * Deletes a file by moving it to trash.
 *
 * @param {string} fileId - File ID to trash
 */
function trashFile(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (e) {
    throw new Error('trashFile failed [' + fileId + ']: ' + e.message);
  }
}

// ── PDF EXPORT ────────────────────────────────────────────────────────────────

/**
 * Exports a specific sheet tab as a PDF and saves to a Drive folder.
 * Returns the PDF file ID.
 *
 * @param {string} spreadsheetId - Source spreadsheet ID
 * @param {string} tabName - Tab name to export
 * @param {string} pdfFileName - Name for the PDF file (without .pdf)
 * @param {string} destinationFolderId - Folder to save the PDF in
 * @returns {string} PDF file ID
 */
function exportSheetAsPDF(spreadsheetId, tabName, pdfFileName, destinationFolderId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);

    var sheetGid = sheet.getSheetId();
    var token = ScriptApp.getOAuthToken();

    var exportUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId +
      '/export?' + [
        'format=pdf',
        'size=A4',
        'portrait=true',
        'fitw=true',
        'sheetnames=false',
        'printtitle=false',
        'pagenumbers=false',
        'gridlines=false',
        'fzr=false',
        'gid=' + sheetGid
      ].join('&');

    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('PDF export HTTP error: ' + response.getResponseCode());
    }

    var blob = response.getBlob().setName(pdfFileName + '.pdf');
    var folder = DriveApp.getFolderById(destinationFolderId);
    var file = folder.createFile(blob);
    return file.getId();

  } catch (e) {
    throw new Error('exportSheetAsPDF failed [' + tabName + ']: ' + e.message);
  }
}

/**
 * Gets the file blob for email attachment.
 *
 * @param {string} fileId - File ID
 * @returns {Blob} File blob for use as email attachment
 */
function getFileBlob(fileId) {
  try {
    return DriveApp.getFileById(fileId).getBlob();
  } catch (e) {
    throw new Error('getFileBlob failed [' + fileId + ']: ' + e.message);
  }
}

// ── VALIDATION HELPER ─────────────────────────────────────────────────────────

/**
 * Checks if a file exists in a folder matching a name prefix and period.
 * Used for period lock check in CommissionApplication.gs.
 *
 * @param {string} folderId - Folder to check
 * @param {string} brokerCode - Broker short code
 * @param {string} period - Period string "YYYY-MM"
 * @returns {boolean} true if a matching file exists
 */
function periodFileExists(folderId, brokerCode, period) {
  try {
    var prefix = brokerCode + '_Sales_Data_' + period;
    var match = findMostRecentFileByPrefix(folderId, prefix);
    return match !== null;
  } catch (e) {
    throw new Error('periodFileExists failed: ' + e.message);
  }
}
