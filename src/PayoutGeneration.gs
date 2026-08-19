/**
 * CaliberPO — Payout Generation
 *
 * Step III of the CaliberPO pipeline.
 *
 * Flow:
 *   1. Read enriched Sales_Data_Master from Output/
 *   2. Filter to MATCHED rows only
 *   3. Group by partner_id
 *   4. Generate commission statement per partner (42-col Excel)
 *   5. Generate GST invoice per GST-registered partner (PDF)
 *   6. Dispatch emails in batches (respecting 1,400/day limit)
 *   7. UTR upload → mark payment confirmed
 *
 * Commission Statement: 42-col filtered projection of Sales_Data_Master
 *   Cols A-AL: selected original data fields (partner-visible only)
 *   Cols AM-AP: PO Rate % + PO Amount (x2 for dual rate)
 *
 * Tax Invoice: Programmatically generated Google Sheet → exported PDF
 *   Seller = Partner, Buyer = Broker (partner invoice)
 *   Seller = Broker, Buyer = Insurer (insurer invoice — handled in Step IV)
 */

// ── COLUMN MAPPING: Sales_Data_Master → Commission Statement ──────────────────
// Source col index (0-based) → Statement col position (0-based)
// 42 columns total in statement

var STATEMENT_COL_MAP = [
  { src: 0,   label: 'Sr. No.' },
  { src: 1,   label: 'Insurer' },
  { src: 2,   label: 'Policy Number' },
  { src: 3,   label: 'Product' },
  { src: 4,   label: 'Product Type' },
  { src: 5,   label: 'Product Sub Type' },
  { src: 6,   label: 'Product Category' },
  { src: 7,   label: 'Policy Category' },
  { src: 8,   label: 'Policy Type' },
  { src: 9,   label: 'Issue Date' },
  { src: 10,  label: 'Posp' },
  { src: 11,  label: 'Posp Id' },
  { src: 13,  label: 'Rm' },
  { src: 14,  label: 'Employee' },
  { src: 15,  label: 'Emp Id' },
  { src: 22,  label: 'Policy Start Date' },
  { src: 23,  label: 'Policy Expiry Date' },
  { src: 24,  label: 'Business Type' },
  { src: 29,  label: 'Make Month' },
  { src: 30,  label: 'Make Year' },
  { src: 31,  label: 'Vehicle Fuel Type' },
  { src: 35,  label: 'Vehicle Registration State' },
  { src: 36,  label: 'Vehicle Registration District' },
  { src: 37,  label: 'Body Type' },
  { src: 38,  label: 'Vehicle Registration Date' },
  { src: 39,  label: 'Vehicle Seating Capacity' },
  { src: 41,  label: 'Vehicle Cc' },
  { src: 46,  label: 'Insured Name' },
  { src: 87,  label: 'Total Od Add On Premium' },
  { src: 90,  label: 'Total Tp Add On Premium' },
  { src: 91,  label: 'Net Cpa Premium' },
  { src: 92,  label: 'Net Premium' },
  { src: 93,  label: 'Taxes' },
  { src: 95,  label: 'Gross Discount' },
  { src: 96,  label: 'Ncb' },
  { src: 97,  label: 'Vehicle Gvw As Per Rc' },
  { src: 110, label: 'Remarks' },
  { src: 111, label: 'System Policy Uid' },
  { src: 124, label: 'PO Rate %' },
  { src: 125, label: 'PO Amount' },
  { src: 126, label: 'PO Rate % (2)' },
  { src: 127, label: 'PO Amount (2)' }
];

// ── MAIN PAYOUT GENERATION ────────────────────────────────────────────────────

/**
 * Main payout generation entry point.
 * Generates statements and invoices for all MATCHED partners.
 * Run from Apps Script editor after commission batch is validated.
 */
