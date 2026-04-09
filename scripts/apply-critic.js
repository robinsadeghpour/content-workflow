#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Anthropic = require('@anthropic-ai/sdk');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------------ constants
const MAX_ATTEMPTS = 3;
const PASS_THRESHOLD = 7;

// ------------------------------------------------------------------ helpers

function usage() {
  console.error('Usage: node apply-critic.js --idea <idea_id>');
  console.error('       Processes ALL drafts for the given idea_id with status="generated".');
  process.exit(1);
}

/**
 * Strip markdown code fences (```json ... ```) that Claude sometimes returns
 * even when asked for raw JSON. Then attempt JSON.parse.
 * Returns parsed object or throws.
 */
function safeJsonParse(text, label) {
  // Strip leading/trailing whitespace
  let clean = text.trim();
  // Strip markdown code fences: ```json\n...\n``` or ```\n...\n```
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(clean);
  } catch (err) {
    throw new Error(`[${label}] JSON parse failed: ${err.message}\nRaw (first 500 chars): ${text.slice(0, 500)}`);
  }
}

// ------------------------------------------------------------------ prompt builders

/**
 * System prompt for the critic agent.
 * isSlideContent controls whether SLIDE QUALITY dimension is evaluated.
 */
function buildCriticSystemPrompt(voiceProfile, isSlideContent) {
  return `You are a content critic reviewing draft posts for Robin Faraj.
Score each draft on 3 dimensions (0-10 each):

1. VOICE AUTHENTICITY: Does it match the voice profile exactly?
   - Check against the voice profile provided below
   - Red flags: banned patterns, wrong opener style, wrong sentence rhythm
   - Pass threshold: >= ${PASS_THRESHOLD}

2. SLIDE QUALITY${isSlideContent ? '' : ' (skip — not slide content, auto-score 10)'}:
   - Hook slide: strong enough to stop scroll?
   - Text: readable, within safe zones, no em dashes?
   - Narrative flow: does progression make sense?
   - Pass threshold: >= ${PASS_THRESHOLD}

3. FACTUAL ACCURACY:
   - Every claim must trace to source transcript or idea summary
   - No invented personal experiences
   - Pass threshold: all claims verified (binary — 10 if pass, 0 if fail)

OVERALL PASS: all applicable dimensions pass.
On failure: return specific rewrite instructions per dimension.

Voice profile:
${voiceProfile}

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "voice_score": <0-10>,
  "voice_feedback": "<specific feedback>",
  "slide_score": <0-10>,
  "slide_feedback": "<specific feedback or 'N/A — not slide content'>",
  "factual_score": <0 or 10>,
  "factual_feedback": "<specific feedback>",
  "overall_pass": <true or false>,
  "rewrite_instructions": "<specific instructions to fix failures, or 'None — all dimensions passed'>"
}`;
}

/**
 * User prompt for the critic agent.
 * Passes draft content + source material for fact-checking.
 */
function buildCriticUserPrompt(draft, content, idea) {
  return `Review this ${draft.platform} draft:

Content:
${JSON.stringify(content, null, 2)}

Source material for fact-checking:
Title: ${idea.title}
Summary: ${idea.summary || 'None available'}
Transcript: ${idea.transcript || 'None available'}
Source URL: ${idea.source_url || 'None'}`;
}

/**
 * System prompt for the auto-revise pass.
 * Given critic feedback, fix only what failed.
 */
function buildReviseSystemPrompt(voiceProfile) {
  return `You are revising Robin Faraj's content draft. Fix ONLY the issues identified by the critic. Preserve everything that passed.

Voice profile:
${voiceProfile}

Return ONLY valid JSON in the same structure as the input draft — no markdown fences, no extra text.`;
}

/**
 * User prompt for the auto-revise pass.
 */
function buildReviseUserPrompt(content, criticResult) {
  return `Original draft:
${JSON.stringify(content, null, 2)}

Critic feedback:
${JSON.stringify(criticResult, null, 2)}

Revise to address the failures while preserving what passed. Return the complete revised content JSON.`;
}

// ------------------------------------------------------------------ main

