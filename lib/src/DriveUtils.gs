/**
 * CaliberPO Grid Engine Library — Drive Utilities
 * Uses DriveApp (no Drive API v3 required).
 */

function findFileInFolder(folderId, fileName) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files  = folder.getFilesByName(fileName);
    return files.hasNext() ? files.next().getId() : null;
  } catch (e) { Logger.log('findFileInFolder failed [' + fileName + ']: ' + e.message); return null; }
}

function listFilesInFolder(folderId) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files  = folder.getFiles();
    var result = [];
    while (files.hasNext()) {
      var f = files.next();
      result.push({ id: f.getId(), name: f.getName(), createdDate: f.getDateCreated().getTime() });
    }
    return result;
  } catch (e) { Logger.log('listFilesInFolder failed: ' + e.message); return []; }
}