function runPayoutGeneration() {
  return wrapWithErrorHandling('runPayoutGeneration', function() {

    Logger.log('=== PayoutGeneration: Starting ===');
    if (!CONFIG.CURRENT_PERIOD) {
      throw new Error('CONFIG.CURRENT_PERIOD not set.');
    }

    // Step 1: Load commission output file
    var prefix = CONFIG.BROKER_SHORT_CODE + '_Sales_Data_' + CONFIG.CURRENT_PERIOD;
    var fileId = findMostRecentFileByPrefix(CONFIG.FOLDER_OUTPUT, prefix);
    if (!fileId) {
      throw new Error('No commission output file found for ' + CONFIG.CURRENT_PERIOD +
        '. Run runCommissionBatch() first.');
    }

    var outputSS    = SpreadsheetApp.openById(fileId);
    var outputSheet = outputSS.getSheetByName('Policy_Data');
    if (!outputSheet) throw new Error('Policy_Data tab not found in output file.');

    var allData = outputSheet.getDataRange().getValues();
    // Row 0 = section headers, Row 1 = col headers, Row 2+ = data
    var dataRows = allData.slice(2);

    // Step 2: Filter to MATCHED rows only
    var matchedRows = dataRows.filter(function(row) {
      return row[128] && row[128].toString() === 'MATCHED';
    });

    Logger.log('Total rows: ' + dataRows.length +
      ', MATCHED rows: ' + matchedRows.length);

    if (matchedRows.length === 0) {
      Logger.log('No MATCHED rows — nothing to process.');
      return;
    }

    // Step 3: Load Partner Master
    var partners = getSheetDataAsObjects(CONFIG.SHEET_PARTNER_MASTER, 'Partners');
    var partnerMap = {};
    partners.forEach(function(p) {
      if (p.posp_id) partnerMap[p.posp_id.toString().trim()] = p;
    });

    // Step 4: Group matched rows by partner_id (col 11, 0-indexed)
    var partnerGroups = {};
    matchedRows.forEach(function(row) {
      var pospId = row[11] ? row[11].toString().trim() : '';
      if (!pospId) return;
      if (!partnerGroups[pospId]) partnerGroups[pospId] = [];
      partnerGroups[pospId].push(row);
    });

    var partnerIds  = Object.keys(partnerGroups);
    Logger.log('Partners to process: ' + partnerIds.length);

    // Step 5: Create period subfolder for statements
    var statementFolderId = createPeriodSubfolder(
      CONFIG.FOLDER_STATEMENTS, CONFIG.CURRENT_PERIOD);
    var invoiceFolderId   = createPeriodSubfolder(
      CONFIG.FOLDER_INVOICES_PARTNER, CONFIG.CURRENT_PERIOD);

    // Step 6: Generate statement + invoice per partner
    var statementsGenerated = 0;
    var invoicesGenerated   = 0;
    var partnerSheet = SpreadsheetApp.openById(CONFIG.SHEET_PARTNER_MASTER)
      .getSheetByName('Partners');

    partnerIds.forEach(function(pospId) {
      try {
        var partnerData = partnerMap[pospId];
        if (!partnerData) {
          Logger.log('Partner not in master (skipping): ' + pospId);
          return;
        }

        var partnerRows = partnerGroups[pospId];

        // Generate commission statement
        generatePartnerStatement(
          partnerRows, partnerData, CONFIG.CURRENT_PERIOD, statementFolderId);
        statementsGenerated++;

        // Generate GST invoice if partner is GST registered
        if (partnerData.gstin && partnerData.gstin.toString().trim() !== '') {
          generatePartnerInvoice(
            partnerRows, partnerData, CONFIG.CURRENT_PERIOD, invoiceFolderId);
          invoicesGenerated++;
        }

        // Update Partner Master: set statement_sent = PENDING
        updatePartnerField(partnerSheet, pospId, 'statement_sent', 'PENDING');

        Logger.log('Partner processed: ' + pospId +
          ' (' + partnerRows.length + ' policies)');

      } catch (partnerErr) {
        Logger.log('Error processing partner ' + pospId + ': ' + partnerErr.message);
        logError('runPayoutGeneration', 'Partner ' + pospId + ': ' + partnerErr.message, '');
      }
    });

    Logger.log('Statements generated: ' + statementsGenerated);
    Logger.log('Invoices generated:   ' + invoicesGenerated);

    // Step 7: Trigger email dispatch
    runEmailDispatch();

    // Step 8: Summary email
    if (CONFIG.EMAIL_COORDINATOR) {
      MailApp.sendEmail(
        CONFIG.EMAIL_COORDINATOR,
        'CaliberPO — Payout Generation Complete: ' + CONFIG.CURRENT_PERIOD,
        [
          'Payout generation complete for ' + CONFIG.CURRENT_PERIOD + '.',
          '',
          'Partners processed:   ' + partnerIds.length,
          'Statements generated: ' + statementsGenerated,
          'Invoices generated:   ' + invoicesGenerated,
          '',
          'Email dispatch has been triggered.',
          '— CaliberPO System'
        ].join('\n')
      );
    }

    Logger.log('=== PayoutGeneration: Complete ===');
  });
}

