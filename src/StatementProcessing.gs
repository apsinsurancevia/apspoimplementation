/**
 * CaliberPO — Insurer Statement Processing
 *
 * Step IV of the CaliberPO pipeline.
 *
 * Flow:
 *   1. Receive insurer statement file (PDF or Excel) from Drive
 *   2. Extract content — text layer first, image fallback for scanned PDFs
 *   3. Send to Claude API with insurer-specific prompt from Config Sheet
 *   4. Claude returns raw extracted data as JSON array
 *   5. Generate insurer GST invoice (Broker → Insurer)
 *   6. Create statement summary Excel
 *   7. Email invoice + summary to EMAIL_FINANCE
 *
 * Claude extracts exactly what is in the statement.
 * No normalisation, no standardisation at this stage.
 * QC and reconciliation happen in Step V.
 */

// ── MAIN ENTRY POINT ──────────────────────────────────────────────────────────

/**
 * Main entry point for insurer statement processing.
 * Run from Apps Script editor with insurer ID and Drive file ID.
 *
 * @param {string} insurerId - CaliberPO insurer ID e.g. "OR", "NIC"
 * @param {string} fileId    - Drive file ID of the statement
 */
function processInsurerStatement(insurerId, fileId) {
  return wrapWithErrorHandling('processInsurerStatement', function() {

    Logger.log('=== processInsurerStatement: ' + insurerId + ' ===');
    if (!insurerId) throw new Error('insurerId is required');
    if (!fileId)    throw new Error('fileId is required');
    if (!CONFIG.CURRENT_PERIOD) throw new Error('CONFIG.CURRENT_PERIOD not set');

    // Step 1: Get insurer details
    var insurers = getSheetDataAsObjects(CONFIG.SHEET_INSURER_MASTER, 'Insurers');
    var insurerData = null;
    for (var i = 0; i < insurers.length; i++) {
      if (insurers[i].insurer_id === insurerId) {
        insurerData = insurers[i];
        break;
      }
    }
    if (!insurerData) {
      throw new Error('Insurer not found in Insurer Master: ' + insurerId);
    }
    Logger.log('Insurer: ' + insurerData.insurer_name);

    // Step 2: Get extraction prompt
    var prompts = getSheetDataAsObjects(CONFIG.SHEET_BROKER_CONFIG, 'Prompts');
    var promptTemplate = null;
    for (var j = 0; j < prompts.length; j++) {
      if (prompts[j].insurer_id === insurerId) {
        promptTemplate = prompts[j].prompt_template;
        break;
      }
    }
    if (!promptTemplate) {
      throw new Error(
        'No extraction prompt found for insurer: ' + insurerId +
        '. Add a row to the Prompts tab in the Broker Config Sheet.'
      );
    }

    // Step 3: Extract statement content
    Logger.log('Extracting statement content...');
    var extracted = extractStatementContent(fileId, insurerId);
    Logger.log('Extraction method: ' + extracted.type +
      ', content length: ' + extracted.content.length);

    // Step 4: Call Claude API
    Logger.log('Calling Claude API...');
    var statementData = extractViaClaudeAPI(
      extracted.content, promptTemplate, extracted.type, extracted.mimeType
    );
    Logger.log('Claude extracted ' + statementData.length + ' rows');

    if (!statementData || statementData.length === 0) {
      throw new Error(
        'Claude API returned no data. Check statement content and prompt template.');
    }

    // Step 5: Create period subfolders
    var invoiceFolderId = createPeriodSubfolder(
      CONFIG.FOLDER_INVOICES_INSURER, CONFIG.CURRENT_PERIOD);

    // Step 6: Generate insurer invoice
    Logger.log('Generating insurer invoice...');
    var invoicePdfId = generateInsurerInvoice(
      insurerId, insurerData, statementData, CONFIG.CURRENT_PERIOD, invoiceFolderId);

    // Step 7: Create statement summary Excel
    Logger.log('Creating statement summary...');
    var summaryFileId = createStatementSummary(
      insurerId, statementData, CONFIG.CURRENT_PERIOD, invoiceFolderId);

    // Step 8: Email to finance
    Logger.log('Emailing to finance...');
    emailInsurerInvoice(insurerId, insurerData, invoicePdfId, summaryFileId);

    Logger.log('=== processInsurerStatement complete: ' + insurerId + ' ===');
    return {
      insurerId:     insurerId,
      rowsExtracted: statementData.length,
      invoicePdfId:  invoicePdfId,
      summaryFileId: summaryFileId
    };
  });
}

// ── CONTENT EXTRACTION ────────────────────────────────────────────────────────

