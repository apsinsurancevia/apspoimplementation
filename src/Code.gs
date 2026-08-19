/**
 * CaliberPO — Main Router
 *
 * Entry point for all Web App requests.
 * Routes to appropriate handler based on request parameters.
 * All other business logic lives in dedicated .gs files.
 */

/**
 * Web App entry point — handles all GET requests.
 * Routes: api=true → JSON API handler, otherwise → Rate Lookup HTML form
 */
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.api === 'true') {
      return handleAPIRequest(e);
    }
    return HtmlService
      .createHtmlOutputFromFile('index')
      .setTitle('CaliberPO Rate Lookup')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles API requests from system integrations.
 * Expects parameters: api=true, insurerId, productType, productSubType,
 * rto, policyIssueDate, and optional premium fields.
 */
function handleAPIRequest(e) {
  try {
    var params = {
      insurerId:       e.parameter.insurerId       || '',
      productType:     e.parameter.productType     || '',
      productSubType:  e.parameter.productSubType  || '',
      rto:             e.parameter.rto             || '',
      vehicleCc:       parseFloat(e.parameter.vehicleCc)    || null,
      vehicleGvw:      parseFloat(e.parameter.vehicleGvw)   || null,
      vehicleSeating:  parseFloat(e.parameter.vehicleSeating) || null,
      policyIssueDate: e.parameter.policyIssueDate || '',
      netPremium:      parseFloat(e.parameter.netPremium)   || 0,
      odPremium:       parseFloat(e.parameter.odPremium)    || 0,
      tpPremium:       parseFloat(e.parameter.tpPremium)    || 0
    };
    var result = lookupRate(params);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