// ── COMMISSION STATEMENT GENERATION ──────────────────────────────────────────

/**
 * Generates a 42-column commission statement for one partner.
 * Saves as Google Sheet in Statements/[YYYY-MM]/ folder.
 *
 * @param {Array[]} partnerRows  - MATCHED rows for this partner
 * @param {Object}  partnerData  - Partner master row object
 * @param {string}  period       - "YYYY-MM"
 * @param {string}  folderId     - Destination folder ID
 * @returns {string} Created spreadsheet ID
 */
function generatePartnerStatement(partnerRows, partnerData, period, folderId) {
  try {
    var fileName = partnerData.posp_id + '_statement_' + period;
    var ss       = createSheetInFolder(folderId, fileName);
    var sheet    = ss.getSheets()[0];
    sheet.setName('Statement');

    // Row 1: Section headers
    var sectionRow = new Array(42).fill('');
    sectionRow[0]  = 'ORIGINAL SALES DATA';
    sectionRow[38] = 'COMMISSION WORKING';
    sheet.getRange(1, 1, 1, 42).setValues([sectionRow]);

    // Style section headers
    sheet.getRange(1, 1,  1, 38)
      .setBackground('#1F3864').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.getRange(1, 39, 1, 4)
      .setBackground('#375623').setFontColor('#FFFFFF').setFontWeight('bold');

    // Row 2: Column headers
    var colHeaders = STATEMENT_COL_MAP.map(function(m) { return m.label; });
    sheet.getRange(2, 1, 1, 42).setValues([colHeaders]);
    sheet.getRange(2, 1,  1, 38)
      .setBackground('#1F3864').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.getRange(2, 39, 1, 4)
      .setBackground('#375623').setFontColor('#FFFFFF').setFontWeight('bold');

    // Rows 3+: Data
    var dataRows = partnerRows.map(function(row) {
      return STATEMENT_COL_MAP.map(function(m) {
        var val = row[m.src];
        return val !== null && val !== undefined ? val : '';
      });
    });

    if (dataRows.length > 0) {
      sheet.getRange(3, 1, dataRows.length, 42).setValues(dataRows);
    }

    sheet.setFrozenRows(2);
    SpreadsheetApp.flush();

    Logger.log('Statement created: ' + fileName + ' (' + partnerRows.length + ' rows)');
    return ss.getId();

  } catch (e) {
    throw new Error('generatePartnerStatement failed [' + partnerData.posp_id + ']: ' + e.message);
  }
}

// ── PARTNER GST INVOICE GENERATION ───────────────────────────────────────────

