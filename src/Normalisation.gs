/**
 * CaliberPO — Normalisation Engine
 *
 * Pure utility functions for data normalisation and derivation.
 * No Drive, Sheet, or Config access — pure input → output transforms.
 * Called by CommissionApplication.gs, RateLookup.gs, and setup.gs.
 *
 * All functions:
 *   - Wrapped in try/catch
 *   - Return null (or false for boolean) on failure
 *   - Log warnings with function name and input value on failure
 */

// ── RTO NORMALISATION ─────────────────────────────────────────────────────────

/**
 * Normalises an RTO code to XX-00 hyphenated format.
 *
 * Examples:
 *   "MH01"   → "MH-01"
 *   "AN-01"  → "AN-01"  (passthrough — already correct)
 *   "UP 32"  → "UP-32"
 *   "MH1"    → "MH-01"  (zero-padded)
 *   "mh01"   → "MH-01"  (uppercased)
 *
 * @param {string} code - Raw RTO code in any format
 * @returns {string|null} Normalised XX-00 code, or null if unparseable
 */
function normaliseRTO(code) {
  try {
    if (!code || code.toString().trim() === '') return null;

    var cleaned = code.toString().trim().toUpperCase().replace(/\s+/g, '');

    // Already in correct XX-00 format
    if (/^[A-Z]{2}-\d{2,}$/.test(cleaned)) return cleaned;

    // XX00 format — insert hyphen
    var match = cleaned.match(/^([A-Z]{2})(\d+)$/);
    if (match) {
      var alpha = match[1];
      var num   = match[2].padStart(2, '0');
      return alpha + '-' + num;
    }

    // Hyphen present but wrong padding e.g. MH-1
    var matchHyphen = cleaned.match(/^([A-Z]{2})-(\d+)$/);
    if (matchHyphen) {
      return matchHyphen[1] + '-' + matchHyphen[2].padStart(2, '0');
    }

    Logger.log('normaliseRTO: unrecognised format — returning as-is: ' + code);
    return cleaned;

  } catch (e) {
    Logger.log('normaliseRTO failed for input "' + code + '": ' + e.message);
    return null;
  }
}

// ── DATE NORMALISATION ────────────────────────────────────────────────────────

/**
 * Normalises a date string to YYYY-MM-DD format.
 * Auto-detects format if inputFormat not provided.
 *
 * Supported input formats:
 *   "DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY",
 *   "DD-MMM-YYYY" (e.g. "01-Apr-2026"), JavaScript Date objects
 *
 * @param {string|Date} dateStr - Date in any supported format
 * @param {string} [inputFormat] - Optional format hint
 * @returns {string|null} "YYYY-MM-DD" string, or null if unparseable
 */
function normaliseDate(dateStr, inputFormat) {
  try {
    if (!dateStr) return null;

    // Already a Date object (e.g. from Sheets cell)
    if (dateStr instanceof Date) {
      if (isNaN(dateStr.getTime())) return null;
      return Utilities.formatDate(dateStr, 'UTC', 'yyyy-MM-dd');
    }

    var s = dateStr.toString().trim();
    if (s === '') return null;

    var d, m, y;

    // Try specified format first
    if (inputFormat) {
      var result = parseDateByFormat_(s, inputFormat);
      if (result) return result;
    }

    // Auto-detect: YYYY-MM-DD (ISO) — check first as most unambiguous
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var parts = s.split('-');
      y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]);
      if (isValidDate_(y, m, d)) return s;
    }

    // DD-MM-YYYY or DD/MM/YYYY
    var dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      d = parseInt(dmyMatch[1]); m = parseInt(dmyMatch[2]); y = parseInt(dmyMatch[3]);
      if (isValidDate_(y, m, d)) {
        return y + '-' + pad2_(m) + '-' + pad2_(d);
      }
    }

    // DD-MMM-YYYY (e.g. 01-Apr-2026)
    var dmmyMatch = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})$/);
    if (dmmyMatch) {
      d = parseInt(dmmyMatch[1]);
      m = monthNameToNum_(dmmyMatch[2]);
      y = parseInt(dmmyMatch[3]);
      if (m && isValidDate_(y, m, d)) {
        return y + '-' + pad2_(m) + '-' + pad2_(d);
      }
    }

    // Try JavaScript Date parsing as last resort
    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, 'UTC', 'yyyy-MM-dd');
    }

    Logger.log('normaliseDate: could not parse "' + dateStr + '"');
    return null;

  } catch (e) {
    Logger.log('normaliseDate failed for input "' + dateStr + '": ' + e.message);
    return null;
  }
}

