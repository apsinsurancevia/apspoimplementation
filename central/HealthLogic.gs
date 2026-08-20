/**
 * CaliberPO CommandCentre — Health Logic
 *
 * Pure functions. No sheet access, no external calls.
 * Takes a broker row object (keyed by Broker_Status column names),
 * returns { status: 'Green'|'Amber'|'Red', reason: string }.
 */

/**
 * Computes health status for a single broker.
 * Red rules: first match wins and returns immediately.
 * Amber rules: all evaluated; returns Amber if any match.
 *
 * @param {Object} b - Broker row with these keys:
 *   trigger_health, sync_age_mins, api_failures_24h,
 *   commission_last_status, commission_last_error, commission_last_run,
 *   payout_last_status, payout_last_error, payout_last_run,
 *   statement_last_status, statement_last_error, statement_last_run,
 *   reconciliation_last_status
 * @returns {{ status: string, reason: string }}
 */
function computeHealth(b) {
  var syncAgeMins = parseInt(b.sync_age_mins)    || 0;
  var apiFailures = parseInt(b.api_failures_24h) || 0;

  // ── RED CONDITIONS ────────────────────────────────────────────────────────
  // First match returns immediately.

  // 1. Trigger not firing
  if (b.trigger_health === 'STALE' || b.trigger_health === 'MISSING') {
    return { status: 'Red', reason: 'Monitoring trigger not firing in broker workspace' };
  }

  // 2. No signal for over 2 hours
  if (syncAgeMins > 120) {
    return { status: 'Red', reason: 'No signal received for over 2 hours' };
  }

  // 3. Commission batch failed
  if (b.commission_last_status === 'FAILED') {
    return {
      status: 'Red',
      reason: 'Commission batch failed: ' + (b.commission_last_error || 'unknown error')
    };
  }

  // 4. Payout failed
  if (b.payout_last_status === 'FAILED') {
    return {
      status: 'Red',
      reason: 'Payout generation failed: ' + (b.payout_last_error || 'unknown error')
    };
  }

  // 5. Statement failed within last 2 hours
  if (b.statement_last_status === 'FAILED' && b.statement_last_run) {
    var stMinsAgo = (new Date() - new Date(b.statement_last_run)) / 60000;
    if (stMinsAgo <= 120) {
      return {
        status: 'Red',
        reason: 'Statement processing failed: ' + (b.statement_last_error || 'unknown error')
      };
    }
  }

  // 6. Claude API failing repeatedly
  if (apiFailures >= 3) {
    return {
      status: 'Red',
      reason: 'Claude API failing — ' + apiFailures + ' failures in 24h'
    };
  }

  // ── AMBER CONDITIONS ──────────────────────────────────────────────────────
  // All evaluated; collected and joined.

  var amberReasons = [];

  // 1. Signal delayed > 30 mins but ≤ 120
  if (syncAgeMins > 30) {
    amberReasons.push('Signal delayed — last received ' + syncAgeMins + ' mins ago');
  }

  // 2. Commission stuck in STARTED for > 2 hours
  if (b.commission_last_status === 'STARTED' && b.commission_last_run) {
    if ((new Date() - new Date(b.commission_last_run)) / 60000 > 120) {
      amberReasons.push('Commission batch appears stuck — started over 2 hours ago');
    }
  }

  // 3. Payout stuck in STARTED for > 2 hours
  if (b.payout_last_status === 'STARTED' && b.payout_last_run) {
    if ((new Date() - new Date(b.payout_last_run)) / 60000 > 120) {
      amberReasons.push('Payout generation appears stuck — started over 2 hours ago');
    }
  }

  // 4. Intermittent API failures
  if (apiFailures >= 1) {
    amberReasons.push('Claude API intermittent — ' + apiFailures + ' failure(s) in 24h');
  }

  if (amberReasons.length > 0) {
    return { status: 'Amber', reason: amberReasons.join('; ') };
  }

  return { status: 'Green', reason: '' };
}