/**
 * Generates a GST tax invoice for a GST-registered partner.
 * Seller = Partner, Buyer = Broker.
 * Exports as PDF to Invoices/Partner/[YYYY-MM]/ folder.
 *
 * @param {Array[]} partnerRows  - MATCHED rows for this partner
 * @param {Object}  partnerData  - Partner master row object
 * @param {string}  period       - "YYYY-MM"
 * @param {string}  folderId     - Destination folder ID
 * @returns {string} PDF file ID
 */
function generatePartnerInvoice(partnerRows, partnerData, period, folderId) {
  try {
    // Calculate gross commission
    var grossCommission = 0;
    partnerRows.forEach(function(row) {
      grossCommission += normalisePremium(row[125]); // DV: PO Amount
      grossCommission += normalisePremium(row[127]); // DX: PO Amount (2)
    });
    grossCommission = Math.round(grossCommission * 100) / 100;

    // Determine GST type (intra-state = CGST+SGST, inter-state = IGST)
    var partnerStateCode = (partnerData.partner_state_code || '').toString().trim();
    var brokerStateCode  = (CONFIG.BROKER_STATE_CODE       || '').toString().trim();
    var isSameState      = partnerStateCode !== '' &&
                           brokerStateCode  !== '' &&
                           partnerStateCode === brokerStateCode;

    var gstRate   = CONFIG.DEFAULT_GST_RATE || 0.18;
    var halfRate  = gstRate / 2;
    var taxAmount = Math.round(grossCommission * gstRate  * 100) / 100;
    var halfTax   = Math.round(grossCommission * halfRate * 100) / 100;
    var total     = Math.round((grossCommission + taxAmount) * 100) / 100;

    // Get invoice number
    var invoiceNum = incrementCounter(CONFIG.SHEET_BROKER_CONFIG, 'PARTNER_INVOICE_COUNTER');
    var invoiceNo  = (CONFIG.PARTNER_INVOICE_PREFIX || 'INV') + '/' +
      String(invoiceNum).padStart(4, '0');

    var invoiceDate = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy');

    // Create invoice sheet
    var fileName = partnerData.posp_id + '_invoice_' + period;
    var ss       = createSheetInFolder(folderId, fileName);
    var sheet    = ss.getSheets()[0];
    sheet.setName('Invoice');

    // Build invoice layout
    buildInvoiceLayout(sheet, {
      title:         'Tax Invoice',
      invoiceNo:     invoiceNo,
      invoiceDate:   invoiceDate,
      supplierRef:   partnerData.posp_id || '',

      // Seller = Partner
      sellerName:    partnerData.partner_legal_name || partnerData.posp_name || '',
      sellerAddress: partnerData.partner_address    || '',
      sellerGstin:   partnerData.gstin              || '',
      sellerState:   partnerData.partner_state      || '',
      sellerCode:    partnerData.partner_state_code || '',
      sellerEmail:   partnerData.partner_email      || '',

      // Buyer = Broker
      buyerName:     CONFIG.BROKER_LEGAL_NAME  || '',
      buyerAddress:  CONFIG.BROKER_ADDRESS     || '',
      buyerGstin:    CONFIG.BROKER_GSTIN       || '',
      buyerState:    CONFIG.BROKER_STATE       || '',
      buyerCode:     CONFIG.BROKER_STATE_CODE  || '',

      // Line item
      sacCode:       CONFIG.SAC_CODE           || '997131',
      description:   'Commission for ' + period + ' — ' + CONFIG.BROKER_SHORT_CODE,
      amount:        grossCommission,

      // Tax
      isSameState:   isSameState,
      gstRate:       gstRate,
      halfRate:      halfRate,
      taxAmount:     taxAmount,
      halfTax:       halfTax,
      total:         total,

      // Footer
      pan:           partnerData.partner_pan    || '[PAN]',
      bankName:      partnerData.bank_name      || '[Bank Name]',
      accountNo:     partnerData.account_number || '[Account No]',
      ifsc:          partnerData.ifsc_code      || '[IFSC]',
      signatoryName: partnerData.partner_legal_name || partnerData.posp_name || ''
    });

    SpreadsheetApp.flush();

    // Export as PDF then trash the working sheet
    var pdfId = exportSheetAsPDF(ss.getId(), 'Invoice', fileName, folderId);
    DriveApp.getFileById(ss.getId()).setTrashed(true);

    Logger.log('Partner invoice created: ' + invoiceNo + ' — total: ' + total);
    return pdfId;

  } catch (e) {
    throw new Error('generatePartnerInvoice failed [' + partnerData.posp_id + ']: ' + e.message);
  }
}

