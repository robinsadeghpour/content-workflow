'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  FOLLOWER_ACTOR,
  buildAudienceInput,
  parseArgs,
  resolveOutputPath,
  runAudienceResearch,
} = require('../scripts/research/x-audience');

test('parseArgs normalizes profile targets and audience options', () => {
  const options = parseArgs([
    '@nasa',
    '--handles',
    'SpaceX,nasa,NASA',
    '--user-ids',
    '123,456',
    '--relation',
    'verified_followers',
    '--max-items',
    '75',
    '--output-mode',
    'full',
    '--overlap',
  ]);

  assert.deepEqual(options.twitterHandles, ['nasa', 'spacex']);
  assert.deepEqual(options.userIds, ['123', '456']);
  assert.equal(options.relation, 'verified_followers');
  assert.equal(options.maxItems, 75);
  assert.equal(options.outputMode, 'full');
  assert.equal(options.overlap, true);
});

test('buildAudienceInput enables merge metadata for overlap research', () => {
  const options = parseArgs([
    '--handles',
    'nasa,SpaceX',
    '--relation',
    'followers',
    '--overlap',
  ]);

  assert.deepEqual(buildAudienceInput(options), {
    relation: 'followers',
    maxItems: 100,
    outputMode: 'compact',
    includeTargetMetadata: true,
    twitterHandles: ['nasa', 'spacex'],
    overlapMode: true,
    dedupeMode: 'merge',
  });
});

test('buildAudienceInput maps list and community relations to native targets', () => {
  const listInput = buildAudienceInput(
    parseArgs(['--list-ids', '123', '--relation', 'list_members'])
  );
  const communityInput = buildAudienceInput(
    parseArgs([
      '--community-ids',
      '456',
      '--relation',
      'community_members',
    ])
  );

  assert.deepEqual(listInput.listIds, ['123']);
  assert.deepEqual(communityInput.communityIds, ['456']);
});

test('buildAudienceInput rejects incompatible relation targets', () => {
  const options = parseArgs([
    '--handles',
    'nasa',
    '--relation',
    'list_followers',
  ]);

  assert.throws(
    () => buildAudienceInput(options),
    /list_followers requires an X list ID/
  );
});

test('resolveOutputPath confines JSON output to the research directory', () => {
  const outputPath = resolveOutputPath(
    'data/research/audience-example.json',
    123
  );

  assert.equal(
    outputPath.endsWith(path.join('data', 'research', 'audience-example.json')),
    true
  );
  assert.throws(
    () => resolveOutputPath('../audience-example.json', 123),
    /Output must be a JSON file under data\/research/
  );
});

test('runAudienceResearch separates profiles from Actor diagnostics', async () => {
  const options = parseArgs(['nasa', '--max-items', '5']);
  const warnings = [];
  let request;

  const result = await runAudienceResearch({
    options,
    runActor: async actorRequest => {
      request = actorRequest;
      return [
        {
          id: 'diag:partial',
          resultType: 'diagnostic',
          message: 'A target returned no profiles.',
        },
        {
          id: '123',
          username: 'researcher',
          sourceTarget: 'nasa',
        },
      ];
    },
    warn: warning => warnings.push(warning),
    timestamp: Date.parse('2026-07-27T00:00:00.000Z'),
  });

  assert.equal(request.actorId, FOLLOWER_ACTOR);
  assert.equal(request.maxItems, 5);
  assert.deepEqual(result.report.profiles, [
    { id: '123', username: 'researcher', sourceTarget: 'nasa' },
  ]);
  assert.equal(result.report.diagnostics.length, 1);
  assert.deepEqual(warnings, [
    '[X Follower Scraper] A target returned no profiles.',
  ]);
});
