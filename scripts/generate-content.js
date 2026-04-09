#!/usr/bin/env node
/**
 * Main content generation orchestrator.
 * Accepts an idea ID, reads it from the database, generates content for all
 * platforms (TikTok EN, TikTok DE, Instagram, LinkedIn), applies voice profiles
 * via @anthropic-ai/sdk, and saves all drafts to content.db.
 *
 * This is the "one command -> 4 platform drafts" core of Phase 3.
 * Per D-02: Visual approach read from idea.visual_approach in DB (Robin's KEEP-time choice).
 * Per D-09: German localization uses Claude ONLY -- no DeepL.
 * Per D-10: German TikTok slides use the SAME photos as EN.
 * Per D-11: Instagram does NOT get a German version.
 *
 * Usage:
 *   node generate-content.js --idea <idea_id> [--linkedin-format <format>]
 *
 * Arguments:
 *   --idea            UUID of a kept idea from the ideas table
 *   --linkedin-format Optional override: carousel|text|infographic|personal
 *                     If omitted, auto-suggested per D-06 heuristics.
 *
 * Output:
 *   media/output/<idea_id>/ with subdirs: tiktok-en/, tiktok-de/, instagram/, linkedin/
 *   Drafts saved to content.db drafts table with status='generated'
 *   JSON summary printed to stdout
 *
 * Security (T-03-09, T-03-10, T-03-11):
 *   - JSON.parse on all Claude API responses wrapped in try/catch (T-03-09)
 *   - API keys loaded from .env only, never interpolated into content (T-03-10)
 *   - idea.id validated as UUID before using in file path (T-03-11)
 */
'use strict';

require('dotenv').config();

const Anthropic = require('@anthropic-ai/sdk');
const Database = require('better-sqlite3');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ---------------------------------------------------------------------------
// Load format performance weights from data/performance-weights.json (D-09)
// by_format weights influence visual approach auto-detection when Robin hasn't
// made an explicit KEEP-time choice. Falls back gracefully when file is absent.
// ---------------------------------------------------------------------------
let formatWeights = {};
try {
  const perfWeights = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'performance-weights.json'), 'utf-8')
  );
  formatWeights = perfWeights.by_format || {};
} catch (e) { /* no weights yet — use default auto-detection */ }

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const ideaId = getArg('idea');
const linkedinFormatOverride = getArg('linkedin-format');

