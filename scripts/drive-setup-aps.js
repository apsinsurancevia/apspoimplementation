/**
 * Fresh APS Drive setup using clasp OAuth (drive.file scope).
 * Creates CaliberPO folders + master sheets, writes deploy_setup_ids.local.json
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const CLASPRC = path.join(process.env.USERPROFILE || process.env.HOME, '.clasprc.json');
const OUT = path.join(ROOT, 'deploy_setup_ids.local.json');
const EXISTING_ROOT = '1KZBvUZyt1Y8l0-hfNa6nz5SLkENEnsue';

const PRODUCT_MASTER_DATA = [
  ['Motor','TW','New (1+5)','Scooter','New Business','Y'],
  ['Motor','TW','New (1+5)','Bike','New Business','Y'],
  ['Motor','TW','New (5+5)','Scooter','New Business','Y'],
  ['Motor','TW','New (5+5)','Bike','New Business','Y'],
  ['Motor','TW','1+1','Scooter','New Business / Renewal','Y'],
  ['Motor','TW','1+1','Bike','New Business / Renewal','Y'],
  ['Motor','TW','SAOD','Scooter','New Business / Renewal','Y'],
  ['Motor','TW','SAOD','Bike','New Business / Renewal','Y'],
  ['Motor','TW','SATP','Scooter','New Business / Renewal','Y'],
  ['Motor','TW','SATP','Bike','New Business / Renewal','Y'],
  ['Motor','Pvt Car','New (1+3)','','New Business','Y'],
  ['Motor','Pvt Car','New (3+3)','','New Business','Y'],
  ['Motor','Pvt Car','1+1','','New Business / Renewal','Y'],
  ['Motor','Pvt Car','SAOD','','New Business / Renewal','Y'],
  ['Motor','Pvt Car','SATP','','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','3W','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','Water Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','Car Carrier','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','Flatbed','New Business / Renewal','Y'],
  ['Motor','GCV','1+1','Oil Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','3W','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','Water Tanker','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','Car Carrier','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','Flatbed','New Business / Renewal','Y'],
  ['Motor','GCV','SATP','Oil Tanker','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','3W','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Taxi 4+1','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Taxi 5+1','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Taxi>7','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Bus<12','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Bus>12<36','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Bus>36','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','School Bus','New Business / Renewal','Y'],
  ['Motor','PCV','1+1','Staff Bus','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','3W','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','Taxi 4+1','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','Bus<12','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','Bus>36','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','School Bus','New Business / Renewal','Y'],
  ['Motor','PCV','SATP','Staff Bus','New Business / Renewal','Y'],
  ['Misc D','Tractor','1+1','Excavator','New Business / Renewal','Y'],
  ['Misc D','Tractor','1+1','Harvester','New Business / Renewal','Y'],
  ['Misc D','Tractor','1+1','Agri Tractor','New Business / Renewal','Y'],
  ['Misc D','Tractor','SATP','Excavator','New Business / Renewal','Y'],
  ['Misc D','Tractor','SATP','Harvester','New Business / Renewal','Y'],
  ['Misc D','Tractor','SATP','Agri Tractor','New Business / Renewal','Y'],
  ['Misc D','Construction Eqpt','1+1','','New Business / Renewal','Y'],
  ['Misc D','Construction Eqpt','SATP','','New Business / Renewal','Y']
];

const INSURER_MASTER_DATA = [
  ['OR','THE ORIENTAL INSURANCE CO LTD','[GSTIN]','DELHI','DL','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['NIC','NATIONAL INSURANCE CO LTD','[GSTIN]','WEST BENGAL','WB','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['UIIC','UNITED INDIA INSURANCE CO LTD','[GSTIN]','TAMILNADU','TN','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['USGI','UNIVERSAL SOMPO GENERAL INSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['TATA','TATA AIG GENERAL INSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['BAJAJ','BAJAJ ALLIANZ GENERAL INSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['GO','GO DIGIT GENERAL INSURANCE LTD','[GSTIN]','KARNATAKA','KA','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['INDUSIND','INDUSIND GENERAL INSURANCE CO LTD','[GSTIN]','[STATE]','[CODE]','[ADDRESS]','997131','[SPOC_EMAIL]','Y'],
  ['NIA','THE NEW INDIA ASSURANCE CO LTD','[GSTIN]','MAHARASHTRA','MH','[ADDRESS]','997131','[SPOC_EMAIL]','Y']
];

function request(method, urlStr, { token, body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        if (res.statusCode >= 400) {
          reject(new Error(`${method} ${u.pathname} ${res.statusCode}: ${data.slice(0, 500)}`));
          return;
        }
        resolve({ status: res.statusCode, json, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  const rc = JSON.parse(fs.readFileSync(CLASPRC, 'utf8'));
  const t = rc.tokens.default;
  const body = new URLSearchParams({
    client_id: t.client_id,
    client_secret: t.client_secret,
    refresh_token: t.refresh_token,
    grant_type: 'refresh_token'
  }).toString();
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, (r) => {
      let data = '';
      r.on('data', (c) => (data += c));
      r.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (!j.access_token) reject(new Error(data));
          else resolve(j.access_token);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function createFolder(token, name, parentId) {
  const meta = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) meta.parents = [parentId];
  const res = await request('POST', 'https://www.googleapis.com/drive/v3/files?fields=id,name', {
    token,
    body: JSON.stringify(meta)
  });
  console.log('folder', name, res.json.id);
  return res.json.id;
}

async function createSpreadsheet(token, title, parentId) {
  const meta = {
    name: title,
    mimeType: 'application/vnd.google-apps.spreadsheet',
    parents: [parentId]
  };
  const res = await request('POST', 'https://www.googleapis.com/drive/v3/files?fields=id,name', {
    token,
    body: JSON.stringify(meta)
  });
  console.log('sheet', title, res.json.id);
  return res.json.id;
}

async function sheetsBatchUpdate(token, spreadsheetId, requests) {
  await request('POST', `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    token,
    body: JSON.stringify({ requests })
  });
}

async function sheetsValues(token, spreadsheetId, range, values) {
  await request('PUT',
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    { token, body: JSON.stringify({ values }) });
}

async function getSpreadsheet(token, spreadsheetId) {
  const res = await request('GET',
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { token });
  return res.json;
}

async function ensureTabs(token, spreadsheetId, tabs) {
  // tabs: [{ title, headers, rows? }]
  const ss = await getSpreadsheet(token, spreadsheetId);
  const existing = (ss.sheets || []).map((s) => s.properties.title);
  const requests = [];
  // rename first sheet if needed
  const first = ss.sheets && ss.sheets[0];
  if (first && tabs[0] && first.properties.title !== tabs[0].title) {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: first.properties.sheetId, title: tabs[0].title },
        fields: 'title'
      }
    });
  }
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    if (i === 0) continue;
    if (!existing.includes(t.title) && !(first && first.properties.title === t.title)) {
      // after rename, existing first title changes — check by intent
      const stillMissing = !existing.includes(t.title);
      if (stillMissing) requests.push({ addSheet: { properties: { title: t.title } } });
    }
  }
  if (requests.length) await sheetsBatchUpdate(token, spreadsheetId, requests);

  for (const t of tabs) {
    const values = [t.headers || []];
    if (t.rows && t.rows.length) values.push(...t.rows);
    if (values[0].length || values.length > 1) {
      await sheetsValues(token, spreadsheetId, `${t.title}!A1`, values.length ? values : [['']]);
    }
  }
}

async function main() {
  const token = await getAccessToken();
  const root = EXISTING_ROOT;

  const folders = {
    ROOT: root,
    MASTERS: await createFolder(token, 'Masters', root),
    CONFIG: await createFolder(token, 'Config', root),
    GRIDS: await createFolder(token, 'Grids', root),
    GRID_IMPORT: await createFolder(token, 'Grid Import', root),
    GRID_ARCHIVE: await createFolder(token, 'Grid Archive', root),
    INPUT: await createFolder(token, 'Input', root),
    OUTPUT: await createFolder(token, 'Output', root),
    STATEMENTS: await createFolder(token, 'Statements', root),
    INVOICES: await createFolder(token, 'Invoices', root),
    RECONCILIATION: await createFolder(token, 'Reconciliation', root),
    BACKUP: await createFolder(token, 'Backup', root),
    LOG: await createFolder(token, 'Log', root)
  };
  folders.INVOICES_PARTNER = await createFolder(token, 'Partner', folders.INVOICES);
  folders.INVOICES_INSURER = await createFolder(token, 'Insurer', folders.INVOICES);

  const sheets = {};
  sheets.PRODUCT_MASTER = await createSpreadsheet(token, 'Product Master', folders.MASTERS);
  await ensureTabs(token, sheets.PRODUCT_MASTER, [{
    title: 'Motor',
    headers: ['product_vertical','product_type','product_sub_type','product_sub_sub_type','policy_type','active'],
    rows: PRODUCT_MASTER_DATA
  }]);

  sheets.RTO_MASTER = await createSpreadsheet(token, 'RTO Master', folders.MASTERS);
  await ensureTabs(token, sheets.RTO_MASTER, [{
    title: 'RTO',
    headers: ['rto_id','rto_city','state_name','rto_code','state_code']
  }]);

  sheets.INSURER_MASTER = await createSpreadsheet(token, 'Insurer Master', folders.MASTERS);
  await ensureTabs(token, sheets.INSURER_MASTER, [{
    title: 'Insurers',
    headers: ['insurer_id','insurer_name','insurer_gstin','insurer_state','insurer_state_code','insurer_address','sac_code','spoc_email','active'],
    rows: INSURER_MASTER_DATA
  }]);

  sheets.BROKER_CONFIG = await createSpreadsheet(token, 'CaliberPO Config', folders.CONFIG);
  await ensureTabs(token, sheets.BROKER_CONFIG, [
    { title: 'Field_Mapping', headers: ['broker_field','standard_field','transform','notes'] },
    { title: 'Insurer_Code_Map', headers: ['broker_value','caliber_insurer_id','notes'] },
    { title: 'Product_Map', headers: ['broker_field','broker_value','caliber_field','caliber_value','notes'] },
    { title: 'Derivation_Rules', headers: ['rule_type','keyword','derived_value','notes'] },
    { title: 'Counters', headers: ['counter_name','current_value'], rows: [['PARTNER_INVOICE_COUNTER', 0], ['INSURER_INVOICE_COUNTER', 0]] },
    { title: 'Prompts', headers: ['insurer_id','prompt_template','notes'] }
  ]);

  sheets.PARTNER_MASTER = await createSpreadsheet(token, 'Partner Master', folders.CONFIG);
  await ensureTabs(token, sheets.PARTNER_MASTER, [{
    title: 'Partners',
    headers: [
      'posp_id','posp_name','dealer_name','manager','rm',
      'partner_email','partner_mobile','pan_number','gstin',
      'partner_legal_name','partner_address','partner_state','partner_state_code','partner_pan',
      'bank_account_name','bank_name','bank_branch','account_number','ifsc_code','account_type',
      'tds_rate_override','active','statement_sent','utr_number','payment_date'
    ]
  }]);

  sheets.LOG = await createSpreadsheet(token, 'CaliberPO Log', folders.LOG);
  await ensureTabs(token, sheets.LOG, [
    { title: 'Log_Active', headers: ['timestamp','function_name','caller_type','insurer_id','product_type','rto','match_type','match_status','response_ms','notes','fuel_type','yom'] },
    { title: 'Log_Summary', headers: ['period','total_calls','matched','no_match','errors','avg_response_ms'] },
    { title: 'Log_Dashboard', headers: [] },
    { title: 'processed_policies', headers: ['policy_no','period','processed_at','source_file'] },
    { title: 'Run_Log', headers: ['timestamp','function_name','trigger_type','run_status','error_message','error_function','duration_seconds'] }
  ]);

  sheets.RECONCILIATION = await createSpreadsheet(token, 'Reconciliation', folders.RECONCILIATION);
  await ensureTabs(token, sheets.RECONCILIATION, [{
    title: 'Index',
    headers: ['insurer_id','insurer_name','last_run','total_outstanding','total_variance','notes']
  }]);

  const result = {
    success: true,
    rootFolderUrl: `https://drive.google.com/drive/folders/${root}`,
    folders,
    sheets
  };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log('Wrote', OUT);
  console.log('ROOT', result.rootFolderUrl);
}

main().catch((e) => { console.error(e); process.exit(1); });
