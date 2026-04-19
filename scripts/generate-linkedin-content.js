#!/usr/bin/env node
/**
 * Generate LinkedIn content with 4 format routes:
 *   1. carousel  — PDF slide deck via Robin's branded HTML template + Playwright screenshot
 *   2. text      — text-only post (hook + body + CTA structure)
 *   3. infographic — portrait image (1080x1350) via Gemini API + accompanying post text
 *   4. personal  — first-person reflective post, optional image
 *
 * Per D-03: LinkedIn keeps its own Playwright pipeline.
 * Per D-06: Format auto-suggested from content type heuristics; Robin can override at approval.
 * Per D-07: Single branded template (slide-template.html) for PDF carousels.
 * Per D-08: LinkedIn infographics use Gemini AI image generation, not HTML screenshot.
 *
 * Usage:
 *   node generate-linkedin-content.js \
 *     --idea-json <idea.json> \
 *     [--format carousel|text|infographic|personal] \
 *     [--slide-texts <texts.json>]  (for carousel: pre-generated slide texts JSON array) \
 *     [--post-text <text_file>]     (for text/personal/infographic: pre-written draft text) \
 *     --output <dir>
 *
 * idea.json shape:
 *   { id, title, summary, transcript, source_url, source_type, content_angle_suggestion }
 *
 * Output:
 *   <output>/linkedin-result.json  — structured result for the orchestrator
 *   stdout: JSON result
 *
 * Environment:
 *   GEMINI_API_KEY — required only for infographic format
 *
 * Security (T-03-05, T-03-06, T-03-07):
 *   - All idea text HTML-escaped before injection into slide-template.html (T-03-05)
 *   - GEMINI_API_KEY loaded from .env only, never in output files or prompts (T-03-06)
 *   - HTML file path constructed from sanitised idea ID (UUID characters only), via path.join (T-03-07)
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const ideaJsonPath = getArg('idea-json');
const formatArg    = getArg('format');
const slideTextsPath = getArg('slide-texts');
const postTextPath = getArg('post-text');
const outputDir    = getArg('output');

if (!ideaJsonPath || !outputDir) {
  console.error([
    'Usage: node generate-linkedin-content.js',
    '  --idea-json <idea.json>',
    '  [--format carousel|text|infographic|personal]',
    '  [--slide-texts <texts.json>]',
    '  [--post-text <text_file>]',
    '  --output <dir>'
  ].join('\n'));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Security helpers (T-03-05)
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters to prevent injection when injecting idea text
 * into the carousel HTML template.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitise a string to UUID-safe characters only (hex + hyphens).
 * Used to construct output file paths from idea IDs (T-03-07).
 *
 * @param {string} id
 * @returns {string}
 */
function sanitiseId(id) {
  if (typeof id !== 'string') return 'unknown';
  return id.replace(/[^a-f0-9A-F\-_]/g, '').slice(0, 64) || 'unknown';
}

// ---------------------------------------------------------------------------
// Format auto-suggestion (D-06)
// ---------------------------------------------------------------------------

/**
 * Determine the best LinkedIn format from the idea's content type heuristics.
 * Robin can always override this suggestion at approval time.
 *
 * Decision table (D-06):
 *   Tutorial/how-to/guide → carousel
 *   Hot take/controversial → text
 *   News reaction + data   → infographic
 *   Founder note / story   → personal
 *   default                → text (safest fallback)
 *
 * @param {{ title?: string, summary?: string, source_type?: string, content_angle_suggestion?: string }} idea
 * @returns {'carousel' | 'text' | 'infographic' | 'personal'}
 */
function suggestFormat(idea) {
  const title = (idea.title || '').toLowerCase();
  const angle = (idea.content_angle_suggestion || '').toLowerCase();
  const summary = (idea.summary || '');

  if (angle.includes('tutorial') || /\b(how to|guide|step|tutorial|tips)\b/.test(title)) {
    return 'carousel';
  }
  if (angle.includes('hot take') || /\b(wrong|actually|unpopular|controversial|opinion)\b/.test(title)) {
    return 'text';
  }
  if (angle.includes('news') && /\d/.test(summary)) {
    return 'infographic';
  }
  if (idea.source_type === 'founder_note' || angle.includes('story')) {
    return 'personal';
  }
  return 'text'; // safest fallback
}

// ---------------------------------------------------------------------------
// HTML carousel assembly (LINK-01, D-07)
// ---------------------------------------------------------------------------

