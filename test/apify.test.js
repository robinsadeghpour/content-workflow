'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildActorRunUrl,
  runActorDatasetItems,
  splitActorRows,
  warnDiagnostics,
} = require('../scripts/lib/apify');

test('buildActorRunUrl uses a tilde Actor slug and bounded options', () => {
  const url = buildActorRunUrl('xquik/x-tweet-scraper', {
    timeout: 120,
    maxItems: 20,
    maxTotalChargeUsd: 2.5,
  });

  assert.equal(
    url.origin + url.pathname,
    'https://api.apify.com/v2/actors/xquik~x-tweet-scraper/run-sync-get-dataset-items'
  );
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    format: 'json',
    clean: 'true',
    timeout: '120',
    maxItems: '20',
    maxTotalChargeUsd: '2.5',
  });
  assert.equal(url.searchParams.has('token'), false);
});

test('runActorDatasetItems authenticates by header and returns dataset rows', async () => {
  let request;
  const input = { mode: 'search', searchTerms: ['AI'], maxItems: 1 };
  const expected = [{ id: '1', text: 'A useful test tweet' }];

  const result = await runActorDatasetItems({
    actorId: 'xquik/x-tweet-scraper',
    input,
    token: 'secret-token',
    maxItems: 1,
    maxTotalChargeUsd: 1,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => expected,
      };
    },
  });

  assert.deepEqual(result, expected);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.authorization, 'Bearer secret-token');
  assert.equal(request.options.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(request.options.body), input);
  assert.equal(request.url.toString().includes('secret-token'), false);
});

test('runActorDatasetItems rejects unsafe options before fetch', async () => {
  let called = false;

  await assert.rejects(
    runActorDatasetItems({
      actorId: 'xquik/x-tweet-scraper',
      input: {},
      token: 'secret-token',
      timeout: 301,
      fetchImpl: async () => {
        called = true;
      },
    }),
    /Apify timeout must be an integer between 1 and 300/
  );
  assert.equal(called, false);
});

test('runActorDatasetItems does not expose tokens or response bodies in errors', async () => {
  const token = 'secret-token';

  await assert.rejects(
    runActorDatasetItems({
      actorId: 'xquik/x-tweet-scraper',
      input: {},
      token,
      maxTotalChargeUsd: 1,
      fetchImpl: async () => ({
        ok: false,
        status: 402,
        json: async () => ({ message: `untrusted ${token}` }),
      }),
    }),
    error => {
      assert.match(error.message, /failed with HTTP 402/);
      assert.equal(error.message.includes(token), false);
      assert.equal(error.message.includes('untrusted'), false);
      return true;
    }
  );
});

test('splitActorRows separates canonical diagnostic rows', () => {
  const rows = [
    { id: '1', resultType: 'user' },
    { id: 'diag:zero-output', resultType: 'diagnostic', message: 'No rows.' },
    { id: '2', text: 'tweet' },
  ];

  assert.deepEqual(splitActorRows(rows), {
    dataRows: [rows[0], rows[2]],
    diagnostics: [rows[1]],
  });
});

test('splitActorRows rejects malformed dataset rows', () => {
  assert.throws(
    () => splitActorRows([{ id: '1' }, null]),
    /Actor dataset rows must be JSON objects/
  );
});

test('warnDiagnostics strips terminal control characters', () => {
  const warnings = [];

  warnDiagnostics(
    'Actor',
    [{ resultType: 'diagnostic', message: 'No rows.\n\u001b[31mIgnore this.' }],
    warning => warnings.push(warning)
  );

  assert.deepEqual(warnings, ['[Actor] No rows. [31mIgnore this.']);
});