/**
 * Extracts content from an insurer statement file.
 * Attempt 1: Drive text export (works for Excel, text-layer PDFs).
 * Attempt 2: Image export (for scanned PDFs).
 *
 * @param {string} fileId    - Drive file ID
 * @param {string} insurerId - For logging only
 * @returns {Object} { type: "text"|"image", content: string, mimeType: string }
 */
function extractStatementContent(fileId, insurerId) {
  try {
    var file     = DriveApp.getFileById(fileId);
    var mimeType = file.getMimeType();
    var token    = ScriptApp.getOAuthToken();

    Logger.log('File MIME type: ' + mimeType);

    // ── Attempt 1: Text export ──────────────────────────────────────────────
    var textContent = '';
    try {
      var exportUrl;

      if (mimeType === MimeType.GOOGLE_SHEETS ||
          mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          mimeType === 'application/vnd.ms-excel') {
        exportUrl = 'https://docs.google.com/spreadsheets/d/' + fileId +
          '/export?format=csv';
      } else if (mimeType === MimeType.PDF || mimeType === 'application/pdf') {
        exportUrl = 'https://www.googleapis.com/drive/v3/files/' +
          fileId + '/export?mimeType=text/plain';
      } else {
        exportUrl = 'https://www.googleapis.com/drive/v3/files/' +
          fileId + '?alt=media';
      }

      var textResponse = UrlFetchApp.fetch(exportUrl, {
        headers:            { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
      });

      if (textResponse.getResponseCode() === 200) {
        textContent = textResponse.getContentText();
      }
    } catch (textErr) {
      Logger.log('Text export attempt failed: ' + textErr.message);
    }

    // If text content is substantial (>200 chars) use it
    if (textContent && textContent.trim().length > 200) {
      Logger.log('Using text extraction (' + textContent.length + ' chars)');
      return { type: 'text', content: textContent, mimeType: 'text/plain' };
    }

    // ── Attempt 2: Image/binary export (for scanned PDFs) ──────────────────
    Logger.log('Text extraction insufficient — attempting image extraction');

    if (CONFIG.EMAIL_COORDINATOR) {
      try {
        MailApp.sendEmail(
          CONFIG.EMAIL_COORDINATOR,
          'CaliberPO — Scanned PDF detected: ' + insurerId,
          'Statement for ' + insurerId + ' (file ID: ' + fileId + ') ' +
          'appears to be a scanned document. ' +
          'Using image extraction via Claude API vision.'
        );
      } catch (mailErr) {
        Logger.log('Notification email failed: ' + mailErr.message);
      }
    }

    // Get file as blob and encode as base64
    var fileBlob   = file.getBlob();
    var base64Data = Utilities.base64Encode(fileBlob.getBytes());

    var imageMime = (mimeType === MimeType.PDF || mimeType === 'application/pdf')
      ? 'application/pdf'
      : 'image/png';

    Logger.log('Image extraction: base64 length = ' + base64Data.length);
    return { type: 'image', content: base64Data, mimeType: imageMime };

  } catch (e) {
    throw new Error('extractStatementContent failed: ' + e.message);
  }
}

// ── CLAUDE API EXTRACTION ─────────────────────────────────────────────────────

/**
 * Sends statement content to Claude API for data extraction.
 * Returns array of extracted objects exactly as Claude returns them.
 * No normalisation — raw extraction only.
 *
 * @param {string} content        - Statement content (text or base64)
 * @param {string} promptTemplate - Extraction prompt from Config Sheet
 * @param {string} contentType    - "text" or "image"
 * @param {string} mimeType       - MIME type for image content
 * @returns {Array} Extracted data array e.g. [{policy_no, brokerage_amount}, ...]
 */
function extractViaClaudeAPI(content, promptTemplate, contentType, mimeType) {
  try {
    var apiKey = PropertiesService.getScriptProperties()
      .getProperty('CLAUDE_API_KEY');
    if (!apiKey) {
      throw new Error(
        'CLAUDE_API_KEY not found in Script Properties. ' +
        'Go to Project Settings → Script Properties → add CLAUDE_API_KEY.'
      );
    }

    // Build message content block
    var messageContent;
    if (contentType === 'text') {
      messageContent = [
        { type: 'text', text: promptTemplate + '\n\n' + content }
      ];
    } else {
      messageContent = [
        {
          type:   'image',
          source: {
            type:       'base64',
            media_type: mimeType || 'image/png',
            data:       content
          }
        },
        { type: 'text', text: promptTemplate }
      ];
    }

    var requestBody = {
      model:      CONFIG.CLAUDE_MODEL      || 'claude-sonnet-4-6',
      max_tokens: CONFIG.CLAUDE_MAX_TOKENS || 4096,
      system: [
        'You are a data extraction assistant for an insurance commission system.',
        'Extract the exact data as it appears in the document.',
        'Do not normalise, standardise, or modify any values.',
        'Return only valid JSON — no markdown, no code blocks, no explanation.',
        'If you cannot extract data, return an empty array: []'
      ].join(' '),
      messages: [
        { role: 'user', content: messageContent }
      ]
    };

    Logger.log('Calling Claude API: ' + (CONFIG.CLAUDE_MODEL || 'claude-sonnet-4-6'));

    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method:  'post',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload:            JSON.stringify(requestBody),
      muteHttpExceptions: true
    });

    var responseCode = response.getResponseCode();
    Logger.log('Claude API response code: ' + responseCode);

    if (responseCode !== 200) {
      throw new Error(
        'Claude API error ' + responseCode + ': ' + response.getContentText()
      );
    }

    var responseBody = JSON.parse(response.getContentText());

    // Extract text from response content blocks
    var rawText = '';
    if (responseBody.content && responseBody.content.length > 0) {
      for (var i = 0; i < responseBody.content.length; i++) {
        if (responseBody.content[i].type === 'text') {
          rawText = responseBody.content[i].text;
          break;
        }
      }
    }

    if (!rawText) throw new Error('Claude API returned empty response');

    Logger.log('Claude raw response length: ' + rawText.length);

    // Strip markdown code fences if present
    var cleanText = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    var parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (parseErr) {
      // Fallback: find JSON array anywhere in the response
      var arrayMatch = cleanText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        parsed = JSON.parse(arrayMatch[0]);
      } else {
        throw new Error(
          'Could not parse Claude response as JSON. Raw: ' +
          cleanText.substring(0, 500)
        );
      }
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Claude response is not an array. Got: ' + typeof parsed);
    }

    Logger.log('Claude extracted ' + parsed.length + ' items');
    return parsed;

  } catch (e) {
    throw new Error('extractViaClaudeAPI failed: ' + e.message);
  }
}