const SLIDE_TEMPLATE_PATH = path.join(
  process.env.HOME,
  '.claude/skills/linkedin/references/slide-template.html'
);

const SCREENSHOT_SCRIPT_PATH = path.join(
  process.env.HOME,
  '.claude/skills/linkedin/scripts/screenshot-slides.py'
);

// Always invoke screenshot-slides.py via the notebooklm venv Python.
// System python3 does NOT have playwright installed (Pitfall 3).
const PLAYWRIGHT_PYTHON = path.join(
  process.env.HOME,
  '.local/pipx/venvs/notebooklm-py/bin/python3'
);

const ROBIN_PORTRAIT_PATH = path.join(
  __dirname,
  '../media/images/linkedin/robin-portrait.png'
);

// Brand colors from slide-template.html CSS :root variables
const BRAND_COLORS = {
  primary: '#0A0A0A',
  accent: '#C8A96E',
  bg: '#FAFAF8',
  text: '#1A1A1A',
  muted: '#6B6B6B'
};

/**
 * Build branded HTML carousel from an array of slide objects.
 * Injects content into the slide-template.html structure.
 *
 * All idea text is HTML-escaped to prevent injection (T-03-05).
 *
 * @param {string} templateHtml - Base template HTML read from slide-template.html
 * @param {Array<{title: string, body: string, slide_number: number}>} slides
 * @param {string} ideaTitle - The idea title (for the title slide)
 * @returns {string} Complete HTML with injected slides
 */
function buildCarouselHtml(templateHtml, slides, ideaTitle) {
  const slideDivs = slides.map((slide, i) => {
    const isFirst = i === 0;
    const isLast  = i === slides.length - 1;

    const titleHtml  = escapeHtml(slide.title || '');
    const bodyHtml   = escapeHtml(slide.body  || '');
    const slideClass = isFirst ? 'slide slide--cover' : isLast ? 'slide slide--cta' : 'slide';

    if (isFirst) {
      // Cover slide: large title + Robin branding
      return `
  <div class="${slideClass}">
    <div class="slide__cover-content">
      <div class="slide__label">Robin Sadeghpour</div>
      <h1 class="slide__title">${titleHtml}</h1>
      <p class="slide__subtitle">${bodyHtml}</p>
      <div class="slide__slide-number">01 / ${String(slides.length).padStart(2, '0')}</div>
    </div>
  </div>`;
    }

    if (isLast) {
      // CTA slide
      return `
  <div class="${slideClass}">
    <div class="slide__content">
      <h2 class="slide__title">${titleHtml}</h2>
      <p class="slide__body">${bodyHtml}</p>
      <div class="slide__cta-footer">
        <span class="slide__author">Robin Sadeghpour</span>
        <span class="slide__platform">linkedin.com/in/robinsadeghpour</span>
      </div>
    </div>
  </div>`;
    }

    // Regular content slide
    return `
  <div class="${slideClass}">
    <div class="slide__content">
      <div class="slide__slide-number">${String(i + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}</div>
      <h2 class="slide__title">${titleHtml}</h2>
      <p class="slide__body">${bodyHtml}</p>
    </div>
  </div>`;
  }).join('\n');

  // If the template has a proper structure, inject slides before </body>
  // Otherwise, build a complete standalone HTML document
  if (templateHtml.includes('</body>')) {
    return templateHtml.replace(
      '</body>',
      `<div class="slides-container">${slideDivs}\n</div>\n</body>`
    );
  }

  // Build complete HTML using the template's <style> block + injected slides
  // Extract <style> content from the template if available
  const styleMatch = templateHtml.match(/<style>([\s\S]*?)<\/style>/i);
  const customStyle = styleMatch ? styleMatch[1] : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LinkedIn Carousel — ${escapeHtml(ideaTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    /* Brand Tokens */
    :root {
      --color-primary:  ${BRAND_COLORS.primary};
      --color-accent:   ${BRAND_COLORS.accent};
      --color-bg:       ${BRAND_COLORS.bg};
      --color-text:     ${BRAND_COLORS.text};
      --color-muted:    ${BRAND_COLORS.muted};
      --font-serif:     'Cormorant Garamond', Georgia, serif;
      --font-mono:      'JetBrains Mono', 'Courier New', monospace;
      --font-sans:      'Outfit', system-ui, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #e8e8e8;
      font-family: var(--font-sans);
    }

    .slides-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 24px;
    }

    .slide {
      width: 1080px;
      height: 1080px;
      background: var(--color-bg);
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 80px;
    }

    .slide--cover {
      background: var(--color-primary);
      color: white;
    }

    .slide--cta {
      background: var(--color-accent);
      color: var(--color-primary);
    }

    .slide__cover-content,
    .slide__content {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 24px;
    }

    .slide__label {
      font-family: var(--font-mono);
      font-size: 18px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      opacity: 0.6;
    }

    .slide__title {
      font-family: var(--font-serif);
      font-size: 72px;
      font-weight: 500;
      line-height: 1.1;
      color: inherit;
    }

    .slide--cover .slide__title {
      color: white;
    }

    .slide__subtitle,
    .slide__body {
      font-family: var(--font-sans);
      font-size: 28px;
      font-weight: 300;
      line-height: 1.6;
      opacity: 0.85;
    }

    .slide__slide-number {
      font-family: var(--font-mono);
      font-size: 16px;
      letter-spacing: 0.1em;
      opacity: 0.4;
    }

    .slide__cta-footer {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .slide__author {
      font-family: var(--font-serif);
      font-size: 32px;
      font-weight: 600;
    }

    .slide__platform {
      font-family: var(--font-mono);
      font-size: 16px;
      opacity: 0.6;
    }

    ${customStyle}
  </style>
</head>
<body>
  <div class="slides-container">
    ${slideDivs}
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Gemini infographic generation (LINK-03, D-08)
// ---------------------------------------------------------------------------

const GEMINI_MODEL   = 'gemini-2.5-flash-image';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 60000;

/**
 * Generate a portrait infographic image (1080x1350) via Gemini API.
 * Implements the Nano Banana direct API pattern from .claude/skills/nano-banana/SKILL.md.
 *
 * @param {string} prompt - Infographic generation prompt
 * @param {string} outPath - Absolute output path for the generated PNG
 * @returns {Promise<void>}
 */
async function generateInfographic(prompt, outPath) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set in .env — cannot generate infographic');
  }

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
  };

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(no body)');
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  const candidates = result && result.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('Gemini response missing candidates');
  }
  const parts = candidates[0] && candidates[0].content && candidates[0].content.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('Gemini response missing content parts');
  }

  const imagePart = parts.find(p => p.inlineData && p.inlineData.data);
  if (!imagePart) {
    throw new Error('Gemini response has no inlineData image part');
  }

  const base64Data = imagePart.inlineData.data;
  if (typeof base64Data !== 'string' || base64Data.length === 0) {
    throw new Error('Gemini inlineData is not a valid base64 string');
  }

  // GEMINI_API_KEY is never included in the written file (T-03-06)
  const imageBuffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(outPath, imageBuffer);
}