// ── INVOICE LAYOUT BUILDER ────────────────────────────────────────────────────

/**
 * Builds the GST invoice layout in a Google Sheet.
 * Used for both partner invoices and insurer invoices.
 *
 * @param {Sheet}  sheet - Google Sheet to write into
 * @param {Object} data  - Invoice data object
 */
function buildInvoiceLayout(sheet, data) {
  try {
    // Set column widths
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 80);
    sheet.setColumnWidth(4, 100);
    sheet.setColumnWidth(5, 100);
    sheet.setColumnWidth(6, 100);
    sheet.setColumnWidth(7, 120);

    var r = 1; // current row tracker

    // ── Title ──
    sheet.getRange(r, 1, 1, 7).merge()
      .setValue(data.title || 'Tax Invoice')
      .setFontSize(14).setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBackground('#1F3864').setFontColor('#FFFFFF');
    r++;

    // ── Seller + Invoice metadata side by side ──
    sheet.getRange(r, 1).setValue('Seller').setFontWeight('bold');
    sheet.getRange(r, 4).setValue('Invoice No.').setFontWeight('bold');
    sheet.getRange(r, 5, 1, 3).merge().setValue(data.invoiceNo);
    r++;

    sheet.getRange(r, 1, 1, 3).merge().setValue(data.sellerName).setFontWeight('bold');
    sheet.getRange(r, 4).setValue('Date').setFontWeight('bold');
    sheet.getRange(r, 5, 1, 3).merge().setValue(data.invoiceDate);
    r++;

    sheet.getRange(r, 1, 1, 3).merge().setValue(data.sellerAddress);
    sheet.getRange(r, 4).setValue('Supplier Ref.').setFontWeight('bold');
    sheet.getRange(r, 5, 1, 3).merge().setValue(data.supplierRef);
    r++;

    sheet.getRange(r, 1, 1, 3).merge()
      .setValue('GSTIN: ' + data.sellerGstin);
    r++;

    sheet.getRange(r, 1, 1, 3).merge()
      .setValue('State: ' + data.sellerState + '  Code: ' + data.sellerCode);
    r++;

    sheet.getRange(r, 1, 1, 3).merge()
      .setValue('Email: ' + data.sellerEmail);
    r++;

    // ── Buyer block ──
    sheet.getRange(r, 1).setValue('Buyer').setFontWeight('bold');
    r++;

    sheet.getRange(r, 1, 1, 6).merge().setValue(data.buyerName).setFontWeight('bold');
    r++;

    sheet.getRange(r, 1, 1, 6).merge().setValue(data.buyerAddress);
    r++;

    sheet.getRange(r, 1, 1, 6).merge()
      .setValue('GSTIN: ' + data.buyerGstin +
        '   State: ' + data.buyerState + '   Code: ' + data.buyerCode);
    r++;

    r++; // spacer

    // ── Line items table header ──
    var tableHeaders = ['Sl No.', 'Description of Goods', 'HSN/SAC',
      'Qty', 'Rate', 'Per', 'Amount (₹)'];
    var hRange = sheet.getRange(r, 1, 1, 7);
    hRange.setValues([tableHeaders]);
    hRange.setFontWeight('bold')
      .setBackground('#1F3864').setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
    r++;

    // ── Line item 1: Service ──
    sheet.getRange(r, 1).setValue('1');
    sheet.getRange(r, 2).setValue(data.description);
    sheet.getRange(r, 3).setValue(data.sacCode);
    sheet.getRange(r, 4).setValue('');
    sheet.getRange(r, 5).setValue('');
    sheet.getRange(r, 6).setValue('');
    sheet.getRange(r, 7).setValue(data.amount).setNumberFormat('#,##0.00');
    r++;

    // ── Tax lines ──
    if (data.isSameState) {
      sheet.getRange(r, 2).setValue('CGST ' + (data.halfRate * 100) + '%');
      sheet.getRange(r, 5).setValue(data.halfRate * 100 + '%');
      sheet.getRange(r, 7).setValue(data.halfTax).setNumberFormat('#,##0.00');
      r++;
      sheet.getRange(r, 2).setValue('SGST ' + (data.halfRate * 100) + '%');
      sheet.getRange(r, 5).setValue(data.halfRate * 100 + '%');
      sheet.getRange(r, 7).setValue(data.halfTax).setNumberFormat('#,##0.00');
      r++;
    } else {
      sheet.getRange(r, 2).setValue('IGST ' + (data.gstRate * 100) + '%');
      sheet.getRange(r, 5).setValue(data.gstRate * 100 + '%');
      sheet.getRange(r, 7).setValue(data.taxAmount).setNumberFormat('#,##0.00');
      r++;
    }

    // ── Total row ──
    sheet.getRange(r, 1, 1, 6).merge()
      .setValue('Total').setFontWeight('bold')
      .setHorizontalAlignment('right');
    sheet.getRange(r, 7).setValue(data.total)
      .setFontWeight('bold').setNumberFormat('#,##0.00');
    r++;

    r++; // spacer

    // ── Amount in words ──
    sheet.getRange(r, 1, 1, 7).merge()
      .setValue('Amount Chargeable (in words): ' + numberToWords(data.total))
      .setFontStyle('italic');
    r++;

    r++; // spacer

    // ── Tax summary table ──
    var taxHeaders = ['HSN/SAC', 'Taxable Value', 'Central Tax Rate', 'Central Tax Amt',
      'State Tax Rate', 'State Tax Amt', 'Total Tax'];
    sheet.getRange(r, 1, 1, 7).setValues([taxHeaders])
      .setFontWeight('bold').setBackground('#e8eaf6');
    r++;

    if (data.isSameState) {
      sheet.getRange(r, 1, 1, 7).setValues([[
        data.sacCode, data.amount,
        (data.halfRate * 100) + '%', data.halfTax,
        (data.halfRate * 100) + '%', data.halfTax,
        data.taxAmount
      ]]);
    } else {
      sheet.getRange(r, 1, 1, 7).setValues([[
        data.sacCode, data.amount,
        (data.gstRate * 100) + '%', data.taxAmount,
        '0%', 0, data.taxAmount
      ]]);
    }
    r++;

    sheet.getRange(r, 1).setValue('Total').setFontWeight('bold');
    sheet.getRange(r, 2).setValue(data.amount).setFontWeight('bold');
    sheet.getRange(r, 7).setValue(data.taxAmount).setFontWeight('bold');
    r++;

    r++; // spacer

    // ── Tax amount in words ──
    sheet.getRange(r, 1, 1, 7).merge()
      .setValue('Tax Amount (in words): ' + numberToWords(data.taxAmount))
      .setFontStyle('italic');
    r++;

    r++; // spacer

    // ── Footer: PAN + Bank details ──
    sheet.getRange(r, 1, 1, 3).merge()
      .setValue("Company's PAN: " + data.pan).setFontWeight('bold');
    sheet.getRange(r, 4, 1, 4).merge()
      .setValue("Company's Bank Details").setFontWeight('bold');
    r++;

    sheet.getRange(r, 4, 1, 4).merge().setValue('Bank Name: ' + data.bankName);
    r++;
    sheet.getRange(r, 4, 1, 4).merge().setValue('A/c No.: ' + data.accountNo);
    r++;
    sheet.getRange(r, 4, 1, 4).merge().setValue('IFSC Code: ' + data.ifsc);
    r++;

    r++; // spacer

    // ── Declaration + Signatory ──
    sheet.getRange(r, 1, 1, 4).merge()
      .setValue('Declaration: We declare that this invoice shows the actual price ' +
        'of the goods described and that all particulars are true and correct.')
      .setFontStyle('italic').setWrap(true);
    sheet.getRange(r, 5, 1, 3).merge()
      .setValue('For ' + data.signatoryName)
      .setFontWeight('bold').setHorizontalAlignment('center');
    r++;

    sheet.getRange(r, 5, 1, 3).merge()
      .setValue('Director / Authorised Signatory')
      .setHorizontalAlignment('center').setFontStyle('italic');

    // ── Border entire invoice ──
    sheet.getRange(1, 1, r, 7).setBorder(
      true, true, true, true, true, true,
      '#cccccc', SpreadsheetApp.BorderStyle.SOLID);

  } catch (e) {
    throw new Error('buildInvoiceLayout failed: ' + e.message);
  }
}