// ── STATEMENT SUMMARY ─────────────────────────────────────────────────────────

/**
 * Creates a summary Excel of extracted statement data.
 * Saved to Invoices/Insurer/[YYYY-MM]/ folder.
 *
 * @param {string} insurerId     - Insurer ID
 * @param {Array}  statementData - Extracted data array from Claude
 * @param {string} period        - "YYYY-MM"
 * @param {string} folderId      - Destination folder ID
 * @returns {string} Created spreadsheet ID
 */
function createStatementSummary(insurerId, statementData, period, folderId) {
  try {
    var fileName = insurerId + '_statement_summary_' + period;
    var ss       = createSheetInFolder(folderId, fileName);
    var sheet    = ss.getSheets()[0];
    sheet.setName('Summary');

    if (!statementData || statementData.length === 0) return ss.getId();

    // Derive headers from first extracted row's keys
    var headers     = Object.keys(statementData[0]);
    var fullHeaders = ['insurer_id', 'period'].concat(headers);

    sheet.getRange(1, 1, 1, fullHeaders.length).setValues([fullHeaders]);
    styleHeaderRow(sheet, 1, fullHeaders.length, '#1a1a2e', '#FFFFFF');
    sheet.setFrozenRows(1);

    var dataRows = statementData.map(function(item) {
      var row = [insurerId, period];
      headers.forEach(function(h) {
        row.push(item[h] !== undefined ? item[h] : '');
      });
      return row;
    });

    if (dataRows.length > 0) {
      sheet.getRange(2, 1, dataRows.length, fullHeaders.length).setValues(dataRows);
    }

    // Add totals row if brokerage_amount column exists
    var amtIdx = headers.indexOf('brokerage_amount');
    if (amtIdx !== -1) {
      var total = statementData.reduce(function(sum, item) {
        return sum + (parseFloat(item.brokerage_amount) || 0);
      }, 0);
      var totalRow      = new Array(fullHeaders.length).fill('');
      totalRow[0]       = 'TOTAL';
      totalRow[amtIdx + 2] = Math.round(total * 100) / 100;
      var lastRow       = dataRows.length + 2;
      sheet.getRange(lastRow, 1, 1, fullHeaders.length).setValues([totalRow]);
      sheet.getRange(lastRow, 1, 1, fullHeaders.length)
        .setFontWeight('bold').setBackground('#f0f0f0');
    }

    SpreadsheetApp.flush();
    Logger.log('Statement summary created: ' + fileName);
    return ss.getId();

  } catch (e) {
    throw new Error('createStatementSummary failed: ' + e.message);
  }
}

