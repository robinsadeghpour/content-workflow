'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  X_ACTOR,
  X_ACTORS,
  buildXActorInput,
  fetchXIdeas,
  normalizeXItem,
  resolveXActorId,
} = require('../scripts/pulse/source-x');

test('buildXActorInput preserves the existing Tweet Actor contract', () => {
  const input = buildXActorInput(['Claude Code lang:en'], 10);

  assert.equal(X_ACTOR, X_ACTORS.existing);
  assert.deepEqual(input, {
    searchTerms: ['Claude Code lang:en'],
    maxTweets: 10,
    filter: 'Latest',
  });
});

test('buildXActorInput matches the Xquik search contract', () => {
  const input = buildXActorInput(
    ['Claude Code lang:en'],
    10,
    X_ACTORS.xquik
  );

  assert.deepEqual(input, {
    mode: 'search',
    searchTerms: ['Claude Code lang:en'],
    maxItems: 10,
    queryType: 'Latest',
    outputVariant: 'rich',
    outputPreset: 'nested',
    fieldStyle: 'camelCase',
    includeSearchTerms: true,
  });
});

test('resolveXActorId accepts only supported routes', () => {
  assert.equal(resolveXActorId(), X_ACTORS.existing);
  assert.equal(resolveXActorId('xquik~x-tweet-scraper'), X_ACTORS.xquik);
  assert.throws(
    () => resolveXActorId('other/tweet-scraper'),
    /PULSE_X_ACTOR_ID/
  );
});

test('normalizeXItem reads rich nested camel-case rows', () => {
  const idea = normalizeXItem(
    {
      id: '123',
      text: 'A detailed Claude Code workflow worth studying.',
      tweetUrl: 'https://x.com/example/status/123',
      author: { username: 'example' },
      retweetCount: 7,
      likeCount: 23,
      replyCount: 4,
      viewCount: 900,
    },
    '2026-07-27T00:00:00.000Z'
  );

  assert.deepEqual(idea, {
    title: 'A detailed Claude Code workflow worth studying.',
    summary: 'Tweet by @example. 7 retweets, 23 likes.',
    source_url: 'https://x.com/example/status/123',
    source_type: 'x',
    scraped_at: '2026-07-27T00:00:00.000Z',
    views: 900,
    likes: 23,
    comments: 4,
  });
});

test('fetchXIdeas filters diagnostics and duplicate tweet URLs', async () => {
  const warnings = [];
  let request;
  const tweet = {
    id: '123',
    text: 'A detailed Claude Code workflow worth studying.',
    tweetUrl: 'https://x.com/example/status/123',
    author: { username: 'example' },
  };

  const ideas = await fetchXIdeas({
    actorId: X_ACTORS.xquik,
    runActor: async actorRequest => {
      request = actorRequest;
      return [
        {
          id: 'diag:zero-output',
          resultType: 'diagnostic',
          message: 'One query returned no rows.',
        },
        tweet,
        { ...tweet },
      ];
    },
    warn: warning => warnings.push(warning),
  });

  assert.equal(request.actorId, X_ACTORS.xquik);
  assert.equal(request.input.mode, 'search');
  assert.equal(request.maxItems, request.input.maxItems);
  assert.equal(ideas.length, 1);
  assert.equal(ideas[0].source_url, tweet.tweetUrl);
  assert.deepEqual(warnings, [
    '[X Tweet Scraper] One query returned no rows.',
  ]);
});