// ---------------------------------------------------------------------------
// Format handlers
// ---------------------------------------------------------------------------

/**
 * carousel format (LINK-01, D-07):
 * Reads slide-template.html, injects slide content, invokes Playwright via
 * notebooklm venv Python to screenshot each .slide element.
 * Returns structured JSON for the orchestrator.
 *
 * @param {object} idea
 * @param {string} outDir
 * @param {string|null} slideTextsFilePath - optional pre-generated slide texts JSON
 * @param {string|null} postTextFilePath   - optional post text file
 * @returns {object} result
 */
async function handleCarousel(idea, outDir, slideTextsFilePath, postTextFilePath) {
  // Read the branded slide template
  let templateHtml = '';
  try {
    templateHtml = fs.readFileSync(SLIDE_TEMPLATE_PATH, 'utf-8');
  } catch (err) {
    console.warn(`[warn] Could not read slide-template.html (${err.message}); using built-in template`);
  }

  // Determine slides — provided by orchestrator or skeleton
  let slides;
  if (slideTextsFilePath) {
    const raw = JSON.parse(fs.readFileSync(slideTextsFilePath, 'utf-8'));
    slides = Array.isArray(raw) ? raw : raw.slides || [];
  } else {
    // Skeleton — orchestrator fills in actual content
    slides = [
      { title: idea.title || 'Untitled', body: idea.summary || '', slide_number: 1 },
      { title: 'Key Insight', body: '[Orchestrator: add key insight here]', slide_number: 2 },
      { title: 'What This Means', body: '[Orchestrator: add implications here]', slide_number: 3 },
      { title: 'Follow for More', body: 'Robin Sadeghpour — AI & Automation', slide_number: 4 }
    ];
  }

  const carouselHtml = buildCarouselHtml(templateHtml, slides, idea.title || 'LinkedIn Carousel');

  // Construct HTML output path from sanitised idea ID (T-03-07)
  const safeId = sanitiseId(String(idea.id || 'unknown'));
  const htmlFilename = `linkedin-carousel-${safeId}.html`;
  const htmlPath = path.join(outDir, htmlFilename);

  fs.writeFileSync(htmlPath, carouselHtml, 'utf-8');

  // Invoke Playwright via notebooklm venv (MUST use venv — Pitfall 3)
  const slidesSubdir = path.join(outDir, 'slides');
  fs.mkdirSync(slidesSubdir, { recursive: true });

  const playwrightResult = spawnSync(
    PLAYWRIGHT_PYTHON,
    [SCREENSHOT_SCRIPT_PATH, htmlPath, slidesSubdir],
    { stdio: 'inherit', timeout: 60000 }
  );

  if (playwrightResult.error) {
    console.warn(`[warn] Playwright screenshot error: ${playwrightResult.error.message}`);
  } else if (playwrightResult.status !== 0) {
    console.warn(`[warn] screenshot-slides.py exited with status ${playwrightResult.status}`);
  }

  // Locate generated PDF (screenshot-slides.py writes it one level up from slides/)
  const pdfPath = path.join(outDir, 'linkedin-carousel.pdf');

  // Determine post text
  let postText = '';
  if (postTextFilePath) {
    postText = fs.readFileSync(postTextFilePath, 'utf-8').trim();
  } else {
    postText = `[Orchestrator: generate LinkedIn post text for "${escapeHtml(idea.title || '')}"]`;
  }

  return {
    format: 'carousel',
    post_text: postText,
    html_path: htmlPath,
    pdf_path: pdfPath,
    slides_dir: slidesSubdir,
    slide_count: slides.length
  };
}

