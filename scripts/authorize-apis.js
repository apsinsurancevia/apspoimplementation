/**
 * Authorize Rate/GridRun by running a setup function via Apps Script Execution API,
 * then probe /exec. Uses clasp OAuth from ~/.clasprc.json (not printed).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const CLASPRC = path.join(process.env.USERPROFILE || process.env.HOME, '.clasprc.json');
const RATE_SCRIPT = '1-H0hwycds6ezI98VKQsv1ZRLSAV1AZ7xjSG8FWa2dJjn7h0KzLK4Sxyj';
const GRID_SCRIPT = '1LFJdwOxsWXH4MIivXXWYbqr78GgJBA6_MGWA0sVyfIaqguY7iH4JwpdP';
const MAIN_SCRIPT = '15qyIZVXoKqUEfqRBGWqUs-OAjAsYfP_2kQJsbQlZ8VAc9k-nKExc6N2J';
const MAIN_EXEC = 'https://script.google.com/macros/s/AKfycbyTM-OpjCtov-a_CCRaN9qZZ9n2xWkHd_w0TDKUtAdk3Ez8bkCDymsRaVldPMcVb9XK/exec';
const RATE_EXEC = 'https://script.google.com/macros/s/AKfycbxrxaVP--oxPF32qoKU5uui6Q-AbUmvjB7nip9SGsAPFdk1NrXx8XWWE61FmauAhWk_/exec';
const GRID_EXEC = 'https://script.google.com/macros/s/AKfycbyoPL3ZxYkt8aUKZxmeVzY_JhAq9MewDEjCSVu_R5B1sncUmYr86hLOfV8GE5Rv6EdiEg/exec';

function req(method, urlStr, { token, body, headers, form } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = form || (body ? JSON.stringify(body) : null);
    const h = { ...(headers || {}) };
    if (token) h.Authorization = `Bearer ${token}`;
    if (payload && form) {
      h['Content-Type'] = 'application/x-www-form-urlencoded';
      h['Content-Length'] = Buffer.byteLength(payload);
    } else if (payload) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: h
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function getToken() {
  const rc = JSON.parse(fs.readFileSync(CLASPRC, 'utf8'));
  const t = rc.tokens.default;
  const form = new URLSearchParams({
    client_id: t.client_id,
    client_secret: t.client_secret,
    refresh_token: t.refresh_token,
    grant_type: 'refresh_token'
  }).toString();
  const res = await req('POST', 'https://oauth2.googleapis.com/token', { form });
  const j = JSON.parse(res.body);
  if (!j.access_token) throw new Error('token refresh failed: ' + res.body.slice(0, 200));
  return j.access_token;
}

async function scriptsRun(token, scriptId, functionName, parameters) {
  const res = await req('POST', `https://script.googleapis.com/v1/scripts/${scriptId}:run`, {
    token,
    body: { function: functionName, parameters: parameters || [], devMode: true }
  });
  let j = null;
  try { j = JSON.parse(res.body); } catch (_) {}
  return { status: res.status, body: res.body.slice(0, 800), json: j };
}

async function probe(url) {
  const res = await req('GET', url, { headers: { 'User-Agent': 'caliberpo-authorize' } });
  return { status: res.status, snippet: res.body.slice(0, 180) };
}

async function shareLibraryAnyone(token, scriptId) {
  // Script projects appear as Drive files with the same ID for many accounts
  const res = await req('POST', `https://www.googleapis.com/drive/v3/files/${scriptId}/permissions`, {
    token,
    body: { role: 'reader', type: 'anyone' }
  });
  return { status: res.status, body: res.body.slice(0, 300) };
}

async function main() {
  const token = await getToken();
  const libId = '1zswvxtu96FtsICvO06_Rngtp9Kq-o7nMmu_igeKwnN61weruLxvgN_-c';
  console.log('share GridEngine library…');
  console.log(await shareLibraryAnyone(token, libId));

  for (const [name, id, fn] of [
    ['rate', RATE_SCRIPT, 'authorizeDeployment'],
    ['grid', GRID_SCRIPT, 'authorizeDeployment'],
    ['main', MAIN_SCRIPT, 'authorizeMainProperties']
  ]) {
    console.log(`\nrun ${name}.${fn}`);
    const r = await scriptsRun(token, id, fn, []);
    console.log('status', r.status);
    if (r.json && r.json.error) console.log('error', JSON.stringify(r.json.error).slice(0, 400));
    else if (r.json && r.json.response) console.log('response', JSON.stringify(r.json.response).slice(0, 400));
    else console.log(r.body.slice(0, 400));
  }

  // Configure Rate/GridRun from Main bootstrap keys
  console.log('\nmain bootstrap…');
  const boot = await req('GET', `${MAIN_EXEC}?action=bootstrap&key=${encodeURIComponent('caliberpo-aps-bootstrap-2026')}`, {
    headers: { 'User-Agent': 'caliberpo-authorize' }
  });
  let bj = null;
  try { bj = JSON.parse(boot.body); } catch (_) {}
  console.log('boot status', boot.status, 'success', bj && bj.success);

  if (bj && bj.success) {
    const rateQs = new URLSearchParams({
      action: 'bootstrap',
      bootstrapKey: bj.rateApiKey,
      RATE_API_KEY: bj.rateApiKey,
      FOLDER_GRIDS: bj.folders.GRIDS || '',
      SHEET_INSURER_MASTER: bj.sheets.INSURER_MASTER || ''
    });
    const gridQs = new URLSearchParams({
      action: 'bootstrap',
      bootstrapKey: bj.gridRunApiKey,
      GRID_RUN_API_KEY: bj.gridRunApiKey,
      FOLDER_GRIDS: bj.folders.GRIDS || '',
      SHEET_INSURER_MASTER: bj.sheets.INSURER_MASTER || ''
    });
    console.log('probe/bootstrap rate…', await probe(`${RATE_EXEC}?${rateQs}`));
    console.log('probe/bootstrap grid…', await probe(`${GRID_EXEC}?${gridQs}`));
  } else {
    console.log('probe rate…', await probe(`${RATE_EXEC}?api=true`));
    console.log('probe grid…', await probe(`${GRID_EXEC}?api=true`));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