function parseDateByFormat_(s, format) {
  try {
    var parts;
    if (format === 'DD-MM-YYYY' || format === 'DD/MM/YYYY') {
      parts = s.split(/[\/\-]/);
      if (parts.length === 3) {
        var d = parseInt(parts[0]), m = parseInt(parts[1]), y = parseInt(parts[2]);
        if (isValidDate_(y, m, d)) return y + '-' + pad2_(m) + '-' + pad2_(d);
      }
    }
    if (format === 'YYYY-MM-DD') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    }
    if (format === 'MM/DD/YYYY') {
      parts = s.split('/');
      if (parts.length === 3) {
        var m2 = parseInt(parts[0]), d2 = parseInt(parts[1]), y2 = parseInt(parts[2]);
        if (isValidDate_(y2, m2, d2)) return y2 + '-' + pad2_(m2) + '-' + pad2_(d2);
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function monthNameToNum_(name) {
  var months = {
    jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
    jul:7, aug:8, sep:9, oct:10, nov:11, dec:12
  };
  return months[name.toLowerCase().substring(0, 3)] || null;
}

function isValidDate_(y, m, d) {
  if (!y || !m || !d) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  if (y < 1900 || y > 2100) return false;
  return true;
}

function pad2_(n) {
  return n < 10 ? '0' + n : '' + n;
}

// ── GVW NORMALISATION ─────────────────────────────────────────────────────────

/**
 * Normalises GVW to tonnes.
 * If CONFIG.GVW_UNIT = "kg" then divides by 1000.
 * If CONFIG.GVW_UNIT = "tonnes" then returns as-is.
 *
 * @param {string|number} value - GVW value (may have commas)
 * @param {string} unit - "tonnes" or "kg"
 * @returns {number|null} GVW in tonnes, or null if unparseable
 */
function normaliseGVW(value, unit) {
  try {
    if (value === null || value === undefined || value === '') return null;
    var cleaned = value.toString().replace(/,/g, '').trim();
    var num = parseFloat(cleaned);
    if (isNaN(num)) {
      Logger.log('normaliseGVW: could not parse value "' + value + '"');
      return null;
    }
    if ((unit || 'tonnes').toLowerCase() === 'kg') {
      return Math.round((num / 1000) * 1000) / 1000; // 3 decimal places
    }
    return num;
  } catch (e) {
    Logger.log('normaliseGVW failed for input "' + value + '": ' + e.message);
    return null;
  }
}

// ── PREMIUM NORMALISATION ─────────────────────────────────────────────────────

/**
 * Normalises a premium value to a float rounded to 2 decimal places.
 * Returns 0 if null, blank, or non-numeric.
 *
 * @param {string|number} value - Premium value (may have commas)
 * @returns {number} Premium as float, 0 if unparseable
 */
function normalisePremium(value) {
  try {
    if (value === null || value === undefined || value === '') return 0;
    var cleaned = value.toString().replace(/,/g, '').trim();
    var num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return Math.round(num * 100) / 100;
  } catch (e) {
    Logger.log('normalisePremium failed for input "' + value + '": ' + e.message);
    return 0;
  }
}

// ── VEHICLE AGE DERIVATION ────────────────────────────────────────────────────

/**
 * Derives vehicle age category from make year.
 * Current year vehicles = "New". Prior years = "Old".
 * Uses current year dynamically — never hardcoded.
 *
 * @param {string|number} makeYear - Vehicle manufacture year
 * @returns {string} "New" or "Old", or null if makeYear unparseable
 */
function deriveVehicleAge(makeYear) {
  try {
    if (!makeYear) return null;
    var year = parseInt(makeYear.toString().trim());
    if (isNaN(year)) {
      Logger.log('deriveVehicleAge: could not parse year "' + makeYear + '"');
      return null;
    }
    var currentYear = new Date().getFullYear();
    return year >= currentYear ? 'New' : 'Old';
  } catch (e) {
    Logger.log('deriveVehicleAge failed for input "' + makeYear + '": ' + e.message);
    return null;
  }
}

// ── SUB-SUB-TYPE DERIVATION ───────────────────────────────────────────────────

/**
 * Derives product_sub_sub_type from vehicle model name
 * using keyword rules from the Derivation_Rules config tab.
 *
 * @param {string} model - Vehicle model name
 * @param {Array} derivationRules - Array of {keyword, derived_value} objects
 * @returns {string|null} "Scooter", "Bike", or null if no keyword match
 */
function deriveSubSubType(model, derivationRules) {
  try {
    if (!model || !derivationRules || derivationRules.length === 0) return null;
    var modelUpper = model.toString().toUpperCase();
    for (var i = 0; i < derivationRules.length; i++) {
      var rule = derivationRules[i];
      if (!rule.keyword) continue;
      if (modelUpper.indexOf(rule.keyword.toString().toUpperCase()) !== -1) {
        return rule.derived_value || null;
      }
    }
    return null;
  } catch (e) {
    Logger.log('deriveSubSubType failed for model "' + model + '": ' + e.message);
    return null;
  }
}

// ── VEHICLE PARAMETER MATCHING ────────────────────────────────────────────────

/**
 * Checks if a numeric value falls within a range (inclusive both ends).
 * Blank/null lower = 0. Blank/null upper = 999999.
 *
 * Used for CC range (TW), GVW range (GCV/Tractor), Seating (PCV).
 *
 * @param {number} value - The vehicle parameter value
 * @param {string|number} lower - Lower limit (inclusive), blank = 0
 * @param {string|number} upper - Upper limit (inclusive), blank = 999999
 * @returns {boolean} true if value is within range
 */
function matchVehicleParam(value, lower, upper) {
  try {
    if (value === null || value === undefined || value === '') return false;

    var val = parseFloat(value.toString().replace(/,/g, ''));
    if (isNaN(val)) return false;

    var lo = (lower === null || lower === undefined || lower === '')
      ? 0
      : parseFloat(lower.toString().replace(/,/g, ''));

    var hi = (upper === null || upper === undefined || upper === '')
      ? 999999
      : parseFloat(upper.toString().replace(/,/g, ''));

    if (isNaN(lo)) lo = 0;
    if (isNaN(hi)) hi = 999999;

    return val >= lo && val <= hi;

  } catch (e) {
    Logger.log('matchVehicleParam failed for value "' + value + '": ' + e.message);
    return false;
  }
}

// ── PRODUCT VERTICAL DERIVATION ───────────────────────────────────────────────

/**
 * Derives product_vertical from CaliberPO canonical product_type.
 *
 * @param {string} productType - Canonical product_type (TW, Pvt Car, GCV, PCV, Tractor, Construction Eqpt)
 * @returns {string} "Motor" or "Misc D"
 */
function deriveProductVertical(productType) {
  try {
    if (!productType) return 'Motor';
    var miscD = ['Tractor', 'Construction Eqpt'];
    return miscD.indexOf(productType.toString().trim()) !== -1 ? 'Misc D' : 'Motor';
  } catch (e) {
    Logger.log('deriveProductVertical failed for "' + productType + '": ' + e.message);
    return 'Motor';
  }
}

// ── GRID TAB NAME ─────────────────────────────────────────────────────────────

/**
 * Returns the grid tab name for a given product type and period.
 *
 * Tab prefix mapping:
 *   TW               → "TW"
 *   Pvt Car          → "Pvt Car"
 *   GCV              → "GCV"
 *   PCV              → "PCV"
 *   Tractor          → "Misc D"
 *   Construction Eqpt → "Misc D"
 *
 * @param {string} productType - CaliberPO canonical product_type
 * @param {string} period - "YYYY-MM" period string
 * @returns {string} Tab name e.g. "TW_2026-08"
 */
function getGridTabName(productType, period) {
  try {
    var prefixMap = {
      'TW':                'TW',
      'Pvt Car':           'Pvt Car',
      'GCV':               'GCV',
      'PCV':               'PCV',
      'Tractor':           'Misc D',
      'Construction Eqpt': 'Misc D'
    };
    var prefix = prefixMap[productType] || productType;
    return prefix + '_' + period;
  } catch (e) {
    Logger.log('getGridTabName failed for "' + productType + '", "' + period + '": ' + e.message);
    return null;
  }
}

// ── PERIOD DERIVATION ─────────────────────────────────────────────────────────

/**
 * Extracts YYYY-MM period string from a YYYY-MM-DD date string.
 *
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {string|null} "YYYY-MM" period string
 */
function derivePeriod(dateStr) {
  try {
    if (!dateStr) return null;
    var s = dateStr.toString().trim();
    var match = s.match(/^(\d{4}-\d{2})/);
    return match ? match[1] : null;
  } catch (e) {
    Logger.log('derivePeriod failed for "' + dateStr + '": ' + e.message);
    return null;
  }
}

// ── NUMBER TO WORDS ───────────────────────────────────────────────────────────

/**
 * Converts a numeric amount to Indian currency words.
 * Used for invoice "Amount in words" field.
 *
 * Examples:
 *   400000  → "INR Four Lakh Only"
 *   472000  → "INR Four Lakh Seventy Two Thousand Only"
 *   72000   → "INR Seventy Two Thousand Only"
 *   36000   → "INR Thirty Six Thousand Only"
 *
 * @param {number} amount - Numeric amount (integer or decimal)
 * @returns {string} Amount in words
 */
function numberToWords(amount) {
  try {
    if (!amount && amount !== 0) return '';

    var num = Math.round(parseFloat(amount));
    if (num === 0) return 'INR Zero Only';

    var ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
      'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
      'Seventeen','Eighteen','Nineteen'];
    var tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

    function twoDigits(n) {
      if (n < 20) return ones[n];
      return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    }

    function threeDigits(n) {
      if (n < 100) return twoDigits(n);
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
    }

    var parts = [];
    var crore = Math.floor(num / 10000000);
    var lakh  = Math.floor((num % 10000000) / 100000);
    var thou  = Math.floor((num % 100000) / 1000);
    var rest  = num % 1000;

    if (crore) parts.push(twoDigits(crore) + ' Crore');
    if (lakh)  parts.push(twoDigits(lakh)  + ' Lakh');
    if (thou)  parts.push(twoDigits(thou)  + ' Thousand');
    if (rest)  parts.push(threeDigits(rest));

    return 'INR ' + parts.join(' ') + ' Only';

  } catch (e) {
    Logger.log('numberToWords failed for "' + amount + '": ' + e.message);
    return '';
  }
}

// ── UNIT TESTS ────────────────────────────────────────────────────────────────

/**
 * Run this function from Apps Script editor to verify all normalisations.
 * Check execution log for PASS/FAIL results.
 */
function runNormalisationTests() {
  var tests = [
    // normaliseRTO
    { fn: 'normaliseRTO', input: 'MH01',   expected: 'MH-01' },
    { fn: 'normaliseRTO', input: 'AN-01',  expected: 'AN-01' },
    { fn: 'normaliseRTO', input: 'UP 32',  expected: 'UP-32' },
    { fn: 'normaliseRTO', input: 'mh01',   expected: 'MH-01' },
    { fn: 'normaliseRTO', input: 'MH1',    expected: 'MH-01' },
    { fn: 'normaliseRTO', input: 'MH-1',   expected: 'MH-01' },
    { fn: 'normaliseRTO', input: '',       expected: null },

    // normaliseDate
    { fn: 'normaliseDate', input: '01-04-2026',  expected: '2026-04-01' },
    { fn: 'normaliseDate', input: '2026-04-01',  expected: '2026-04-01' },
    { fn: 'normaliseDate', input: '01/04/2026',  expected: '2026-04-01' },
    { fn: 'normaliseDate', input: '01-Apr-2026', expected: '2026-04-01' },
    { fn: 'normaliseDate', input: '',            expected: null },

    // normaliseGVW
    { fn: 'normaliseGVW', input: ['1500', 'kg'],     expected: 1.5 },
    { fn: 'normaliseGVW', input: ['1,500', 'kg'],    expected: 1.5 },
    { fn: 'normaliseGVW', input: ['2.5', 'tonnes'],  expected: 2.5 },
    { fn: 'normaliseGVW', input: ['', 'tonnes'],     expected: null },

    // normalisePremium
    { fn: 'normalisePremium', input: '1,200.50', expected: 1200.50 },
    { fn: 'normalisePremium', input: '',         expected: 0 },
    { fn: 'normalisePremium', input: null,       expected: 0 },

    // matchVehicleParam
    { fn: 'matchVehicleParam', input: [125, 100, 150],  expected: true },
    { fn: 'matchVehicleParam', input: [100, 100, 150],  expected: true },
    { fn: 'matchVehicleParam', input: [150, 100, 150],  expected: true },
    { fn: 'matchVehicleParam', input: [99,  100, 150],  expected: false },
    { fn: 'matchVehicleParam', input: [151, 100, 150],  expected: false },
    { fn: 'matchVehicleParam', input: [125, '',  ''],   expected: true },
    { fn: 'matchVehicleParam', input: ['',  100, 150],  expected: false },

    // deriveVehicleAge
    { fn: 'deriveVehicleAge', input: new Date().getFullYear(),     expected: 'New' },
    { fn: 'deriveVehicleAge', input: new Date().getFullYear() - 1, expected: 'Old' },
    { fn: 'deriveVehicleAge', input: 2020,                        expected: 'Old' },

    // deriveProductVertical
    { fn: 'deriveProductVertical', input: 'TW',               expected: 'Motor' },
    { fn: 'deriveProductVertical', input: 'GCV',              expected: 'Motor' },
    { fn: 'deriveProductVertical', input: 'Tractor',          expected: 'Misc D' },
    { fn: 'deriveProductVertical', input: 'Construction Eqpt',expected: 'Misc D' },

    // getGridTabName
    { fn: 'getGridTabName', input: ['TW', '2026-08'],               expected: 'TW_2026-08' },
    { fn: 'getGridTabName', input: ['Pvt Car', '2026-08'],          expected: 'Pvt Car_2026-08' },
    { fn: 'getGridTabName', input: ['Tractor', '2026-08'],          expected: 'Misc D_2026-08' },
    { fn: 'getGridTabName', input: ['Construction Eqpt', '2026-08'],expected: 'Misc D_2026-08' },

    // derivePeriod
    { fn: 'derivePeriod', input: '2026-08-15', expected: '2026-08' },
    { fn: 'derivePeriod', input: '',           expected: null },

    // numberToWords
    { fn: 'numberToWords', input: 400000, expected: 'INR Four Lakh Only' },
    { fn: 'numberToWords', input: 472000, expected: 'INR Four Lakh Seventy Two Thousand Only' },
    { fn: 'numberToWords', input: 72000,  expected: 'INR Seventy Two Thousand Only' },
    { fn: 'numberToWords', input: 36000,  expected: 'INR Thirty Six Thousand Only' },
    { fn: 'numberToWords', input: 0,      expected: 'INR Zero Only' }
  ];

  var passed = 0;
  var failed = 0;

  tests.forEach(function(test) {
    try {
      var result;
      var input = test.input;

      if (test.fn === 'normaliseRTO')              result = normaliseRTO(input);
      else if (test.fn === 'normaliseDate')        result = normaliseDate(input);
      else if (test.fn === 'normaliseGVW')         result = normaliseGVW(input[0], input[1]);
      else if (test.fn === 'normalisePremium')     result = normalisePremium(input);
      else if (test.fn === 'matchVehicleParam')    result = matchVehicleParam(input[0], input[1], input[2]);
      else if (test.fn === 'deriveVehicleAge')     result = deriveVehicleAge(input);
      else if (test.fn === 'deriveProductVertical')result = deriveProductVertical(input);
      else if (test.fn === 'getGridTabName')       result = getGridTabName(input[0], input[1]);
      else if (test.fn === 'derivePeriod')         result = derivePeriod(input);
      else if (test.fn === 'numberToWords')        result = numberToWords(input);

      var pass = JSON.stringify(result) === JSON.stringify(test.expected);
      if (pass) {
        passed++;
        Logger.log('PASS: ' + test.fn + '(' + JSON.stringify(input) + ') → ' + JSON.stringify(result));
      } else {
        failed++;
        Logger.log('FAIL: ' + test.fn + '(' + JSON.stringify(input) + ')');
        Logger.log('  Expected: ' + JSON.stringify(test.expected));
        Logger.log('  Got:      ' + JSON.stringify(result));
      }
    } catch (e) {
      failed++;
      Logger.log('ERROR: ' + test.fn + ' threw: ' + e.message);
    }
  });

  Logger.log('');
  Logger.log('=== TEST RESULTS: ' + passed + ' passed, ' + failed + ' failed ===');
}