(async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const ideaIdx = args.indexOf('--idea');

  if (ideaIdx === -1 || !args[ideaIdx + 1]) {
    usage();
  }

  const ideaId = args[ideaIdx + 1];

  // Open DB
  const db = new Database(path.join(__dirname, '..', 'data', 'content.db'));

  // Load idea and drafts
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
  if (!idea) {
    console.error(`No idea found with id "${ideaId}"`);
    process.exit(1);
  }

  const drafts = db.prepare('SELECT * FROM drafts WHERE idea_id = ? AND status = ?').all(ideaId, 'generated');
  if (drafts.length === 0) {
    console.log(JSON.stringify({ idea_id: ideaId, message: 'No drafts with status="generated" found.', total: 0, approved: 0, failed: 0, results: [] }, null, 2));
    db.close();
    return;
  }

  // Load voice profiles
  const voiceCasual = fs.readFileSync(
    path.join(__dirname, '..', '.claude', 'skills', 'writing', 'data', 'voice-casual.xml'),
    'utf-8'
  );
  const voiceLinkedin = fs.readFileSync(
    path.join(__dirname, '..', '.claude', 'skills', 'writing', 'data', 'voice-linkedin.xml'),
    'utf-8'
  );

  // Initialize Anthropic client (fresh context — D-12, T-03-13)
  const anthropic = new Anthropic();

  // Process each draft individually with fresh critic context
  for (const draft of drafts) {
    let content;
    try {
      content = safeJsonParse(draft.content, `draft ${draft.id} initial parse`);
    } catch (parseErr) {
      console.error(`Failed to parse stored draft content for draft ${draft.id}: ${parseErr.message}`);
      db.prepare('UPDATE drafts SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('critic_failed', draft.id);
      continue;
    }

    // Preserve original content before any critic revisions (PUBL-05 gap closure)
    // Only set if not already set (idempotent for re-runs)
    const existingOriginal = db.prepare('SELECT original_content FROM drafts WHERE id = ?').get(draft.id);
    if (!existingOriginal || !existingOriginal.original_content) {
      db.prepare("UPDATE drafts SET original_content = ? WHERE id = ?")
        .run(draft.content, draft.id);
    }

    const voiceProfile = draft.platform === 'linkedin' ? voiceLinkedin : voiceCasual;
    const isSlideContent = ['tiktok_en', 'tiktok_de', 'instagram'].includes(draft.platform) ||
                           (content.type && content.type === 'linkedin_carousel');

    let attempts = 0;
    let passed = false;

    while (!passed && attempts < MAX_ATTEMPTS) {
      attempts++;
      console.error(`[critic] draft ${draft.id} (${draft.platform}) — attempt ${attempts}/${MAX_ATTEMPTS}`);

      let criticResult;
      try {
        const criticResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: buildCriticSystemPrompt(voiceProfile, isSlideContent),
          messages: [{ role: 'user', content: buildCriticUserPrompt(draft, content, idea) }]
        });

        criticResult = safeJsonParse(criticResponse.content[0].text, `critic response attempt ${attempts}`);
      } catch (err) {
        // T-03-12: Invalid JSON from critic — treat as failed attempt, retry
        console.error(`[critic] JSON parse error on attempt ${attempts}: ${err.message}`);
        if (attempts >= MAX_ATTEMPTS) {
          // All attempts exhausted with parse failures — mark as failed
          db.prepare('UPDATE drafts SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('critic_failed', draft.id);
          passed = false;
        }
        continue;
      }

      // Evaluate scores
      const voicePass = (criticResult.voice_score ?? 0) >= PASS_THRESHOLD;
      const slidePass = !isSlideContent || (criticResult.slide_score ?? 0) >= PASS_THRESHOLD;
      const factualPass = (criticResult.factual_score ?? 0) >= PASS_THRESHOLD;

      if (criticResult.overall_pass && voicePass && slidePass && factualPass) {
        passed = true;
        db.prepare('UPDATE drafts SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('critic_approved', draft.id);
        console.error(`[critic] draft ${draft.id} APPROVED (voice:${criticResult.voice_score}, slide:${criticResult.slide_score}, factual:${criticResult.factual_score})`);
      } else if (attempts < MAX_ATTEMPTS) {
        // Auto-revise: separate Claude call to fix specific issues
        console.error(`[critic] draft ${draft.id} FAILED attempt ${attempts} — auto-revising (voice:${criticResult.voice_score}, slide:${criticResult.slide_score}, factual:${criticResult.factual_score})`);

        try {
          const reviseResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            system: buildReviseSystemPrompt(voiceProfile),
            messages: [{ role: 'user', content: buildReviseUserPrompt(content, criticResult) }]
          });

          const revisedContent = safeJsonParse(reviseResponse.content[0].text, `revise response attempt ${attempts}`);

          // Update draft content in DB for next critic pass
          db.prepare('UPDATE drafts SET content = ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(JSON.stringify(revisedContent), draft.id);

          // Update local reference for next loop iteration
          Object.assign(content, revisedContent);
        } catch (reviseErr) {
          console.error(`[critic] Revise parse error on attempt ${attempts}: ${reviseErr.message}`);
          // Continue loop — will retry critic on unrevised content (still better than stopping)
        }
      }
    }

    // After MAX_ATTEMPTS, if still not passed — mark as critic_failed
    if (!passed) {
      db.prepare('UPDATE drafts SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('critic_failed', draft.id);
      console.error(`[critic] draft ${draft.id} FAILED after ${MAX_ATTEMPTS} attempts — marked critic_failed`);
    }
  }

  // Print summary
  const results = db.prepare('SELECT id, platform, status FROM drafts WHERE idea_id = ?').all(ideaId);
  const approved = results.filter(r => r.status === 'critic_approved').length;
  const failed = results.filter(r => r.status === 'critic_failed').length;

  console.log(JSON.stringify({
    idea_id: ideaId,
    total: results.length,
    approved,
    failed,
    results
  }, null, 2));

  db.close();
})();