if (!ideaId) {
  console.error('Usage: node generate-content.js --idea <idea_id> [--linkedin-format carousel|text|infographic|personal]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// UUID validation (T-03-11): idea.id must be a UUID before using in paths
// ---------------------------------------------------------------------------
if (!/^[0-9a-f-]{36}$/.test(ideaId)) {
  console.error(`Invalid idea ID format: "${ideaId}" -- must be a UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Safe JSON parse helper (T-03-09): wrap Claude API JSON.parse in try/catch
// ---------------------------------------------------------------------------
function safeJsonParse(text, label) {
  try {
    // Claude sometimes wraps JSON in markdown code fences -- strip them
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`JSON parse error for ${label}: ${err.message}`);
    console.error('Raw response (first 500 chars):', text.slice(0, 500));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// LinkedIn format auto-suggestion (D-06 heuristics)
// ---------------------------------------------------------------------------
function suggestLinkedInFormat(idea) {
  const title = (idea.title || '').toLowerCase();
  const angle = (idea.content_angle_suggestion || '').toLowerCase();
  const sourceType = (idea.source_type || '').toLowerCase();

  // Tutorial/how-to -> carousel
  if (/tutorial|how to|guide|step[- ]by[- ]step|tips|walkthrough/.test(title) ||
      /tutorial breakdown/.test(angle)) {
    return 'carousel';
  }

  // Hot take -> text
  if (/hot take|wrong|actually|unpopular|controversial|opinion/.test(title) ||
      /hot take/.test(angle)) {
    return 'text';
  }

  // Founder note / personal story -> personal
  if (sourceType === 'founder_note' || /story|pillar/.test(angle)) {
    return 'personal';
  }

  // News reaction with data/numbers -> infographic
  if (/news reaction/.test(angle) && /\d/.test(idea.title + (idea.summary || ''))) {
    return 'infographic';
  }

  // Default: text post (safest fallback)
  return 'text';
}

// ---------------------------------------------------------------------------
// Main async IIFE
// ---------------------------------------------------------------------------
(async () => {

  // =========================================================================
  // Step 1: Load idea from DB
  // =========================================================================
  const DB_PATH = path.join(__dirname, '..', 'data', 'content.db');
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH} -- run: node scripts/init-db.js`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const idea = db.prepare('SELECT * FROM ideas WHERE id = ? AND status = ?').get(ideaId, 'kept');
  if (!idea) {
    console.error(`Idea not found or not in "kept" status: ${ideaId}`);
    db.close();
    process.exit(1);
  }

  console.log(`\nGenerating content for: "${idea.title}" (${ideaId})\n`);

  // =========================================================================
  // Step 2: Determine visual approach (D-02 fully implemented)
  // Robin's explicit KEEP-time choice is read from idea.visual_approach column.
  // Fall back to auto-detect only for ideas kept before Phase 3 (NULL value).
  // =========================================================================
  const catalogPath = path.join(__dirname, '..', 'media', 'images', 'tiktok', 'catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

  // Visual approach selection (D-02 + D-09 performance feedback):
  // 1. Robin's explicit KEEP-time choice always wins (no override).
  // 2. When no explicit choice AND both formats are viable, prefer the
  //    higher-performing format based on formatWeights from performance-weights.json.
  // 3. If catalog is empty, fall back to ai_generated regardless of weights.
  let visualApproach;
  if (idea.visual_approach) {
    visualApproach = idea.visual_approach;
  } else if (catalog.photos && catalog.photos.length > 0) {
    // Both formats are viable — let performance data influence the choice
    const photoWeight = formatWeights['photo_overlay'] || formatWeights['photo'] || 1.0;
    const aiWeight = formatWeights['ai_generated'] || formatWeights['ai'] || 1.0;
    visualApproach = photoWeight >= aiWeight ? 'photo_overlay' : 'ai_generated';
  } else {
    visualApproach = 'ai_generated';
  }

  console.log(`Visual approach: ${visualApproach}${idea.visual_approach ? " (Robin's choice)" : ' (auto-detected, no KEEP-time choice recorded)'}`);

  // =========================================================================
  // Step 3: Create output directories
  // =========================================================================
  const outputBase = path.join(__dirname, '..', 'media', 'output', idea.id);
  fs.mkdirSync(path.join(outputBase, 'tiktok-en'), { recursive: true });
  fs.mkdirSync(path.join(outputBase, 'tiktok-de'), { recursive: true });
  fs.mkdirSync(path.join(outputBase, 'instagram'), { recursive: true });
  fs.mkdirSync(path.join(outputBase, 'linkedin'), { recursive: true });

  // =========================================================================
  // Step 4: Read voice profiles
  // Per writing/SKILL.md: "NEVER generate content without reading the voice profile first."
  // =========================================================================
  const voiceCasual = fs.readFileSync(
    path.join(__dirname, '..', '.claude', 'skills', 'writing', 'data', 'voice-casual.xml'),
    'utf-8'
  );
  const voiceLinkedin = fs.readFileSync(
    path.join(__dirname, '..', '.claude', 'skills', 'writing', 'data', 'voice-linkedin.xml'),
    'utf-8'
  );

  // =========================================================================
  // Step 5: Initialize Anthropic client
  // (T-03-10): ANTHROPIC_API_KEY loaded from .env only, never interpolated into content
  // =========================================================================
  const anthropic = new Anthropic();

  // =========================================================================
  // Step 6: Generate TikTok EN slide content via Claude
  // =========================================================================
  console.log('\n[1/4] Generating TikTok EN slide content...');

  const tiktokResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: `You are Robin Faraj creating TikTok slideshow content. Voice profile:
${voiceCasual}

Rules:
- No emoji in slide text (canvas cannot render them)
- Use \\n for manual line breaks
- Keep lines to 4-6 words for readability
- Slide count: 3-5 for hot takes, 5-8 for tutorials/listicles -- adapt to content
- Each slide text must be punchy and standalone
- Return valid JSON only, no markdown wrapping`,
    messages: [{
      role: 'user',
      content: `Create TikTok slideshow slides for this topic:

Title: ${idea.title}
Summary: ${idea.summary || 'None'}
Transcript: ${idea.transcript || 'None'}
Source: ${idea.source_url || 'None'}
Source type: ${idea.source_type || 'None'}

Return JSON with this exact shape:
{
  "slides": [
    { "text": "slide text with\\nline breaks", "photo_description": "description for photo matching" }
  ],
  "caption": "TikTok caption text (with hashtags if relevant)",
  "hook_formula": "name of hook formula used (e.g. contrarian-take, milestone, pov-setup)"
}`
    }]
  });

  const tiktokContent = safeJsonParse(tiktokResponse.content[0].text, 'TikTok EN content');

  if (!tiktokContent.slides || !Array.isArray(tiktokContent.slides) || tiktokContent.slides.length < 2) {
    console.error('Claude returned invalid TikTok slides structure -- expected at least 2 slides');
    process.exit(1);
  }

  console.log(`  Generated ${tiktokContent.slides.length} slides using hook: "${tiktokContent.hook_formula}"`);

  // =========================================================================
  // Step 7: Match photos from catalog or generate AI slides
  // Routes based on visualApproach (from idea.visual_approach per D-02, with fallback)
  // =========================================================================
  let enPhotoPaths = [];

  if (visualApproach === 'photo_overlay' && catalog.photos && catalog.photos.length > 0) {
    console.log('\n  Matching photos from catalog...');

    // Match photos by keyword overlap between slide photo_description and catalog descriptions
    enPhotoPaths = tiktokContent.slides.map((slide, idx) => {
      const keywords = slide.photo_description.toLowerCase().split(/\s+/);
      let bestMatch = catalog.photos[0]; // fallback to first photo
      let bestScore = 0;

      for (const photo of catalog.photos) {
        const desc = [
          photo.description || '',
          photo.mood || '',
          ...(photo.best_for || [])
        ].join(' ').toLowerCase();
        const score = keywords.filter(kw => kw.length > 3 && desc.includes(kw)).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = photo;
        }
      }

      const photoPath = path.join(__dirname, '..', 'media', 'images', 'tiktok', bestMatch.filename);
      console.log(`  Slide ${idx + 1}: matched "${bestMatch.filename}" (score: ${bestScore})`);
      return photoPath;
    });

    // Write photos.json and texts.json for generate-tiktok-slides.js
    const photosJson = path.join(outputBase, 'tiktok-en', 'photos.json');
    const textsJson = path.join(outputBase, 'tiktok-en', 'texts.json');
    fs.writeFileSync(photosJson, JSON.stringify(enPhotoPaths));
    fs.writeFileSync(textsJson, JSON.stringify(tiktokContent.slides.map(s => s.text)));

    console.log('  Rendering TikTok EN slides (photo_overlay)...');
    const result = spawnSync('node', [
      path.join(__dirname, 'generate-tiktok-slides.js'),
      '--photos', photosJson,
      '--texts', textsJson,
      '--output', path.join(outputBase, 'tiktok-en')
    ], { stdio: 'inherit' });

    if (result.status !== 0) {
      console.error('generate-tiktok-slides.js failed for TikTok EN');
      process.exit(1);
    }

  } else {
    // AI generation (Robin chose 'ai_generated' OR catalog is empty)
    console.log(`\n  Generating AI slides (${visualApproach === 'ai_generated' ? "Robin's choice" : 'catalog empty'})...`);

    const promptsJson = path.join(outputBase, 'tiktok-en', 'prompts.json');
    fs.writeFileSync(promptsJson, JSON.stringify(
      tiktokContent.slides.map(s => `Portrait photo for TikTok slide, 9:16 vertical format, 1080x1440. ${s.photo_description}. Cinematic, high quality, no text overlay.`)
    ));

    const aiResult = spawnSync('node', [
      path.join(__dirname, 'generate-ai-slides.js'),
      '--prompts', promptsJson,
      '--output', path.join(outputBase, 'tiktok-en')
    ], { stdio: 'inherit' });

    if (aiResult.status !== 0) {
      console.error('generate-ai-slides.js failed for TikTok EN');
      process.exit(1);
    }

    // Collect AI-generated image paths for text overlay and DE reuse
    enPhotoPaths = tiktokContent.slides.map((_, i) => {
      const slideNum = String(i + 1).padStart(2, '0');
      return path.join(outputBase, 'tiktok-en', `slide-${slideNum}.png`);
    });

    // Now overlay text on AI-generated images (second pass: same images, add text)
    const photosAiJson = path.join(outputBase, 'tiktok-en', 'photos-ai.json');
    const textsJson = path.join(outputBase, 'tiktok-en', 'texts.json');
    fs.writeFileSync(photosAiJson, JSON.stringify(enPhotoPaths));
    fs.writeFileSync(textsJson, JSON.stringify(tiktokContent.slides.map(s => s.text)));

    // Write photos.json (used by DE pipeline to read EN photo paths)
    const photosJson = path.join(outputBase, 'tiktok-en', 'photos.json');
    fs.writeFileSync(photosJson, JSON.stringify(enPhotoPaths));

    const overlayResult = spawnSync('node', [
      path.join(__dirname, 'generate-tiktok-slides.js'),
      '--photos', photosAiJson,
      '--texts', textsJson,
      '--output', path.join(outputBase, 'tiktok-en')
    ], { stdio: 'inherit' });

    if (overlayResult.status !== 0) {
      console.error('generate-tiktok-slides.js failed for TikTok EN text overlay on AI images');
      process.exit(1);
    }
  }

  console.log('  TikTok EN slides: done');

  // =========================================================================
  // Step 8: Generate TikTok DE (German localization, D-09/D-10)
  // D-09: Claude-only localization with <localization-de> rules -- no DeepL
  // D-10: Same photos as EN, only text changes
  // =========================================================================
  console.log('\n[2/4] Generating TikTok DE (German adaptation)...');

  const deResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: `You are localizing Robin's TikTok content from English to German.

Rules from voice-casual.xml <localization-de> section:
- Preserve raw energy -- find German phrases with same casual punch
- "brooo" energy in German: Alter, Bruder, krass
- Keep lowercase where German grammar allows
- Adapt milestone posts to German entrepreneur culture -- same raw excitement
- Do NOT literal-translate -- find German idioms with same casual energy
- Avoid formal German grammar -- use spoken German
- No emoji in slide text (canvas limitation)
- Keep \\n line breaks, keep lines to 4-6 words
- Return valid JSON only, no markdown wrapping`,
    messages: [{
      role: 'user',
      content: `Localize these TikTok slide texts from English to German:
${JSON.stringify(tiktokContent.slides.map(s => s.text), null, 2)}

Also localize the caption:
${tiktokContent.caption}

Return JSON:
{
  "slides": ["german slide 1", "german slide 2", ...],
  "caption": "german caption text"
}`
    }]
  });

  const deContent = safeJsonParse(deResponse.content[0].text, 'TikTok DE content');

  if (!deContent.slides || !Array.isArray(deContent.slides)) {
    console.error('Claude returned invalid German localization structure');
    process.exit(1);
  }

  // D-10: Reuse EN photo paths (same photos, different text overlays)
  const enPhotosPath = path.join(outputBase, 'tiktok-en', 'photos.json');
  const enPhotos = JSON.parse(fs.readFileSync(enPhotosPath, 'utf-8'));

  // Align slide count: if DE has fewer slides, pad; if more, trim
  const targetSlideCount = tiktokContent.slides.length;
  while (deContent.slides.length < targetSlideCount) {
    deContent.slides.push(deContent.slides[deContent.slides.length - 1] || '...');
  }
  if (deContent.slides.length > targetSlideCount) {
    deContent.slides.length = targetSlideCount;
  }

  const deTextsJson = path.join(outputBase, 'tiktok-de', 'texts.json');
  fs.writeFileSync(deTextsJson, JSON.stringify(deContent.slides));

  const dePhotosJson = path.join(outputBase, 'tiktok-de', 'photos.json');
  fs.writeFileSync(dePhotosJson, JSON.stringify(enPhotos));

  const deResult = spawnSync('node', [
    path.join(__dirname, 'generate-tiktok-slides.js'),
    '--photos', dePhotosJson,
    '--texts', deTextsJson,
    '--output', path.join(outputBase, 'tiktok-de')
  ], { stdio: 'inherit' });

  if (deResult.status !== 0) {
    console.error('generate-tiktok-slides.js failed for TikTok DE');
    process.exit(1);
  }

  console.log('  TikTok DE slides: done');

  // =========================================================================
  // Step 9: Generate Instagram carousel (TIKT-07)
  // Reuses TikTok EN PNGs with a sharp center-crop to 1080x1350 (4:5 ratio)
  // D-11: Instagram does NOT get a German version
  // =========================================================================
  console.log('\n[3/4] Generating Instagram carousel (cropping TikTok EN slides to 4:5)...');

  const enSlidesDir = path.join(outputBase, 'tiktok-en');
  const enSlideFiles = fs.readdirSync(enSlidesDir)
    .filter(f => /^slide-\d+\.png$/.test(f))
    .sort();

  if (enSlideFiles.length === 0) {
    console.error('No TikTok EN slide PNGs found -- cannot generate Instagram carousel');
    process.exit(1);
  }

  for (const file of enSlideFiles) {
    const inputPath = path.join(enSlidesDir, file);
    const outputPath = path.join(outputBase, 'instagram', file);
    await sharp(inputPath)
      .resize(1080, 1350, { fit: 'cover', position: 'centre' })
      .toFile(outputPath);
  }

  console.log(`  Instagram carousel: ${enSlideFiles.length} slides cropped to 1080x1350`);

  // =========================================================================
  // Step 10: Generate LinkedIn content
  // =========================================================================
  console.log('\n[4/4] Generating LinkedIn content...');

  const linkedinFormat = linkedinFormatOverride || suggestLinkedInFormat(idea);
  console.log(`  LinkedIn format: ${linkedinFormat}${linkedinFormatOverride ? ' (override)' : ' (auto-suggested)'}`);

  // Generate LinkedIn post text via Claude with LinkedIn voice profile
  const linkedinTextResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: `You are Robin Faraj writing LinkedIn content. Voice profile:
${voiceLinkedin}

Format: ${linkedinFormat}

For "carousel" format: Write a post text AND include slide texts.
For "text" format: Write a standalone LinkedIn post.
For "infographic" format: Write a post text that introduces the infographic.
For "personal" format: Write a first-person reflective post.

If format is "carousel", end your response with a line starting with:
SLIDES_JSON: [followed by a JSON array of slide texts, one per slide, 5-8 slides]

Return the post text directly (no JSON wrapping for the main text).`,
    messages: [{
      role: 'user',
      content: `Write LinkedIn content for:
Title: ${idea.title}
Summary: ${idea.summary || 'None'}
Transcript: ${idea.transcript ? idea.transcript.slice(0, 1000) + (idea.transcript.length > 1000 ? '...' : '') : 'None'}
Source: ${idea.source_url || 'None'}
Format: ${linkedinFormat}`
    }]
  });

  const linkedinResponseText = linkedinTextResponse.content[0].text;

  // Parse post text and optional slide texts for carousel
  let linkedinPostText = linkedinResponseText;
  let linkedinSlideTexts = null;

  const slidesMatch = linkedinResponseText.match(/SLIDES_JSON:\s*(\[[\s\S]*?\])\s*$/m);
  if (slidesMatch) {
    linkedinPostText = linkedinResponseText.slice(0, slidesMatch.index).trim();
    linkedinSlideTexts = safeJsonParse(slidesMatch[1], 'LinkedIn slide texts');
  }

  // Write idea JSON and post text to files for generate-linkedin-content.js
  const ideaJsonPath = path.join(outputBase, 'linkedin', 'idea.json');
  fs.writeFileSync(ideaJsonPath, JSON.stringify(idea));

  const postTextPath = path.join(outputBase, 'linkedin', 'post-text.txt');
  fs.writeFileSync(postTextPath, linkedinPostText);

  const linkedinArgs = [
    '--idea-json', ideaJsonPath,
    '--format', linkedinFormat,
    '--post-text', postTextPath,
    '--output', path.join(outputBase, 'linkedin')
  ];

  if (linkedinSlideTexts && linkedinFormat === 'carousel') {
    const slideTextsPath = path.join(outputBase, 'linkedin', 'slide-texts.json');
    fs.writeFileSync(slideTextsPath, JSON.stringify(linkedinSlideTexts));
    linkedinArgs.push('--slide-texts', slideTextsPath);
  }

  const linkedinResult = spawnSync('node', [
    path.join(__dirname, 'generate-linkedin-content.js'),
    ...linkedinArgs
  ], { stdio: 'inherit' });

  if (linkedinResult.status !== 0) {
    console.error('generate-linkedin-content.js failed');
    process.exit(1);
  }

  console.log('  LinkedIn content: done');

  // =========================================================================
  // Step 11: Save all drafts to content.db
  // 4 platforms: tiktok_en, tiktok_de, instagram, linkedin
  // =========================================================================
  console.log('\nSaving drafts to content.db...');

  const insertDraft = db.prepare(`
    INSERT INTO drafts (id, idea_id, platform, content, status, visual_approach, media_dir, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'generated', ?, ?, datetime('now'), datetime('now'))
  `);

  // TikTok EN
  const tiktokEnDraftId = crypto.randomUUID();
  insertDraft.run(
    tiktokEnDraftId,
    idea.id,
    'tiktok_en',
    JSON.stringify({
      type: 'tiktok_slideshow',
      slides: tiktokContent.slides,
      caption: tiktokContent.caption,
      hook_formula: tiktokContent.hook_formula,
      slide_count: tiktokContent.slides.length
    }),
    visualApproach,
    path.join(outputBase, 'tiktok-en')
  );
  console.log(`  tiktok_en draft: ${tiktokEnDraftId}`);

  // TikTok DE
  const tiktokDeDraftId = crypto.randomUUID();
  insertDraft.run(
    tiktokDeDraftId,
    idea.id,
    'tiktok_de',
    JSON.stringify({
      type: 'tiktok_slideshow',
      slides: deContent.slides.map((text, i) => ({
        text,
        photo_description: tiktokContent.slides[i] ? tiktokContent.slides[i].photo_description : ''
      })),
      caption: deContent.caption,
      slide_count: deContent.slides.length
    }),
    visualApproach,
    path.join(outputBase, 'tiktok-de')
  );
  console.log(`  tiktok_de draft: ${tiktokDeDraftId}`);

  // Instagram (reuses TikTok EN content, center-cropped slides)
  const instagramDraftId = crypto.randomUUID();
  insertDraft.run(
    instagramDraftId,
    idea.id,
    'instagram',
    JSON.stringify({
      type: 'instagram_carousel',
      slides: tiktokContent.slides,
      caption: tiktokContent.caption,
      slide_count: tiktokContent.slides.length
    }),
    visualApproach,
    path.join(outputBase, 'instagram')
  );
  console.log(`  instagram draft: ${instagramDraftId}`);

  // LinkedIn
  const linkedinResultPath = path.join(outputBase, 'linkedin', 'linkedin-result.json');
  let linkedinResultData = {};
  if (fs.existsSync(linkedinResultPath)) {
    linkedinResultData = safeJsonParse(fs.readFileSync(linkedinResultPath, 'utf-8'), 'LinkedIn result');
  }

  // Determine visual approach for LinkedIn by format
  let linkedinVisualApproach;
  if (linkedinFormat === 'carousel') {
    linkedinVisualApproach = 'html_screenshot';
  } else if (linkedinFormat === 'infographic') {
    linkedinVisualApproach = 'ai_generated';
  } else {
    linkedinVisualApproach = 'none';
  }

  const linkedinDraftId = crypto.randomUUID();
  insertDraft.run(
    linkedinDraftId,
    idea.id,
    'linkedin',
    JSON.stringify({
      type: `linkedin_${linkedinFormat}`,
      post_text: linkedinPostText,
      format: linkedinFormat,
      ...linkedinResultData
    }),
    linkedinVisualApproach,
    path.join(outputBase, 'linkedin')
  );
  console.log(`  linkedin draft: ${linkedinDraftId}`);

  db.close();

  // =========================================================================
  // Step 12: Print summary
  // =========================================================================
  const summary = {
    idea_id: idea.id,
    title: idea.title,
    platforms: ['tiktok_en', 'tiktok_de', 'instagram', 'linkedin'],
    visual_approach: visualApproach,
    visual_approach_source: idea.visual_approach ? 'robin_choice' : 'auto_detected',
    linkedin_format: linkedinFormat,
    linkedin_format_source: linkedinFormatOverride ? 'override' : 'auto_suggested',
    output_dir: outputBase,
    drafts: {
      tiktok_en: tiktokEnDraftId,
      tiktok_de: tiktokDeDraftId,
      instagram: instagramDraftId,
      linkedin: linkedinDraftId
    },
    status: 'generated'
  };

  console.log('\n' + JSON.stringify(summary, null, 2));
  console.log('\nContent generation complete. All 4 platform drafts saved to content.db with status="generated".');

})().catch(err => {
  console.error('generate-content.js error:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