/**
 * text format (LINK-02):
 * Produces a structured LinkedIn text post skeleton.
 * Actual post text may be provided by the orchestrator via --post-text.
 *
 * @param {object} idea
 * @param {string|null} postTextFilePath
 * @returns {object} result
 */
async function handleText(idea, postTextFilePath) {
  let postText;

  if (postTextFilePath) {
    postText = fs.readFileSync(postTextFilePath, 'utf-8').trim();
  } else {
    // Skeleton — voice application by orchestrator (per D-06 / Plan 03)
    postText = [
      `[Hook: ${idea.title || 'compelling opening statement'}]`,
      '',
      '[Body paragraph 1: core insight from idea summary]',
      '',
      '[Body paragraph 2: supporting point or example]',
      '',
      '[Soft CTA: invite reflection or ask for experience]'
    ].join('\n');
  }

  return {
    format: 'text',
    post_text: postText
  };
}

/**
 * infographic format (LINK-03, D-08):
 * Extracts data points from the idea, calls Gemini API to generate a
 * portrait infographic (1080x1350), and returns image path + post text.
 *
 * @param {object} idea
 * @param {string} outDir
 * @param {string|null} postTextFilePath
 * @returns {Promise<object>} result
 */
async function handleInfographic(idea, outDir, postTextFilePath) {
  // Extract data points / key numbers from summary and transcript
  const combinedText = `${idea.summary || ''}\n${idea.transcript || ''}`;
  const numberMatches = combinedText.match(/[\d,]+\.?\d*\s?(%|x|k|M|B|\$|€)?/g) || [];
  const dataPoints = numberMatches.slice(0, 5).map(n => n.trim()).filter(Boolean);

  // Compose infographic prompt
  const topicDescription = escapeHtml(idea.title || 'AI & Tech insight');
  const dataPointsText   = dataPoints.length > 0
    ? `Key data points to highlight: ${dataPoints.join(', ')}.`
    : 'Focus on the key insight in visual format.';

  const prompt = [
    `Create a clean, modern professional LinkedIn infographic in portrait orientation (1080x1350 pixels).`,
    `Topic: ${idea.title || 'AI & Tech insight'}.`,
    dataPointsText,
    `Design requirements:`,
    `- Background: ${BRAND_COLORS.bg} (off-white, #FAFAF8)`,
    `- Primary text color: ${BRAND_COLORS.text} (#1A1A1A)`,
    `- Accent color for highlights and data callouts: ${BRAND_COLORS.accent} (#C8A96E, warm gold)`,
    `- Clean sans-serif typography, no decorative elements`,
    `- Bold data callout boxes with the key numbers prominent`,
    `- Author attribution: "Robin Sadeghpour" at the bottom in small text`,
    `- No logos, watermarks, or stock imagery`,
    `- Professional but not corporate — human and direct`,
    `Content to visualise: ${(idea.summary || '').slice(0, 400)}`
  ].join(' ');

  const imagePath = path.join(outDir, 'infographic.png');

  try {
    await generateInfographic(prompt, imagePath);
  } catch (err) {
    console.warn(`[warn] Infographic generation failed: ${err.message}`);
    // Return result without image so orchestrator can handle gracefully
    return {
      format: 'infographic',
      post_text: postTextFilePath
        ? fs.readFileSync(postTextFilePath, 'utf-8').trim()
        : `[Orchestrator: generate LinkedIn post text for "${idea.title || ''}"]`,
      image_path: null,
      data_points: dataPoints,
      error: err.message
    };
  }

  let postText;
  if (postTextFilePath) {
    postText = fs.readFileSync(postTextFilePath, 'utf-8').trim();
  } else {
    postText = [
      `[Hook: news or data reaction opening for "${idea.title || ''}"]`,
      '',
      '[Body: key insight + what the numbers mean]',
      '',
      '[Soft CTA: invite reflection or discussion]'
    ].join('\n');
  }

  return {
    format: 'infographic',
    post_text: postText,
    image_path: imagePath,
    data_points: dataPoints
  };
}