// ── INSURER INVOICE GENERATION ────────────────────────────────────────────────

/**
 * Generates a GST tax invoice from Broker to Insurer.
 * Seller = Broker, Buyer = Insurer.
 * Exports as PDF to Invoices/Insurer/[YYYY-MM]/ folder.
 *
 * @param {string} insurerId     - Insurer ID
 * @param {Object} insurerData   - Insurer Master row
 * @param {Array}  statementData - Extracted statement data
 * @param {string} period        - "YYYY-MM"
 * @param {string} folderId      - Destination folder ID
 * @returns {string} PDF file ID
 */
function generateInsurerInvoice(insurerId, insurerData,
                                 statementData, period, folderId) {
  try {
    // Sum brokerage from extracted statement
    var grossBrokerage = statementData.reduce(function(sum, item) {
      return sum + (parseFloat(item.brokerage_amount) || 0);
    }, 0);
    grossBrokerage = Math.round(grossBrokerage * 100) / 100;

    // Determine GST type
    var brokerStateCode  = (CONFIG.BROKER_STATE_CODE         || '').toString().trim();
    var insurerStateCode = (insurerData.insurer_state_code   || '').toString().trim();
    var isSameState      = brokerStateCode  !== '' &&
                           insurerStateCode !== '' &&
                           brokerStateCode === insurerStateCode;

    var gstRate   = CONFIG.DEFAULT_GST_RATE || 0.18;
    var halfRate  = gstRate / 2;
    var taxAmount = Math.round(grossBrokerage * gstRate  * 100) / 100;
    var halfTax   = Math.round(grossBrokerage * halfRate * 100) / 100;
    var total     = Math.round((grossBrokerage + taxAmount) * 100) / 100;

    // Get invoice number
    var invoiceNum = incrementCounter(
      CONFIG.SHEET_BROKER_CONFIG, 'INSURER_INVOICE_COUNTER');
    var invoiceNo  = (CONFIG.INSURER_INVOICE_PREFIX || 'INV-I') + '/' +
      String(invoiceNum).padStart(4, '0');

    var invoiceDate = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MMM-yyyy');

    // Create working sheet
    var fileName = insurerId + '_invoice_' + period;
    var ss       = createSheetInFolder(folderId, fileName);
    var sheet    = ss.getSheets()[0];
    sheet.setName('Invoice');

    // Reuse shared invoice layout builder from PayoutGeneration.gs
    buildInvoiceLayout(sheet, {
      title:         'Tax Invoice',
      invoiceNo:     invoiceNo,
      invoiceDate:   invoiceDate,
      supplierRef:   CONFIG.IRDAI_REG_NUMBER || '',

      // Seller = Broker
      sellerName:    CONFIG.BROKER_LEGAL_NAME      || '',
      sellerAddress: CONFIG.BROKER_ADDRESS         || '',
      sellerGstin:   CONFIG.BROKER_GSTIN           || '',
      sellerState:   CONFIG.BROKER_STATE           || '',
      sellerCode:    CONFIG.BROKER_STATE_CODE      || '',
      sellerEmail:   CONFIG.EMAIL_SENDER           || '',

      // Buyer = Insurer
      buyerName:     insurerData.insurer_name         || '',
      buyerAddress:  insurerData.insurer_address      || '',
      buyerGstin:    insurerData.insurer_gstin        || '',
      buyerState:    insurerData.insurer_state        || '',
      buyerCode:     insurerData.insurer_state_code   || '',

      // Line item
      sacCode:       CONFIG.SAC_CODE                  || '997131',
      description:   'Brokerage for ' + period + ' — ' + insurerData.insurer_name,
      amount:        grossBrokerage,

      // Tax
      isSameState:   isSameState,
      gstRate:       gstRate,
      halfRate:      halfRate,
      taxAmount:     taxAmount,
      halfTax:       halfTax,
      total:         total,

      // Footer
      pan:           CONFIG.BROKER_PAN           || '[PAN]',
      bankName:      CONFIG.BROKER_BANK_NAME     || '[Bank Name]',
      accountNo:     CONFIG.BROKER_BANK_ACCOUNT  || '[Account No]',
      ifsc:          CONFIG.BROKER_BANK_IFSC     || '[IFSC]',
      signatoryName: CONFIG.BROKER_LEGAL_NAME    || ''
    });

    SpreadsheetApp.flush();

    // Export PDF and trash working sheet
    var pdfId = exportSheetAsPDF(ss.getId(), 'Invoice', fileName, folderId);
    DriveApp.getFileById(ss.getId()).setTrashed(true);

    Logger.log('Insurer invoice created: ' + invoiceNo +
      ' — total: ' + total + ' (' + insurerId + ')');
    return pdfId;

  } catch (e) {
    throw new Error('generateInsurerInvoice failed [' + insurerId + ']: ' + e.message);
  }
}

