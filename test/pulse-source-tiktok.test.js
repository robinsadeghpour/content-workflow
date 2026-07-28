'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TIKTOK_ACTOR,
  buildTikTokActorInput,
  fetchTikTokIdeas,
} = require('../scripts/pulse/source-tiktok');

test('buildTikTokActorInput preserves the existing Actor contract', () => {
  assert.deepEqual(buildTikTokActorInput(), {
    hashtags: ['claudeai', 'aitools', 'llm', 'claudecode'],
    resultsPerPage: 5,
    maxItems: 20,
  });
});

test('fetchTikTokIdeas uses the shared runner and deduplicates results', async () => {
  let request;
  const item = {
    text: 'A useful AI workflow.',
    webVideoUrl: 'https://www.tiktok.com/@example/video/123',
    authorMeta: { name: 'example' },
  };

  const ideas = await fetchTikTokIdeas({
    runActor: async actorRequest => {
      request = actorRequest;
      return [item, { ...item }];
    },
    warn: () => {},
  });

  assert.equal(request.actorId, TIKTOK_ACTOR);
  assert.equal(request.maxItems, request.input.maxItems);
  assert.equal(ideas.length, 1);
  assert.equal(ideas[0].source_url, item.webVideoUrl);
});