// ── EMAIL DISPATCH ────────────────────────────────────────────────────────────

/**
 * Dispatches commission statements and invoices to partners.
 * Respects EMAIL_BATCH_SIZE (1,400/day) limit.
 * Reads Partner Master for rows where statement_sent = "PENDING".
 */
function runEmailDispatch() {
  return wrapWithErrorHandling('runEmailDispatch', function() {

    Logger.log('runEmailDispatch: starting');
    var partners = getSheetDataAsObjects(CONFIG.SHEET_PARTNER_MASTER, 'Partners');
    var partnerSheet = SpreadsheetApp.openById(CONFIG.SHEET_PARTNER_MASTER)
      .getSheetByName('Partners');

    var pending = partners.filter(function(p) {
      return p.statement_sent === 'PENDING' && p.partner_email;
    });

    Logger.log('Partners pending dispatch: ' + pending.length);

    var batchSize = CONFIG.EMAIL_BATCH_SIZE || 1400;
    var sent      = 0;

    for (var i = 0; i < pending.length; i++) {
      if (sent >= batchSize) {
        Logger.log('Batch limit reached (' + batchSize + '). Remaining marked BATCH_QUEUED.');
        for (var j = i; j < pending.length; j++) {
          updatePartnerField(partnerSheet, pending[j].posp_id,
            'statement_sent', 'BATCH_QUEUED');
        }
        break;
      }

      var partner = pending[i];
      try {
        // Find statement file
        var statementFolderId = createPeriodSubfolder(
          CONFIG.FOLDER_STATEMENTS, CONFIG.CURRENT_PERIOD);
        var statementFileId = findFileInFolder(
          statementFolderId,
          partner.posp_id + '_statement_' + CONFIG.CURRENT_PERIOD);

        // Find invoice PDF (optional)
        var invoiceFolderId = createPeriodSubfolder(
          CONFIG.FOLDER_INVOICES_PARTNER, CONFIG.CURRENT_PERIOD);
        var invoiceFileId = findFileInFolder(
          invoiceFolderId,
          partner.posp_id + '_invoice_' + CONFIG.CURRENT_PERIOD + '.pdf');

        // Build attachments
        var attachments = [];
        if (statementFileId) {
          attachments.push(DriveApp.getFileById(statementFileId).getBlob());
        }
        if (invoiceFileId) {
          attachments.push(DriveApp.getFileById(invoiceFileId).getBlob());
        }

        // Send email
        var subject = 'Commission Statement — ' + CONFIG.BROKER_SHORT_CODE +
          ' — ' + CONFIG.CURRENT_PERIOD;
        var body = [
          'Dear ' + (partner.posp_name || partner.posp_id) + ',',
          '',
          'Please find your commission statement for ' + CONFIG.CURRENT_PERIOD + ' attached.',
          (invoiceFileId ? 'Your GST invoice is also attached.' : ''),
          '',
          'For any queries please contact your relationship manager.',
          '',
          'Regards,',
          CONFIG.BROKER_NAME || CONFIG.BROKER_SHORT_CODE
        ].join('\n');

        GmailApp.sendEmail(partner.partner_email, subject, body, {
          from:        CONFIG.EMAIL_SENDER,
          attachments: attachments
        });

        updatePartnerField(partnerSheet, partner.posp_id, 'statement_sent', 'Y');
        sent++;

        Logger.log('Statement sent: ' + partner.posp_id +
          ' → ' + partner.partner_email);

      } catch (sendErr) {
        Logger.log('Email failed for ' + partner.posp_id + ': ' + sendErr.message);
        logError('runEmailDispatch',
          'Partner ' + partner.posp_id + ': ' + sendErr.message, '');
        updatePartnerField(partnerSheet, partner.posp_id,
          'statement_sent', 'EMAIL_ERROR');
      }
    }

    Logger.log('runEmailDispatch: ' + sent + ' emails sent');
    return { sent: sent };
  });
}

