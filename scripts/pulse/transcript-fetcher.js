'use strict';

const _pLimit = require('p-limit');
const pLimit = _pLimit.default || _pLimit;
const limit = pLimit(3);

async function fetchTranscript(url) {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    console.error('[TRANSCRIPT] SUPADATA_API_KEY not set');
    return null;
  }
  try {
    const encodedUrl = encodeURIComponent(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(
      `https://api.supadata.ai/v1/transcript?url=${encodedUrl}&text=true&mode=native`,
      {
        headers: { 'x-api-key': apiKey },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return data.content || null;
  } catch (err) {
    console.error(`[TRANSCRIPT] Failed for ${url}: ${err.message}`);
    return null;
  }
}

async function fetchTranscriptsForIdeas(ideas) {
  const videoIdeas = ideas.filter(i => ['youtube', 'tiktok'].includes(i.source_type));
  if (videoIdeas.length === 0) return;
  console.log(`[TRANSCRIPT] Fetching transcripts for ${videoIdeas.length} video ideas...`);
  const results = await Promise.all(
    videoIdeas.map(idea => limit(() => fetchTranscript(idea.source_url)))
  );
  videoIdeas.forEach((idea, i) => { idea.transcript = results[i]; });
  const found = results.filter(Boolean).length;
  console.log(`[TRANSCRIPT] ${found}/${videoIdeas.length} transcripts fetched`);
}

module.exports = { fetchTranscript, fetchTranscriptsForIdeas };
