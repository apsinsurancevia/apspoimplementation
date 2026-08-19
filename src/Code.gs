// Code.gs — entry points (populated in later prompts)
// Prompt 00 placeholder — safe to push

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("CaliberPO")
      .addItem("Open Rate Lookup", "openRateLookup")
      .addSeparator()
      .addItem("Run Commission Application", "runCommissionApplication")
      .addItem("Generate Partner Statements", "generatePartnerStatements")
      .addItem("Generate Insurer Invoices", "generateInsurerInvoices")
      .addItem("Run Reconciliation", "runReconciliation")
      .addToUi();
  } catch (e) {
    throw new Error("[onOpen] failed: " + e.message);
  }
}

function openRateLookup() {
  try {
    var html = HtmlService.createHtmlOutputFromFile("index")
      .setWidth(800)
      .setHeight(600)
      .setTitle("Rate Lookup");
    SpreadsheetApp.getUi().showModalDialog(html, "Rate Lookup");
  } catch (e) {
    throw new Error("[openRateLookup] failed: " + e.message);
  }
}

// Stubs — implemented in subsequent prompts
function runCommissionApplication()  { throw new Error("Not yet implemented — see CommissionApplication.gs"); }
function generatePartnerStatements() { throw new Error("Not yet implemented — see PayoutGeneration.gs"); }
function generateInsurerInvoices()   { throw new Error("Not yet implemented — see PayoutGeneration.gs"); }
function runReconciliation()         { throw new Error("Not yet implemented — see Reconciliation.gs"); }