// ── UTR UPLOAD PROCESSING ─────────────────────────────────────────────────────

/**
 * Processes UTR numbers uploaded to the Partner Master.
 * Marks payment_date for partners where utr_number is filled
 * but payment_date is blank.
 * Run after coordinator enters UTR numbers in Partner Master.
 */
function processUTRUpload() {
  return wrapWithErrorHandling('processUTRUpload', function() {

    Logger.log('processUTRUpload: starting');
    var partners = getSheetDataAsObjects(CONFIG.SHEET_PARTNER_MASTER, 'Partners');
    var partnerSheet = SpreadsheetApp.openById(CONFIG.SHEET_PARTNER_MASTER)
      .getSheetByName('Partners');

    var today     = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy');
    var confirmed = 0;

    partners.forEach(function(partner) {
      var hasUTR     = partner.utr_number  &&
                       partner.utr_number.toString().trim() !== '';
      var noPaidDate = !partner.payment_date ||
                       partner.payment_date.toString().trim() === '';
      if (hasUTR && noPaidDate) {
        updatePartnerField(partnerSheet, partner.posp_id, 'payment_date', today);
        logInfo('processUTRUpload',
          'Payment confirmed: ' + partner.posp_id +
          ' UTR: ' + partner.utr_number);
        confirmed++;
      }
    });

    var msg = confirmed + ' payment(s) confirmed for ' + CONFIG.CURRENT_PERIOD;
    Logger.log('processUTRUpload: ' + msg);

    if (CONFIG.EMAIL_COORDINATOR) {
      MailApp.sendEmail(CONFIG.EMAIL_COORDINATOR,
        'CaliberPO — Payments Confirmed: ' + CONFIG.CURRENT_PERIOD, msg);
    }

    return { confirmed: confirmed };
  });
}

// ── PARTNER MASTER HELPER ─────────────────────────────────────────────────────

/**
 * Updates a single field for a partner in the Partner Master sheet.
 *
 * @param {Sheet}  sheet     - Partner Master sheet object
 * @param {string} pospId    - POSP ID to find
 * @param {string} fieldName - Column header name to update
 * @param {*}      value     - New value
 */
function updatePartnerField(sheet, pospId, fieldName, value) {
  try {
    var data    = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) {
      return h ? h.toString().trim() : '';
    });
    var colIdx = headers.indexOf(fieldName);
    if (colIdx === -1) {
      Logger.log('updatePartnerField: column not found: ' + fieldName);
      return;
    }

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] &&
          data[i][0].toString().trim() === pospId.toString().trim()) {
        sheet.getRange(i + 1, colIdx + 1).setValue(value);
        SpreadsheetApp.flush();
        return;
      }
    }
    Logger.log('updatePartnerField: partner not found: ' + pospId);
  } catch (e) {
    Logger.log('updatePartnerField failed: ' + e.message);
  }
}