// ── EMAIL DISPATCH ────────────────────────────────────────────────────────────

/**
 * Emails insurer invoice and statement summary to EMAIL_FINANCE.
 *
 * @param {string} insurerId     - Insurer ID
 * @param {Object} insurerData   - Insurer Master row
 * @param {string} invoicePdfId  - PDF file ID
 * @param {string} summaryFileId - Summary spreadsheet ID
 */
function emailInsurerInvoice(insurerId, insurerData, invoicePdfId, summaryFileId) {
  try {
    if (!CONFIG.EMAIL_FINANCE) {
      Logger.log('EMAIL_FINANCE not set — skipping invoice email');
      return;
    }

    var attachments = [];
    if (invoicePdfId) {
      attachments.push(DriveApp.getFileById(invoicePdfId).getBlob());
    }
    if (summaryFileId) {
      attachments.push(
        SpreadsheetApp.openById(summaryFileId).getBlob()
          .setName(insurerId + '_statement_summary_' +
            CONFIG.CURRENT_PERIOD + '.xlsx')
      );
    }

    var currentInvoiceNum = getCounterValue(
      CONFIG.SHEET_BROKER_CONFIG, 'INSURER_INVOICE_COUNTER');

    var subject = 'Insurer Invoice — ' + insurerId + ' — ' + CONFIG.CURRENT_PERIOD;
    var body = [
      'Please find attached the brokerage invoice and statement summary for:',
      '',
      'Insurer:  ' + insurerData.insurer_name,
      'Period:   ' + CONFIG.CURRENT_PERIOD,
      'Invoice:  ' + (CONFIG.INSURER_INVOICE_PREFIX || 'INV-I') + '/' +
        String(currentInvoiceNum).padStart(4, '0'),
      '',
      'Please forward to the insurer SPOC for processing.',
      '',
      '— CaliberPO System'
    ].join('\n');

    GmailApp.sendEmail(CONFIG.EMAIL_FINANCE, subject, body, {
      from:        CONFIG.EMAIL_SENDER || '',
      attachments: attachments
    });

    Logger.log('Invoice email sent to ' + CONFIG.EMAIL_FINANCE);

  } catch (e) {
    Logger.log('emailInsurerInvoice failed: ' + e.message);
    logError('emailInsurerInvoice', e.message, e.stack || '');
  }
}

// ── PROMPT MANAGEMENT HELPERS ─────────────────────────────────────────────────

/**
 * Lists all insurers that have extraction prompts configured.
 * Run from Apps Script editor to check prompt setup.
 */
function listConfiguredPrompts() {
  try {
    var prompts = getSheetDataAsObjects(CONFIG.SHEET_BROKER_CONFIG, 'Prompts');
    Logger.log('Configured extraction prompts:');
    if (!prompts || prompts.length === 0) {
      Logger.log('  NONE — add rows to Prompts tab in Broker Config Sheet');
      return [];
    }
    prompts.forEach(function(p) {
      Logger.log('  ' + p.insurer_id + ': ' +
        (p.prompt_template || '').substring(0, 80) + '...');
    });
    return prompts.map(function(p) { return p.insurer_id; });
  } catch (e) {
    Logger.log('listConfiguredPrompts failed: ' + e.message);
  }
}

/**
 * Tests Claude API connectivity without processing a real statement.
 * Run from Apps Script editor to verify API key is working.
 */
function testClaudeAPIConnection() {
  try {
    var apiKey = PropertiesService.getScriptProperties()
      .getProperty('CLAUDE_API_KEY');
    if (!apiKey) {
      Logger.log('FAIL: CLAUDE_API_KEY not set in Script Properties');
      return false;
    }

    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify({
        model:      CONFIG.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Reply with: {"status":"ok"}' }
        ]
      }),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code === 200) {
      var body = JSON.parse(response.getContentText());
      Logger.log('Claude API connection: OK');
      Logger.log('Model: ' + (body.model || 'unknown'));
      Logger.log('Response: ' +
        (body.content && body.content[0] ? body.content[0].text : 'empty'));
      return true;
    } else {
      Logger.log('Claude API connection FAILED: HTTP ' + code);
      Logger.log(response.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log('testClaudeAPIConnection failed: ' + e.message);
    return false;
  }
}
