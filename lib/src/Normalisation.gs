/**
 * CaliberPO Grid Engine Library — Normalisation
 * Pure functions. No Config, Drive, or Sheet access.
 */

function normaliseRTO(code) {
  try {
    if (!code || code.toString().trim() === '') return null;
    var cleaned = code.toString().trim().toUpperCase().replace(/\s+/g, '');
    if (/^[A-Z]{2}-\d{2,}$/.test(cleaned)) return cleaned;
    var match = cleaned.match(/^([A-Z]{2})(\d+)$/);
    if (match) return match[1] + '-' + match[2].padStart(2, '0');
    var matchHyphen = cleaned.match(/^([A-Z]{2})-(\d+)$/);
    if (matchHyphen) return matchHyphen[1] + '-' + matchHyphen[2].padStart(2, '0');
    return cleaned;
  } catch (e) { Logger.log('normaliseRTO failed: ' + e.message); return null; }
}

function normaliseDate(dateStr) {
  try {
    if (!dateStr) return null;
    if (dateStr instanceof Date) {
      if (isNaN(dateStr.getTime())) return null;
      return Utilities.formatDate(dateStr, 'UTC', 'yyyy-MM-dd');
    }
    var s = dateStr.toString().trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var p = s.split('-');
      if (isValidDate_(parseInt(p[0]), parseInt(p[1]), parseInt(p[2]))) return s;
    }
    var dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      var d = parseInt(dmy[1]), m = parseInt(dmy[2]), y = parseInt(dmy[3]);
      if (isValidDate_(y, m, d)) return y + '-' + pad2_(m) + '-' + pad2_(d);
    }
    var dmmy = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})$/);
    if (dmmy) {
      var d2 = parseInt(dmmy[1]), m2 = monthNum_(dmmy[2]), y2 = parseInt(dmmy[3]);
      if (m2 && isValidDate_(y2, m2, d2)) return y2 + '-' + pad2_(m2) + '-' + pad2_(d2);
    }
    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, 'UTC', 'yyyy-MM-dd');
    return null;
  } catch (e) { Logger.log('normaliseDate failed: ' + e.message); return null; }
}

function derivePeriod(dateStr) {
  try {
    if (!dateStr) return null;
    var match = dateStr.toString().trim().match(/^(\d{4}-\d{2})/);
    return match ? match[1] : null;
  } catch (e) { return null; }
}

function getGridTabName(productType, period) {
  try {
    var prefixMap = {
      'TW': 'TW', 'Pvt Car': 'PC', 'GCV': 'GCV',
      'PCV': 'PCV', 'Tractor': 'MiscD', 'Construction Eqpt': 'MiscD'
    };
    var prefix  = prefixMap[productType] || productType;
    var parts   = period.split('-');
    var year    = parseInt(parts[0]);
    var month   = parseInt(parts[1]);
    var fyStart = month >= 4 ? year : year - 1;
    var fyEnd   = fyStart + 1;
    return prefix + '_' + String(fyStart).slice(2) + '-' + String(fyEnd).slice(2);
  } catch (e) { Logger.log('getGridTabName failed: ' + e.message); return null; }
}

function normalisePremium(value) {
  try {
    if (value === null || value === undefined || value === '') return 0;
    var num = parseFloat(value.toString().replace(/,/g, '').trim());
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  } catch (e) { return 0; }
}

function matchVehicleParam(value, lower, upper) {
  try {
    if (value === null || value === undefined || value === '') return false;
    var val = parseFloat(value.toString().replace(/,/g, ''));
    if (isNaN(val)) return false;
    var lo = (!lower && lower !== 0) ? 0   : parseFloat(lower.toString().replace(/,/g, ''));
    var hi = (!upper && upper !== 0) ? 999999 : parseFloat(upper.toString().replace(/,/g, ''));
    if (isNaN(lo)) lo = 0;
    if (isNaN(hi)) hi = 999999;
    return val >= lo && val <= hi;
  } catch (e) { return false; }
}

function deriveVehicleAge(yom) {
  if (!yom) return '';
  return parseInt(yom) >= new Date().getFullYear() ? 'New' : 'Old';
}

function isValidDate_(y, m, d) {
  return y && m && d && m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100;
}
function pad2_(n) { return n < 10 ? '0' + n : '' + n; }
function monthNum_(name) {
  var m = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  return m[name.toLowerCase().substring(0, 3)] || null;
}