/**
 * personal format (LINK-04):
 * Generates a polished personal LinkedIn post in first-person reflective tone.
 * No visual pipeline by default; image_optional = true for orchestrator to decide.
 *
 * @param {object} idea
 * @param {string|null} postTextFilePath
 * @returns {object} result
 */
async function handlePersonal(idea, postTextFilePath) {
  let postText;

  if (postTextFilePath) {
    postText = fs.readFileSync(postTextFilePath, 'utf-8').trim();
  } else {
    // First-person skeleton — voice + story application by orchestrator
    postText = [
      `[Hook: personal statement or specific event — "I [action/decision]"]`,
      '',
      `[The context: what was happening, what was the situation]`,
      '',
      `[The turn: what I learned, what changed, the insight]`,
      '',
      `[Reflective close: soft CTA — "Would love to hear..." or "Happy building"]`
    ].join('\n');
  }

  return {
    format: 'personal',
    post_text: postText,
    image_optional: true
  };
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

(async () => {
  // Load and validate idea JSON
  let idea;
  try {
    idea = JSON.parse(fs.readFileSync(ideaJsonPath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to read idea JSON at ${ideaJsonPath}: ${err.message}`);
    process.exit(1);
  }

  if (!idea || typeof idea !== 'object') {
    console.error('idea-json must be a JSON object');
    process.exit(1);
  }

  // Create output directory (T-03-07: use path.join, not concatenation)
  fs.mkdirSync(outputDir, { recursive: true });

  // Determine format — explicit arg takes precedence over auto-suggestion (D-06)
  const validFormats = ['carousel', 'text', 'infographic', 'personal'];
  let format;

  if (formatArg) {
    if (!validFormats.includes(formatArg)) {
      console.error(`Invalid format "${formatArg}". Must be one of: ${validFormats.join(', ')}`);
      process.exit(1);
    }
    format = formatArg;
  } else {
    format = suggestFormat(idea);
    console.error(`[info] Format auto-suggested: ${format} (use --format to override)`);
  }

  // Route to the appropriate format handler
  let result;
  switch (format) {
    case 'carousel':
      result = await handleCarousel(idea, outputDir, slideTextsPath, postTextPath);
      break;
    case 'text':
      result = await handleText(idea, postTextPath);
      break;
    case 'infographic':
      result = await handleInfographic(idea, outputDir, postTextPath);
      break;
    case 'personal':
      result = await handlePersonal(idea, postTextPath);
      break;
    default:
      console.error(`Unknown format: ${format}`);
      process.exit(1);
  }

  // Attach common metadata
  result.idea_id       = idea.id     || null;
  result.idea_title    = idea.title  || '';
  result.source_type   = idea.source_type || '';
  result.format_was_suggested = !formatArg;

  // Write linkedin-result.json to output directory
  const resultPath = path.join(outputDir, 'linkedin-result.json');
  // GEMINI_API_KEY is never written to output files (T-03-06)
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');

  // Print to stdout for orchestrator consumption
  console.log(JSON.stringify(result));
})().catch(err => {
  console.error('generate-linkedin-content error:', err.message);
  process.exit(1);
});
