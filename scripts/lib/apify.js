'use strict';

const APIFY_API_ROOT = 'https://api.apify.com/v2';
const DIAGNOSTIC_RESULT_TYPE = 'diagnostic';

function normalizeActorId(actorId) {
  if (
    typeof actorId !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*(?:[~/][A-Za-z0-9][A-Za-z0-9_-]*)?$/.test(actorId)
  ) {
    throw new Error('Invalid Apify Actor ID. Use an Actor ID or owner/name slug.');
  }

  return actorId.replace('/', '~');
}

function requirePositiveInteger(value, name, maximum) {
  const exceedsMaximum = maximum !== undefined && value > maximum;
  if (!Number.isInteger(value) || value <= 0 || exceedsMaximum) {
    const range = maximum !== undefined
      ? ` between 1 and ${maximum}`
      : ' greater than 0';
    throw new Error(`${name} must be an integer${range}.`);
  }

  return value;
}

function resolveChargeLimit(value) {
  if (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return undefined;
  }

  const chargeLimit = Number(value);
  if (!Number.isFinite(chargeLimit) || chargeLimit <= 0) {
    throw new Error('APIFY_MAX_TOTAL_CHARGE_USD must be a positive number.');
  }

  return chargeLimit;
}

function buildActorRunUrl(actorId, options = {}) {
  const timeout = options.timeout === undefined ? 300 : options.timeout;
  requirePositiveInteger(timeout, 'Apify timeout', 300);

  const url = new URL(
    `${APIFY_API_ROOT}/actors/${normalizeActorId(actorId)}/run-sync-get-dataset-items`
  );
  url.searchParams.set('format', 'json');
  url.searchParams.set('clean', 'true');
  url.searchParams.set('timeout', String(timeout));

  if (options.maxItems !== undefined) {
    url.searchParams.set(
      'maxItems',
      String(requirePositiveInteger(options.maxItems, 'Apify maxItems'))
    );
  }

  const chargeLimit = resolveChargeLimit(options.maxTotalChargeUsd);
  if (chargeLimit !== undefined) {
    url.searchParams.set('maxTotalChargeUsd', String(chargeLimit));
  }

  return url;
}

async function runActorDatasetItems({
  actorId,
  input,
  token = process.env.APIFY_TOKEN,
  timeout = 300,
  maxItems,
  maxTotalChargeUsd,
  fetchImpl = globalThis.fetch,
}) {
  if (!token) {
    throw new Error('APIFY_TOKEN not set. Add it to .env first.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Apify Actor input must be a JSON object.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch is unavailable. Use Node.js 20 or newer.');
  }

  const chargeLimit = maxTotalChargeUsd === undefined
    ? process.env.APIFY_MAX_TOTAL_CHARGE_USD
    : maxTotalChargeUsd;
  const url = buildActorRunUrl(actorId, {
    timeout,
    maxItems,
    maxTotalChargeUsd: chargeLimit,
  });
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      `Apify Actor ${actorId} failed with HTTP ${response.status}. Check the Actor run.`
    );
  }

  let items;
  try {
    items = await response.json();
  } catch {
    throw new Error(
      `Apify Actor ${actorId} returned invalid JSON. Check the Actor run.`
    );
  }

  if (!Array.isArray(items)) {
    throw new Error(`Apify Actor ${actorId} returned an unexpected dataset response.`);
  }

  return items;
}

function isDiagnosticRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return false;
  }

  return (
    row.resultType === DIAGNOSTIC_RESULT_TYPE ||
    row.result_type === DIAGNOSTIC_RESULT_TYPE ||
    row.type === DIAGNOSTIC_RESULT_TYPE ||
    (typeof row.id === 'string' && row.id.startsWith('diag:'))
  );
}

function splitActorRows(items) {
  if (!Array.isArray(items)) {
    throw new Error('Actor dataset items must be an array.');
  }

  const dataRows = [];
  const diagnostics = [];

  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Actor dataset rows must be JSON objects.');
    }

    if (isDiagnosticRow(item)) {
      diagnostics.push(item);
    } else {
      dataRows.push(item);
    }
  }

  return { dataRows, diagnostics };
}

function sanitizeLogText(value) {
  return String(value)
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function warnDiagnostics(label, diagnostics, warn = console.warn) {
  for (const diagnostic of diagnostics) {
    const message = sanitizeLogText(
      diagnostic.message || diagnostic.status || 'Actor returned a diagnostic row.'
    );
    warn(`[${label}] ${message}`);
  }
}

module.exports = {
  buildActorRunUrl,
  isDiagnosticRow,
  normalizeActorId,
  resolveChargeLimit,
  runActorDatasetItems,
  sanitizeLogText,
  splitActorRows,
  warnDiagnostics,
};
